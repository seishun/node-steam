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


/**
 * Uploads you RP to steam.
 * @param {Object} rp - RichPresence object. Example - {
        RP: {
            status: "Competitive Inferno [ 3 : 10 ]",
            version: "13503",
            time: "4411.216601",
            "game:mode": "competitive",
            "game:mapgroupname": "mg_de_inferno",
            "game:map": "random",
            "game:server": "kv",
            "watch": "1",
            "game:score": "[ 3 : 1]"
        }
    }
 * @param steamids - Array of steamid who should recieve update. Example - ['76561198031711686']
 */
SteamRichPresence.prototype.upload = function(rp, steamids) {
  var payload = new schema.CMsgClientRichPresenceUpload();
  payload.rich_presence_kv = require("../../VDF").encode(rp);
  if(steamids){
    payload.steamid_broadcast = steamids;
  }
  this._client.send({
        msg: EMsg.ClientRichPresenceUpload,
        proto: {
          routing_appid: this._appid
        }
      },
      payload.toBuffer());
};

SteamRichPresence.prototype.request = function(steamids) {
  this._client.send({
    msg: EMsg.ClientRichPresenceRequest,
    proto: {
      routing_appid: this._appid
    }
  }, new schema.CMsgClientRichPresenceRequest({
    steamid_request: steamids
  }).toBuffer());
};


// Handlers

var handlers = {};

handlers[EMsg.ClientRichPresenceInfo] = function(header, body) {
  if (header.proto.routing_appid != this._appid)
    return;

  var vdf = require('../../VDF');
  var response_kv = schema.CMsgClientRichPresenceInfo.decode(body);
  var output = {};
  //We can recieve multiple RichPresence objects in response, anyway it comes as array
  for(var index in response_kv.rich_presence){
    if(response_kv.rich_presence.hasOwnProperty(index)){
      var rp = vdf.decode(response_kv.rich_presence[index].rich_presence_kv.toBuffer());
      if(rp.hasOwnProperty('RP')) {
        rp = rp.RP;
      }
      output[response_kv.rich_presence[index].steamid_user] = rp;
    }
  }
  this.emit('info', output);
};


Steam.SteamRichPresence = SteamRichPresence;
