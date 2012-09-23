var EventEmitter = require('events').EventEmitter;

function SteamClient(username, password) {
  EventEmitter.call(this); // TODO: check if this is necessary
  
  var cmclient = new (require('./cmclient.js'))(this.emit.bind(this));
  cmclient.username = username;
  cmclient.password = password;
//  cmclient.emit = this.emit.bind(this);
  
//  this.changeStatus = function(state, name) {
//    cmclient.send('ClientChangeStatus', {
//      personaState: state,
//      playerName: name
//    });
//  };
  
  this.send = cmclient.send.bind(cmclient);
  
  this.joinChat = function(steamID) {
    var body = new Buffer(9); // steamIdChat (8) + isVoiceSpeaker (1)
    
    steamID.copy(body, 0);
    body.writeInt8(0, 8);
    
    cmclient.send('ClientJoinChat', body);
  };
  
  this.sendChatMsg = function(steamID, message) {
    var payload = new Buffer(message);
    
    var body = new Buffer(20 + payload.length + 1);
    
    cmclient.steamID.copy(body, 0);

    var lo = steamID;
    var hi = 0x01880000;
    body.writeInt32LE(lo, 8);
    body.writeInt32LE(hi, 12);
    body.writeInt32LE(1, 16);
    payload.copy(body, 20);
    body.writeInt8(0, 20 + payload.length);
    
    cmclient.send('ClientChatMsg', body);
  };
}

require('util').inherits(SteamClient, EventEmitter);

module.exports = SteamClient;