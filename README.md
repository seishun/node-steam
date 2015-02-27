# Steam for Node.js and io.js

This is a node port of [SteamKit2](https://github.com/SteamRE/SteamKit). It lets you interface with Steam without running an actual Steam client. Could be used to run an autonomous chat/trade bot.


# Installation

```
npm install steam
```

Note: when installing from git, you have to additionally run `npm install` inside the project directory to run the `prepublish` script (see [npm/npm#3055](https://github.com/npm/npm/issues/3055)). It pulls Steam resources (Protobufs and SteamLanguage) from SteamKit2 and requires `svn`.

**Note: only Node.js v0.12 and io.js v1.4 are supported.**

# Usage
First, `require` this module.
```js
var Steam = require('steam');
```
`Steam` is now a namespace (implemented as an object) containing the SteamClient class, `servers` property, and a huge collection of enums (implemented as objects). More on those below.

Then you'll want to create an instance of SteamClient, call its [logOn](#logonlogondetails) method and assign event listeners.

```js
var bot = new Steam.SteamClient();
bot.logOn({
  accountName: 'username',
  password: 'password'
});
bot.on('loggedOn', function() { /* ... */});
```

See example.js for the usage of some of the available API.

# Servers

`Steam.servers` contains the list of CM servers node-steam will attempt to connect to. The bootstrapped list (see [servers.js](https://github.com/seishun/node-steam/blob/master/lib/servers.js)) is not always up-to-date and might contain dead servers. To avoid timeouts, replace it with your own list before logging in if you have one (see ['servers' event](#servers-1)).

# SteamID

Since JavaScript's Number type does not have enough precision to store 64-bit integers, SteamIDs are represented as decimal strings. (Just wrap the number in quotes)

Chat-related methods automatically convert ClanIDs (group's SteamID) to ChatIDs. Conversely, ChatIDs are converted to ClanIDs in chat-related events if it's a group chat (i.e. not an "ad hoc" chat), otherwise left alone. In the following docs, chat SteamID always refers to ClanID for group chats and ChatID otherwise.

# Enums

Whenever a method accepts (or an event provides) an `ESomething`, it's a Number that represents some enum value. See [enums.steamd](https://github.com/SteamRE/SteamKit/blob/master/Resources/SteamLanguage/enums.steamd) and [eresult.steamd](https://github.com/SteamRE/SteamKit/blob/master/Resources/SteamLanguage/eresult.steamd) for the whole list of them. For each enum, there is an equivalently named property on `Steam`. The property is an object; for each of the enum's members, there is an equivalently named property on the object with an equivalent value.

Note that you can't easily get the string value from the number, but you probably don't need to. You can still use them in conditions (e.g. `if (type == Steam.EChatEntryType.Emote) ...`) or switch statements.

# SteamClient

## Properties

### loggedOn

A boolean that indicates whether you are currently logged on. ['loggedOn'](#loggedon-1) is emitted when it changes to `true`, and ['loggedOff'](#loggedoff) or ['error'](#error) when it changes to `false`, unless you called [logOff](#logoff). Accessing any other properties or calling any methods other than [logOn](#logonlogondetails) or [logOff](#logoff) is only allowed while logged on.

### steamID

Your own SteamID.

### users

Information about users you have encountered. It's an object whose keys are SteamIDs and values are objects with the same structure as in the ['user' event](#user).

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

### logOn(logOnDetails)

Connects to Steam and logs you on upon connecting. `logOnDetails` is an object with the following properties:

* `accountName` - required.
* `password` - required.
* `authCode` - Steam Guard code. Must be valid if provided, otherwise the logon will fail. Note that Steam Guard codes expire after a short while.
* `shaSentryfile` - sentry hash. If not provided, you'll receive one through the ['sentry' event](#sentry) (if the logon succeeds). If no Steam Guard code is provided, the hash must be already registered with this account, otherwise it's ignored.

If you provide neither a Steam Guard code nor a sentry hash registered with this account, the logon will fail and you'll receive an email with the code.

If you provide both a sentry hash and a valid Steam Guard code, the hash will be registered with this account. This allows you to reuse the same hash for multiple accounts.

You can call this method at any time. If you are already logged on, logs you off first. If there is an ongoing connection attempt, cancels it.

### logOff()

Logs you off from Steam. If you are already logged off, does nothing. If there is an ongoing connection attempt, cancels it. Will not emit either ['loggedOff'](#loggedoff) or ['error'](#error).

### webLogOn(callback)

Logs into Steam Community. You only need this if you know you do. `callback` will be called with an array of your new cookies (as strings).

Do not call this before the first ['webSessionID' event](#websessionid), or you'll get a broken cookie. Feel free to call this whenever you need to refresh your web session - for example, if you log into the same account from a browser on another computer.

### gamesPlayed(appIDs)

Tells Steam you are playing game(s). `appIDs` is an array of AppIDs, for example `[570]`. Multiple AppIDs can (used to?) be used for multi-game idling.

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

### trade(steamID)

Sends a trade request to the specified user.

### respondToTrade(tradeID, acceptTrade)

Same `tradeID` as the one passed through the ['tradeProposed' event](#tradeproposed). `acceptTrade` should be `true` or `false`.

### cancelTrade(steamID)

Cancels your proposed trade to the specified user.

### toGC(appID, type, body, [args...])

Sends a message to Game Coordinator. `body` must be a serialized message without the header (it will be added by node-steam). `type` must be masked accordingly if it's a protobuf message. If any extra arguments are provided and this message receives a response (JobID-based), they will be passed to the ['fromGC' event](#fromgc) handler.

## Events

### 'error'
* `e` - an `Error` object

Something preventing continued operation of node-steam has occurred. `e.cause` is a string containing one of these values:
* 'logonFail' - can't log into Steam. `e.eresult` is an `EResult`, the logon response. Some values you might want to handle are `InvalidPassword`, `AlreadyLoggedInElsewhere` and `AccountLogonDenied` (Steam Guard code required).
* 'loggedOff' - you were logged off for a reason other than Steam going down. `e.eresult` is an `EResult`, most likely `LoggedInElsewhere`.

### 'loggedOn'

You can now safely use all API.

### 'webSessionID'
* your new sessionID

If you are using Steam Community (including trading), you should call [webLogOn](#weblogoncallback) again, since your current cookie is no longer valid.

### 'sentry'
* a Buffer containing your Steam Guard sentry file hash

If you didn't provide a hash when logging in, Steam will send you one through this event. If you have Steam Guard enabled, you should save this and use it for your further logons. It will not expire unlike the code.

### 'servers'
* an Array containing the up-to-date server list

node-steam will use this new list when reconnecting, but it will be lost when your application restarts. You might want to save it to a file or a database and assign it to [`Steam.servers`](#servers) before logging in next time.

Note that `Steam.servers` will be automatically updated _after_ this event is emitted. This will be useful if you want to compare the old list with the new one for some reason - otherwise it shouldn't matter.

### 'loggedOff'

You were logged off from Steam due to it going down. It will keep trying to reconnect and eventually emit either ['loggedOn'](#loggedon-1) or ['error'](#error), unless you cancel it with [logOff](#logoff).

### 'chatInvite'
* SteamID of the chat you were invited to
* name of the chat
* SteamID of the user who invited you

### 'user'
* Object with new user data

Someone has gone offline/online, started a game, changed their nickname or something else. The provided object has a property for each set field in [CMsgClientPersonaState.Friend](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver.proto) with the name converted to camelCase. The values have the following types:

* `gameServerIp`: String (e.g. '88.221.39.235')
* `lastLogoff`, `lastLogon`: Date objects
* other `uint32` fields: Number
* `fixed64` fields: String
* `bytes` fields: Buffer objects

Note that the [`users`](#users) property is not yet updated when this event is fired, so you can compare the new state with the old one to see what changed.

### 'richPresence'
**This API is unstable.**
* SteamID of the user
* the user's string status (e.g. '#DOTA_RP_FINDING_MATCH' or '#DOTA_RP_PLAYING_AS')
* optional extra args (in Dota 2, hero level and hero name)

Game-specific information about a user. Only received when you're in the same game.

### 'relationships'

The [`friends`](#friends) and [`groups`](#groups) properties now contain data (unless your friend/group list is empty). Listen for this if you want to accept/decline friend requests that came while you were offline, for example.

### 'friend'
* SteamID of the user
* `EFriendRelationship`

Some activity in your friend list. For example, `EFriendRelationship.PendingInvitee` means you got a friend invite, `EFriendRelationship.None` means you got removed. The [`friends`](#friends) property is updated after this event is emitted.

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

### 'tradeOffers'
* New count (can be zero)

Your number of pending incoming trade offers has changed.

### 'tradeProposed'
* Trade ID
* SteamID of the user who proposed the trade

You were offered a trade.

### 'tradeResult'
* Trade ID
* `EEconTradeResponse`
* SteamID of the user you sent a trade request

Listen for this event if you are the one sending a trade request.

### 'sessionStart'
* SteamID of the other party

The trade is now available at http://steamcommunity.com/trade/{SteamID}. You'll need the cookies from [webLogOn](#weblogoncallback). You can use [node-steam-trade](https://github.com/seishun/node-steam-trade) to automate the trade itself.

### 'announcement'
* SteamID of the group
* headline

Use the group's RSS feed to get the body of the announcement if you want it.

### 'fromGC'
* appID
* `type` - masked accordingly for protobuf
* the message body
* optional extra args

A message has been received from GC. The extra arguments are the same as passed to [toGC](#togcappid-type-body-callback) if this message is a JobID-based response to it.
