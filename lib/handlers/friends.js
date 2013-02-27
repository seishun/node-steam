var Steam = require('../steam_client');
var SteamID = require('../steamID');

var EMsg = Steam.EMsg;
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
    var chatMsg = schema.MsgClientChatMsg.serialize({
      steamIdChatter: this.steamID,
      steamIdChatRoom: toChatID(target),
      chatMsgType: type
    });

    this._send(EMsg.ClientChatMsg, Buffer.concat([chatMsg, payload]));
  }
};

prototype.addFriend = function(steamID) {
  this._send(EMsg.ClientAddFriend | protoMask, schema.CMsgClientAddFriend.serialize({
    steamidToAdd: steamID
  }));
};

prototype.removeFriend = function(steamID) {
  this._send(EMsg.ClientRemoveFriend | protoMask, schema.CMsgClientRemoveFriend.serialize({
    friendid: steamID
  }));
};

prototype.joinChat = function(steamID) {
  this._send(EMsg.ClientJoinChat, schema.MsgClientJoinChat.serialize({
    steamIdChat: toChatID(steamID)
  }));
};

prototype.kick = function(steamIdChat, steamIdMember) {
  this._send(EMsg.ClientChatAction, schema.MsgClientChatAction.serialize({
    steamIdChat: toChatID(steamIdChat),
    steamIdUserToActOn: steamIdMember,
    chatAction: Steam.EChatAction.Kick
  }));
};

prototype.ban = function(steamIdChat, steamIdMember) {
  this._send(EMsg.ClientChatAction, schema.MsgClientChatAction.serialize({
    steamIdChat: toChatID(steamIdChat),
    steamIdUserToActOn: steamIdMember,
    chatAction: Steam.EChatAction.Ban
  }));
};

prototype.unban = function(steamIdChat, steamIdMember) {
  this._send(EMsg.ClientChatAction, schema.MsgClientChatAction.serialize({
    steamIdChat: toChatID(steamIdChat),
    steamIdUserToActOn: steamIdMember,
    chatAction: Steam.EChatAction.UnBan
  }));
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientPersonaState] = function(data) {
  var perState  = schema.CMsgClientPersonaState.parse(data);

  var users = perState.friends;

  for(var i = 0; i < users.length; i++) {
    var userInfo = users[i];

    var userID = new SteamID(userInfo.friendid);
    if(userID.accountType == Steam.EAccountType.Individual) {
      var user = this.users[userID] || {};

      if(!(userID in this.users)) {
        user.steamID = userID.toString();
        user.state = 0;
        user.relationship = 0;
        this.users[userID] = user;
      }

      if(userInfo.playerName !== undefined) {
        user.name = userInfo.playerName;
      }
      if(userInfo.personaState !== undefined) {
        user.state = userInfo.personaState;
      }

      this.emit('personaState', user);
    }
  }
};

handlers[EMsg.ClientFriendsList] = function(data) {
  var list = schema.CMsgClientFriendsList.parse(data);

  if (!list.bincremental) {
    this.friendList = {};
  }

  var friends = list.friends;
  var friendsToRemove = [];
  var toGetInfo = [];

  for(var i = 0; i < friends.length; i++) {
    var friendObj = friends[i];
    var friendID = new SteamID(friendObj.ulfriendid);

    if(friendID.accountType == Steam.EAccountType.Individual) {
      var friend = this.users[friendID] || {};

      if(!(friendID in this.users)) {
        friend.steamID = friendID.toString();
        friend.state = 0;
        this.users[friendID] = friend;
      }

      friend.relationship = friendObj.efriendrelationship;

      this.friendList[friendID] = friend;

      if(friend.relationship == Steam.EFriendRelationship.None) {
        friendsToRemove.push(friendID);
      }

    }

    if(!list.bincremental) {
      toGetInfo.push(friendID);
    }
  }


  friendsToRemove.forEach(this.removeFriend.bind(this));

  if(toGetInfo.length) {
    this._send(EMsg.ClientRequestFriendData | protoMask, schema.CMsgClientRequestFriendData.serialize({
      friends: toGetInfo.map(function(b){return b.toString();}),
      personaStateRequested: Steam.EClientPersonaStateFlag.PlayerName |
                             Steam.EClientPersonaStateFlag.Presence
    }));
  }

  this.emit('friendsList', this.friendList);
};

