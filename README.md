# Steam for Node.js

Lets you interface with Steam without running an actual Steam client, similarly to [SteamKit2](https://bitbucket.org/VoiDeD/steamre/wiki/Home). Could be used to run an autonomous chat bot.

## How to use

The API is scarce so far - only a handful of Steam functions are implemented.

```js
var SteamClient = require('steamclient');
var bot = new SteamClient(username, password); // will start connecting right away
```

You can interface with the bot by calling it methods and listening to its events. See example.js for the usage of most of the available API.

Note that this library is very WIP and the API might change drastically at any point.