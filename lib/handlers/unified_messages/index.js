'use strict';

const EventEmitter = require('events').EventEmitter;
const Steam = require('../../steam_client');

const EMsg = Steam.EMsg;
const schema = Steam.Internal;

const ZERO = 0;
const FIRST = 1;


function SteamUnifiedMessages(steamClient, service) {
    this._client = steamClient;
    this._service = service;

    this._client.on('message', (header, body, callback) => {
        if (header.msg in handlers) {
            handlers[header.msg].call(this, header, body, callback);
        }
    });
}

require('util').inherits(SteamUnifiedMessages, EventEmitter);


// Methods
SteamUnifiedMessages.prototype.send = function (methodName, body, callback) {
    let eresult;
    Steam.Unified.Internal[this._service][methodName]((method, req, cb) => {
        this._client.send({
            msg: EMsg.ClientServiceMethod,
            proto: {}
        }, new schema.CMsgClientServiceMethod({
            method_name: `${this._service}.${methodName}#1`,
            serialized_method: req.toBuffer(),
            is_notification: !callback
        }).toBuffer(), callback && ((header, body) => {
            eresult = header.proto.eresult;
            const resp = schema.CMsgClientServiceMethodResponse.decode(body);
            cb(null, resp.serialized_method_response);
        }));
    }, body, (err, res) => {
        if (err) {
            throw err;
        }
        callback(eresult, Steam._processProto(res));
    });
};


// Handlers

const handlers = {};

handlers[EMsg.ServiceMethod] = function (header, body) {
    const jobName = header.proto.target_job_name;
    if (jobName.split('.')[ZERO] !== this._service) {
        return;
    }
    const methodName = jobName.split(/\W/)[FIRST];
    Steam.Unified.Internal[this._service][methodName]((method, req) => {
        this.emit('message', methodName, Steam._processProto(req));
    }, body);
};


Steam.SteamUnifiedMessages = SteamUnifiedMessages;
