var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var EResult = Steam.EResult;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

Steam.servers = require('../servers');

prototype.logOn = function(username, password, hash, code) {
  this._username = username;
  this._password = password;

  if (!code && !Buffer.isBuffer(hash)) {
    code = hash;
    hash = undefined;
  }
  this._hash = hash;
  this._code = code;

  this._send(EMsg.ClientLogon | protoMask, schema.CMsgClientLogon.serialize({
    accountName: this._username,
    password: this._password,
    protocolVersion: 65575,

    authCode: this._code,
    shaSentryfile: this._hash
  }));
};

prototype.webLogOn = function(callback) {
  var sessionKey = require('crypto').randomBytes(32);
  var cryptedSessionKey = require('ursa').createPublicKey(require('fs').readFileSync(__dirname + '/../public.pub')).encrypt(sessionKey);
  var cryptedLoginKey = require('../crypto_helper').symmetricEncrypt(this._webLoginKey, sessionKey);

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
      self._send(EMsg.ClientRequestWebAPIAuthenticateUserNonce | protoMask, schema.CMsgClientRequestWebAPIAuthenticateUserNonce.serialize({}), function() {
        self.webLogOn(callback);
      });
    }
  }).end(data);
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientLogOnResponse] = function(data) {
  if(!data._isProto) {
    this.emit('debug', 'Got non-proto logon response, this is indicative of no logon attempt after connecting.');
    return;
  }

  var logonResp = schema.CMsgClientLogonResponse.parse(data);
  var eresult = logonResp.eresult;

  if (eresult == EResult.OK) {
    var header = data._header;

    this._sessionID = header.proto.clientSessionid;
    this.steamID = header.proto.steamid;

    var hbDelay = logonResp.outOfGameHeartbeatSeconds;

    clearTimeout(this._heartBeatFunc);
    this._heartBeatFunc = setInterval(function() {
      this._send(EMsg.ClientHeartBeat, schema.CMsgClientHeartBeat.serialize({}));
    }.bind(this), hbDelay * 1000);

  }

  this.emit('loggedOn', eresult);
};

handlers[EMsg.ClientNewLoginKey] = function(data) {
  var loginKey = schema.CMsgClientNewLoginKey.parse(data);

  this._send(EMsg.ClientNewLoginKeyAccepted | protoMask, schema.CMsgClientNewLoginKeyAccepted.serialize({
    uniqueId: loginKey.uniqueId
  }));

  this._webLoginKey = loginKey.loginKey;
  // yes, number -> string -> ASCII bytes -> base64
  this._webSessionID = new Buffer(loginKey.uniqueId.toString()).toString('base64');

  this.emit('webSessionID', this._webSessionID);
};

handlers[EMsg.ClientRequestWebAPIAuthenticateUserNonceResponse] = function(data, callback) {
  var nonce = schema.CMsgClientRequestWebAPIAuthenticateUserNonceResponse.parse(data);
  this._webLoginKey = nonce.webapiAuthenticateUserNonce;
  callback();
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
