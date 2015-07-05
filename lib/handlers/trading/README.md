# SteamTrading

This is a handler for sending and receiving trade requests. Initialize it by passing a SteamClient instance to the constructor.

```js
var steamTrading = new Steam.SteamTrading(steamClient);
```

## Methods

### trade(steamID)

Sends a trade request to the specified user.

### respondToTrade(tradeID, acceptTrade)

Same `tradeID` as the one passed through the ['tradeProposed' event](#tradeproposed). `acceptTrade` should be `true` or `false`.

### cancelTrade(steamID)

Cancels your proposed trade to the specified user.

## Events

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

The trade is now available at http://steamcommunity.com/trade/{SteamID}. You can use [node-steam-trade](https://github.com/seishun/node-steam-trade) to automate the trade itself.
