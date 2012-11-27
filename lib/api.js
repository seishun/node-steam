var Steam = require('./steam_client');

var EMsg = Steam.EMsg;

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
    personaState: this._personaState,
    playerName: name
  }));
};

prototype.setPersonaState = function(state) {
  this._personaState = state;
  this._send(EMsg.ClientChangeStatus | protoMask, schema.CMsgClientChangeStatus.serialize({
    personaState: state
  }));
};

prototype.getFriendPersonaName = function(steamId) {
  return this._users[steamId];
};

prototype.sendMessage = function(target, message, type) {
  target = new Steam.SteamID(target);
  type = type || Steam.EChatEntryType.ChatMsg;
  
  var payload = new Buffer(Buffer.byteLength(message) + 1);
  payload.writeCString(message);
  
  if (target.accountType == Steam.EAccountType.Individual || target.accountType == Steam.EAccountType.ConsoleUser) {
    this._send(EMsg.ClientFriendMsg | protoMask, schema.CMsgClientFriendMsg.serialize({
      steamid: target.toString(),
      message: payload,
      chatEntryType: type
    }));
    
  } else {
    // assume chat message
    if (target.accountType == Steam.EAccountType.Clan) {
      // this steamid is incorrect, so we'll fix it up
      target.accountInstance = Steam.SteamID.ChatInstanceFlags.Clan;
      target.accountType = Steam.EAccountType.Chat;
    }
    
    var chatMsg = schema.MsgClientChatMsg.serialize({
      steamIdChatter: this.steamID.toString(),
      steamIdChatRoom: target.toString(),
      chatMsgType: type
    });
    
    this._send(EMsg.ClientChatMsg, Buffer.concat([chatMsg, payload]));
  }
};

prototype.joinChat = function(steamID) {
  steamID = new Steam.SteamID(steamID);
  
  if (steamID.accountType == Steam.EAccountType.Clan) {
    // this steamid is incorrect, so we'll fix it up
    steamID.accountInstance = Steam.SteamID.ChatInstanceFlags.Clan;
    steamID.accountType = Steam.EAccountType.Chat;
  }
  
  var joinChat = schema.MsgClientJoinChat.serialize({
    steamIdChat: steamID.toString()
  });
  
  this._send(EMsg.ClientJoinChat, joinChat);
};

prototype.trade = function(user) {
  this._send(EMsg.EconTrading_InitiateTradeRequest | protoMask, schema.CMsgTrading_InitiateTradeRequest.serialize({
    otherSteamid: user.toString()
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
    otherSteamid: user.toString()
  }));
};
