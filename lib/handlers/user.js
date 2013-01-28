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
  
  this._jobs = {};
  this._currentJobID = 0;
  
  var server = servers[Math.floor(Math.random() * servers.length)];
  this.emit('debug', 'connecting to ' + server);
  this._connection.connect(server);
};

prototype.webLogOn = function(callback) {
  this._send(EMsg.ClientRequestWebAPIAuthenticateUserNonce | protoMask, schema.CMsgClientRequestWebAPIAuthenticateUserNonce.serialize({}), callback);
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientLogOnResponse] = function(data) {
  var logonResp = schema.CMsgClientLogonResponse.parse(data);
  var eresult = logonResp.eresult;
  
  if (eresult == EResult.OK) {
    var hbDelay = logonResp.outOfGameHeartbeatSeconds;
    
    this._heartBeatFunc = setInterval(function() {
      this._send(EMsg.ClientHeartBeat, schema.CMsgClientHeartBeat.serialize({}));
    }.bind(this), hbDelay * 1000);
    
    this.emit('loggedOn');
    return;
  }
  
  this.emit('debug', 'logon fail: ' + eresult);
  
  if (this._sessionID) {
    switch (eresult) {
      case EResult.ServiceUnavailable:
      case EResult.TryAnotherCM:
        // let it reconnect in this case
        return;
    }
  }
  
  if (eresult == EResult.TryAnotherCM) {
    // normally we don't try to reconnect if the initial connect fails,
    // but TryAnotherCM is a special case
    this.emit('debug', 'reconnecting due to TryAnotherCM');
    this.logOn(this._username, this._password, this._steamGuard);
    return;
  }
  
  // it's something serious - prevent reconnect and make sure the user knows
  delete this._sessionID;
  
  var e = new Error('Logon fail: ' + eresult);
  e.cause = 'logonFail';
  e.eresult = eresult;
  this.emit('error', e);
};

handlers[EMsg.ClientNewLoginKey] = function(data) {
  var loginKey = schema.CMsgClientNewLoginKey.parse(data);
  
  this._send(EMsg.ClientNewLoginKeyAccepted | protoMask, schema.CMsgClientNewLoginKeyAccepted.serialize({
    uniqueId: loginKey.uniqueId
  }));
  
  // yes, number -> string -> ASCII bytes -> base64
  this._webSessionID = new Buffer(loginKey.uniqueId.toString()).toString('base64');
  
  this.emit('webSessionID', this._webSessionID);
};

handlers[EMsg.ClientRequestWebAPIAuthenticateUserNonceResponse] = function(data, callback) {
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
  
  require('http').request(options, function(res) {
    if (res.statusCode == 200) {
      res.on('data', function (chunk) {
        callback('sessionid=' + self._webSessionID + '; steamLogin=' + JSON.parse(chunk).authenticateuser.token);
      });
    } else {
      self.emit('debug', 'Web authentication failed, retrying');
      self._send(EMsg.ClientRequestWebAPIAuthenticateUserNonce | protoMask, schema.CMsgClientRequestWebAPIAuthenticateUserNonce.serialize({}), callback); 
    }
  }).end(data);
};

handlers[EMsg.ClientLoggedOff] = function(data) {  
  var eresult = schema.CMsgClientLoggedOff.parse(data).eresult;
  
  if (eresult == EResult.ServiceUnavailable) {
    // let it reconnect
    this.emit('loggedOff');
  } else {
    // it's something serious - prevent reconnect and make sure the user knows
    delete this._sessionID;
    
    var e = new Error('Logged off: ' + eresult);
    e.cause = 'loggedOff';
    e.eresult = eresult;
    this.emit('error', e);
  }
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
