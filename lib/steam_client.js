var EventEmitter = require('events').EventEmitter;
var Schema = require('protobuf').Schema;
var Steam = exports;

var fs = require('fs');

// generated from steammessages_base.proto and steammessages_clientserver.proto
var schema = Steam.Internal = new Schema(fs.readFileSync(__dirname + '/generated/steam_msg.desc'));

Steam.GC = {
  // generated from dota/steammessages.proto
  Internal: new Schema(fs.readFileSync(__dirname + '/generated/GC/steam_msg_base.desc'))
};

require('./generated/steam_language');
require('./generated/steam_language_internal');

var EMsg = Steam.EMsg;

var protoMask = 0x80000000;


function SteamClient() {
  EventEmitter.call(this);
}

require('util').inherits(SteamClient, EventEmitter);


// Methods

SteamClient.prototype._send = function(eMsg, body, job) {
  if (typeof job == 'function') {
    var sourceJobID = ++this._currentJobID;
    this._jobs[sourceJobID] = job;
  } else {
    var targetJobID = job;
  }
  
  var header;
  
  if (eMsg == EMsg.ChannelEncryptResponse) {
    header = schema.MsgHdr.serialize({
      msg: eMsg,
      sourceJobID: sourceJobID,
      targetJobID: targetJobID
    });
  
  } else if (eMsg & protoMask) {
    header = schema.MsgHdrProtoBuf.serialize({
      msg: eMsg,
      proto: {
        clientSessionid: this._sessionID,
        steamid: this.steamID,
        jobidSource: sourceJobID,
        jobidTarget: targetJobID
      }
    });
  
  } else {
    header = schema.ExtendedClientMsgHdr.serialize({
      msg: eMsg,
      steamID: this.steamID,
      sessionID: this._sessionID,
      sourceJobID: sourceJobID,
      targetJobID: targetJobID
    });
  }
  
  this._connection.send(Buffer.concat([header, body]));
};

SteamClient.prototype._netMsgReceived = function(data) {
  var rawEMsg = data.readUInt32LE(0);
  var eMsg = rawEMsg & ~protoMask;
  
  var header, sourceJobID, targetJobID, body;
  if (eMsg == EMsg.ChannelEncryptRequest || eMsg == EMsg.ChannelEncryptResult) {
    header = schema.MsgHdr.parse(data);
    sourceJobID = header.sourceJobID;
    targetJobID = header.targetJobID;
    body = data.slice(schema.MsgHdr.baseSize);
  
  } else if (rawEMsg & protoMask) {
    header = schema.MsgHdrProtoBuf.parse(data);
    if (!this._sessionID && header.headerLength > 0) {
      this._sessionID = header.proto.clientSessionid;
      this.steamID = header.proto.steamid;
    }
    sourceJobID = header.proto.jobidSource;
    targetJobID = header.proto.jobidTarget;
    body = data.slice(schema.MsgHdrProtoBuf.baseSize + header.headerLength);
  
  } else {
    header = schema.ExtendedClientMsgHdr.parse(data);
    sourceJobID = header.sourceJobID;
    targetJobID = header.targetJobID;
    body = data.slice(schema.ExtendedClientMsgHdr.baseSize);
  }
  
  if (eMsg in this._handlers) {
    this._handlers[eMsg].call(this, body, this._jobs[targetJobID] || sourceJobID);
  } else {
    this.emit('unhandled', eMsg);
  }
};

SteamClient.prototype._disconnected = function(had_error) {
  this.emit('debug', 'socket closed' + (had_error ? ' with an error' : ''));
  delete this._connection;
  
  if (this.loggedOn) {
    this.emit('debug', 'unexpected disconnection');
    this.loggedOn = false;
    clearInterval(this._heartBeatFunc);
    this.emit('loggedOff');
  }
  
  if (!had_error) {
    this.logOn(this._logOnDetails);
    return;
  }
  
  var timeout = this._timeout || 1;
  this.emit('debug', 'waiting ' + timeout + ' secs');
  this._scheduledConnection = setTimeout(function() {
    delete this._scheduledConnection;
    this.logOn(this._logOnDetails);
  }.bind(this), timeout * 1000);
  this._timeout = timeout * 2;
};


// Handlers

var handlers = SteamClient.prototype._handlers = {};

handlers[EMsg.ChannelEncryptRequest] = function(data) {
  // assume server isn't dead
  this._connection.setTimeout(0);
  
//  var encRequest = schema.MsgChannelEncryptRequest.parse(data);
  this.emit('debug', 'encrypt request');
  
  this._tempSessionKey = require('crypto').randomBytes(32);
  var cryptedSessKey = require('ursa').createPublicKey(fs.readFileSync(__dirname + '/public.pub')).encrypt(this._tempSessionKey);
  var keyCrc = require('buffer-crc32').signed(cryptedSessKey);
  
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
  
  this.emit('debug', 'handshake complete');
  
  this._logOnDetails.protocolVersion = 65575;
  this._send(EMsg.ClientLogon | protoMask, schema.CMsgClientLogon.serialize(this._logOnDetails));
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

handlers[EMsg.ClientCMList] = function(data) {
  var list = schema.CMsgClientCMList.parse(data);
  var servers = list.cmAddresses.map(function(number, index) {
    var buf = new Buffer(4);
    buf.writeUInt32BE(number, 0);
    return {
      host: [].join.call(buf, '.'),
      port: list.cmPorts[index]
    };
  });
  
  this.emit('servers', servers);
  Steam.servers = servers;
};


Steam.SteamClient = SteamClient;
require('./handlers/friends');
require('./handlers/game_coordinator');
require('./handlers/trading');
require('./handlers/user');
