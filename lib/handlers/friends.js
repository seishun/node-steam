var ByteBuffer = require('bytebuffer');
var Steam = require('../steam_client');
var SteamID = require('../steamID');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

prototype.setPersonaName = function(name) {
  this._send(EMsg.ClientChangeStatus | protoMask, new schema.CMsgClientChangeStatus({
    personaState: this._personaState,
    playerName: name
  }));
};

prototype.setPersonaState = function(state) {
  this._personaState = state;
  this._send(EMsg.ClientChangeStatus | protoMask, new schema.CMsgClientChangeStatus({
    personaState: state
  }));
};

prototype.sendMessage = function(target, message, type) {
  target = SteamID.decode(target);
  type = type || Steam.EChatEntryType.ChatMsg;
  
  var payload = new ByteBuffer(Buffer.byteLength(message) + 1);
  payload.writeCString(message).flip();
  
  if (target.accountType == Steam.EAccountType.Individual || target.accountType == Steam.EAccountType.ConsoleUser) {
    this._send(EMsg.ClientFriendMsg | protoMask, new schema.CMsgClientFriendMsg({
      steamid: target.encode(),
      message: payload,
      chatEntryType: type
    }));
    
  } else {
    // assume chat message
    var chatMsg = new schema.MsgClientChatMsg({
      steamIdChatter: this.steamID,
      steamIdChatRoom: toChatID(target),
      chatMsgType: type
    });
    
    this._send(EMsg.ClientChatMsg, ByteBuffer.concat([chatMsg.encode(), payload]));
  }
};

prototype.addFriend = function(steamID) {
  this._send(EMsg.ClientAddFriend | protoMask, new schema.CMsgClientAddFriend({
    steamidToAdd: steamID
  }));
};

prototype.removeFriend = function(steamID) {
  this._send(EMsg.ClientRemoveFriend | protoMask, new schema.CMsgClientRemoveFriend({
    friendid: steamID
  }));
};

prototype.joinChat = function(steamID) {
  this._send(EMsg.ClientJoinChat, new schema.MsgClientJoinChat({
    steamIdChat: toChatID(steamID)
  }));
};

prototype.leaveChat = function(steamID) {
  var leaveChat = new schema.MsgClientChatMemberInfo({
    steamIdChat: toChatID(steamID),
    type: Steam.EChatInfoType.StateChange
  });
  
  var payload = new ByteBuffer(20, ByteBuffer.LITTLE_ENDIAN);
  payload.writeUint64(ByteBuffer.Long.fromString(this.steamID));
  payload.writeUint32(Steam.EChatMemberStateChange.Left);
  payload.writeUint64(ByteBuffer.Long.fromString(this.steamID));
  
  this._send(EMsg.ClientChatMemberInfo, ByteBuffer.concat([leaveChat.encode(), payload.flip()]));
  delete this.chatRooms[steamID];
};

prototype.lockChat = function(steamID) {
  this._send(EMsg.ClientChatAction, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamID),
    steamIdUserToActOn: toChatID(steamID),
    chatAction: Steam.EChatAction.LockChat
  }));
};

prototype.unlockChat = function(steamID) {
  this._send(EMsg.ClientChatAction, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamID),
    steamIdUserToActOn: toChatID(steamID),
    chatAction: Steam.EChatAction.UnlockChat
  }));
};

prototype.setModerated = function(steamID) {
  this._send(EMsg.ClientChatAction, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamID),
    steamIdUserToActOn: toChatID(steamID),
    chatAction: Steam.EChatAction.SetModerated
  }));
};

prototype.setUnmoderated = function(steamID) {
  this._send(EMsg.ClientChatAction, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamID),
    steamIdUserToActOn: toChatID(steamID),
    chatAction: Steam.EChatAction.SetUnmoderated
  }));
};

prototype.kick = function(steamIdChat, steamIdMember) {
  this._send(EMsg.ClientChatAction, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamIdChat),
    steamIdUserToActOn: steamIdMember,
    chatAction: Steam.EChatAction.Kick
  }));
};

prototype.ban = function(steamIdChat, steamIdMember) {
  this._send(EMsg.ClientChatAction, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamIdChat),
    steamIdUserToActOn: steamIdMember,
    chatAction: Steam.EChatAction.Ban
  }));
};

