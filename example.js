var fs = require('fs');
var Steam = require('steam');

// if we've saved a server list, use it
if (fs.existsSync('servers')) {
  Steam.servers = JSON.parse(fs.readFileSync('servers'));
}

var bot = new Steam.SteamClient();

bot.on('connected', function(result) {
  if(result == Steam.EResult.OK) {
    console.log('Connected to Steam, Logging In');
    bot.logOn('username', 'password');

  } else {
    console.log('Connection Failed');
  }
});

bot.on('loggedOn', function(result) {
  if(result == Steam.EResult.OK) {
    console.log('Logged in!');
    bot.setPersonaState(Steam.EPersonaState.Online); // to display your bot's status as "Online"
    bot.setPersonaName('Haruhi'); // to change its nickname
    bot.joinChat('103582791431621417'); // the group's SteamID as a string
  } else {
    console.log('Login failed with code: ' + result);
  }
});

bot.on('servers', function(servers) {
  fs.writeFile('servers', JSON.stringify(servers));
});

bot.on('chatInvite', function(chatRoomID, chatRoomName, patronID) {
  console.log('Got an invite to ' + chatRoomName + ' from ' + bot.users[patronID].playerName);
  bot.joinChat(chatRoomID); // autojoin on invite
});

bot.on('message', function(source, message, type, chatter) {
  // respond to both chat room and private messages
  console.log('Received message: ' + message);
  if (message == 'ping') {
    bot.sendMessage(source, 'pong', Steam.EChatEntryType.ChatMsg); // ChatMsg by default
  }
});

bot.on('chatStateChange', function(stateChange, chatterActedOn, steamIdChat, chatterActedBy) {
  if (stateChange == Steam.EChatMemberStateChange.Kicked && chatterActedOn == bot.steamID) {
    bot.joinChat(steamIdChat);  // autorejoin!
  }
});

bot.on('announcement', function(group, headline) {
  console.log('Group with SteamID ' + group + ' has posted ' + headline);
});

bot.connect();