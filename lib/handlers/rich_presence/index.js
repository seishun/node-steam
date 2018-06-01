'use strict';

const EventEmitter = require('events').EventEmitter;
const Steam = require('../../steam_client');

const EMsg = Steam.EMsg;
const schema = Steam.Internal;


function SteamRichPresence(steamClient, appid) {
    this._client = steamClient;
    this._appid = appid;

    this._client.on('message', (header, body, callback) => {
        if (header.msg in handlers) {
            handlers[header.msg].call(this, header, body, callback);
        }
    });
}

require('util').inherits(SteamRichPresence, EventEmitter);


// Methods

SteamRichPresence.prototype.upload = function (body) {
    this._client.send({
        msg: EMsg.ClientRichPresenceUpload,
        proto: {
            routing_appid: this._appid
        }
    }, new schema.CMsgClientRichPresenceUpload(body).toBuffer());
};

SteamRichPresence.prototype.request = function (body) {
    this._client.send({
        msg: EMsg.ClientRichPresenceRequest,
        proto: {
            routing_appid: this._appid
        }
    }, new schema.CMsgClientRichPresenceRequest(body).toBuffer());
};


// Handlers

const handlers = {};

handlers[EMsg.ClientRichPresenceInfo] = function (header, body) {
    if (header.proto.routing_appid !== this._appid) {
        return;
    }

    const info = schema.CMsgClientRichPresenceInfo.decode(body);
    this.emit('info', Steam._processProto(info));
};


Steam.SteamRichPresence = SteamRichPresence;
