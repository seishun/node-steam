var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;

var protoMask = 0x80000000;

module.exports = SteamGameCoordinator;

function SteamGameCoordinator(steamClient) {
  this._client = steamClient;
  this._client.on('message', function(header, body, callback) {
    if (header.msg in handlers) {
      handlers[header.msg].call(this, body, callback);
    }
  });
  this._client.on('loggedOn', function() {
    // TODO: does this belong here?
    this._jobs = {};
    this._currentJobID = 0;
  }.bind(this));
}


// Methods

var prototype = SteamGameCoordinator.prototype;

prototype.toGC = function(appid, type, body) {
  if (arguments.length > 3) {
    var sourceJobID = ++this._currentJobID;
    this._jobs[sourceJobID] = Array.prototype.slice.call(arguments, 3);
  }
  
  var header;
  if (type & protoMask) {
    header = new schema.MsgGCHdrProtoBuf({
      msg: type >>> 0,
      proto: {
        jobIdSource: sourceJobID || null,
        // jobIdTarget: targetJobID || null
      }
    });
  } else {
    header = new schema.MsgGCHdr({
      sourceJobID: sourceJobID,
      // targetJobID: targetJobID
    });
  }
  
  this._client.send({ msg: EMsg.ClientToGC, proto: {} }, new schema.CMsgGCClient({
    msgtype: type,
    appid: appid,
    payload: Buffer.concat([header.toBuffer(), body])
  }));
};


// Handlers

var handlers = {};

handlers[EMsg.ClientFromGC] = function(data, jobid) {
  var msg = schema.CMsgGCClient.decode(data);
  
  var header, targetJobID, body;
  if (msg.msgtype & protoMask) {
    header = schema.MsgGCHdrProtoBuf.decode(msg.payload);
    targetJobID = header.proto.jobIdTarget;
  } else {
    header = schema.MsgGCHdr.decode(msg.payload);
    targetJobID = header.targetJobID;
  }
  
  this.emit.apply(this, ['fromGC', msg.appid, msg.msgtype, msg.payload.toBuffer()].concat(this._jobs[targetJobID] || []));
};
