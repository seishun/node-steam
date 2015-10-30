var EventEmitter = require('events').EventEmitter;
var Steam = require('../../steam_client');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;


function SteamRichPresence(steamClient, appid) {
  this._client = steamClient;
  this._appid = appid;
  
  this._client.on('message', function(header, body, callback) {
    if (header.msg in handlers)
      handlers[header.msg].call(this, header, body, callback);
  }.bind(this));
}

require('util').inherits(SteamRichPresence, EventEmitter);


// Methods

SteamRichPresence.prototype.upload = function(body) {
  this._client.send({
    msg: EMsg.ClientRichPresenceUpload,
    proto: {
      routing_appid: this._appid
    }
  }, new schema.CMsgClientRichPresenceUpload(body).toBuffer());
};

SteamRichPresence.prototype.request = function(body) {
  this._client.send({
    msg: EMsg.ClientRichPresenceRequest,
    proto: {
      routing_appid: this._appid
    }
  }, new schema.CMsgClientRichPresenceRequest(body).toBuffer());
};


// Handlers

var handlers = {};

handlers[EMsg.ClientRichPresenceInfo] = function(header, body) {
  if (header.proto.routing_appid != this._appid)
    return;
  
  var info = schema.CMsgClientRichPresenceInfo.decode(body);
  this.emit('info', Steam._processProto(info));
};


Steam.SteamRichPresence = SteamRichPresence;
