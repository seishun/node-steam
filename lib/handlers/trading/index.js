'use strict';

const EventEmitter = require('events').EventEmitter;
const Steam = require('../../steam_client');

const EMsg = Steam.EMsg;
const schema = Steam.Internal;


function SteamTrading(steamClient) {
    this._client = steamClient;
    this._client.on('message', (header, body, callback) => {
        if (header.msg in handlers) {
            handlers[header.msg].call(this, body, callback);
        }
    });
}

require('util').inherits(SteamTrading, EventEmitter);


// Methods

SteamTrading.prototype.trade = function (user) {
    this._client.send({
        msg: EMsg.EconTrading_InitiateTradeRequest,
        proto: {}
    }, new schema.CMsgTrading_InitiateTradeRequest({
        other_steamid: user
    }).toBuffer());
};

SteamTrading.prototype.respondToTrade = function (tradeId, acceptTrade) {
    this._client.send({
        msg: EMsg.EconTrading_InitiateTradeResponse,
        proto: {}
    }, new schema.CMsgTrading_InitiateTradeResponse({
        trade_request_id: tradeId,
        response: Number(!acceptTrade)
    }).toBuffer());
};

SteamTrading.prototype.cancelTrade = function (user) {
    this._client.send({
        msg: EMsg.EconTrading_CancelTradeRequest,
        proto: {}
    }, new schema.CMsgTrading_CancelTradeRequest({
        other_steamid: user
    }).toBuffer());
};


// Handlers

const handlers = {};

handlers[EMsg.EconTrading_InitiateTradeProposed] = function (data) {
    const tradeProp = Steam._processProto(schema.CMsgTrading_InitiateTradeRequest.decode(data));
    this.emit('tradeProposed', tradeProp.trade_request_id, tradeProp.other_steamid, tradeProp.other_name);
};

handlers[EMsg.EconTrading_InitiateTradeResult] = function (data) {
    const tradeResult = Steam._processProto(schema.CMsgTrading_InitiateTradeResponse.decode(data));
    this.emit('tradeResult', tradeResult.trade_request_id, tradeResult.response, tradeResult.other_steamid);
};

handlers[EMsg.EconTrading_StartSession] = function (data) {
    const startSess = schema.CMsgTrading_StartSession.decode(data);
    this.emit('sessionStart', startSess.other_steamid.toString());
};


Steam.SteamTrading = SteamTrading;
