var EventEmitter = require('events').EventEmitter;
var Steam = require('../../steam_client');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;

var protoMask = 0x80000000;


function SteamGameCoordinator(steamClient) {
  this._client = steamClient;
  
  this._jobs = {};
  this._currentJobID = 0;
  
  this._client.on('message', function(header, body, callback) {
    if (header.msg in handlers)
      handlers[header.msg].call(this, body, callback);
  }.bind(this));
  
  this._client.on('logOnResponse', function() {
    this._jobs = {};
    this._currentJobID = 0;
  }.bind(this));
}

require('util').inherits(SteamGameCoordinator, EventEmitter);


// Methods

SteamGameCoordinator.prototype.toGC = function(appid, type, body) {
  if (arguments.length > 3) {
    var sourceJobID = ++this._currentJobID;
    this._jobs[sourceJobID] = Array.prototype.slice.call(arguments, 3);
  }
  
  var header;
  if (type & protoMask) {
    header = new schema.MsgGCHdrProtoBuf({
      msg: type >>> 0,
      proto: {
        job_id_source: sourceJobID,
        // job_id_target: targetJobID
      }
    });
  } else {
    header = new schema.MsgGCHdr({
      sourceJobID: sourceJobID,
      // targetJobID: targetJobID
    });
  }
  
  this._client.send({
    msg: EMsg.ClientToGC,
    proto: {}
  }, new schema.CMsgGCClient({
    msgtype: type,
    appid: appid,
    payload: Buffer.concat([header.toBuffer(), body])
  }).toBuffer());
};


// Handlers

var handlers = {};

handlers[EMsg.ClientFromGC] = function(data, jobid) {
  var msg = schema.CMsgGCClient.decode(data);
  
  var header, targetJobID, body;
  if (msg.msgtype & protoMask) {
    header = schema.MsgGCHdrProtoBuf.decode(msg.payload);
    targetJobID = header.proto.job_id_target;
  } else {
    header = schema.MsgGCHdr.decode(msg.payload);
    targetJobID = header.targetJobID;
  }
  
  this.emit.apply(this, ['fromGC', msg.appid, msg.msgtype, msg.payload.toBuffer()].concat(this._jobs[targetJobID] || []));
};


Steam.SteamGameCoordinator = SteamGameCoordinator;
