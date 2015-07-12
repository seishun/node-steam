var EventEmitter = require('events').EventEmitter;
var Steam = require('../../steam_client');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;


function SteamUser(steamClient) {
  this._client = steamClient;
  this._client.on('message', function(header, body, callback) {
    if (header.msg in handlers)
      handlers[header.msg].call(this, body, callback);
  }.bind(this));
}

require('util').inherits(SteamUser, EventEmitter);


// Methods

SteamUser.prototype.logOn = function(logOnDetails) {
  // construct temporary SteamID
  this._client.steamID = new (require('../../steamID'))({
    accountInstance: 1,
    accountUniverse: Steam.EUniverse.Public,
    accountType: Steam.EAccountType.Individual
  }).toString();
  
  logOnDetails.protocol_version = 65575;
  this._client.send({
    msg: EMsg.ClientLogon,
    proto: {}
  }, new schema.CMsgClientLogon(logOnDetails).toBuffer());
};

SteamUser.prototype.requestWebAPIAuthenticateUserNonce = function(callback) {
  this._client.send({
    msg: EMsg.ClientRequestWebAPIAuthenticateUserNonce,
    proto: {}
  }, new schema.CMsgClientRequestWebAPIAuthenticateUserNonce().toBuffer(), function(header, body) {
    var nonce = schema.CMsgClientRequestWebAPIAuthenticateUserNonceResponse.decode(body);
    callback(Steam._processProto(nonce));
  });
};

SteamUser.prototype.gamesPlayed = function(gamesPlayed) {
  this._client.send({
    msg: EMsg.ClientGamesPlayed,
    proto: {}
  }, new schema.CMsgClientGamesPlayed(gamesPlayed).toBuffer());
};


// Handlers

var handlers = {};

handlers[EMsg.ClientUpdateMachineAuth] = function(data, callback) {
  var machineAuth = schema.CMsgClientUpdateMachineAuth.decode(data);
  
  this.emit('updateMachineAuth', Steam._processProto(machineAuth), function(response) {
    callback({
      msg: EMsg.ClientUpdateMachineAuthResponse,
      proto: {}
    }, new schema.CMsgClientUpdateMachineAuthResponse(response).toBuffer());
  });
};

handlers[EMsg.ClientUserNotifications] = function(data) {
  var notifications = schema.CMsgClientUserNotifications.decode(data).notifications;
  this.emit('tradeOffers', notifications.length ? notifications[0].count : 0); // assuming length == 1 and userNotificationType == 1
};


Steam.SteamUser = SteamUser;
