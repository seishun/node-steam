var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var EResult = Steam.EResult;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

prototype.getNumberOfCurrentPlayers = function(appID, callback) {
  var buf = new Buffer(8);
  buf.writeUInt64LE(appID, 0);
  
  this._send(EMsg.ClientGetNumberOfCurrentPlayers, buf, callback);
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientGetNumberOfCurrentPlayersResponse] = function(data, callback) {
  var result = data.readUInt32LE(0);
  var players = data.readUInt32LE(4);
  
  callback(result, players);
};