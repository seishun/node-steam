var Steam = require('./steam_client');

var EMsg = Steam.EMsg;
var EChatEntryType = Steam.EChatEntryType;

var prototype = Steam.SteamClient.prototype;
var schema = Steam.Internal;

var protoMask = 0x80000000;
var servers = require('./servers');

prototype.logOn = function(username, password, authCode) {
  this._username = username;
  this._password = password;
  this._authCode = authCode;
  
  var server = servers[Math.floor(Math.random() * servers.length)];
  this._connection.connect(server);
};

prototype.setPersonaName = function(name) {
  this._send(EMsg.ClientChangeStatus | protoMask, schema.CMsgClientChangeStatus.serialize({
    playerName: name
  }));
};

prototype.setPersonaState = function(state) {
  this._send(EMsg.ClientChangeStatus | protoMask, schema.CMsgClientChangeStatus.serialize({
    personaState: state
  }));
};

prototype.getFriendPersonaName = function(steamId) {
  return this._users[steamId];
};

prototype.sendChatMessage = function(target, message, type) {
  this._send(EMsg.ClientFriendMsg | protoMask, schema.CMsgClientFriendMsg.serialize({
    steamid: target,
    message: new Buffer(message),
    chatEntryType: type || EChatEntryType.ChatMsg
  }));
};

prototype.joinChat = function(steamId) {
  var joinChat = schema.MsgClientJoinChat.serialize({
    steamIdChat: steamId
  });
  
  // this is ugly, do something
  if (joinChat[6] == 0x70) {
    joinChat[6] = 0x88;
  }
    
  this._send(EMsg.ClientJoinChat, joinChat);
};

prototype.sendChatRoomMessage = function(steamIdChat, message, type) {
  var chatMsg = schema.MsgClientChatMsg.serialize({
    steamIdChatter: this.steamID,
    steamIdChatRoom: steamIdChat,
    chatMsgType: type || EChatEntryType.ChatMsg
  });
  
  // ugly ugly ugly
  if (chatMsg[14] == 0x70) {
    chatMsg[14] = 0x88;
  }
  
  var body = new Buffer(chatMsg.length + Buffer.byteLength(message) + 1);
  chatMsg.copy(body, 0);
  body.writeCString(message, chatMsg.length);
  
  this._send(EMsg.ClientChatMsg, body);
};

prototype.trade = function(user) {
  this._send(EMsg.EconTrading_InitiateTradeRequest | protoMask, schema.CMsgTrading_InitiateTradeRequest.serialize({
    otherSteamid: user
  }));
};

prototype.respondToTrade = function(tradeId, acceptTrade) {
  this._send(EMsg.EconTrading_InitiateTradeResponse | protoMask, schema.CMsgTrading_InitiateTradeResponse.serialize({
    tradeRequestId: tradeId,
    response: !acceptTrade
  }));
};

prototype.cancelTrade = function(user) {
  this._send(EMsg.EconTrading_CancelTradeRequest | protoMask, schema.CMsgTrading_CancelTradeRequest.serialize({
    otherSteamid: user
  }));
};
