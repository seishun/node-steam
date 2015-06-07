var fs = require('fs');
var Steam = require('steam');

// if we've saved a server list, use it
if (fs.existsSync('servers')) {
  Steam.servers = JSON.parse(fs.readFileSync('servers'));
}

var steamClient = new Steam.SteamClient();
var steamUser = new Steam.SteamUser(steamClient);
var steamFriends = new Steam.SteamFriends(steamClient);

steamClient.connect();
steamClient.on('connected', function() {
  steamUser.logOn({
    account_name: 'username',
    password: 'password'
  });
});

steamClient.on('logOnResponse', function(logonResp) {
  if (logonResp.eresult == Steam.EResult.OK) {
    console.log('Logged in!');
    steamFriends.setPersonaState(Steam.EPersonaState.Online); // to display your bot's status as "Online"
    steamFriends.setPersonaName('Haruhi'); // to change its nickname
    steamFriends.joinChat('103582791431621417'); // the group's SteamID as a string
  }
});

steamClient.on('servers', function(servers) {
  fs.writeFile('servers', JSON.stringify(servers));
});

steamFriends.on('chatInvite', function(chatRoomID, chatRoomName, patronID) {
  console.log('Got an invite to ' + chatRoomName + ' from ' + steamFriends.personaStates[patronID].player_name);
  steamFriends.joinChat(chatRoomID); // autojoin on invite
});

steamFriends.on('message', function(source, message, type, chatter) {
  // respond to both chat room and private messages
  console.log('Received message: ' + message);
  if (message == 'ping') {
    steamFriends.sendMessage(source, 'pong', Steam.EChatEntryType.ChatMsg); // ChatMsg by default
  }
});

steamFriends.on('chatStateChange', function(stateChange, chatterActedOn, steamIdChat, chatterActedBy) {
  if (stateChange == Steam.EChatMemberStateChange.Kicked && chatterActedOn == steamClient.steamID) {
    steamFriends.joinChat(steamIdChat);  // autorejoin!
  }
});

steamFriends.on('clanState', function(clanState) {
  if (clanState.announcements.length) {
    console.log('Group with SteamID ' + clanState.steamid_clan + ' has posted ' + clanState.announcements[0].headline);
  }
});
