var EventEmitter = require('events').EventEmitter;

var Steam = exports;
var schema = Steam.Internal = new (require('protobuf').Schema)(require('fs').readFileSync(__dirname + '/generated/steam_msg.desc'));
require('./generated/steam_language');
require('./generated/steam_language_internal');

var EMsg = Steam.EMsg;

var protoMask = 0x80000000;


function SteamClient() {
  EventEmitter.call(this);

  // construct temporary SteamID
  var steamID = new (require('./steamID'))(0);
  steamID.accountInstance = 1;
  steamID.accountUniverse = Steam.EUniverse.Public;
  steamID.accountType = Steam.EAccountType.Individual;
  this.steamID = steamID.toString();

  this.users = {};
  this.friendList = {};
  this.chatRooms = {};
}

require('util').inherits(SteamClient, EventEmitter);


// Internal methods

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
    sourceJobID = header.proto.jobidSource;
    targetJobID = header.proto.jobidTarget;
    body = data.slice(schema.MsgHdrProtoBuf.baseSize + header.headerLength);
    body._isProto = true;

  } else {
    header = schema.ExtendedClientMsgHdr.parse(data);
    sourceJobID = header.sourceJobID;
    targetJobID = header.targetJobID;
    body = data.slice(schema.ExtendedClientMsgHdr.baseSize);
  }

  if (eMsg in this._handlers) {
    body._header = header;
    this._handlers[eMsg].call(this, body, this._jobs[targetJobID] || sourceJobID);
  } else {
    this.emit('unhandled', eMsg);
  }
};

SteamClient.prototype._disconnected = function() {
  clearInterval(this._heartBeatFunc);
  delete this._connection.sessionKey;

  if (this._sessionID) {
    this.emit('debug', 'unexpected disconnection, reconnecting');
    this.emit('disconnected');
    this.logOn(this._username, this._password, this._hash, this._code);
  }
};

SteamClient.prototype._error = function(err) {
  if (err.code == 'ETIMEDOUT') {
    // possibly a dead CM, try another
    this.emit('debug', 'connection timed out, reconnecting');
    this.connect();
    return;
  }

  if (!this._sessionID) {
    // fail at initial connect - make sure the user knows
    var e = new Error('Connection fail: ' + err);
    e.cause = 'connectFail';
    e.error = err;
    this.emit('error', e);
    return;
  }
};

// Public methods

SteamClient.prototype.connect = function() {
  this._jobs = {};
  this._currentJobID = 0;

  var server = Steam.servers[Math.floor(Math.random() * Steam.servers.length)];
  this.emit('debug', 'connecting to ' + server.host + ':' + server.port);

  this._connection = new (require('./connection'))();
  this._connection.on('packet', this._netMsgReceived.bind(this));
  this._connection.on('error', this._error.bind(this));

  var self = this;

  this._connection.on('connect', function() {
    self.emit('debug', 'connected');
  });

  this._connection.on('close', function(had_error) {
    self.emit('debug', 'socket closed' + (had_error ? ' with an error' : ''));
    if (!had_error) {
      self._disconnected();
    } // otherwise already handled
  });

  this._connection.on('end', function() {
    self.emit('debug', 'socket ended');
  });

  this._connection.connect(server.port, server.host);
};


// Handlers

var handlers = SteamClient.prototype._handlers = {};

handlers[EMsg.ChannelEncryptRequest] = function(data) {
//  var encRequest = schema.MsgChannelEncryptRequest.parse(data);
  this.emit('debug', 'encrypt request');

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

  if(encResult.result == Steam.EResult.OK) {
    this._connection.sessionKey = this._tempSessionKey;
  }

  this.emit('connected', encResult.result);
  this.emit('debug', 'handshake complete');
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
require('./handlers/trading');
require('./handlers/user');
