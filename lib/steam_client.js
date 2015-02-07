var ByteBuffer = require('bytebuffer');
var EventEmitter = require('events').EventEmitter;
var ProtoBuf = require('protobufjs');
var Steam = exports;

var fs = require('fs');
var path = require('path');

ProtoBuf.convertFieldsToCamelCase = true;

var builder = ProtoBuf.newBuilder();
ProtoBuf.loadProtoFile(path.join(__dirname, '../resources/protobufs/steamclient/steammessages_clientserver.proto'), builder);
ProtoBuf.loadProtoFile(path.join(__dirname, '../resources/protobufs/steamclient/steammessages_clientserver_2.proto'), builder);
var schema = Steam.Internal = builder.build();

Steam.GC = {
  // generated from dota/steammessages.proto
  Internal: ProtoBuf.loadProtoFile(path.join(__dirname, '../resources/protobufs/dota/steammessages.proto')).build()
};

require('../resources/steam_language_parser');

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
    header = new schema.MsgHdr({
      msg: eMsg,
      sourceJobID: sourceJobID,
      targetJobID: targetJobID
    });
  
  } else if (eMsg & protoMask) {
    header = new schema.MsgHdrProtoBuf({
      msg: eMsg,
      proto: {
        clientSessionid: this._sessionID,
        steamid: this.steamID,
        jobidSource: sourceJobID || null,
        jobidTarget: targetJobID || null
      }
    });
  
  } else {
    header = new schema.ExtendedClientMsgHdr({
      msg: eMsg,
      steamID: this.steamID,
      sessionID: this._sessionID,
      sourceJobID: sourceJobID,
      targetJobID: targetJobID
    });
  }
  
  this._connection.send(Buffer.concat([header.toBuffer(), body.toBuffer()]));
};

SteamClient.prototype._netMsgReceived = function(data) {
  var rawEMsg = data.readUInt32LE(0);
  var eMsg = rawEMsg & ~protoMask;
  
  data = ByteBuffer.wrap(data, ByteBuffer.LITTLE_ENDIAN);
  
  var header, sourceJobID, targetJobID;
  if (eMsg == EMsg.ChannelEncryptRequest || eMsg == EMsg.ChannelEncryptResult) {
    header = schema.MsgHdr.decode(data);
    sourceJobID = header.sourceJobID;
    targetJobID = header.targetJobID;
  
  } else if (rawEMsg & protoMask) {
    header = schema.MsgHdrProtoBuf.decode(data);
    if (!this._sessionID && header.headerLength > 0) {
      this._sessionID = header.proto.clientSessionid;
      this.steamID = header.proto.steamid.toString();
    }
    sourceJobID = header.proto.jobidSource;
    targetJobID = header.proto.jobidTarget;
  
  } else {
    header = schema.ExtendedClientMsgHdr.decode(data);
    sourceJobID = header.sourceJobID;
    targetJobID = header.targetJobID;
  }
  
  if (eMsg in this._handlers) {
    this._handlers[eMsg].call(this, data, this._jobs[targetJobID] || sourceJobID);
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
  
//  var encRequest = schema.MsgChannelEncryptRequest.decode(data);
  this.emit('debug', 'encrypt request');
  
  this._tempSessionKey = require('crypto').randomBytes(32);
  var cryptedSessKey = require('crypto').publicEncrypt(fs.readFileSync(__dirname + '/public.pub'), this._tempSessionKey);
  var keyCrc = require('buffer-crc32').signed(cryptedSessKey);
  
  var encResp = new schema.MsgChannelEncryptResponse().encode();
  var body = new ByteBuffer(encResp.limit + 128 + 4 + 4, ByteBuffer.LITTLE_ENDIAN); // key, crc, trailer
  
  body.append(encResp);
  body.append(cryptedSessKey);
  body.writeInt32(keyCrc);
  body.writeUint32(0); // TODO: check if the trailer is required
  
  this._send(EMsg.ChannelEncryptResponse, body.flip());
};

handlers[EMsg.ChannelEncryptResult] = function(data) {
  var encResult = schema.MsgChannelEncryptResult.decode(data);
  
  if (encResult.result == Steam.EResult.OK) {
    this._connection.sessionKey = this._tempSessionKey;
  } else {
    this.emit('error', new Error("Encryption fail: " + encResult.result));
    return;
  }
  
  this.emit('debug', 'handshake complete');
  
  this._logOnDetails.protocolVersion = 65575;
  this._send(EMsg.ClientLogon | protoMask, new schema.CMsgClientLogon(this._logOnDetails));
};

handlers[EMsg.Multi] = function(data) {
  var msgMulti = schema.CMsgMulti.decode(data);
  
  var payload = msgMulti.messageBody.toBuffer();
      
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
  var list = schema.CMsgClientCMList.decode(data);
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
