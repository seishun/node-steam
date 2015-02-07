var Long = require("bytebuffer").Long;

module.exports = SteamID;

function SteamID(object) {
  this.accountID = object.accountID || 0;
  this.accountInstance = object.accountInstance || 0;
  this.accountType = object.accountType || 0;
  this.accountUniverse = object.accountUniverse || 0;
}

SteamID.ChatInstanceFlags = {
  Clan: 0x100000 >> 1,
  Lobby: 0x100000 >> 2,
  MMSLobby: 0x100000 >> 3,
};

SteamID.decode = function(steamID) {
  steamID = Long.fromValue(steamID);
  
  return new SteamID({
    accountID: steamID.low,
    accountInstance: steamID.high & 0xFFFFF,
    accountType: steamID.high >> 20 & 0xF,
    accountUniverse: steamID.high >> 24 & 0xFF
  });
};

SteamID.prototype.encode = function() {
  return new Long(this.accountID, this.accountInstance | this.accountType << 20 | this.accountUniverse << 24);
};

SteamID.prototype.toString = function() {
  return this.encode().toString();
};
