var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

prototype.toGC = function(appid, type, body) {
  if (arguments.length > 3) {
    var sourceJobID = ++this._currentJobID;
    this._jobs[sourceJobID] = Array.prototype.slice.call(arguments, 3);
  }
  
  var header;
  if (type & protoMask) {
    header = schema.MsgGCHdrProtoBuf.serialize({
      msg: type >>> 0,
      proto: {
        jobIdSource: sourceJobID,
        // jobIdTarget: targetJobID
      }
    });
  } else {
    header = schema.MsgGCHdr.serialize({
      sourceJobID: sourceJobID,
      // targetJobID: targetJobID
    });
  }
  
  this._send(EMsg.ClientToGC | protoMask, schema.CMsgGCClient.serialize({
    msgtype: type,
    appid: appid,
    payload: Buffer.concat([header, body])
  }));
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientFromGC] = function(data, jobid) {
  var msg = schema.CMsgGCClient.parse(data);
  
  var header, targetJobID, body;
  if (msg.msgtype & protoMask) {
    header = schema.MsgGCHdrProtoBuf.parse(msg.payload);
    targetJobID = header.proto.jobIdTarget;
    body = msg.payload.slice(schema.MsgGCHdrProtoBuf.baseSize + header.headerLength);
  } else {
    header = schema.MsgGCHdr.parse(msg.payload);
    targetJobID = header.targetJobID;
    body = msg.payload.slice(schema.MsgGCHdr.baseSize);
  }
  
  this.emit.apply(this, ['fromGC', msg.appid, msg.msgtype, body].concat(this._jobs[targetJobID] || []));
};
