var ByteBuffer = require('bytebuffer');
var EventEmitter = require('events').EventEmitter;
var ProtoBuf = require('protobufjs');
var Steam = exports;

var fs = require('fs');
var path = require('path');

var builder = ProtoBuf.newBuilder();
ProtoBuf.loadProtoFile(path.join(__dirname, '../resources/protobufs/steamclient/steammessages_clientserver.proto'), builder);
ProtoBuf.loadProtoFile(path.join(__dirname, '../resources/protobufs/steamclient/steammessages_clientserver_2.proto'), builder);
var schema = Steam.Internal = builder.build();

Steam.GC = {
  // generated from dota/steammessages.proto
  Internal: ProtoBuf.loadProtoFile(path.join(__dirname, '../resources/protobufs/dota/steammessages.proto')).build()
};

Steam._processProto = function(proto) {
  proto = proto.toRaw(false, true);
  for (var field in proto)
    if (proto[field] == null)
      delete proto[field];
  return proto;
};

require('../resources/steam_language_parser');

var EMsg = Steam.EMsg;

var protoMask = 0x80000000;


function SteamClient() {
  EventEmitter.call(this);
}

require('util').inherits(SteamClient, EventEmitter);


// Methods

Steam.servers = require('./servers');

SteamClient.prototype.connect = function() {
  this.disconnect();
  
  this._jobs = {};
  this._currentJobID = 0;
  
  this._sessionID = 0;
  
  var server = Steam.servers[Math.floor(Math.random() * Steam.servers.length)];
  this.emit('debug', 'connecting to ' + server.host + ':' + server.port);
  
  this._connection = new (require('./connection'))();
  this._connection.on('packet', this._netMsgReceived.bind(this));
  this._connection.on('close', this._disconnected.bind(this));
  
  var self = this;
  
  this._connection.on('error', function(err) {
    // it's ok, we'll reconnect after 'close'
    self.emit('debug', 'socket error: ' + err);
  });
  
  this._connection.on('connect', function() {
    self.emit('debug', 'connected');
    delete self._timeout;
  });
  
  this._connection.on('end', function() {
    self.emit('debug', 'socket ended');
  });
  
  this._connection.setTimeout(1000, function() {
    self.emit('debug', 'socket timed out');
    self._connection.destroy();
  });
  
  this._connection.connect(server.port, server.host);
};

SteamClient.prototype.disconnect = function() {
  if (this._connection) {
    this._connection.destroy();
    this._connection.removeAllListeners();
    delete this._connection;
    if (this.loggedOn) {
      this.loggedOn = false;
      clearInterval(this._heartBeatFunc);
    }
    this.connected = false;
  } else if (this._scheduledConnection) {
    // there was an error and we're currently waiting
    clearTimeout(this._scheduledConnection);
    delete this._scheduledConnection;
  }
};

SteamClient.prototype._send = function(header, body, callback) {
  if (callback) {
    var sourceJobID = ++this._currentJobID;
    this._jobs[sourceJobID] = callback;
  }
  
  if (header.msg == EMsg.ChannelEncryptResponse) {
    header.sourceJobID = sourceJobID;
    header = new schema.MsgHdr(header);
  
  } else if (header.proto) {
    header.proto.client_sessionid = this._sessionID;
    header.proto.steamid = this.steamID;
    header.proto.jobid_source = sourceJobID;
    header = new schema.MsgHdrProtoBuf(header);
  
  } else {
    header.steamID = this.steamID;
    header.sessionID = this._sessionID;
    header.sourceJobID = sourceJobID;
    header = new schema.ExtendedClientMsgHdr(header);
  }
  
  this._connection.send(Buffer.concat([header.toBuffer(), body]));
};

SteamClient.prototype.send = function(header, body, callback) {
  // ignore any target job ID
  if (header.proto)
    delete header.proto.jobid_target;
  else
    delete header.targetJobID;
  this._send(header, body, callback);
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
    header.proto = Steam._processProto(header.proto);
    if (!this._sessionID && header.headerLength > 0) {
      this._sessionID = header.proto.client_sessionid;
      this.steamID = header.proto.steamid;
    }
    sourceJobID = header.proto.jobid_source;
    targetJobID = header.proto.jobid_target;
  
  } else {
    header = schema.ExtendedClientMsgHdr.decode(data);
    sourceJobID = header.sourceJobID;
    targetJobID = header.targetJobID;
  }
  
  var body = data.toBuffer();
  
  if (eMsg in handlers)
    handlers[header.msg].call(this, body);
  
  if (sourceJobID != '18446744073709551615') {
    var callback = function(header, body, callback) {
      if (header.proto)
        header.proto.jobid_target = sourceJobID;
      else
        header.targetJobID = sourceJobID;
      this._send(header, body, callback);
    }.bind(this);
  }
  
  if (targetJobID in this._jobs)
    this._jobs[targetJobID](header, body, callback);
  else
    this.emit('message', header, body, callback);
};