prototype.unban = function(steamIdChat, steamIdMember) {
  this._send(EMsg.ClientChatAction, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamIdChat),
    steamIdUserToActOn: steamIdMember,
    chatAction: Steam.EChatAction.UnBan
  }));
};

prototype.chatInvite = function(steamIdChat, steamIdInvited) {
  this._send(EMsg.ClientChatInvite | protoMask, new schema.CMsgClientChatInvite({
    steamIdInvited: steamIdInvited,
    steamIdChat: toChatID(steamIdChat)
  }));
};

prototype.getSteamLevel = function(steamids, callback) {
  var accountids = steamids.map(function(steamid) {
    return SteamID.decode(steamid).accountID;
  });
  
  this._send(EMsg.ClientFSGetFriendsSteamLevels | protoMask, new schema.CMsgClientFSGetFriendsSteamLevels({
    accountids: accountids
  }), callback);
};

var defaultInfoRequest = Steam.EClientPersonaStateFlag.PlayerName
  |
  Steam.EClientPersonaStateFlag.Presence
  |
  Steam.EClientPersonaStateFlag.SourceID
  |
  Steam.EClientPersonaStateFlag.GameExtraInfo;

prototype.requestFriendData = function(steamIdList, requestedData) {
  this._send(EMsg.ClientRequestFriendData | protoMask, new schema.CMsgClientRequestFriendData({
    friends: steamIdList,
    personaStateRequested: requestedData || defaultInfoRequest
  }));
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientPersonaState] = function(data) {
  schema.CMsgClientPersonaState.decode(data).friends.forEach(function(friend) {
    for (var field in friend) {
      if (friend[field] == null)
        delete friend[field];
      else if (ByteBuffer.isByteBuffer(friend[field]))
        friend[field] = friend[field].toBuffer();
      else if (ByteBuffer.Long.isLong(friend[field]))
        friend[field] = friend[field].toString();
    }
    
    if ('gameServerIp' in friend) {
      var buf = new Buffer(4);
      buf.writeUInt32BE(friend.gameServerIp, 0);
      friend.gameServerIp = Array.prototype.join.call(buf, '.');
    }
    
    ['lastLogoff', 'lastLogon'].forEach(function(field) {
      if (field in friend)
        friend[field] = new Date(friend[field] * 1000);
    });
    
    this.emit('user', friend);
    
    if (!this.users[friend.friendid])
      this.users[friend.friendid] = {};
    
    for (var field in friend)
      this.users[friend.friendid][field] = friend[field];
  }.bind(this));
};

handlers[EMsg.ClientRichPresenceInfo] = function(data) {
  var info = schema.CMsgClientRichPresenceInfo.decode(data).richPresence[0];
  var vdf = require('../VDF').decode(info.richPresenceKv).RP;
  this.emit.apply(this, ['richPresence', info.steamidUser.toString(), vdf.status].concat(Object.keys(vdf).filter(function(key) {
    return !key.indexOf('param');
  }).map(function(key) {
    return vdf[key];
  })));
};

handlers[EMsg.ClientFriendsList] = function(data) {
  var list = schema.CMsgClientFriendsList.decode(data);
  
  list.friends.forEach(function(relationship) {
    var steamID = relationship.ulfriendid;
    var isClan = SteamID.decode(steamID).accountType == Steam.EAccountType.Clan;
    if (list.bincremental) {
      this.emit(isClan ? 'group' : 'friend', steamID.toString(), relationship.efriendrelationship);
    }
    if (relationship.efriendrelationship == Steam.EFriendRelationship.None) {
      delete this[isClan ? 'groups' : 'friends'][steamID];
    } else {
      this[isClan ? 'groups' : 'friends'][steamID] = relationship.efriendrelationship;
    }
  }.bind(this));
  
  if (!list.bincremental) {
    this.emit('relationships');
  }
};

handlers[EMsg.ClientFriendMsgIncoming] = function(data) {
  var friendMsg = schema.CMsgClientFriendMsgIncoming.decode(data);
  
  // Steam cuts off after the first null
  var message = friendMsg.message.toString('utf8').split('\u0000')[0];
  
  this.emit('message', friendMsg.steamidFrom.toString(), message, friendMsg.chatEntryType);
  this.emit('friendMsg', friendMsg.steamidFrom.toString(), message, friendMsg.chatEntryType);
};

