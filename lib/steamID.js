require('ref');

module.exports = SteamID;

function SteamID(steamID) {
  this._buffer = new Buffer(8);
  this._buffer.writeUInt64LE(steamID, 0);
}

SteamID.ChatInstanceFlags = {
  Clan: 0x100000 >> 1,
  Lobby: 0x100000 >> 2,
  MMSLobby: 0x100000 >> 3,
};

SteamID.prototype.toString = function() {
  return this._buffer.readUInt64LE(0).toString();
};

Object.defineProperties(SteamID.prototype, {
  accountID: {
    get: function() {
      return this._buffer.readUInt32LE(0);
    },
    set: function(value) {
      this._buffer.writeUInt32LE(value, 0);
    }
  },
  accountInstance: {
    get: function() {
      return this._buffer.readUInt32LE(4) & 0x000FFFFF;
    },
    set: function(value) {
      this._buffer.writeUInt32LE(this._buffer.readUInt32LE(4) & 0xFFF00000 | value, 4);
    }
  },
  accountType: {
    get: function() {
      return this._buffer[6] >> 4;
    },
    set: function(value) {
      this._buffer[6] = this._buffer[6] & 0x0F | value << 4;
    }
  },
  accountUniverse: {
    get: function() {
      return this._buffer[7];
    },
    set: function(value) {
      this._buffer[7] = value;
    }
  }
});
