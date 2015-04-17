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

prototype.getServerList = function(filter, limit, callback) {
  this._sendUnified("GameServers.GetServerList#1", new schema.CGameServers_GetServerList_Request({"filter": filter, "limit": limit}), false, function(msgName, body) {
    callback(schema.CGameServers_GetServerList_Response.decode(body).servers || []);
  });
};

prototype.getServerSteamIDsByIP = function(ips, callback) {
  this._sendUnified("GameServers.GetServerSteamIDsByIP#1", new schema.CGameServers_GetServerSteamIDsByIP_Request({"serverIps": ips}), false, function(msgName, body) {
    var data = schema.CGameServers_IPsWithSteamIDs_Response.decode(body);
    var servers = {};
    (data.servers || []).forEach(function(server) {
      servers[server.addr] = server.steamid;
    });
    
    callback(servers);
  });
};

prototype.getServerIPsBySteamID = function(steamids, callback) {
  this._sendUnified("GameServers.GetServerIPsBySteamID#1", new schema.CGameServers_GetServerIPsBySteamID_Request({"serverSteamids": steamids}), false, function(msgName, body) {
    var data = schema.CGameServers_IPsWithSteamIDs_Response.decode(body);
    var servers = {};
    (data.servers || []).forEach(function(server) {
      servers[server.steamid] = server.addr;
    });
    
    callback(servers);
  });
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
