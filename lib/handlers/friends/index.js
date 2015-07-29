var ByteBuffer = require('bytebuffer');
var EventEmitter = require('events').EventEmitter;
var Steam = require('../../steam_client');
var SteamID = require('../../steamID');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;


function SteamFriends(steamClient) {
  this._client = steamClient;
  
  this.personaStates = {};
  this.clanStates = {};
  this.chatRooms = {};
  this.friends = {};
  this.groups = {};
  
  this._client.on('message', function(header, body, callback) {
    if (header.msg in handlers)
      handlers[header.msg].call(this, ByteBuffer.wrap(body, ByteBuffer.LITTLE_ENDIAN), callback);
  }.bind(this));
  
  this._client.on('logOnResponse', function() {
    this.personaStates = {};
    this.clanStates = {};
    this.chatRooms = {};
    this.friends = {};
    this.groups = {};
  }.bind(this));
}

require('util').inherits(SteamFriends, EventEmitter);


// Methods

SteamFriends.prototype.setPersonaName = function(name) {
  this._client.send({
    msg: EMsg.ClientChangeStatus,
    proto: {}
  }, new schema.CMsgClientChangeStatus({
    persona_state: this._personaState,
    player_name: name
  }).toBuffer());
};

SteamFriends.prototype.setPersonaState = function(state) {
  this._personaState = state;
  this._client.send({
    msg: EMsg.ClientChangeStatus,
    proto: {}
  }, new schema.CMsgClientChangeStatus({
    persona_state: state
  }).toBuffer());
};

SteamFriends.prototype.sendMessage = function(target, message, type) {
  target = SteamID.decode(target);
  type = type || Steam.EChatEntryType.ChatMsg;
  
  var payload = new ByteBuffer(Buffer.byteLength(message) + 1);
  payload.writeCString(message).flip();
  
  if (target.accountType == Steam.EAccountType.Individual || target.accountType == Steam.EAccountType.ConsoleUser) {
    this._client.send({
      msg: EMsg.ClientFriendMsg,
      proto: {}
    }, new schema.CMsgClientFriendMsg({
      steamid: target.encode(),
      message: payload,
      chat_entry_type: type
    }).toBuffer());
    
  } else {
    // assume chat message
    var chatMsg = new schema.MsgClientChatMsg({
      steamIdChatter: this._client.steamID,
      steamIdChatRoom: toChatID(target),
      chatMsgType: type
    }).toBuffer();
    
    this._client.send({
      msg: EMsg.ClientChatMsg
    }, Buffer.concat([chatMsg, payload.toBuffer()]));
  }
};

SteamFriends.prototype.addFriend = function(steamID) {
  this._client.send({
    msg: EMsg.ClientAddFriend,
    proto: {}
  }, new schema.CMsgClientAddFriend({
    steamid_to_add: steamID
  }).toBuffer());
};

SteamFriends.prototype.removeFriend = function(steamID) {
  this._client.send({
    msg: EMsg.ClientRemoveFriend,
    proto: {}
  }, new schema.CMsgClientRemoveFriend({
    friendid: steamID
  }).toBuffer());
};

SteamFriends.prototype.joinChat = function(steamID) {
  this._client.send({ msg: EMsg.ClientJoinChat }, new schema.MsgClientJoinChat({
    steamIdChat: toChatID(steamID)
  }).toBuffer());
};

SteamFriends.prototype.leaveChat = function(steamID) {
  var leaveChat = new schema.MsgClientChatMemberInfo({
    steamIdChat: toChatID(steamID),
    type: Steam.EChatInfoType.StateChange
  }).toBuffer();
  
  var payload = new ByteBuffer(20, ByteBuffer.LITTLE_ENDIAN);
  payload.writeUint64(this._client.steamID);
  payload.writeUint32(Steam.EChatMemberStateChange.Left);
  payload.writeUint64(this._client.steamID);
  payload.flip();
  
  this._client.send({
    msg: EMsg.ClientChatMemberInfo
  }, Buffer.concat([leaveChat, payload.toBuffer()]));
  
  delete this.chatRooms[steamID];
};

