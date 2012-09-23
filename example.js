var SteamClient = require('./');

var bot = new SteamClient(username, password);

bot.on('connected', function() {
  console.log('Connected!');
});

bot.on('loggedOn', function() {
  console.log('Logged in!');
  bot.send('ClientChangeStatus', {  // you work with protobuf'd messages directly (without wrapper methods)
    personaState: 1,                // 1 stands for "Online". Otherwise your bot will stay offline
    playerName: 'Haruhi'            // optional and can be used alone at some other time
  }); 
});

bot.on('ClientChatInvite', function(data) {
  // see SteamRE / Resources / Protobufs / steamclient / steammessages_clientserver.proto for other kinds of messages you can listen for

  console.log('Got an invite to ' + data.chatName);
  
  // steamIdChat is a buffer containing the 64-bit steamid of the chat room
  bot.joinChat(data.steamIdChat); // autojoin on invite
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