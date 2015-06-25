var EventEmitter = require('events').EventEmitter;
var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var EResult = Steam.EResult;
var schema = Steam.Internal;

module.exports = SteamUser;

function SteamUser(steamClient) {
  this._client = steamClient;
  this._client.on('message', function(header, body, callback) {
    if (header.msg in handlers) {
      handlers[header.msg].call(this, body, callback);
    }
  }.bind(this));
}

require('util').inherits(SteamUser, EventEmitter);


// Methods

var prototype = SteamUser.prototype;

Steam.servers = require('../servers');

prototype.logOn = function(logOnDetails) {
  // construct temporary SteamID
  this._client.steamID = new (require('../steamID'))({
    accountInstance: 1,
    accountUniverse: Steam.EUniverse.Public,
    accountType: Steam.EAccountType.Individual
  }).toString();
  
  logOnDetails.protocol_version = 65575;
  this._client.send({ msg: EMsg.ClientLogon, proto: {} }, new schema.CMsgClientLogon(logOnDetails));
};

prototype.logOff = function() {
  // do we need a method to send an actual logoff message?
};

prototype.requestWebAPIAuthenticateUserNonce = function(callback) {
  this._client.send({
    msg: EMsg.ClientRequestWebAPIAuthenticateUserNonce,
    proto: {}
  }, new schema.CMsgClientRequestWebAPIAuthenticateUserNonce(), function(header, body) {
    callback(schema.CMsgClientRequestWebAPIAuthenticateUserNonceResponse.decode(body));
  });
};

prototype.gamesPlayed = function(gamesPlayed) {
  this._client.send({
    msg: EMsg.ClientGamesPlayed,
    proto: {}
  }, new schema.CMsgClientGamesPlayed(gamesPlayed));
};


// Handlers

var handlers = {};

handlers[EMsg.ClientUpdateMachineAuth] = function(data, callback) {
  var sha = require('crypto').createHash('sha1');
  sha.update(schema.CMsgClientUpdateMachineAuth.decode(data).bytes.toBuffer());
  sha = new Buffer(sha.digest(), 'binary');
  
  callback({ msg: EMsg.ClientUpdateMachineAuthResponse, proto: {} }, new schema.CMsgClientUpdateMachineAuthResponse({
    sha_file: sha
  }));
  // TODO: pass whole sentry
  this.emit('sentry', sha);
};

handlers[EMsg.ClientUserNotifications] = function(data) {
  var notifications = schema.CMsgClientUserNotifications.decode(data).notifications;
  this.emit('tradeOffers', notifications.length ? notifications[0].count : 0); // assuming length == 1 and userNotificationType == 1
};
