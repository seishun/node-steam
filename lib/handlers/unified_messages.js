var ProtoBuf = require('protobufjs');
var Steam = require('../steam_client');

// this is ridiculous. how2not boilerplate?
var builder = ProtoBuf.newBuilder();
[
  'steammessages_broadcast.steamclient.proto',
  'steammessages_cloud.steamclient.proto',
  'steammessages_credentials.steamclient.proto',
  'steammessages_depotbuilder.steamclient.proto',
  'steammessages_deviceauth.steamclient.proto',
  'steammessages_econ.steamclient.proto',
  'steammessages_gamenotifications.steamclient.proto',
  'steammessages_gameservers.steamclient.proto',
  'steammessages_linkfilter.steamclient.proto',
  'steammessages_offline.steamclient.proto',
  'steammessages_parental.steamclient.proto',
  'steammessages_partnerapps.steamclient.proto',
  'steammessages_player.steamclient.proto',
  'steammessages_publishedfile.steamclient.proto',
  'steammessages_secrets.steamclient.proto',
  'steammessages_twofactor.steamclient.proto',
  'steammessages_video.steamclient.proto',
].forEach(function(filename) {
  ProtoBuf.loadProtoFile(require('path').join(__dirname, '../../resources/protobufs/steamclient', filename), builder);
});
Steam.Unified = {
  Internal: builder.build()
};

var EMsg = Steam.EMsg;
var schema = Steam.Internal;

module.exports = SteamUnifiedMessages;

function SteamUnifiedMessages(steamClient) {
  this._client = steamClient;
  this._client.on('message', function(header, body, callback) {
    if (header.msg in handlers) {
      // see how it actually passes the header this time
      handlers[header.msg].call(this, header, body, callback);
    }
  }.bind(this));
}


// Methods

var prototype = SteamUnifiedMessages.prototype;

// TODO


// Handlers

var handlers = {};

handlers[EMsg.ServiceMethod] = function(header, body) {
  var jobName = header.proto.targetJobName;
  var names = jobName.split('#')[0].split('.');

  Steam.Unified.Internal[names[0]][names[1]](function(method, req) {
    this.emit('unified', jobName, req);
  }.bind(this), body);
};
