# SteamFriends

This is a handler for Community functionality. Initialize it by passing a SteamClient instance to the constructor.

```js
var steamFriends = new Steam.SteamFriends(steamClient);
```

Chat-related methods automatically convert ClanIDs (group's SteamID) to ChatIDs. Conversely, ChatIDs are converted to ClanIDs in chat-related events if it's a group chat (i.e. not an "ad hoc" chat), otherwise left alone. In the following docs, chat SteamID always refers to ClanID for group chats and ChatID otherwise.

## Properties

### personaStates

Information about users you have encountered. It's an object whose keys are SteamIDs and values are [`CMsgClientPersonaState.Friend`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver.proto) objects.

### clanStates

Information about groups you have encountered. It's an object whose keys are SteamIDs and values are [`CMsgClientClanState`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver.proto) objects.

### chatRooms

Information about chat rooms you have joined. It's an object with the following structure:
```js
{
  "steamID of the chat": {
    "steamID of one of the chat's current members": {
      rank: "EClanPermission",
      permissions: "a bitset of values from EChatPermission"
    }
    // other members
  }
  // other chats
}
```

For example, `Object.keys(steamClient.chatRooms[chatID])` will return an array of the chat's current members, and `steamClient.chatRooms[chatID][memberID].permissions & Steam.EChatPermission.Kick` will evaluate to a nonzero value if the specified user is allowed to kick from the specified chat.

### friends

An object that maps users' SteamIDs to their `EFriendRelationship` with you. Empty until ['relationships'](#relationships) is emitted. ['friend'](#friend) is emitted before this object changes.

### groups

An object that maps groups' SteamIDs to their `EClanRelationship` with you. Empty until ['relationships'](#relationships) is emitted. ['group'](#group) is emitted before this object changes.

## Methods

### setPersonaName(name)

Changes your Steam profile name.

### setPersonaState(EPersonaState)

You'll want to call this with `EPersonaState.Online` upon logon, otherwise you'll show up as offline.

### sendMessage(steamID, message, [EChatEntryType])

Last parameter defaults to `EChatEntryType.ChatMsg`. Another type you might want to use is `EChatEntryType.Emote`.

### addFriend(steamID)

Sends a friend request.

### removeFriend(steamID)

Removes a friend.

### joinChat(steamID)

Attempts to join the specified chat room. The result should arrive in the ['chatEnter' event](#chatenter).

### leaveChat(steamID)

Leaves the specified chat room. Will silently fail if you are not currently in it. Removes the chat from [`chatRooms`](#chatrooms).

### lockChat(steamID), unlockChat(steamID)

Locks and unlocks a chat room respectively.

### setModerated(steamID), setUnmoderated(steamID)

Enables and disables officers-only chat respectively.

### kick(chatSteamID, memberSteamID), ban(chatSteamID, memberSteamID), unban(chatSteamID, memberSteamID)

Self-explanatory.

### chatInvite(chatSteamID, invitedSteamID)

Invites the specified user to the specified chat.

### getSteamLevel(steamids, callback)

Requests the Steam level of a number of specified accounts. The `steamids` argument should be an array of SteamIDs.

The single object parameter of the `callback` has the requested SteamIDs as properties and the level as their values. Example:

```js
{
	"76561198006409530": 62,
	"76561197960287930": 7
}
```

### requestFriendData(steamIDs, [requestedData])

Requests friend data. `steamIDs` must be an array. `requestedData` is optional – if falsy, defaults to `EClientPersonaStateFlag.PlayerName | EClientPersonaStateFlag.Presence | EClientPersonaStateFlag.SourceID | EClientPersonaStateFlag.GameExtraInfo`. The response, if any, should arrive in the ['user' event](#user).

### setIgnoreFriend(steamID, setIgnore, callback)

Blocks a friend if `setIgnore` is `true`, unblocks them if it's `false`. The first argument to `callback` will be `EResult`.

## Events

### 'chatInvite'
* SteamID of the chat you were invited to
* name of the chat
* SteamID of the user who invited you

### 'personaState'
* [`CMsgClientPersonaState.Friend`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver.proto)

Someone has gone offline/online, started a game, changed their nickname or something else. Note that the [`personaStates`](#personastates) property is not yet updated when this event is fired, so you can compare the new state with the old one to see what changed.

### 'clanState'
* [`CMsgClientClanState`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver.proto)

Some group has posted an event or an announcement, changed their avatar or something else. Note that the [`clanStates`](#clanstates) property is not yet updated when this event is fired, so you can compare the new state with the old one to see what changed.

### 'relationships'

The [`friends`](#friends) and [`groups`](#groups) properties now contain data (unless your friend/group list is empty). Listen for this if you want to accept/decline friend requests that came while you were offline, for example.

### 'friend'
* SteamID of the user
* `EFriendRelationship`

Some activity in your friend list. For example, `EFriendRelationship.RequestRecipient` means you got a friend invite, `EFriendRelationship.None` means you got removed. The [`friends`](#friends) property is updated after this event is emitted.

### 'group'
* SteamID of the group
* `EClanRelationship`

Some activity in your group list. For example, `EClanRelationship.Invited` means you got invited to a group, `EClanRelationship.Kicked` means you got kicked. The [`groups`](#groups) property is updated after this event is emitted.

### 'friendMsg'
* SteamID of the user
* the message
* `EChatEntryType`

### 'chatMsg'
* SteamID of the chat room
* the message
* `EChatEntryType`
* SteamID of the chatter

### 'message'
Same arguments as the above two, captures both events. In case of a friend message, the fourth argument will be undefined.

### 'friendMsgEchoToSender'
Same as '[friendMsg](#friendmsg)', except it is a message you send to a friend on another client.

### 'chatEnter'
* SteamID of the chat room
* `EChatRoomEnterResponse`

The result of attempting to join a chat. If successful, the list of chat members is available in [`chatRooms`](#chatrooms).

### 'chatStateChange'
* `EChatMemberStateChange`
* SteamID of the user who entered or left the chat room, disconnected, or was kicked or banned
* SteamID of the chat where it happened
* SteamID of the user who kicked or banned

Something happened in a chat you are in. For example, if the first argument equals `Steam.EChatMemberStateChange.Kicked`, then someone got kicked.

### 'chatRoomInfo'
* SteamID of the chat
* `EChatInfoType`

In case of `EChatInfoType.InfoUpdate`, there are two extra arguments:

* A bitset of values from `EChatFlags`
* SteamID of the user who initiated the change
