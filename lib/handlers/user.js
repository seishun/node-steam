var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var EResult = Steam.EResult;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

var servers = require('../servers');

prototype.logOn = function(username, password, steamGuard) {
  this._username = username;
  this._password = password;
  this._steamGuard = steamGuard;
  
  var server = servers[Math.floor(Math.random() * servers.length)];
  this._connection.connect(server);
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientLogOnResponse] = function(data) {
  var logonResp = schema.CMsgClientLogonResponse.parse(data);
  
  if (logonResp.eresult == EResult.OK) {
    var hbDelay = logonResp.outOfGameHeartbeatSeconds;
    
    clearInterval(this._heartBeatFunc);
    this._heartBeatFunc = setInterval(function() {
      this._send(EMsg.ClientHeartBeat, schema.CMsgClientHeartBeat.serialize({}));
    }.bind(this), hbDelay * 1000);
    
    this.emit('loggedOn');
    return;
  }
  
  if (logonResp.eresult == EResult.TryAnotherCM || logonResp.eresult == EResult.ServiceUnavailable && this._sessionID) {
    this.emit('debug', 'reconnecting due to ' + (logonResp.eresult == EResult.TryAnotherCM ? 'TryAnotherCM' : 'ServiceUnavailable'));
    this.logOn(this._username, this._password, this._steamGuard); // retry
    return;
  }
  
  switch (logonResp.eresult) {
    case EResult.InvalidPassword:
      this.emit('error', new Error('Invalid password'));
      break;
    
    case EResult.ServiceUnavailable:
      this.emit('error', new Error('Steam is down'));
      break;
    
    case EResult.AccountLogonDenied:
      this.emit('error', new Error('SteamGuard'));
      break;
    
    default:
      this.emit('error', new Error('Logon fail: ' + logonResp.eresult));
  }
};

handlers[EMsg.ClientNewLoginKey] = function(data) {
  var loginKey = schema.CMsgClientNewLoginKey.parse(data);
  
  this._send(EMsg.ClientNewLoginKeyAccepted | protoMask, schema.CMsgClientNewLoginKeyAccepted.serialize({
    uniqueId: loginKey.uniqueId
  }));
  
  // yes, number -> string -> ASCII bytes -> base64
  this._webSessionID = new Buffer(loginKey.uniqueId.toString()).toString('base64');
  
  this._send(EMsg.ClientRequestWebAPIAuthenticateUserNonce | protoMask, schema.CMsgClientRequestWebAPIAuthenticateUserNonce.serialize({}));
};

handlers[EMsg.ClientRequestWebAPIAuthenticateUserNonceResponse] = function(data) {
  var nonce = schema.CMsgClientRequestWebAPIAuthenticateUserNonceResponse.parse(data);
  
  var sessionKey = require('crypto').randomBytes(32);
  var cryptedSessionKey = require('ursa').createPublicKey(require('fs').readFileSync(__dirname + '/../public.pub')).encrypt(sessionKey);
  var cryptedLoginKey = require('../crypto_helper').symmetricEncrypt(nonce.webapiAuthenticateUserNonce, sessionKey);
  
  var data = 'steamid=' + this.steamID
    + '&sessionkey=' + escape(cryptedSessionKey.toString('binary'))
    + '&encrypted_loginkey=' + escape(cryptedLoginKey.toString('binary'));
  
  var options = {
    hostname: 'api.steampowered.com',
    path: '/ISteamUserAuth/AuthenticateUser/v1',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': data.length
    }
  };
  
  var self = this;
  
  var req = require('http').request(options, function(res) {
    if (res.statusCode == 200) {
      res.on('data', function (chunk) {
        self.emit('webLoggedOn', self._webSessionID, JSON.parse(chunk).authenticateuser.token)
      });
    } else {
      self.emit('debug', 'Web authentication failed, retrying');
      self._send(EMsg.ClientRequestWebAPIAuthenticateUserNonce | protoMask, schema.CMsgClientRequestWebAPIAuthenticateUserNonce.serialize({})); 
    }
  });
  
  req.write(data);
  req.end();
};

handlers[EMsg.ClientLoggedOff] = function(data) {
  clearInterval(this._heartBeatFunc);
  
  var loggedOff = schema.CMsgClientLoggedOff.parse(data);
  
  if (loggedOff.eresult == EResult.ServiceUnavailable) {
    this.logOn(this._username, this._password, this._steamGuard); // retry
  }
  this.emit('loggedOff', loggedOff.eresult);
};

handlers[EMsg.ClientUpdateMachineAuth] = function(data, jobID) {
  var sha = require('crypto').createHash('sha1');
  sha.update(schema.CMsgClientUpdateMachineAuth.parse(data).bytes);
  sha = new Buffer(sha.digest(), 'binary');
  
  this._send(EMsg.ClientUpdateMachineAuthResponse | protoMask, schema.CMsgClientUpdateMachineAuthResponse.serialize({
    shaFile: sha
  }), jobID);
  this.emit('sentry', sha);
};
