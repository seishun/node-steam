# Steam for Node.js

Lets you interface with Steam without running an actual Steam client, similarly to [SteamKit2](https://bitbucket.org/VoiDeD/steamre/wiki/Home). Could be used to run an autonomous chat bot.

Note: if you are looking for the Steam WebAPI wrapper, it has been renamed to `steam-web`.

# Installation

```
npm install steam
```
# Usage

The API is scarce compared to SteamKit2 - however, chat and trade functions are implemented.

```js
var Steam = require('steam');
var bot = new Steam.SteamClient();
bot.logOn('username', 'password');
```

You can interface with the bot by calling it methods and listening to its events. Use decimal strings whenever a SteamID is required, not numbers. The bot's `SteamID` property should contain its own SteamID if you're logged on.

See example.js for the usage of some of the available API.

# Methods

## bot.logOn(username, password, [authCode])

Optionally, `authCode` is your SteamGuard code (not tested)

## bot.setPersonaName(name)

## bot.setPersonaState(state)
`state` is one of `Steam.EPersonaState`. You'll want to call this with `Steam.EPersonaState.Online` upon logon, otherwise you'll show up as offline.

## var name = bot.getFriendPersonaName(steamId)

## bot.sendChatMessage(target, message, [type])
`type` equals `Steam.EChatEntryType.ChatMsg` if not provided. Another type you might want to use is `Steam.EChatEntryType.Emote`.

## bot.joinChat(steamId)

## bot.sendChatRoomMessage(steamIdChat, message, [type])
Same arguments as `sendChatMessage`.

## bot.trade(user)
Sends a trade request to the specified SteamID.

## bot.respondToTrade(tradeId, acceptTrade)
Same `tradeId` as the one passed through the `tradeProposed` event. `acceptTrade` should be `true` or `false`.

## bot.cancelTrade(user)
Cancels your proposed trade to the specified SteamID.

# Events

## 'connected'

## 'loggedOn'
You can now safely use all API.

## 'webLoggedOn'
* sessionID
* token

## 'loggedOff'
* `result` - one of `Steam.EResult`, the reason you were logged off.

You shouldn't use any API now, wait until it reconnects (hopefully).

## 'chatInvite'
* `steamIdChat`
* `chatName`
* `steamIdPatron` - SteamID of the person who invited you.

## 'chatMsg'
* `chatter`
* `message`
* `chatRoom`
* `msgType` - one of `Steam.EChatEntryType`

## 'entered', 'left', 'disconnected', 'banned'
* `chatterActedOn`
* `steamIdChat`
* `chatterActedBy`

## 'tradeProposed'
* `tradeID`
* `otherClient` - SteamID
* `otherName` - seems to be always empty

## 'tradeResult'
* `tradeID`
* `response` - one of `Steam.EEconTradeResponse`
* `otherClient`

## 'sessionStart'
* `otherClient`

The trade is now available at http://steamcommunity.com/trade/< otherClient >. You must have a cookie containing `sessionID` and `token` received in webLoggedOn.

## 'announcement'
* `group`
* `headline`
