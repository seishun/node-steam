# Steam for Node.js

This is a Node.js port of [SteamKit2](https://bitbucket.org/VoiDeD/steamre/wiki/Home). It lets you interface with Steam without running an actual Steam client. Could be used to run an autonomous chat/trade bot.

Note: if you are looking for the Steam WebAPI wrapper, it has been renamed to `steam-web`.

# Installation

```
npm install steam
```
# Usage

The API is scarce compared to SteamKit2 - however, most chat and trade functions are implemented.

```js
var Steam = require('steam');
var bot = new Steam.SteamClient();
bot.logOn('username', 'password');
```

You can interface with the bot by calling its methods and listening to its events.

See example.js for the usage of some of the available API.

# SteamID

The `Steam.SteamID` class encapsulates a [SteamID](https://developer.valvesoftware.com/wiki/SteamID). An instance of `SteamID` can be constructed from a decimal string, and converted to a string by calling its `toString` method. Components of a SteamID can be accessed using properties `accountID`, `accountInstance`, `accountType` and `accountUniverse`.

Whenever a SteamID is returned, it is an instance of `SteamID`. Whenever a SteamID is required, you can pass either a `SteamID` instance, or a decimal string.


# Properties

## steamID

Your own SteamID

## users

Information about users you have encountered. `users[<steamid>]` will get you an object containing properties such as `playerName` and `gameName`.

## chatRooms

Information about chat rooms you have joined. `chatRooms[<steamIdChat>]` will get you an object whose keys are the chat's current members, and the values are `'owner'`, `'officer'`, `'moderator'` or `''`.

# Methods

## logOn(username, password, [authCode])

Connects to Steam and logs you on upon connecting. Optionally, `authCode` is your SteamGuard code.

## setPersonaName(name)

Changes your Steam profile name.

## setPersonaState(state)

`state` is one of `Steam.EPersonaState`. You'll want to call this with `Steam.EPersonaState.Online` upon logon, otherwise you'll show up as offline.

## sendMessage(target, message, [type])
`target` is the SteamID of a user or a chat. `type` equals `Steam.EChatEntryType.ChatMsg` if not specified. Another type you might want to use is `Steam.EChatEntryType.Emote`.

## joinChat(steamID)

Joins the chat room of the specified group. Go to the group's Community page, press Ctrl+U and search for "joinchat". Will silently fail if you are not allowed to join.

## kick(steamIdChat, steamIdMember)
## ban(steamIdChat, steamIdMember)
## unban(steamIdChat, steamIdMember)

Self-explanatory.

## trade(user)

Sends a trade request to the specified SteamID.

## respondToTrade(tradeId, acceptTrade)

Same `tradeId` as the one passed through the `tradeProposed` event. `acceptTrade` should be `true` or `false`.

## cancelTrade(user)

Cancels your proposed trade to the specified SteamID.

# Events

## 'connected'

For informative purposes only. Emitted after a successful encryption handshake.

## 'loggedOn'

You can now safely use all API.

## 'webLoggedOn'
* `sessionID`
* `token`

You can use the callback arguments to construct a cookie to access Steam Community web functions without a separate login.

## 'loggedOff'
* `result` - one of `Steam.EResult`, the reason you were logged off

Do not use any API now, wait until it reconnects (hopefully).

## 'chatInvite'
* `chat` - SteamID of the chat you were invited to
* `chatName` - name of the chat
* `patron` - SteamID of the user who invited you

## 'friendMsg'
* `from` - SteamID of the user
* `message` - the message
* `msgType` - one of `Steam.EChatEntryType`

## 'chatMsg'
* `chatRoom` - SteamID of the chat room
* `message` - the message
* `msgType` - one of `Steam.EChatEntryType`
* `chatter` - SteamID of the user

## 'message'
Same arguments as the above two, captures both events. In case of a friend message, `chatter` will be undefined.

## 'chatStateChange
* `stateChange` - one of `Steam.EChatMemberStateChange`
* `chatterActedOn` - SteamID of the user who entered or left the chat room, disconnected, or was kicked or banned
* `steamIdChat` - SteamID of the chat where it happened
* `chatterActedBy` - SteamID of the user who kicked or banned

Something happened in a chat you are in.

## 'tradeProposed'
* `tradeID`
* `otherClient` - SteamID
* `otherName` - seems to be always empty

You were offered a trade.

## 'tradeResult'
* `tradeID`
* `response` - one of `Steam.EEconTradeResponse`
* `otherClient` - SteamID of the user you sent a trade request

Listen for this event if you are the one sending a trade request.

## 'sessionStart'
* `otherClient`

The trade is now available at http://steamcommunity.com/trade/{otherClient}. You need a cookie as described in `webLoggedOn`. You can use [node-steam-trade](https://github.com/seishun/node-steam-trade) to automate the trade itself.

## 'announcement'
* `group` - SteamID
* `headline`

Use the group's RSS feed to get the body of the announcement if you want it.
