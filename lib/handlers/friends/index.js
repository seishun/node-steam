'use strict';

const ByteBuffer = require('bytebuffer');
const EventEmitter = require('events').EventEmitter;
const Steam = require('../../steam_client');
const SteamID = require('../../steamID');

const EMsg = Steam.EMsg;
const schema = Steam.Internal;
const ZERO = 0;
const FIRST = 1;
const DEFAULT_LENGTH = 20;


function SteamFriends(steamClient) {
    this._client = steamClient;

    this.personaStates = {};
    this.clanStates = {};
    this.chatRooms = {};
    this.friends = {};
    this.groups = {};

    this._client.on('message', (header, body, callback) => {
        if (header.msg in handlers) {
            handlers[header.msg].call(this, ByteBuffer.wrap(body, ByteBuffer.LITTLE_ENDIAN), callback);
        }
    });

    this._client.on('logOnResponse', () => {
        this.personaStates = {};
        this.clanStates = {};
        this.chatRooms = {};
        this.friends = {};
        this.groups = {};
    });
}

require('util').inherits(SteamFriends, EventEmitter);


// Methods

SteamFriends.prototype.setPersonaName = function (name) {
    this._client.send({
        msg: EMsg.ClientChangeStatus,
        proto: {}
    }, new schema.CMsgClientChangeStatus({
        persona_state: this._personaState,
        player_name: name
    }).toBuffer());
};

SteamFriends.prototype.setPersonaState = function (state) {
    this._personaState = state;
    this._client.send({
        msg: EMsg.ClientChangeStatus,
        proto: {}
    }, new schema.CMsgClientChangeStatus({
        persona_state: state
    }).toBuffer());
};

SteamFriends.prototype.sendMessage = function (target, message, type) {
    target = SteamID.decode(target);
    type = type || Steam.EChatEntryType.ChatMsg;

    const payload = new ByteBuffer(Buffer.byteLength(message) + FIRST);
    payload.writeCString(message).flip();

    if (target.accountType === Steam.EAccountType.Individual
        || target.accountType === Steam.EAccountType.ConsoleUser) {
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
        const chatMsg = new schema.MsgClientChatMsg({
            steamIdChatter: this._client.steamID,
            steamIdChatRoom: toChatID(target),
            chatMsgType: type
        }).toBuffer();

        this._client.send({
            msg: EMsg.ClientChatMsg
        }, Buffer.concat([chatMsg, payload.toBuffer()]));
    }
};

SteamFriends.prototype.addFriend = function (steamID) {
    this._client.send({
        msg: EMsg.ClientAddFriend,
        proto: {}
    }, new schema.CMsgClientAddFriend({
        steamid_to_add: steamID
    }).toBuffer());
};

SteamFriends.prototype.removeFriend = function (steamID) {
    this._client.send({
        msg: EMsg.ClientRemoveFriend,
        proto: {}
    }, new schema.CMsgClientRemoveFriend({
        friendid: steamID
    }).toBuffer());
};

SteamFriends.prototype.joinChat = function (steamID) {
    this._client.send({msg: EMsg.ClientJoinChat}, new schema.MsgClientJoinChat({
        steamIdChat: toChatID(steamID)
    }).toBuffer());
};

SteamFriends.prototype.leaveChat = function (steamID) {
    const leaveChat = new schema.MsgClientChatMemberInfo({
        steamIdChat: toChatID(steamID),
        type: Steam.EChatInfoType.StateChange
    }).toBuffer();

    const payload = new ByteBuffer(DEFAULT_LENGTH, ByteBuffer.LITTLE_ENDIAN);
    payload.writeUint64(this._client.steamID);
    payload.writeUint32(Steam.EChatMemberStateChange.Left);
    payload.writeUint64(this._client.steamID);
    payload.flip();

    this._client.send({
        msg: EMsg.ClientChatMemberInfo
    }, Buffer.concat([leaveChat, payload.toBuffer()]));

    delete this.chatRooms[steamID];
};

SteamFriends.prototype.lockChat = function (steamID) {
    this._client.send({
        msg: EMsg.ClientChatAction
    }, new schema.MsgClientChatAction({
        steamIdChat: toChatID(steamID),
        steamIdUserToActOn: toChatID(steamID),
        chatAction: Steam.EChatAction.LockChat
    }).toBuffer());
};

SteamFriends.prototype.unlockChat = function (steamID) {
    this._client.send({
        msg: EMsg.ClientChatAction
    }, new schema.MsgClientChatAction({
        steamIdChat: toChatID(steamID),
        steamIdUserToActOn: toChatID(steamID),
        chatAction: Steam.EChatAction.UnlockChat
    }).toBuffer());
};

SteamFriends.prototype.setModerated = function (steamID) {
    this._client.send({
        msg: EMsg.ClientChatAction
    }, new schema.MsgClientChatAction({
        steamIdChat: toChatID(steamID),
        steamIdUserToActOn: toChatID(steamID),
        chatAction: Steam.EChatAction.SetModerated
    }).toBuffer());
};