SteamFriends.prototype.lockChat = function(steamID) {
  this._client.send({
    msg: EMsg.ClientChatAction
  }, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamID),
    steamIdUserToActOn: toChatID(steamID),
    chatAction: Steam.EChatAction.LockChat
  }).toBuffer());
};

SteamFriends.prototype.unlockChat = function(steamID) {
  this._client.send({
    msg: EMsg.ClientChatAction
  }, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamID),
    steamIdUserToActOn: toChatID(steamID),
    chatAction: Steam.EChatAction.UnlockChat
  }).toBuffer());
};

SteamFriends.prototype.setModerated = function(steamID) {
  this._client.send({
    msg: EMsg.ClientChatAction
  }, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamID),
    steamIdUserToActOn: toChatID(steamID),
    chatAction: Steam.EChatAction.SetModerated
  }).toBuffer());
};

SteamFriends.prototype.setUnmoderated = function(steamID) {
  this._client.send({
    msg: EMsg.ClientChatAction
  }, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamID),
    steamIdUserToActOn: toChatID(steamID),
    chatAction: Steam.EChatAction.SetUnmoderated
  }).toBuffer());
};

SteamFriends.prototype.kick = function(steamIdChat, steamIdMember) {
  this._client.send({
    msg: EMsg.ClientChatAction
  }, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamIdChat),
    steamIdUserToActOn: steamIdMember,
    chatAction: Steam.EChatAction.Kick
  }).toBuffer());
};

SteamFriends.prototype.ban = function(steamIdChat, steamIdMember) {
  this._client.send({
    msg: EMsg.ClientChatAction
  }, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamIdChat),
    steamIdUserToActOn: steamIdMember,
    chatAction: Steam.EChatAction.Ban
  }).toBuffer());
};

SteamFriends.prototype.unban = function(steamIdChat, steamIdMember) {
  this._client.send({
    msg: EMsg.ClientChatAction
  }, new schema.MsgClientChatAction({
    steamIdChat: toChatID(steamIdChat),
    steamIdUserToActOn: steamIdMember,
    chatAction: Steam.EChatAction.UnBan
  }).toBuffer());
};

SteamFriends.prototype.chatInvite = function(steamIdChat, steamIdInvited) {
  this._client.send({
    msg: EMsg.ClientChatInvite,
    proto: {}
  }, new schema.CMsgClientChatInvite({
    steam_id_invited: steamIdInvited,
    steam_id_chat: toChatID(steamIdChat)
  }).toBuffer());
};

SteamFriends.prototype.getSteamLevel = function(steamids, callback) {
  var accountids = steamids.map(function(steamid) {
    return SteamID.decode(steamid).accountID;
  });
  
  this._client.send({
    msg: EMsg.ClientFSGetFriendsSteamLevels,
    proto: {}
  }, new schema.CMsgClientFSGetFriendsSteamLevels({
    accountids: accountids
  }).toBuffer(), function(header, body) {
    var friends = schema.CMsgClientFSGetFriendsSteamLevelsResponse.decode(body).friends;
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
  });
};

var defaultInfoRequest = Steam.EClientPersonaStateFlag.PlayerName
  |
  Steam.EClientPersonaStateFlag.Presence
  |
  Steam.EClientPersonaStateFlag.SourceID
  |
  Steam.EClientPersonaStateFlag.GameExtraInfo;

SteamFriends.prototype.requestFriendData = function(steamIdList, requestedData) {
  this._client.send({
    msg: EMsg.ClientRequestFriendData,
    proto: {}
  }, new schema.CMsgClientRequestFriendData({
    friends: steamIdList,
    persona_state_requested: requestedData || defaultInfoRequest
  }).toBuffer());
};

