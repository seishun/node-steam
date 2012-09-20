var SteamClient = require('./');

var bot = new SteamClient(username, password);

bot.on('connected', function() {
  console.log('Connected!');
});

bot.on('loggedOn', function() {
  console.log('Logged in!');
  bot.changeStatus(1, 'Haruhi'); // 1 stands for "Online". Otherwise your bot will stay offline
});

bot.on('chatInvite', function() {
  console.log('Got an invite');
  // Can't get the SteamID of the chat room invited to due to limitations of the protobuf library for Node.js
  // See https://code.google.com/p/protobuf-for-node/issues/detail?id=14
  // and https://github.com/chrisdew/protobuf/issues/14
  
  bot.joinChat(0x2ee612); // the lower 32 bits of the chat room's SteamID
});

bot.on('chatMsg', function(message, chatroom) {
  // Only the message and the source chatroom are available.
  console.log('Received message: ' + message);
  if (message == 'ping') {
    bot.sendChatMsg(chatroom, 'pong');
  }
});

bot.on('kicked', function(steamIdChat) { // TODO: generalize the event?
  bot.joinChat(steamIdChat); // autorejoin!
});