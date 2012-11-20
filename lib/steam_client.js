var EventEmitter = require('events').EventEmitter;

var Steam = exports;
Steam.Internal = new (require('protobuf').Schema)(require('fs').readFileSync(__dirname + '/generated/steam_msg.desc'));
require('./generated/steam_language');
require('./generated/steam_language_internal');

var EMsg = Steam.EMsg;

var protoMask = 0x80000000;


function SteamClient() {
  EventEmitter.call(this);
  
  this._connection = new (require('./connection'))();
  this._connection.netMsgReceived = this._netMsgReceived.bind(this);
  this._connection.disconnected = this._disconnected.bind(this);
  this._connection.emit = this.emit.bind(this);
  
  this._users = {};
}

require('util').inherits(SteamClient, EventEmitter);


SteamClient.prototype._send = function(eMsg, body) {
  var header;
  
  if (eMsg == EMsg.ChannelEncryptResponse) {
    header = Steam.Internal.MsgHdr.serialize({
      msg: eMsg
    });
  
  } else if (eMsg & protoMask) {
    header = Steam.Internal.MsgHdrProtoBuf.serialize({
      msg: eMsg,
      proto: {
        clientSessionid: this._sessionID,
        steamid: this.steamID || 0x0110000100000000
      }
    });
  
  } else {
    header = Steam.Internal.ExtendedClientMsgHdr.serialize({
      msg: eMsg,
      steamID: this.steamID,
      sessionID: this._sessionID
    });
  }
  
  this._connection.send(Buffer.concat([header, body]));
};


SteamClient.prototype._netMsgReceived = function(data) {
  var rawEMsg = data.readUInt32LE(0);
  var eMsg = rawEMsg & ~protoMask;
    
  var body;
  if (eMsg == EMsg.ChannelEncryptRequest || eMsg == EMsg.ChannelEncryptResult) {
    body = data.slice(Steam.Internal.MsgHdr.baseSize);
    
  } else if (rawEMsg & protoMask) {
    var headerLength = data.readInt32LE(4);
    var baseSize = Steam.Internal.MsgHdrProtoBuf.baseSize;
    if (!this._sessionID && headerLength > 0) {
      var header = Steam.Internal.CMsgProtoBufHeader.parse(data.slice(baseSize, baseSize + headerLength));
      this._sessionID = header.clientSessionid;
      this.steamID = header.steamid;
    }
    body = data.slice(baseSize + headerLength);
    
  } else {
    body = data.slice(Steam.Internal.ExtendedClientMsgHdr.baseSize);
  }
    
  if (eMsg in this._handlers) {
    this._handlers[eMsg].call(this, body);
  } else {
    this.emit('unhandled', eMsg);
  }
};


SteamClient.prototype._disconnected = function() {
  clearInterval(this._heartBeatFunc);
  delete this._connection.sessionKey;
  this.emit('disconnected');
};


Steam.SteamClient = SteamClient;
require('./api');
require('./handlers');