handlers[EMsg.ClientFriendMsgIncoming] = function(data) {
  var friendMsg = schema.CMsgClientFriendMsgIncoming.parse(data);

  // Steam cuts off after the first null
  var message = friendMsg.message.toString().split('\u0000')[0];

  this.emit('message', friendMsg.steamidFrom, message, friendMsg.chatEntryType);
  this.emit('friendMsg', friendMsg.steamidFrom, message, friendMsg.chatEntryType);
};

handlers[EMsg.ClientChatMsg] = function(data) {
  var chatMsg = schema.MsgClientChatMsg.parse(data);

  // Steam cuts off after the first null
  var message = data.slice(schema.MsgClientChatMsg.baseSize).toString().split('\u0000')[0];

  this.emit('message', toClanID(chatMsg.steamIdChatRoom), message, chatMsg.chatMsgType, chatMsg.steamIdChatter);
  this.emit('chatMsg', toClanID(chatMsg.steamIdChatRoom), message, chatMsg.chatMsgType, chatMsg.steamIdChatter);
};

handlers[EMsg.ClientChatEnter] = function(data) {
  var chatEnter = schema.MsgClientChatEnter.parse(data);
  var baseSize = schema.MsgClientChatEnter.baseSize;

  var numObj = data.readUInt32LE(baseSize);
  var chatName = data.readCString(baseSize + 4);
  data = data.slice(baseSize + 4 + Buffer.byteLength(chatName) + 1);

  var chatRoom = this.chatRooms[chatEnter.steamIdClan || chatEnter.steamIdChat] = {};
  while (numObj--) {
    var object = require('../VDF').parse(data).MessageObject;
    chatRoom[object.steamid] = {
      rank: object.Details,
      permissions: object.Permissions
    };
  }
};

handlers[EMsg.ClientChatMemberInfo] = function(data) {
  var membInfo = schema.MsgClientChatMemberInfo.parse(data);
  var clanID = toClanID(membInfo.steamIdChat);

  var payload = data.slice(schema.MsgClientChatMemberInfo.baseSize);

  if (membInfo.type == Steam.EChatInfoType.StateChange) {
    var chatterActedOn = payload.readUInt64LE(0);
    var stateChange = payload.readInt32LE(8);
    var chatterActedBy = payload.readUInt64LE(12);
    this.emit('chatStateChange', stateChange, chatterActedOn, clanID, chatterActedBy);
    payload = payload.slice(20);
  }

  if (membInfo.type == Steam.EChatInfoType.InfoUpdate || stateChange == Steam.EChatMemberStateChange.Entered) {
    var object = require('../VDF').parse(payload).MessageObject;
    this.chatRooms[clanID][object.steamid] = {
      rank: object.Details,
      permissions: object.Permissions
    };
  } else {
    delete this.chatRooms[clanID][chatterActedOn];
  }
};

handlers[EMsg.ClientChatInvite] = function(data) {
  var chatInvite = schema.CMsgClientChatInvite.parse(data);
  this.emit('chatInvite', toClanID(chatInvite.steamIdChat), chatInvite.chatName, chatInvite.steamIdPatron);
};

handlers[EMsg.ClientClanState] = function(data) {
  var clanState = schema.CMsgClientClanState.parse(data);
  if (clanState.announcements)
    this.emit('announcement', clanState.steamidClan, clanState.announcements[0].headline); // TODO: more data
};


// Private functions

function toChatID(steamID) {
  if (typeof steamID == 'string')
    steamID = new SteamID(steamID);

  if (steamID.accountType == Steam.EAccountType.Clan) {
    // this is a ClanID - convert to its respective ChatID
    steamID.accountInstance = SteamID.ChatInstanceFlags.Clan;
    steamID.accountType = Steam.EAccountType.Chat;
  }

  return steamID.toString();
}

function toClanID(steamID) {
  if (typeof steamID == 'string')
    steamID = new SteamID(steamID);

  if (steamID.accountInstance == SteamID.ChatInstanceFlags.Clan) {
    // not an anonymous chat - convert to its respective ClanID
    steamID.accountType = Steam.EAccountType.Clan;
    steamID.accountInstance = 0;
  }

  return steamID.toString();
}
