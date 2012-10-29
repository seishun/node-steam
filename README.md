# Steam for Node.js

Lets you interface with Steam without running an actual Steam client, similarly to [SteamKit2](https://bitbucket.org/VoiDeD/steamre/wiki/Home). Could be used to run an autonomous chat bot.

## Installation

```
git clone git://github.com/seishun/node-steam.git && cd node-steam && npm install
```
## Usage

The API is scarce compared to SteamKit2 - however, most chat functions are implemented.

```js
var SteamClient = require('./node-steam');
var bot = new SteamClient(username, password); // will start connecting right away
```

You can interface with the bot by calling it methods and listening to its events.


### Methods

#### changeStatus([String name], [Number state])
* name - new profile name
* state - 0 for offline, 1 for online

You'll want to call this with 1 upon logon, otherwise you'll show up as offline.

#### joinChat(String steamId)
* steamId - SteamID of the group as a decimal string

#### sendChatMessage(String target, String message, [Number type])
* target - SteamID of the user as a decimal string
* message - the message
* type - 1 for normal message, 4 for emote (1 by default)

#### sendChatRoomMessage(String steamIdChat, String message, [Number type])
* steamIdChat - SteamID of the group as a decimal string
* message - the message
* type - 1 for normal message, 4 for emote (1 by default)

#### getFriendPersonaName(String steamId) --> String
* steamId - SteamID of the user as a decimal string
* **Return:** the user's current profile name

#### steamID() --> String
* **Return:** your SteamID as a decimal string


### Events

#### loggedOn
You can now safely use all API.

#### chatInvite
* String steamIdChat - SteamID of the chat you were invited to
* String chatName - name of the chat
* String steamIdPatron - SteamID of the person who invited you

#### chatMsg
* String chatter - SteamID of the person who sent the message
* String message - the message
* String chatRoom - SteamID of the chat room
* Number msgType - 1 for normal message, 4 for emote

#### entered, left, disconnected, kicked, banned
* String chatterActedOn - SteamID of the person who entered/left the chat, disconnected or got kicked/banned
* String steamIdChat - SteamID of the chat room where it happened
* String chatterActedBy - SteamID of the person who kicked or banned (same as chatterActedOn if not applicable)

#### announcement
* String group - SteamID of the group that posted the announcement
* String headline - the headline of the announcement

See example.js for the usage of most of the available API.
