'use strict';

const Long = require('bytebuffer').Long;

const DEFAULT_VALUE = 0;
const CLAN_FLAG = 0x80000;
const LOBBY_FLAG = 0x40000;
const MMS_LOBBY_FLAG = 0x20000;
const TYPE_OFFSET = 20;
const TYPE_MASK = 0xF;
const UNI_OFFSET = 24;
const UNI_MASK = 0xFF;
const INSTANCE_MASK = 0xfffff;

module.exports = SteamID;

function SteamID(object) {
    this.accountID = object.accountID || DEFAULT_VALUE;
    this.accountInstance = object.accountInstance || DEFAULT_VALUE;
    this.accountType = object.accountType || DEFAULT_VALUE;
    this.accountUniverse = object.accountUniverse || DEFAULT_VALUE;
}

SteamID.ChatInstanceFlags = {
    Clan: CLAN_FLAG,
    Lobby: LOBBY_FLAG,
    MMSLobby: MMS_LOBBY_FLAG,
};

SteamID.decode = function (steamID) {
    steamID = Long.fromValue(steamID);

    return new SteamID({
        accountID: steamID.low,
        accountInstance: steamID.high & INSTANCE_MASK,
        accountType: steamID.high >> TYPE_OFFSET & TYPE_MASK,
        accountUniverse: steamID.high >> UNI_OFFSET & UNI_MASK
    });
};

SteamID.prototype.encode = function () {
    return new Long(this.accountID, this.accountInstance
        | this.accountType << TYPE_OFFSET
        | this.accountUniverse << UNI_OFFSET);
};

SteamID.prototype.toString = function () {
    return this.encode().toString();
};
