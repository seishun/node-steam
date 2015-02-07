var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var EResult = Steam.EResult;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

Steam.servers = require('../servers');

prototype.logOn = function(logOnDetails) {
  this.logOff();
  
  this._logOnDetails = logOnDetails;
  
  this._jobs = {};
  this._currentJobID = 0;
  
  // construct temporary SteamID
  this.steamID = new (require('../steamID'))({
    accountInstance: 1,
    accountUniverse: Steam.EUniverse.Public,
    accountType: Steam.EAccountType.Individual
  }).toString();
  
  this._sessionID = 0;
  
  var server = Steam.servers[Math.floor(Math.random() * Steam.servers.length)];
  this.emit('debug', 'connecting to ' + server.host + ':' + server.port);
  
  this._connection = new (require('../connection'))();
  this._connection.on('packet', this._netMsgReceived.bind(this));
  this._connection.on('close', this._disconnected.bind(this));
  
  var self = this;
  
  this._connection.on('error', function(err) {
    // it's ok, we'll reconnect after 'close'
    self.emit('debug', 'socket error: ' + err);
  });
  
  this._connection.on('connect', function() {
    self.emit('debug', 'connected');
    delete self._timeout;
  });
  
  this._connection.on('end', function() {
    self.emit('debug', 'socket ended');
  });
  
  this._connection.setTimeout(1000, function() {
    self.emit('debug', 'socket timed out');
    self._connection.destroy();
  });
  
  this._connection.connect(server.port, server.host);
};

prototype.logOff = function() {
  if (this._connection) {
    this._connection.destroy();
    this._connection.removeAllListeners();
    if (this.loggedOn) {
      this.loggedOn = false;
      clearInterval(this._heartBeatFunc);
    }
  } else if (this._scheduledConnection) {
    // there was an error and we're currently waiting
    clearTimeout(this._scheduledConnection);
    delete this._scheduledConnection;
  }
};

prototype.webLogOn = function(callback) {
  var sessionKey = require('crypto').randomBytes(32);
  var cryptedSessionKey = require('crypto').publicEncrypt(require('fs').readFileSync(__dirname + '/../public.pub'), sessionKey);
  var cryptedLoginKey = require('../crypto_helper').symmetricEncrypt(this._webLoginKey, sessionKey);
  
  var data = 'steamid=' + this.steamID
    + '&sessionkey=' + cryptedSessionKey.toString('hex').replace(/../g, '%$&')
    + '&encrypted_loginkey=' + cryptedLoginKey.toString('hex').replace(/../g, '%$&');
  
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
  
  var req = require('https').request(options, function(res) {
    if (res.statusCode == 200) {
      res.on('data', function(chunk) {
        var response = JSON.parse(chunk);
        callback([
          'sessionid=' + self._webSessionID,
          'steamLogin=' + response.authenticateuser.token,
          'steamLoginSecure=' + response.authenticateuser.tokensecure
        ]);
      });
    } else {
      self.emit('debug', 'web authentication ' + res.statusCode + ', retrying');
      // request a new login key first
      self._send(EMsg.ClientRequestWebAPIAuthenticateUserNonce | protoMask, new schema.CMsgClientRequestWebAPIAuthenticateUserNonce(), function() {
        self.webLogOn(callback);
      });
      // discard the data
      res.resume();
    }
  });
  
  req.on('error', function(err) {
    self.emit('debug', 'web authentication ' + err + ', retrying');
    self.webLogOn(callback);
  });
  
  req.end(data);
};

prototype.gamesPlayed = function(appIDs) {
  this._send(EMsg.ClientGamesPlayed | protoMask, new schema.CMsgClientGamesPlayed({
    gamesPlayed: appIDs.map(function(appID) {
      return {
        gameId: appID
      };
    })
  }));
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientLogOnResponse] = function(data) {
  var logonResp = schema.CMsgClientLogonResponse.decode(data);
  var eresult = logonResp.eresult;
  
  if (eresult == EResult.OK) {
    var hbDelay = logonResp.outOfGameHeartbeatSeconds;
    
    this._heartBeatFunc = setInterval(function() {
      this._send(EMsg.ClientHeartBeat, new schema.CMsgClientHeartBeat());
    }.bind(this), hbDelay * 1000);
    
    this._webLoginKey = logonResp.webapiAuthenticateUserNonce;
    
    this.chatRooms = {};
    this.friends = {};
    this.groups = {};
    this.users = {};
    
    this.loggedOn = true;
    this.emit('loggedOn');
    return;
  }
  
  this.emit('debug', 'logon fail: ' + eresult + ', sessionID: ' + this._sessionID);
  
  if (~[EResult.Fail, EResult.ServiceUnavailable, EResult.TryAnotherCM].indexOf(eresult)) {
    // probably not our fault, wait for 'close' and reconnect
    return;
  }
  
  // it's something serious - prevent reconnect and make sure the user knows
  this._connection.removeAllListeners();
  delete this._connection;
  
  var e = new Error('Logon fail: ' + eresult);
  e.cause = 'logonFail';
  e.eresult = eresult;
  this.emit('error', e);
};

handlers[EMsg.ClientNewLoginKey] = function(data) {
  var loginKey = schema.CMsgClientNewLoginKey.decode(data);
  
  this._send(EMsg.ClientNewLoginKeyAccepted | protoMask, new schema.CMsgClientNewLoginKeyAccepted({
    uniqueId: loginKey.uniqueId
  }));
  
  // yes, number -> string -> ASCII bytes -> base64
  this._webSessionID = new Buffer(loginKey.uniqueId.toString()).toString('base64');
  
  this.emit('webSessionID', this._webSessionID);
};

handlers[EMsg.ClientRequestWebAPIAuthenticateUserNonceResponse] = function(data, callback) {
  var nonce = schema.CMsgClientRequestWebAPIAuthenticateUserNonceResponse.decode(data);
  this._webLoginKey = nonce.webapiAuthenticateUserNonce;
  callback();
};

handlers[EMsg.ClientLoggedOff] = function(data) {  
  this.loggedOn = false;
  clearInterval(this._heartBeatFunc);
  
  var eresult = schema.CMsgClientLoggedOff.decode(data).eresult;
  
  if (eresult == EResult.ServiceUnavailable) {
    // let it reconnect
    this.emit('loggedOff');
  } else {
    // it's something serious - prevent reconnect and make sure the user knows
    this._connection.removeAllListeners();
    delete this._connection;
    
    var e = new Error('Logged off: ' + eresult);
    e.cause = 'loggedOff';
    e.eresult = eresult;
    this.emit('error', e);
  }
};

handlers[EMsg.ClientUpdateMachineAuth] = function(data, jobID) {
  var sha = require('crypto').createHash('sha1');
  sha.update(schema.CMsgClientUpdateMachineAuth.decode(data).bytes.toBuffer());
  sha = new Buffer(sha.digest(), 'binary');
  
  this._send(EMsg.ClientUpdateMachineAuthResponse | protoMask, new schema.CMsgClientUpdateMachineAuthResponse({
    shaFile: sha
  }), jobID);
  this.emit('sentry', sha);
};

handlers[EMsg.ClientUserNotifications] = function(data) {
  var notifications = schema.CMsgClientUserNotifications.decode(data).notifications;
  this.emit('tradeOffers', notifications.length ? notifications[0].count : 0); // assuming length == 1 and userNotificationType == 1
};
