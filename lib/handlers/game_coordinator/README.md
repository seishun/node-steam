# SteamGameCoordinator

This is a handler for sending and receiving Game Coordinator messages. Initialize it by passing a SteamClient instance to the constructor.

```js
var steamGameCoordinator = new Steam.SteamGameCoordinator(steamClient);
```

## Methods

### toGC(appID, type, body, [args...])

Sends a message to Game Coordinator. `body` must be a serialized message without the header (it will be added by node-steam). `type` must be masked accordingly if it's a protobuf message. If any extra arguments are provided and this message receives a response (JobID-based), they will be passed to the ['fromGC' event](#fromgc) handler.

## Events

### 'fromGC'
* appID
* `type` - masked accordingly for protobuf
* the message body
* optional extra args

A message has been received from GC. The extra arguments are the same as passed to [toGC](#togcappid-type-body-callback) if this message is a JobID-based response to it.
