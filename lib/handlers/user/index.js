'use strict';

const EventEmitter = require('events').EventEmitter;
const Steam = require('../../steam_client');

const EMsg = Steam.EMsg;
const schema = Steam.Internal;

const OFFSET_TRADE_OFFERS = 0;


function SteamUser(steamClient) {
    this._client = steamClient;
    this._client.on('message', (header, body, callback) => {
        if (header.msg in handlers) {
            handlers[header.msg].call(this, body, callback);
        }
    });
}

require('util').inherits(SteamUser, EventEmitter);


// Methods

SteamUser.prototype.logOn = function (logOnDetails) {
    this._logOnDetails = logOnDetails;

    // construct temporary SteamID
    this._client.steamID = new (require('../../steamID'))({
        accountInstance: 1,
        accountUniverse: Steam.EUniverse.Public,
        accountType: Steam.EAccountType.Individual
    }).toString();

    logOnDetails.protocol_version = 65575;
    this._client.send({
        msg: EMsg.ClientLogon,
        proto: {}
    }, new schema.CMsgClientLogon(logOnDetails).toBuffer());
};

SteamUser.prototype.requestWebAPIAuthenticateUserNonce = function (callback) {
    this._client.send({
        msg: EMsg.ClientRequestWebAPIAuthenticateUserNonce,
        proto: {}
    }, new schema.CMsgClientRequestWebAPIAuthenticateUserNonce().toBuffer(), (header, body) => {
        const nonce = schema.CMsgClientRequestWebAPIAuthenticateUserNonceResponse.decode(body);
        callback(Steam._processProto(nonce));
    });
};

SteamUser.prototype.gamesPlayed = function (gamesPlayed) {
    this._client.send({
        msg: EMsg.ClientGamesPlayed,
        proto: {}
    }, new schema.CMsgClientGamesPlayed(gamesPlayed).toBuffer());
};


// Handlers

const handlers = {};

handlers[EMsg.ClientUpdateMachineAuth] = function (data, callback) {
    const machineAuth = schema.CMsgClientUpdateMachineAuth.decode(data);

    this.emit('updateMachineAuth', Steam._processProto(machineAuth), response => {
        callback({
            msg: EMsg.ClientUpdateMachineAuthResponse,
            proto: {}
        }, new schema.CMsgClientUpdateMachineAuthResponse(response).toBuffer());
    });
};
handlers[EMsg.ClientNewLoginKey] = function (data) {
    if (!this._logOnDetails.should_remember_password) {
        return;
    }
    const newLoginKey = schema.CMsgClientNewLoginKey.decode(data);

    this._client.send({
        msg: EMsg.ClientNewLoginKeyAccepted,
        proto: {}
    }, new schema.CMsgClientNewLoginKeyAccepted({unique_id: newLoginKey.unique_id}).toBuffer());

    this.emit('loginKey', newLoginKey.login_key);
};

handlers[EMsg.ClientUserNotifications] = function (data) {
    const notifications = schema.CMsgClientUserNotifications.decode(data).notifications;
    if (notifications.length) {
        this.emit('tradeOffers', notifications[OFFSET_TRADE_OFFERS].count);
    }
};

Steam.SteamUser = SteamUser;