handlers[EMsg.ClientChatMsg] = function(data) {
  var chatMsg = schema.MsgClientChatMsg.decode(data);
  
  // Steam cuts off after the first null
  var message = data.toString('utf8').split('\u0000')[0];
  
  this.emit('message', toClanID(chatMsg.steamIdChatRoom), message, chatMsg.chatMsgType, chatMsg.steamIdChatter.toString());
  this.emit('chatMsg', toClanID(chatMsg.steamIdChatRoom), message, chatMsg.chatMsgType, chatMsg.steamIdChatter.toString());
};

handlers[EMsg.ClientChatEnter] = function(data) {
  var chatEnter = schema.MsgClientChatEnter.decode(data);
  
  if (chatEnter.enterResponse == Steam.EChatRoomEnterResponse.Success) {
    var numObj = data.readUint32();
    var chatName = data.readCString();
    
    var chatRoom = this.chatRooms[chatEnter.steamIdClan || chatEnter.steamIdChat] = {};
    while (numObj--) {
      var object = require('../VDF').decode(data).MessageObject;
      chatRoom[object.steamid] = {
        rank: object.Details,
        permissions: object.permissions
      };
    }
  }
  
  this.emit('chatEnter', (chatEnter.steamIdClan || chatEnter.steamIdChat).toString(), chatEnter.enterResponse);
};

handlers[EMsg.ClientChatMemberInfo] = function(data) {
  var membInfo = schema.MsgClientChatMemberInfo.decode(data);
  var clanID = toClanID(membInfo.steamIdChat);
  
  if (membInfo.type == Steam.EChatInfoType.StateChange) {
    var chatterActedOn = data.readUint64().toString();
    var stateChange = data.readInt32();
    var chatterActedBy = data.readUint64().toString();
    this.emit('chatStateChange', stateChange, chatterActedOn, clanID, chatterActedBy);
  }  
  
  if (!this.chatRooms[clanID])
    return; // it's probably a chat we just left
  
  if (membInfo.type == Steam.EChatInfoType.InfoUpdate || stateChange == Steam.EChatMemberStateChange.Entered) {
    var object = require('../VDF').decode(data).MessageObject;
    this.chatRooms[clanID][object.steamid] = {
      rank: object.Details,
      permissions: object.permissions
    };
  } else if (chatterActedOn == this.steamID) {
    delete this.chatRooms[clanID];
  } else if (stateChange < Steam.EChatMemberStateChange.VoiceSpeaking) {
    delete this.chatRooms[clanID][chatterActedOn];
  }
};

handlers[EMsg.ClientChatInvite] = function(data) {
  var chatInvite = schema.CMsgClientChatInvite.decode(data);
  this.emit('chatInvite', toClanID(chatInvite.steamIdChat), chatInvite.chatName, chatInvite.steamIdPatron.toString());
};

handlers[EMsg.ClientClanState] = function(data) {
  var clanState = schema.CMsgClientClanState.decode(data);
  if (clanState.announcements.length)
    this.emit('announcement', clanState.steamidClan.toString(), clanState.announcements[0].headline); // TODO: more data
};

handlers[EMsg.ClientFSGetFriendsSteamLevelsResponse] = function(data, callback) {
  var friends = schema.CMsgClientFSGetFriendsSteamLevelsResponse.decode(data).friends;
  var output = {};
  friends.forEach(function(friend) {
    output[new SteamID({
      accountUniverse: 1,
      accountType: 1,
      accountInstance: 1,
      accountID: friend.accountid
    })] = friend.level;
  });
  
  callback(output);
};


// Private functions

function toChatID(steamID) {
  if (typeof steamID == 'string')
    steamID = SteamID.decode(steamID);
  
  if (steamID.accountType == Steam.EAccountType.Clan) {
    // this is a ClanID - convert to its respective ChatID
    steamID.accountInstance = SteamID.ChatInstanceFlags.Clan;
    steamID.accountType = Steam.EAccountType.Chat;
  }
  
  return steamID.encode();
}

function toClanID(steamID) {
  steamID = SteamID.decode(steamID);
  
  if (steamID.accountInstance == SteamID.ChatInstanceFlags.Clan) {
    // not an anonymous chat - convert to its respective ClanID
    steamID.accountType = Steam.EAccountType.Clan;
    steamID.accountInstance = 0;
  }
  
  return steamID.toString();
}
