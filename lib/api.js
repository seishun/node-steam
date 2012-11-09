var Steam = require('./steam_client');

var EMsg = Steam.EMsg;
var EChatEntryType = Steam.EChatEntryType;
var prototype = Steam.SteamClient.prototype;

var servers = require('./servers');

var protoMask = 0x80000000;


//prototype.connect = function() {
//  this.disconnect();
//  var server = servers[Math.floor(Math.random() * servers.length)];
//  this._connection.connect(server);
//};
//
//prototype.disconnect = function() {
//  clearInterval(this._heartBeatFunc);
//  this._connection.disconnect();
//};

prototype.steamID = function() {
  return this._steamID;
};

prototype.logOn = function(username, password, authCode) {
  this._username = username;
  this._password = password;
  this._authCode = authCode;
  
  var server = servers[Math.floor(Math.random() * servers.length)];
  this._connection.connect(server);
};

prototype.setPersonaName = function(name) {
  this._send(EMsg.ClientChangeStatus | protoMask, Steam.Internal.CMsgClientChangeStatus.serialize({
    playerName: name
  }));
};

prototype.setPersonaState = function(state) {
  this._send(EMsg.ClientChangeStatus | protoMask, Steam.Internal.CMsgClientChangeStatus.serialize({
    personaState: state
  }));
};

prototype.getFriendPersonaName = function(steamId) {
  return this._users[steamId];
};

prototype.sendChatMessage = function(target, message, type) {
  this._send(EMsg.ClientFriendMsg | protoMask, Steam.Internal.CMsgClientFriendMsg.serialize({
    steamid: target,
    message: new Buffer(message),
    chatEntryType: type || EChatEntryType.ChatMsg
  }));
};

prototype.joinChat = function(steamId) {
  var body = Steam.Internal.MsgClientJoinChat.serialize({
    steamIdChat: steamId
  });
  
  // this is ugly, do something
  if (body[6] == 0x70) {
    body[6] = 0x88;
  }
    
  this._send(EMsg.ClientJoinChat, body);
};

prototype.sendChatRoomMessage = function(steamIdChat, message, type) {
  var body = Steam.Internal.MsgClientChatMsg.serialize({
    steamIdChatter: this._steamID,
    steamIdChatRoom: steamIdChat,
    chatMsgType: type || EChatEntryType.ChatMsg
  });
  
  // ugly ugly ugly
  if (body[14] == 0x70) {
    body[14] = 0x88;
  }
    
  // this should be null-terminated but :effort:
  this._send(EMsg.ClientChatMsg, Buffer.concat([body, new Buffer(message)]));
};
