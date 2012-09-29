var EventEmitter = require('events').EventEmitter;

function SteamClient(username, password) {
  EventEmitter.call(this); // TODO: check if this is necessary
  
  var cmclient = new (require('./cmclient.js'))(username, password, this.emit.bind(this));
  this.send = cmclient.send.bind(cmclient);
  
  this.joinChat = function(steamId) {
    var body = new Buffer(9); // steamIdChat (8) + isVoiceSpeaker (1)
    
    steamId.copy(body, 0);
    body.writeInt8(0, 8);
    
    cmclient.send('ClientJoinChat', body);
  };
  
  this.sendChatMessage = function(target, message, type) {
    cmclient.send('ClientFriendMsg', {
      chatEntryType: type || 1,
      message: new Buffer(message),
      steamid: target
    });
  };
  
  this.sendChatRoomMessage = function(steamIdChat, type, message) {
    var payload = new Buffer(message);
    var body = new Buffer(20 + payload.length + 1);
    
    cmclient.steamID.copy(body, 0);
    steamIdChat.copy(body, 8);
    body.writeInt32LE(type, 16);
    payload.copy(body, 20);
    body.writeInt8(0, 20 + payload.length);
    
    cmclient.send('ClientChatMsg', body);
  };
}

require('util').inherits(SteamClient, EventEmitter);

module.exports = SteamClient;