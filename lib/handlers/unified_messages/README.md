# SteamUnifiedMessages

This is a handler for sending and receiving unified messages. Initialize it by passing a SteamClient instance and a service name to the constructor.

```js
var steamUnifiedMessages = new Steam.SteamUnifiedMessages(steamClient, 'Parental');
```

## Methods

### send(method, body, [callback])

Calls the specified `method` of the service this SteamUnifiedMessages instance was initialized with. `body` is this method's input type object. If not falsy, `callback` will be called with an `EResult` and this method's output type object, otherwise this call is considered a notification.

## Events

### 'message'
* Method name
* The method's input type object

A notification was received from the service this SteamUnifiedMessages instance was initialized with.
