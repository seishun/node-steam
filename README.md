# Steam for Node.js

Lets you interface with Steam without running an actual Steam client, similarly to [SteamKit2](https://bitbucket.org/VoiDeD/steamre/wiki/Home). Could be used to run an autonomous chat bot.

Note: if you are looking for the Steam WebAPI wrapper, it has been renamed to _steam-web_.

## Installation

```
npm install steam
```
## Usage

The API is scarce compared to SteamKit2 - however, most chat functions are implemented.

```js
var Steam = require('steam');
var bot = new Steam.SteamClient();
bot.logOn('username', 'password');
```

You can interface with the bot by calling it methods and listening to its events.


### Methods

#### steamID() --> String
* **Return:** your SteamID as a decimal string

#### logOn(String username, String password, [String authCode])
* username
* password
* authCode - SteamGuard code (not tested)

#### setPersonaName(String name)
* name - new profile name

#### setPersonaState(Number state)
* state - one of Steam.EPersonaState

You'll want to call this with EPersonaState.Online upon logon, otherwise you'll show up as offline.

#### getFriendPersonaName(String steamId) --> String
* steamId - SteamID of the user as a decimal string
* **Return:** the user's current profile name

#### sendChatMessage(String target, String message, [Number type])
* target - SteamID of the user as a decimal string
* message - the message
* type - one of Steam.EChatEntryType (ChatMsg by default)

#### joinChat(String steamId)
* steamId - SteamID of the group as a decimal string

#### sendChatRoomMessage(String steamIdChat, String message, [Number type])
* steamIdChat - SteamID of the group as a decimal string
* message - the message
* type - one of Steam.EChatEntryType (ChatMsg by default)


### Events

#### connected
You can now log on

#### disconnected
You should probably reconnect

#### loggedOn
* Number result

Steam.EResult.OK means you can now safely use all API, otherwise it's an error.

#### loggedOff
* Number result

#### chatInvite
* String steamIdChat - SteamID of the chat you were invited to
* String chatName - name of the chat
* String steamIdPatron - SteamID of the person who invited you

#### chatMsg
* String chatter - SteamID of the person who sent the message
* String message - the message
* String chatRoom - SteamID of the chat room
* Number msgType - one of Steam.EChatEntryType

#### entered, left, disconnected, kicked, banned
* String chatterActedOn - SteamID of the person who entered/left the chat, disconnected or got kicked/banned
* String steamIdChat - SteamID of the chat room where it happened
* String chatterActedBy - SteamID of the person who kicked or banned (same as chatterActedOn if not applicable)

#### announcement
* String group - SteamID of the group that posted the announcement
* String headline - the headline of the announcement

See example.js for the usage of most of the available API.
