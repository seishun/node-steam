var EventEmitter = require('events').EventEmitter;
var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var EResult = Steam.EResult;
var schema = Steam.Internal;


Steam.SteamUser = function(steamClient) {
  this._client = steamClient;
  this._client.on('message', function(header, body, callback) {
    if (header.msg in handlers) {
      handlers[header.msg].call(this, body, callback);
    }
  }.bind(this));
};

require('util').inherits(Steam.SteamUser, EventEmitter);


// Methods

var prototype = Steam.SteamUser.prototype;

Steam.servers = require('../servers');

prototype.logOn = function(logOnDetails) {
  // construct temporary SteamID
  this._client.steamID = new (require('../steamID'))({
    accountInstance: 1,
    accountUniverse: Steam.EUniverse.Public,
    accountType: Steam.EAccountType.Individual
  }).toString();
  
  logOnDetails.protocolVersion = 65575;
  this._client.send({ msg: EMsg.ClientLogon, proto: {} }, new schema.CMsgClientLogon(logOnDetails));
};

prototype.logOff = function() {
  // do we need a method to send an actual logoff message?
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
      self._client.send({
        msg: EMsg.ClientRequestWebAPIAuthenticateUserNonce,
        proto: {}
      }, new schema.CMsgClientRequestWebAPIAuthenticateUserNonce(), function(header, body) {
        var nonce = schema.CMsgClientRequestWebAPIAuthenticateUserNonceResponse.decode(body);
        self._webLoginKey = nonce.webapiAuthenticateUserNonce;
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
  this._client.send({ msg: EMsg.ClientGamesPlayed, proto: {} }, new schema.CMsgClientGamesPlayed({
    gamesPlayed: appIDs.map(function(appID) {
      return {
        gameId: appID
      };
    })
  }));
};


// Handlers

var handlers = {};

handlers[EMsg.ClientLogOnResponse] = function(data) {
  // literally the only reason to handle this here is to save webapiAuthenticateUserNonce. I don't like.
  var logonResp = schema.CMsgClientLogonResponse.decode(data);
  var eresult = logonResp.eresult;
  
  if (eresult == EResult.OK)
    this._webLoginKey = logonResp.webapiAuthenticateUserNonce;
};

handlers[EMsg.ClientNewLoginKey] = function(data) {
  // TODO: remove this, session ID is useless
  var loginKey = schema.CMsgClientNewLoginKey.decode(data);
  
  this._client.send({ msg: EMsg.ClientNewLoginKeyAccepted, proto: {} }, new schema.CMsgClientNewLoginKeyAccepted({
    uniqueId: loginKey.uniqueId
  }));
  
  // yes, number -> string -> ASCII bytes -> base64
  this._webSessionID = new Buffer(loginKey.uniqueId.toString()).toString('base64');
  
  this.emit('webSessionID', this._webSessionID);
};

handlers[EMsg.ClientUpdateMachineAuth] = function(data, callback) {
  var sha = require('crypto').createHash('sha1');
  sha.update(schema.CMsgClientUpdateMachineAuth.decode(data).bytes.toBuffer());
  sha = new Buffer(sha.digest(), 'binary');
  
  callback({ msg: EMsg.ClientUpdateMachineAuthResponse, proto: {} }, new schema.CMsgClientUpdateMachineAuthResponse({
    shaFile: sha
  }));
  // TODO: pass whole sentry
  this.emit('sentry', sha);
};

handlers[EMsg.ClientUserNotifications] = function(data) {
  var notifications = schema.CMsgClientUserNotifications.decode(data).notifications;
  this.emit('tradeOffers', notifications.length ? notifications[0].count : 0); // assuming length == 1 and userNotificationType == 1
};
