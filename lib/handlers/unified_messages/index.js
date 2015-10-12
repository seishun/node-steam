var EventEmitter = require('events').EventEmitter;
var Steam = require('../../steam_client');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;


function SteamUnifiedMessages(steamClient, service) {
  this._client = steamClient;
  this._service = service;
  
  this._client.on('message', function(header, body, callback) {
    if (header.msg in handlers)
      handlers[header.msg].call(this, header, body, callback);
  }.bind(this));
}

require('util').inherits(SteamUnifiedMessages, EventEmitter);


// Methods

SteamUnifiedMessages.prototype.send = function(methodName, body, callback) {
  var eresult;
  Steam.Unified.Internal[this._service][methodName](function(method, req, cb) {
    this._client.send({
      msg: EMsg.ClientServiceMethod,
      proto: {}
    }, new schema.CMsgClientServiceMethod({
      method_name: this._service + '.' + methodName + '#1',
      serialized_method: req.toBuffer(),
      is_notification: !callback
    }).toBuffer(), callback && function(header, body) {
      eresult = header.proto.eresult;
      var resp = schema.CMsgClientServiceMethodResponse.decode(body);
      cb(null, resp.serialized_method_response);
    });
  }.bind(this), body, function(err, res) {
    if (err) throw err; // should always be null
    callback(eresult, Steam._processProto(res));
  });
};


// Handlers

var handlers = {};

handlers[EMsg.ServiceMethod] = function(header, body) {
  var jobName = header.proto.target_job_name;
  if (jobName.split('.')[0] != this._service)
    return;
  var methodName = jobName.split(/\W/)[1];
  Steam.Unified.Internal[this._service][methodName](function(method, req) {
    this.emit('message', methodName, Steam._processProto(req));
  }.bind(this), body);
};


Steam.SteamUnifiedMessages = SteamUnifiedMessages;
