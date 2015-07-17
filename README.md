# Steam for Node.js and io.js

This is a node port of [SteamKit2](https://github.com/SteamRE/SteamKit). It lets you interface with Steam without running an actual Steam client. Could be used to run an autonomous chat/trade bot.

**Please read the [release notes](https://github.com/seishun/node-steam/releases/tag/v1.0.0) for v1.0.0.**

# Installation

```
npm install steam
```

Note: when installing from git, you have to additionally run `npm install` inside the project directory to run the `prepublish` script (see [npm/npm#3055](https://github.com/npm/npm/issues/3055)). It pulls Steam resources (Protobufs and SteamLanguage) from SteamKit2 and requires `svn`.

**Note: only Node.js v0.12 and io.js v2.x are supported.**

# Usage
First, `require` this module.
```js
var Steam = require('steam');
```
`Steam` is now a namespace object containing:
* [SteamClient class](#steamclient)
* [Several handler classes](#handlers)
* [`servers` property](#servers)
* [Enums](#enums)

Then you'll want to create an instance of SteamClient and any handlers you need, call [SteamClient#connect](#connect) and assign event listeners.

```js
var steamClient = new Steam.SteamClient();
var steamUser = new Steam.SteamUser(steamClient);
steamClient.connect();
steamClient.on('connected', function() {
  steamUser.logOn({
    account_name: 'username',
    password: 'password'
  });
});
steamClient.on('logOnResponse', function() { /* ... */});
```

See example.js for the usage of some of the available API.

# Servers

`Steam.servers` contains the list of CM servers node-steam will attempt to connect to. The bootstrapped list (see [servers.js](https://github.com/seishun/node-steam/blob/master/lib/servers.js)) is not always up-to-date and might contain dead servers. To avoid timeouts, replace it with your own list before logging in if you have one (see ['servers' event](#servers-1)).

# SteamID

Since JavaScript's Number type does not have enough precision to store 64-bit integers, SteamIDs are represented as decimal strings. (Just wrap the number in quotes)

# Enums

Whenever a method accepts (or an event provides) an `ESomething`, it's a Number that represents some enum value. See [enums.steamd](https://github.com/SteamRE/SteamKit/blob/master/Resources/SteamLanguage/enums.steamd) and [eresult.steamd](https://github.com/SteamRE/SteamKit/blob/master/Resources/SteamLanguage/eresult.steamd) for the whole list of them. For each enum, there is an equivalently named property on `Steam`. The property is an object; for each of the enum's members, there is an equivalently named property on the object with an equivalent value.

Note that you can't easily get the string value from the number, but you probably don't need to. You can still use them in conditions (e.g. `if (type == Steam.EChatEntryType.Emote) ...`) or switch statements.

# Protobufs

Whenever a method accepts (or an event provides) a `CMsgSomething`, it's an object that represents a protobuf message. It has an equivalently named property for each set field in the specified message with the type as follows:

* `(u)int32` and `fixed32` fields: Number
* `uint64`, `fixed64` and `string` fields: String
* `bytes` fields: Buffer objects
* `bool` fields: Boolean

See the [wiki](https://github.com/seishun/node-steam/wiki/Protobufs) for descriptions of protobuf fields.

# Handlers

Most of the API is provided by handler classes that internally send and receive low-level client messages using ['message'/send](#messagesend):

* [SteamUser](lib/handlers/user) - user account-related functionality, including logon.
* [SteamFriends](lib/handlers/friends) - Community functionality, such as chats and friend messages.
* [SteamTrading](lib/handlers/trading) - sending and receiving trade requests. Not to be confused with trade offers.
* [SteamGameCoordinator](lib/handlers/game_coordinator) - sending and receiving Game Coordinator messages.

If you think some unimplemented functionality belongs in one of the existing handlers, feel free to submit an issue to discuss it.

# SteamClient

## Properties

### connected

A boolean that indicates whether you are currently connected and the encryption handshake is complete. ['connected'](#connected-1) is emitted when it changes to `true`, and ['error'](#error) is emitted when it changes to `false` unless you called [disconnect](#disconnect). Sending any client messages is only allowed while this is `true`.

### loggedOn

A boolean that indicates whether you are currently logged on. Calling any handler methods other than [SteamUser#logOn](lib/handlers/user#logonlogondetails) is only allowed while logged on.

### steamID

Your own SteamID while logged on, otherwise unspecified. Must be set to a valid initial value before sending a logon message ([SteamUser#logOn](lib/handlers/user#logonlogondetails) does that for you).

## Methods

### connect()

Connects to Steam. It will keep trying to reconnect until encryption handshake is complete (see ['connected'](#connected-1)), unless you cancel it with [disconnect](#disconnect).

You can call this method at any time. If you are already connected, disconnects you first. If there is an ongoing connection attempt, cancels it.

### disconnect()

Immediately terminates the connection and prevents any events (including ['error'](#error)) from being emitted until you [connect](#connect) again. If you are already disconnected, does nothing. If there is an ongoing connection attempt, cancels it.


## Events

### 'error'

Connection closed by the server. Only emitted if the encryption handshake is complete, otherwise it will reconnect automatically. [`loggedOn`](#loggedon) is now `false`.

### 'connected'

Encryption handshake complete. From now on, it's your responsibility to handle disconnections and reconnect (see ['error'](#error)). You'll likely want to log on now (see [SteamUser#logOn](lib/handlers/user#logonlogondetails)).

### 'logOnResponse'
* [`CMsgClientLogonResponse`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_clientserver.proto)

Logon response received. If `eresult` is `EResult.OK`, [`loggedOn`](#loggedon) is now `true`.

### 'servers'
* an Array containing the up-to-date server list

node-steam will use this new list when reconnecting, but it will be lost when your application restarts. You might want to save it to a file or a database and assign it to [`Steam.servers`](#servers) before logging in next time.

Note that `Steam.servers` will be automatically updated _after_ this event is emitted. This will be useful if you want to compare the old list with the new one for some reason - otherwise it shouldn't matter.

### 'loggedOff'
* `EResult`

You were logged off from Steam. [`loggedOn`](#loggedon) is now `false`.


## 'message'/send

Sending and receiving client messages is designed to be symmetrical, so the event and the method are documented together. Both have the following arguments:

* `header` - an object representing the message header. It has the following properties:
  * `msg` - `EMsg` (no protomask).
  * `proto` - a [`CMsgProtoBufHeader`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/steamclient/steammessages_base.proto) object if this message is protobuf-backed, otherwise `header.proto` is falsy. The following fields are reserved for internal use and shall be ignored: `steamid`, `client_sessionid`, `jobid_source`, `jobid_target`. (Note: pass an empty object if you don't need to set any fields)
* `body` - a Buffer containing the rest of the message. (Note: in SteamKit2's terms, this is "Body" plus "Payload")
* `callback` (optional) - if not falsy, then this message is a request, and `callback` shall be called with any response to it instead of 'message'/send. `callback` has the same arguments as 'message'/send.
