var ByteBuffer = require('bytebuffer');
var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var EResult = Steam.EResult;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

prototype.getNumberOfCurrentPlayers = function(appID, callback) {
  var buf = new ByteBuffer(8, ByteBuffer.LITTLE_ENDIAN);
  buf.writeUint64(appID).flip();
  
  this._send(EMsg.ClientGetNumberOfCurrentPlayers, buf, callback);
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientGetNumberOfCurrentPlayersResponse] = function(data, callback) {
  var result = data.readUint32();
  var players = data.readUint32();
  
  callback(result, players);
};