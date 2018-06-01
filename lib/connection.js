'use strict';

module.exports = Connection;

const SteamCrypto = require('steam-crypto');
const util = require('util');
const Socket = require('net').Socket;
const MAGIC = 'VT01';
const OFFSET_PAYLOAD = 4;
const BYTE = 8;
const ZERO = 0;

util.inherits(Connection, Socket);

function Connection() {
    Socket.call(this);
    this.on('readable', this._readPacket.bind(this));
}

Connection.prototype.send = function (data) {

    // encrypt
    if (this.sessionKey) {
        data = SteamCrypto.symmetricEncrypt(data, this.sessionKey);
    }

    const buffer = new Buffer(OFFSET_PAYLOAD + OFFSET_PAYLOAD + data.length);
    buffer.writeUInt32LE(data.length, ZERO);
    buffer.write(MAGIC, OFFSET_PAYLOAD);
    data.copy(buffer, OFFSET_PAYLOAD + OFFSET_PAYLOAD);
    this.write(buffer);
};

Connection.prototype._readPacket = function () {
    if (!this._packetLen) {
        const header = this.read(BYTE);
        if (!header) {
            return;
        }
        this._packetLen = header.readUInt32LE(ZERO);
    }

    let packet = this.read(this._packetLen);

    if (!packet) {
        this.emit('debug', 'incomplete packet');
        return;
    }

    delete this._packetLen;

    // decrypt
    if (this.sessionKey) {
        packet = SteamCrypto.symmetricDecrypt(packet, this.sessionKey);
    }

    this.emit('packet', packet);

    // keep reading until there's nothing left
    this._readPacket();
};
