# SteamRichPresence

This is a handler for sending and receiving Rich Presence messages. Initialize it by passing a SteamClient instance and an AppID to the constructor.

```js
var steamRichPresence = new Steam.SteamRichPresence(steamClient, 570);
```

## Methods

### upload(body)

Uploads rich presence for the AppID this SteamRichPresence instance was initialized with. `body` is a [`CMsgClientRichPresenceUpload`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver_2.proto) object.

### request(body)

Requests rich presence for the AppID this SteamRichPresence instance was initialized with. `body` is a [`CMsgClientRichPresenceRequest`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver_2.proto) object.

## Events

### 'info'
* [`CMsgClientRichPresenceInfo`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver_2.proto)

Rich presence info was received for the AppID this SteamRichPresence instance was initialized with.