SteamFriends.prototype.setUnmoderated = function (steamID) {
    this._client.send({
        msg: EMsg.ClientChatAction
    }, new schema.MsgClientChatAction({
        steamIdChat: toChatID(steamID),
        steamIdUserToActOn: toChatID(steamID),
        chatAction: Steam.EChatAction.SetUnmoderated
    }).toBuffer());
};

SteamFriends.prototype.kick = function (steamIdChat, steamIdMember) {
    this._client.send({
        msg: EMsg.ClientChatAction
    }, new schema.MsgClientChatAction({
        steamIdChat: toChatID(steamIdChat),
        steamIdUserToActOn: steamIdMember,
        chatAction: Steam.EChatAction.Kick
    }).toBuffer());
};

SteamFriends.prototype.ban = function (steamIdChat, steamIdMember) {
    this._client.send({
        msg: EMsg.ClientChatAction
    }, new schema.MsgClientChatAction({
        steamIdChat: toChatID(steamIdChat),
        steamIdUserToActOn: steamIdMember,
        chatAction: Steam.EChatAction.Ban
    }).toBuffer());
};

SteamFriends.prototype.unban = function (steamIdChat, steamIdMember) {
    this._client.send({
        msg: EMsg.ClientChatAction
    }, new schema.MsgClientChatAction({
        steamIdChat: toChatID(steamIdChat),
        steamIdUserToActOn: steamIdMember,
        chatAction: Steam.EChatAction.UnBan
    }).toBuffer());
};

SteamFriends.prototype.chatInvite = function (steamIdChat, steamIdInvited) {
    this._client.send({
        msg: EMsg.ClientChatInvite,
        proto: {}
    }, new schema.CMsgClientChatInvite({
        steam_id_invited: steamIdInvited,
        steam_id_chat: toChatID(steamIdChat)
    }).toBuffer());
};

