# SteamGameCoordinator

This is a handler for sending and receiving Game Coordinator messages. Initialize it by passing a SteamClient instance and an AppID to the constructor.

```js
var steamGameCoordinator = new Steam.SteamGameCoordinator(steamClient, 570);
```

It's intended to have the same API as SteamClient's 'message'/send except it uses a different `CMsgProtoBufHeader`.

## 'message'/send

Sending and receiving Game Coordinator messages is designed to be symmetrical, so the event and the method are documented together. Both have the following arguments:

* `header` - an object representing the message header. It has the following properties:
  * `msg` - the game-specific "type" of the message (no protomask).
  * `proto` - a [`CMsgProtoBufHeader`](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/dota/steammessages.proto) object if this message is protobuf-backed, otherwise `header.proto` is falsy. The fields `job_id_source` and `job_id_target` are reserved for internal use and shall be ignored. (Note: pass an empty object if you don't need to set any fields)
* `body` - a Buffer containing the rest of the message. (Note: in SteamKit2's terms, this is "Body" plus "Payload")
* `callback` (optional) - if not falsy, then this message is a request, and `callback` shall be called with any response to it instead of 'message'/send. `callback` has the same arguments as 'message'/send.

The 'message' event is only emitted by a SteamGameCoordinator instance if it was initialized with the same AppID as that of the incoming message. When sending a message, it uses the AppID it was initialized with.
