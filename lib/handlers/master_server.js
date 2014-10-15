var Steam = require('../steam_client');
var SteamID = require('../steamID');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

prototype.serverQuery = function(conditions, callback) {
  if(typeof conditions === 'string') {
    conditions = {"filterText": conditions};
  }
  
  this._send(EMsg.ClientGMSServerQuery | protoMask, new schema.CMsgClientGMSServerQuery(conditions), callback);
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.GMSClientServerQueryResponse] = function(data, callback) {
  var response = schema.CMsgGMSClientServerQueryResponse.decode(data);
  if(response.error) {
    callback(response.error);
    return;
  }
  
  response.servers = response.servers || [];
  
  response.servers.forEach(function(server) {
    var buf = new Buffer(4);
    buf.writeUInt32BE(server.serverIp, 0);
    server.serverIp = Array.prototype.join.call(buf, '.');
  });
  
  callback(null, response.servers);
};
};
