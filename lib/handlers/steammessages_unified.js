var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

prototype._sendUnified = function(methodName, serializedMethod, isNotification, callback) {
  this._send(EMsg.ClientServiceMethod | protoMask, new schema.CMsgClientServiceMethod({
    methodName: methodName,
    serializedMethod: serializedMethod.toBuffer(),
    isNotification: isNotification
  }), callback);
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientServiceMethodResponse] = function(data, callback) {
  var msg = schema.CMsgClientServiceMethodResponse.decode(data);
  callback(msg.methodName, msg.serializedMethodResponse);
};