SteamFriends.prototype.getSteamLevel = function (steamids, callback) {
    const accountids = steamids.map(steamid => SteamID.decode(steamid).accountID);

    this._client.send({
        msg: EMsg.ClientFSGetFriendsSteamLevels,
        proto: {}
    }, new schema.CMsgClientFSGetFriendsSteamLevels({
        accountids: accountids
    }).toBuffer(), (header, body) => {
        const friends = schema.CMsgClientFSGetFriendsSteamLevelsResponse.decode(body).friends;
        const output = {};
        friends.forEach(friend => {
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

const defaultInfoRequest = Steam.EClientPersonaStateFlag.PlayerName
    | Steam.EClientPersonaStateFlag.Presence
    | Steam.EClientPersonaStateFlag.SourceID
    | Steam.EClientPersonaStateFlag.GameExtraInfo;

SteamFriends.prototype.requestFriendData = function (steamIdList, requestedData) {
    this._client.send({
        msg: EMsg.ClientRequestFriendData,
        proto: {}
    }, new schema.CMsgClientRequestFriendData({
        friends: steamIdList,
        persona_state_requested: requestedData || defaultInfoRequest
    }).toBuffer());
};

SteamFriends.prototype.setIgnoreFriend = function (steamID, setIgnore, callback) {
    this._client.send({
        msg: EMsg.ClientSetIgnoreFriend
    }, new schema.MsgClientSetIgnoreFriend({
        mySteamId: this._client.steamID,
        steamIdFriend: steamID,
        ignore: Number(setIgnore)
    }).toBuffer(), (header, body) => {
        callback(schema.MsgClientSetIgnoreFriendResponse.decode(body).result);
    });
};


// Handlers

const handlers = {};

handlers[EMsg.ClientPersonaState] = function (data) {
    schema.CMsgClientPersonaState.decode(data).friends.forEach(friend => {
        friend = Steam._processProto(friend);

        this.emit('personaState', friend);

        if (!this.personaStates[friend.friendid]) {
            this.personaStates[friend.friendid] = {};
        }

        for (const field in friend) {
            if (friend.hasOwnProperty(field)) {
                this.personaStates[friend.friendid][field] = friend[field];
            }
        }
    });
};

handlers[EMsg.ClientFriendsList] = function (data) {
    const list = schema.CMsgClientFriendsList.decode(data);

    list.friends.forEach(relationship => {
        const steamID = relationship.ulfriendid;
        const isClan = SteamID.decode(steamID).accountType === Steam.EAccountType.Clan;
        if (list.bincremental) {
            this.emit(isClan ? 'group' : 'friend', steamID.toString(), relationship.efriendrelationship);
        }
        if (relationship.efriendrelationship === Steam.EFriendRelationship.None) {
            delete this[isClan ? 'groups' : 'friends'][steamID];
        } else {
            this[isClan ? 'groups' : 'friends'][steamID] = relationship.efriendrelationship;
        }
    });

    if (!list.bincremental) {
        this.emit('relationships');
    }
};

handlers[EMsg.ClientFriendMsgIncoming] = function (data) {
    const friendMsg = Steam._processProto(schema.CMsgClientFriendMsgIncoming.decode(data));

    // Steam cuts off after the first null
    const message = friendMsg.message.toString('utf8').split('\u0000')[ZERO];

    this.emit('message', friendMsg.steamid_from, message, friendMsg.chat_entry_type);
    this.emit('friendMsg', friendMsg.steamid_from, message, friendMsg.chat_entry_type);
};

handlers[EMsg.ClientFriendMsgEchoToSender] = function (data) {
    const friendEchoMsg = Steam._processProto(schema.CMsgClientFriendMsgIncoming.decode(data));

    // Steam cuts off after the first null
    const message = friendEchoMsg.message.toString('utf8').split('\u0000')[ZERO];

    this.emit('friendMsgEchoToSender', friendEchoMsg.steamid_from, message, friendEchoMsg.chat_entry_type);
};

handlers[EMsg.ClientChatMsg] = function (data) {
    const chatMsg = schema.MsgClientChatMsg.decode(data);

    // Steam cuts off after the first null
    const message = data.toString('utf8').split('\u0000')[ZERO];

    this.emit('message', toClanID(chatMsg.steamIdChatRoom), message, chatMsg.chatMsgType,
        chatMsg.steamIdChatter.toString());
    this.emit('chatMsg', toClanID(chatMsg.steamIdChatRoom), message, chatMsg.chatMsgType,
        chatMsg.steamIdChatter.toString());
};

handlers[EMsg.ClientChatEnter] = function (data) {
    const chatEnter = schema.MsgClientChatEnter.decode(data);
    const clanID = toClanID(chatEnter.steamIdChat);

    if (chatEnter.enterResponse === Steam.EChatRoomEnterResponse.Success) {

        const chatRoom = this.chatRooms[clanID] = {};
        while (chatEnter.numMembers--) {
            const object = require('../../VDF').decode(data).MessageObject;
            chatRoom[object.steamid] = {
                rank: object.Details,
                permissions: object.permissions
            };
        }
    }

    this.emit('chatEnter', clanID, chatEnter.enterResponse);
};

handlers[EMsg.ClientChatMemberInfo] = function (data) {
    const membInfo = schema.MsgClientChatMemberInfo.decode(data);
    const clanID = toClanID(membInfo.steamIdChat);

    let chatterActedOn;
    let stateChange;
    if (membInfo.type === Steam.EChatInfoType.StateChange) {
        chatterActedOn = data.readUint64().toString();
        stateChange = data.readInt32();
        const chatterActedBy = data.readUint64().toString();
        this.emit('chatStateChange', stateChange, chatterActedOn, clanID, chatterActedBy);
    }

    if (!this.chatRooms[clanID]) {
        return;
    }

    if (membInfo.type === Steam.EChatInfoType.InfoUpdate
        || stateChange === Steam.EChatMemberStateChange.Entered) {
        const object = require('../../VDF').decode(data).MessageObject;
        this.chatRooms[clanID][object.steamid] = {
            rank: object.Details,
            permissions: object.permissions
        };
    } else if (chatterActedOn === this._client.steamID) {
        delete this.chatRooms[clanID];
    } else if (stateChange < Steam.EChatMemberStateChange.VoiceSpeaking) {
        delete this.chatRooms[clanID][chatterActedOn];
    }
};

handlers[EMsg.ClientChatRoomInfo] = function (data) {
    const roomInfo = schema.MsgClientChatRoomInfo.decode(data);
    const args = [toClanID(roomInfo.steamIdChat), roomInfo.type];
    if (roomInfo.type === Steam.EChatInfoType.InfoUpdate) {
        const chatFlags = data.readInt32();
        const actedBy = data.readUint64().toString();
        args.push(chatFlags, actedBy);
    }
    this.emit.apply(this, ['chatRoomInfo'].concat(args));
};

handlers[EMsg.ClientChatInvite] = function (data) {
    const chatInvite = Steam._processProto(schema.CMsgClientChatInvite.decode(data));
    this.emit('chatInvite', toClanID(chatInvite.steam_id_chat), chatInvite.chat_name, chatInvite.steam_id_patron);
};

handlers[EMsg.ClientClanState] = function (data) {
    const clanState = Steam._processProto(schema.CMsgClientClanState.decode(data));

    this.emit('clanState', clanState);

    if (!this.clanStates[clanState.steamid_clan]) {
        this.clanStates[clanState.steamid_clan] = {};
    }

    for (const field in clanState) {
        if (clanState.hasOwnProperty(field)) {
            this.clanStates[clanState.steamid_clan][field] = clanState[field];
        }
    }
};


// Private functions

function toChatID(steamID) {
    if (typeof steamID === 'string') {
        steamID = SteamID.decode(steamID);
    }

    if (steamID.accountType === Steam.EAccountType.Clan) {

        // this is a ClanID - convert to its respective ChatID
        steamID.accountInstance = SteamID.ChatInstanceFlags.Clan;
        steamID.accountType = Steam.EAccountType.Chat;
    }

    return steamID.encode();
}

function toClanID(steamID) {
    steamID = SteamID.decode(steamID);

    if (steamID.accountInstance === SteamID.ChatInstanceFlags.Clan) {

        // not an anonymous chat - convert to its respective ClanID
        steamID.accountType = Steam.EAccountType.Clan;
        steamID.accountInstance = 0;
    }

    return steamID.toString();
}


Steam.SteamFriends = SteamFriends;
