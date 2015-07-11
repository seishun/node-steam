# SteamUser

This is a handler for user account-related functionality. Initialize it by passing a SteamClient instance to the constructor.

```js
var steamUser = new Steam.SteamUser(steamClient);
```

## Methods

### logOn(logOnDetails)

Sets `SteamClient#steamID` to the default value for user accounts and sends a ClientLogon message. `logOnDetails` is a [`CMsgClientLogon`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver.proto) object. It's used as-is except `protocol_version` is set to the currently implemented protocol version.

### requestWebAPIAuthenticateUserNonce(callback)

Requests a nonce for WebAPI's AuthenticateUser method. The first argument to `callback` will be a [`CMsgClientRequestWebAPIAuthenticateUserNonceResponse`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver.proto) object.

### gamesPlayed(gamesPlayed)

Tells Steam you are playing game(s). `gamesPlayed` is a [`CMsgClientGamesPlayed`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver.proto) object.

## Events

### 'updateMachineAuth'
* [`CMsgClientUpdateMachineAuth`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver_2.proto)
* `callback`

Call `callback` with a [`CMsgClientUpdateMachineAuthResponse`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver_2.proto) object to accept this sentry update.

### 'tradeOffers'
* New count (can be zero)

Your number of pending incoming trade offers has changed.
