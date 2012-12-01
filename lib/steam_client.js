var EventEmitter = require('events').EventEmitter;

var Steam = exports;
var schema = Steam.Internal = new (require('protobuf').Schema)(require('fs').readFileSync(__dirname + '/generated/steam_msg.desc'));
require('./generated/steam_language');
require('./generated/steam_language_internal');
require('./steamID');

var EMsg = Steam.EMsg;

var protoMask = 0x80000000;


function SteamClient() {
  EventEmitter.call(this);
  
  this._connection = new (require('./connection'))();
  this._connection.netMsgReceived = this._netMsgReceived.bind(this);
  this._connection.disconnected = this._disconnected.bind(this);
  this._connection.emit = this.emit.bind(this);
  
  // construct temporary SteamID
  this.steamID = new Steam.SteamID(0);
  this.steamID.accountInstance = 1;
  this.steamID.accountUniverse = Steam.EUniverse.Public;
  this.steamID.accountType = Steam.EAccountType.Individual;
  
  this.users = {};
  this.chatRooms = {};
}

require('util').inherits(SteamClient, EventEmitter);


// Methods

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
        steamid: this.steamID.toString()
      }
    });
  
  } else {
    header = Steam.Internal.ExtendedClientMsgHdr.serialize({
      msg: eMsg,
      steamID: this.steamID.toString(),
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
    body = data.slice(schema.MsgHdr.baseSize);
    
  } else if (rawEMsg & protoMask) {
    var headerLength = data.readInt32LE(4);
    var baseSize = schema.MsgHdrProtoBuf.baseSize;
    if (!this._sessionID && headerLength > 0) {
      var header = schema.CMsgProtoBufHeader.parse(data.slice(baseSize, baseSize + headerLength));
      this._sessionID = header.clientSessionid;
      this.steamID = new Steam.SteamID(header.steamid);
    }
    body = data.slice(baseSize + headerLength);
    
  } else {
    body = data.slice(schema.ExtendedClientMsgHdr.baseSize);
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


// Handlers

var handlers = SteamClient.prototype._handlers = {};

handlers[EMsg.ChannelEncryptRequest] = function(data) {    
//  var encRequest = schema.MsgChannelEncryptRequest.parse(data);
  
  this._tempSessionKey = require('crypto').randomBytes(32);
  var cryptedSessKey = require('ursa').createPublicKey(require('fs').readFileSync(__dirname + '/public.pub')).encrypt(this._tempSessionKey);
  var keyCrc = require('crc').buffer.crc32(cryptedSessKey);
  
  var encResp = schema.MsgChannelEncryptResponse.serialize({});
  var body = new Buffer(encResp.length + 128 + 4 + 4); // key, crc, trailer
  
  encResp.copy(body, 0);
  cryptedSessKey.copy(body, encResp.length);
  body.writeInt32LE(keyCrc, encResp.length + 128);
  body.writeUInt32LE(0, encResp.length + 128 + 4); // TODO: check if the trailer is required
  
  this._send(EMsg.ChannelEncryptResponse, body);
};

handlers[EMsg.ChannelEncryptResult] = function(data) {
  var encResult = schema.MsgChannelEncryptResult.parse(data);
  
  if (encResult.result == Steam.EResult.OK) {
    this._connection.sessionKey = this._tempSessionKey;
  } else {
    this.emit('error', new Error("Encryption fail: " + encResult.result));
    return;
  }
  
  this.emit('connected');
  
  this._send(EMsg.ClientLogon | protoMask, schema.CMsgClientLogon.serialize({
    accountName: this._username,
    password: this._password,
    protocolVersion: 65575,
    authCode: this._authCode
  }));
};

handlers[EMsg.Multi] = function(data) {
  var msgMulti = schema.CMsgMulti.parse(data);
  
  var payload = msgMulti.messageBody;
      
  if (msgMulti.sizeUnzipped) {
    var zip = new (require('adm-zip'))(payload);
    payload = zip.readFile('z');
  }
  
  while (payload.length) {
    var subSize = payload.readUInt32LE(0);
    this._netMsgReceived(payload.slice(4, 4 + subSize));
    payload = payload.slice(4 + subSize);
  }
};


Steam.SteamClient = SteamClient;
require('./handlers/friends');
require('./handlers/trading');
require('./handlers/user');
