# SteamUser

This is a handler for user account-related functionality. Initialize it by passing a SteamClient instance to the constructor.

```js
var steamUser = new Steam.SteamUser(steamClient);
```

## Methods

### logOn(logOnDetails)

Sets `SteamClient#steamID` to the default value for user accounts and sends a ClientLogon message. `logOnDetails` is a [`CMsgClientLogon`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver.proto) object. It's used as-is except `protocol_version` is set to the currently implemented protocol version.

### gamesPlayed(appIDs)

Tells Steam you are playing game(s). `appIDs` is an array of AppIDs, for example `[570]`. Multiple AppIDs can (used to?) be used for multi-game idling.

## Events

### 'sentry'
* a Buffer containing your Steam Guard sentry file hash

If you didn't provide a hash when logging in, Steam will send you one through this event. If you have Steam Guard enabled, you should save this and use it for your further logons. It will not expire unlike the code.

### 'tradeOffers'
* New count (can be zero)

Your number of pending incoming trade offers has changed.
