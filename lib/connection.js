module.exports = Connection;

var util = require('util');
var Socket = require('net').Socket;
var MAGIC = 'VT01';

util.inherits(Connection, Socket);

function Connection() {
  Socket.call(this);
  this.on('data', this._readPacket.bind(this));
}

Connection.prototype.connect = function(server) {  
  Socket.prototype.connect.call(this, 27017, server);
};

Connection.prototype.send = function(data) {
  // encrypt
  if (this.sessionKey) {
    data = require('./crypto_helper').symmetricEncrypt(data, this.sessionKey);
  }
  
  var buffer = new Buffer(4 + 4 + data.length);
  buffer.writeUInt32LE(data.length, 0);
  buffer.write(MAGIC, 4);
  data.copy(buffer, 8);
  this.write(buffer);
};

Connection.prototype._readPacket = function(data) {
  if (this._sockbuf) {
    this.emit('debug', util.format('Glued packets: %d + %d = %d', this._sockbuf.length, data.length, data.length + this._sockbuf.length));
    data = Buffer.concat([this._sockbuf, data]);
    delete this._sockbuf;
  } else {
    this._packetLen = data.readUInt32LE(0);
    data = data.slice(8);
  }
  
  if (data.length < this._packetLen) {
    this.emit('debug', util.format('Got %d bytes instead of %d, caching', data.length, this._packetLen));
    this._sockbuf = data;
    return;
  }
  
  // skip to header
  var packet = data.slice(0, this._packetLen); // not sure if this helps
  
  // decrypt
  if (this.sessionKey) {
    packet = require('./crypto_helper').symmetricDecrypt(packet, this.sessionKey);
  }
  
  this.emit('packet', packet);
  
  // there might be more packets in this chunk
  if (data.length > this._packetLen) {
    this.emit('debug', util.format('Got %d bytes instead of %d, recursing', data.length, this._packetLen));
    this._readPacket(data.slice(this._packetLen));
  }
};