SteamFriends.prototype.setIgnoreFriend = function(steamID, setIgnore, callback) {
  this._client.send({
    msg: EMsg.ClientSetIgnoreFriend
  }, new schema.MsgClientSetIgnoreFriend({
    mySteamId: this._client.steamID,
    steamIdFriend: steamID,
    ignore: +setIgnore
  }).toBuffer(), function(header, body) {
    callback(schema.MsgClientSetIgnoreFriendResponse.decode(body).result);
  });
};


// Handlers

var handlers = {};

handlers[EMsg.ClientPersonaState] = function(data) {
  schema.CMsgClientPersonaState.decode(data).friends.forEach(function(friend) {
    friend = Steam._processProto(friend);
    
    this.emit('personaState', friend);
    
    if (!this.personaStates[friend.friendid])
      this.personaStates[friend.friendid] = {};
    
    for (var field in friend)
      this.personaStates[friend.friendid][field] = friend[field];
  }.bind(this));
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
  var friendMsg = Steam._processProto(schema.CMsgClientFriendMsgIncoming.decode(data));
  
  // Steam cuts off after the first null
  var message = friendMsg.message.toString('utf8').split('\u0000')[0];
  
  this.emit('message', friendMsg.steamid_from, message, friendMsg.chat_entry_type);
  this.emit('friendMsg', friendMsg.steamid_from, message, friendMsg.chat_entry_type);
};

handlers[EMsg.ClientFriendMsgEchoToSender] = function(data) {
  var friendEchoMsg = Steam._processProto(schema.CMsgClientFriendMsgIncoming.decode(data));
  
  // Steam cuts off after the first null
  var message = friendEchoMsg.message.toString('utf8').split('\u0000')[0];
  
  this.emit('friendMsgEchoToSender', friendEchoMsg.steamid_from, message, friendEchoMsg.chat_entry_type);
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
  var clanID = toClanID(chatEnter.steamIdChat);
  
  if (chatEnter.enterResponse == Steam.EChatRoomEnterResponse.Success) {
    var chatName = data.readCString();
    
    var chatRoom = this.chatRooms[clanID] = {};
    while (chatEnter.numMembers--) {
      var object = require('../../VDF').decode(data).MessageObject;
      chatRoom[object.steamid] = {
        rank: object.Details,
        permissions: object.permissions
      };
    }
  }
  
  this.emit('chatEnter', clanID, chatEnter.enterResponse);
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
    var object = require('../../VDF').decode(data).MessageObject;
    this.chatRooms[clanID][object.steamid] = {
      rank: object.Details,
      permissions: object.permissions
    };
  } else if (chatterActedOn == this._client.steamID) {
    delete this.chatRooms[clanID];
  } else if (stateChange < Steam.EChatMemberStateChange.VoiceSpeaking) {
    delete this.chatRooms[clanID][chatterActedOn];
  }
};

handlers[EMsg.ClientChatRoomInfo] = function(data) {
  var roomInfo = schema.MsgClientChatRoomInfo.decode(data);
  var args = [toClanID(roomInfo.steamIdChat), roomInfo.type];
  if (roomInfo.type == Steam.EChatInfoType.InfoUpdate) {
    var chatFlags = data.readInt32();
    var actedBy = data.readUint64().toString();
    args.push(chatFlags, actedBy);
  }
  this.emit.apply(this, ['chatRoomInfo'].concat(args));
};

handlers[EMsg.ClientChatInvite] = function(data) {
  var chatInvite = Steam._processProto(schema.CMsgClientChatInvite.decode(data));
  this.emit('chatInvite', toClanID(chatInvite.steam_id_chat), chatInvite.chat_name, chatInvite.steam_id_patron);
};

handlers[EMsg.ClientClanState] = function(data) {
  var clanState = Steam._processProto(schema.CMsgClientClanState.decode(data));
  
  this.emit('clanState', clanState);
  
  if (!this.clanStates[clanState.steamid_clan])
    this.clanStates[clanState.steamid_clan] = {};
  
  for (var field in clanState)
    this.clanStates[clanState.steamid_clan][field] = clanState[field];
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


Steam.SteamFriends = SteamFriends;
