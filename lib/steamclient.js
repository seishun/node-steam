var EventEmitter = require('events').EventEmitter;
require('ref');

function SteamClient(username, password) {
  EventEmitter.call(this); // TODO: check if this is necessary
  
  var cmclient = new (require('./cmclient.js'))(username, password, this.emit.bind(this));
//  this.send = cmclient.send.bind(cmclient);
  
  this.changeStatus = function(name, state) {
    if (typeof name == 'number') {
      state = name;
      name = undefined;
    }
    
    cmclient.send('ClientChangeStatus', {
      personaState: state,
      playerName: name
    });
  };
  
  this.joinChat = function(steamId) {
    var body = new Buffer(9); // steamIdChat (8) + isVoiceSpeaker (1)
    
    body.writeUInt64LE(steamId, 0);
    if (body[6] == 0x70) {
      body[6] = 0x88;
    }
    body.writeUInt8(0, 8); // isVoiceSpeaker
    
    cmclient.send('ClientJoinChat', body);
  };
  
  this.sendChatMessage = function(target, message, type) {
    cmclient.send('ClientFriendMsg', {
      chatEntryType: type || 1,
      message: new Buffer(message),
      steamid: target
    });
  };
  
  this.sendChatRoomMessage = function(steamIdChat, message, type) {
    var body = new Buffer(20 + Buffer.byteLength(message) + 1); // null-terminated
    
    body.writeUInt64LE(cmclient.steamID, 0);
    body.writeUInt64LE(steamIdChat, 8);
    if (body[14] == 0x70) {
      body[14] = 0x88;
    }
    body.writeInt32LE(type || 1, 16);
    body.writeCString(message, 20);
    
    cmclient.send('ClientChatMsg', body);
  };
  
  this.getFriendPersonaName = function(steamId) {
    return cmclient.users[steamId];
  };
  
  this.steamID = function() {
    return cmclient.steamID;
  };
}

require('util').inherits(SteamClient, EventEmitter);

module.exports = SteamClient;
