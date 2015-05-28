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
  Internal: ProtoBuf.loadProtoFile(path.join(__dirname, '../resources/protobufs/dota/steammessages.proto')).build()
};

Steam._processProto = function(proto, types) {
  for (var field in proto) {
    if (proto[field] == null)
      delete proto[field];
    else if (ByteBuffer.isByteBuffer(proto[field]))
      proto[field] = proto[field].toBuffer();
    else if (ByteBuffer.Long.isLong(proto[field]))
      proto[field] = proto[field].toString();
    else if (types[field] == 'ip') {
      var buf = new Buffer(4);
      buf.writeUInt32BE(proto[field], 0);
      proto[field] = Array.prototype.join.call(buf, '.');
    } else if (types[field] == 'timestamp')
      proto[field] = new Date(proto[field] * 1000);
  }
};

require('../resources/steam_language_parser');

var EMsg = Steam.EMsg;

var protoMask = 0x80000000;


function SteamClient() {
  EventEmitter.call(this);
}

require('util').inherits(SteamClient, EventEmitter);


// Methods

SteamClient.prototype.connect = function() {
  this.disconnect();
  
  this._jobs = {};
  this._currentJobID = 0;
  
  // construct temporary SteamID
  this.steamID = new (require('./steamID'))({
    accountInstance: 1,
    accountUniverse: Steam.EUniverse.Public,
    accountType: Steam.EAccountType.Individual
  }).toString();
  
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
  } else if (this._scheduledConnection) {
    // there was an error and we're currently waiting
    clearTimeout(this._scheduledConnection);
    delete this._scheduledConnection;
  }
};

SteamClient.prototype.send = function(header, body, callback) {
  if (callback) {
    var sourceJobID = ++this._currentJobID;
    this._jobs[sourceJobID] = callback;
  }
  
  var eMsg = header.msg;
  
  if (eMsg == EMsg.ChannelEncryptResponse) {
    header.sourceJobID = sourceJobID;
    header = new schema.MsgHdr(header);
  
  } else if (header.proto) {
    header.msg |= protoMask; // this should be handled by the generator ASKDJF;LAKDFJAS;KLDFJ DSKF;ASF 
    header.proto.clientSessionid = this._sessionID;
    header.proto.steamid = this.steamID;
    header.proto.jobidSource = sourceJobID;
    header = new schema.MsgHdrProtoBuf(header);
  
  } else {
    header.steamID = this.steamID;
    header.sessionID = this._sessionID;
    header.sourceJobID = sourceJobID;
    header = new schema.ExtendedClientMsgHdr(header);
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
    
    header.msg = eMsg; // TEMPORARY HACK JKLASJDF;LKASDF;JSJFSDF
  
  } else {
    header = schema.ExtendedClientMsgHdr.decode(data);
    sourceJobID = header.sourceJobID;
    targetJobID = header.targetJobID;
  }
  
  // is this the right way?
  if (eMsg in handlers) {
    handlers[header.msg].call(this, data);
  }
  
  (
    this._jobs[targetJobID]
    ||
    this.emit.bind(this, 'message')
  )(header, data, sourceJobID != '18446744073709551615' && function(header, body, callback) {
    header.proto ? header.proto.jobidTarget : header.targetJobID = sourceJobID;
    this._send(header, body, callback);
  }.bind(this));
};

SteamClient.prototype._disconnected = function(had_error) {
  this.emit('debug', 'socket closed' + (had_error ? ' with an error' : ''));
  delete this._connection;
  
  if (this._connection.sessionKey) { // XXX: add a `connected` property?
    if (this.loggedOn) {
      this.emit('debug', 'unexpected disconnection');
      this.loggedOn = false;
      clearInterval(this._heartBeatFunc);
    }
    this.emit('error', new Error('Disconnected')); // XXX: discuss
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
  
  this._tempSessionKey = require('crypto').randomBytes(32);
  var cryptedSessKey = require('crypto').publicEncrypt(fs.readFileSync(__dirname + '/public.pub'), this._tempSessionKey);
  var keyCrc = require('buffer-crc32').signed(cryptedSessKey);
  
  var encResp = new schema.MsgChannelEncryptResponse().encode();
  var body = new ByteBuffer(encResp.limit + 128 + 4 + 4, ByteBuffer.LITTLE_ENDIAN); // key, crc, trailer
  
  body.append(encResp);
  body.append(cryptedSessKey);
  body.writeInt32(keyCrc);
  body.writeUint32(0); // TODO: check if the trailer is required
  
  this.send({ msg: EMsg.ChannelEncryptResponse }, body.flip());
};

handlers[EMsg.ChannelEncryptResult] = function(data) {
  var encResult = schema.MsgChannelEncryptResult.decode(data);
  
  if (encResult.result == Steam.EResult.OK) {
    this._connection.sessionKey = this._tempSessionKey;
  } else {
    this.emit('error', new Error("Encryption fail: " + encResult.result));
    return;
  }
  
  this.emit('connected');
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

handlers[EMsg.ClientLogOnResponse] = function(data) {
  var logonResp = schema.CMsgClientLogonResponse.decode(data);
  var eresult = logonResp.eresult;
  
  if (eresult == Steam.EResult.OK) {
    var hbDelay = logonResp.outOfGameHeartbeatSeconds;
    
    this._heartBeatFunc = setInterval(function() {
      this.send({ msg: EMsg.ClientHeartBeat, proto: {} }, new schema.CMsgClientHeartBeat());
    }.bind(this), hbDelay * 1000);
    
    this.loggedOn = true;
  }
  
  Steam._processProto(logonResp, {
    publicIp: 'ip',
    rtime32ServerTime: 'timestamp'
  });
  this.emit('logOnResponse', logonResp);
};

handlers[EMsg.ClientLoggedOff] = function(data) {
  this.loggedOn = false;
  clearInterval(this._heartBeatFunc);
  
  var eresult = schema.CMsgClientLoggedOff.decode(data).eresult;
  
  this.emit('loggedOff', eresult);
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
require('./handlers/unified_messages');
require('./handlers/user');
