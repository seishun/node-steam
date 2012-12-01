var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var SteamID = Steam.SteamID;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

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

//prototype.getFriendPersonaName = function(steamId) {
//  return this._users[steamId];
//};

prototype.sendMessage = function(target, message, type) {
  target = new SteamID(target);
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
      target.accountInstance = SteamID.ChatInstanceFlags.Clan;
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
  steamID = new SteamID(steamID);
  
  if (steamID.accountType == Steam.EAccountType.Clan) {
    // this steamid is incorrect, so we'll fix it up
    steamID.accountInstance = SteamID.ChatInstanceFlags.Clan;
    steamID.accountType = Steam.EAccountType.Chat;
  }
  
  this._send(EMsg.ClientJoinChat, schema.MsgClientJoinChat.serialize({
    steamIdChat: steamID.toString()
  }));
};

prototype.kick = function(steamIdChat, steamIdMember) {
  steamIdChat = new SteamID(steamIdChat);
  
  if (steamIdChat.accountType == Steam.EAccountType.Clan) {
    // this steamid is incorrect, so we'll fix it up
    steamIdChat.accountInstance = SteamID.ChatInstanceFlags.Clan;
    steamIdChat.accountType = Steam.EAccountType.Chat;
  }
  
  this._send(EMsg.ClientChatAction, schema.MsgClientChatAction.serialize({
    steamIdChat: steamIdChat.toString(),
    steamIdUserToActOn: steamIdMember.toString(),
    chatAction: Steam.EChatAction.Kick
  }));
};

prototype.ban = function(steamIdChat, steamIdMember) {
  steamIdChat = new SteamID(steamIdChat);
  
  if (steamIdChat.accountType == Steam.EAccountType.Clan) {
    // this steamid is incorrect, so we'll fix it up
    steamIdChat.accountInstance = SteamID.ChatInstanceFlags.Clan;
    steamIdChat.accountType = Steam.EAccountType.Chat;
  }
  
  this._send(EMsg.ClientChatAction, schema.MsgClientChatAction.serialize({
    steamIdChat: steamIdChat.toString(),
    steamIdUserToActOn: steamIdMember.toString(),
    chatAction: Steam.EChatAction.Ban
  }));
};

prototype.unban = function(steamIdChat, steamIdMember) {
  steamIdChat = new SteamID(steamIdChat);
  
  if (steamIdChat.accountType == Steam.EAccountType.Clan) {
    // this steamid is incorrect, so we'll fix it up
    steamIdChat.accountInstance = SteamID.ChatInstanceFlags.Clan;
    steamIdChat.accountType = Steam.EAccountType.Chat;
  }
  
  this._send(EMsg.ClientChatAction, schema.MsgClientChatAction.serialize({
    steamIdChat: steamIdChat.toString(),
    steamIdUserToActOn: steamIdMember.toString(),
    chatAction: Steam.EChatAction.UnBan
  }));
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientPersonaState] = function(data) {
  var friend = schema.CMsgClientPersonaState.parse(data).friends[0];
  
  this.users[friend.friendid] = friend;
};

handlers[EMsg.ClientFriendMsgIncoming] = function(data) {
  var friendMsg = schema.CMsgClientFriendMsgIncoming.parse(data);
  
  // Steam cuts off after the first null
  var message = friendMsg.message.toString().split('\u0000')[0];
  
  this.emit('message', new SteamID(friendMsg.steamidFrom), message, friendMsg.chatMsgType);
  this.emit('friendMsg', new SteamID(friendMsg.steamidFrom), message, friendMsg.chatMsgType);
};

handlers[EMsg.ClientChatMsg] = function(data) {
  var chatMsg = schema.MsgClientChatMsg.parse(data);
  
  // Steam cuts off after the first null
  var message = data.slice(schema.MsgClientChatMsg.baseSize).toString().split('\u0000')[0];
  
  this.emit('message', new SteamID(chatMsg.steamIdChatRoom), message, chatMsg.chatMsgType, new SteamID(chatMsg.steamIdChatter));
  this.emit('chatMsg', new SteamID(chatMsg.steamIdChatRoom), message, chatMsg.chatMsgType, new SteamID(chatMsg.steamIdChatter));
};

handlers[EMsg.ClientChatEnter] = function(data) {
  var chatEnter = schema.MsgClientChatEnter.parse(data);
  data.pos = schema.MsgClientChatEnter.baseSize;
  
  var numObj = data.readUInt32LE(data.pos);
  data.pos += 4;
  
  var chatName = data.readCString(data.pos);
  data.pos += Buffer.byteLength(chatName) + 1;
  
  var chatRoom = this.chatRooms[chatEnter.steamIdChat] = {};
  while (numObj--) {
    var object = require('../VDF').parse(data).MessageObject;
    chatRoom[object.steamid] = {
      1: 'owner',
      2: 'officer',
      4: '',
      8: 'moderator'
    }[object.Details];
  }
};

handlers[EMsg.ClientChatMemberInfo] = function(data) {
  var membInfo = schema.MsgClientChatMemberInfo.parse(data);
  
  // 8 bytes actedon + 4 bytes statechange + 8 bytes actedby
  var payload = data.slice(schema.MsgClientChatMemberInfo.baseSize);
  
  if (membInfo.type != Steam.EChatInfoType.StateChange)
    return; // TODO
    
  var chatterActedOn = payload.readUInt64LE(0);
  var stateChange = payload.readInt32LE(8);
  var chatterActedBy = payload.readUInt64LE(12);
  
  if (stateChange == Steam.EChatMemberStateChange.Entered) {
    var object = require('../VDF').parse(payload.slice(20)).MessageObject;
    this.chatRooms[membInfo.steamIdChat][chatterActedOn] = {
      1: 'owner',
      2: 'officer',
      4: '',
      8: 'moderator'
    }[object.Details];
  } else {
    delete this.chatRooms[membInfo.steamIdChat][chatterActedOn];
  }
  
  this.emit('chatStateChange', stateChange, chatterActedOn, membInfo.steamIdChat, chatterActedBy);
};

handlers[EMsg.ClientChatInvite] = function(data) {
  var chatInvite = schema.CMsgClientChatInvite.parse(data);
  this.emit('chatInvite', new SteamID(chatInvite.steamIdChat), chatInvite.chatName, new SteamID(chatInvite.steamIdPatron));
};

handlers[EMsg.ClientClanState] = function(data) {
  var clanState = schema.CMsgClientClanState.parse(data);
  if (clanState.announcements) {
    this.emit('announcement', new SteamID(clanState.steamidClan), clanState.announcements[0].headline); // TODO: more data
  }
};