SteamClient.prototype._disconnected = function(had_error) {
  this.emit('debug', 'socket closed' + (had_error ? ' with an error' : ''));
  delete this._connection;
  
  if (this.connected) {
    if (this.loggedOn) {
      this.emit('debug', 'unexpected disconnection');
      this.loggedOn = false;
      clearInterval(this._heartBeatFunc);
    }
    this.connected = false;
    this.emit('error', new Error('Disconnected'));
    return;
  }
  
  if (!had_error) {
    this.connect();
    return;
  }
  
  var timeout = this._timeout || 1;
  this.emit('debug', 'waiting ' + timeout + ' secs');
  this._scheduledConnection = setTimeout(function() {
    delete this._scheduledConnection;
    this.connect();
  }.bind(this), timeout * 1000);
  this._timeout = timeout * 2;
};


// Handlers

var handlers = {};

handlers[EMsg.ChannelEncryptRequest] = function(data) {
  // assume server isn't dead
  this._connection.setTimeout(0);
  
//  var encRequest = schema.MsgChannelEncryptRequest.decode(data);
  this.emit('debug', 'encrypt request');
  
  var sessionKey = require('steam-crypto').generateSessionKey();
  this._tempSessionKey = sessionKey.plain;
  var keyCrc = require('buffer-crc32').signed(sessionKey.encrypted);
  
  var encResp = new schema.MsgChannelEncryptResponse().encode();
  var body = new ByteBuffer(encResp.limit + 128 + 4 + 4, ByteBuffer.LITTLE_ENDIAN); // key, crc, trailer
  
  body.append(encResp);
  body.append(sessionKey.encrypted);
  body.writeInt32(keyCrc);
  body.writeUint32(0); // TODO: check if the trailer is required
  body.flip();
  
  this.send({ msg: EMsg.ChannelEncryptResponse }, body.toBuffer());
};

handlers[EMsg.ChannelEncryptResult] = function(data) {
  var encResult = schema.MsgChannelEncryptResult.decode(data);
  
  if (encResult.result == Steam.EResult.OK) {
    this._connection.sessionKey = this._tempSessionKey;
  } else {
    this.emit('error', new Error("Encryption fail: " + encResult.result));
    return;
  }
  
  this.connected = true;
  this.emit('connected');
};

handlers[EMsg.Multi] = function(data) {
  var msgMulti = schema.CMsgMulti.decode(data);
  
  var payload = msgMulti.message_body.toBuffer();
      
  if (msgMulti.size_unzipped) {
    var zip = new (require('adm-zip'))(payload);
    payload = zip.readFile('z');
  }
  
  // stop handling if user disconnected
  while (payload.length && this.connected) {
    var subSize = payload.readUInt32LE(0);
    this._netMsgReceived(payload.slice(4, 4 + subSize));
    payload = payload.slice(4 + subSize);
  }
};

handlers[EMsg.ClientLogOnResponse] = function(data) {
  var logonResp = schema.CMsgClientLogonResponse.decode(data);
  var eresult = logonResp.eresult;
  
  if (eresult == Steam.EResult.OK) {
    var hbDelay = logonResp.out_of_game_heartbeat_seconds;
    
    this._heartBeatFunc = setInterval(function() {
      this.send({
        msg: EMsg.ClientHeartBeat,
        proto: {}
      }, new schema.CMsgClientHeartBeat().toBuffer());
    }.bind(this), hbDelay * 1000);
    
    this.loggedOn = true;
  }
  
  this.emit('logOnResponse', Steam._processProto(logonResp));
};

handlers[EMsg.ClientLoggedOff] = function(data) {
  this.loggedOn = false;
  clearInterval(this._heartBeatFunc);
  
  var eresult = schema.CMsgClientLoggedOff.decode(data).eresult;
  
  this.emit('loggedOff', eresult);
};

handlers[EMsg.ClientCMList] = function(data) {
  var list = schema.CMsgClientCMList.decode(data);
  var servers = list.cm_addresses.map(function(number, index) {
    var buf = new Buffer(4);
    buf.writeUInt32BE(number, 0);
    return {
      host: [].join.call(buf, '.'),
      port: list.cm_ports[index]
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
