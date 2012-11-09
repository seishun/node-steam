var crypto = require('crypto');
var util = require('util');
var MAGIC = 'VT01';

function Connection() {}

Connection.prototype.connect = function(server) {
//  this.disconnect();
  
  this._sock = require('net').connect(27017, server);
  this._sock.on('data', this._readPacket.bind(this));
  this._sock.on('close', function() {this.emit('debug', 'socket closed');}.bind(this));
  this._sock.on('end', function() {this.emit('debug', 'socket ended');}.bind(this));
};

Connection.prototype.disconnect = function() {
  if (!this._sock) {
    return;
  }
  
  this._sock.destroy();
//  this.disconnected();
};

Connection.prototype.send = function(data) {
  // encrypt
  if (this.sessionKey) {
    var iv = crypto.randomBytes(16);
    var aes = crypto.createCipheriv('aes-256-ecb', this.sessionKey, '');
    aes.setAutoPadding(false);
    var cryptedIv = aes.update(iv) + aes.final();
    
    aes = crypto.createCipheriv('aes-256-cbc', this.sessionKey, iv);
    var cipherText = aes.update(data) + aes.final();
    
    data = new Buffer(cryptedIv + cipherText, 'binary');
  }
  
  var buffer = new Buffer(4 + 4 + data.length);
  buffer.writeUInt32LE(data.length, 0);
  buffer.write(MAGIC, 4);
  data.copy(buffer, 8);
  this._sock.write(buffer);
};

Connection.prototype._readPacket = function(data) {
  if (this._sockbuf) {
    this.emit('debug', util.format('Glued packets: %d + %d = %d', this._socklen, data.length, data.length + this._socklen));
    data.copy(this._sockbuf, this._socklen);
    data = this._sockbuf;
    delete this._sockbuf;
  }
  var packetLen = data.readUInt32LE(0);
  var packetMagic = data.toString('ascii', 4, 8);
  if (packetMagic != MAGIC) {
    this.emit('debug', 'Got a packet with invalid magic!');
  }
  
  if (data.length < packetLen + 8) {
    this.emit('debug', util.format('Got %d bytes instead of %d, caching', data.length, packetLen + 8));
    this._sockbuf = new Buffer(8 + packetLen);
    data.copy(this._sockbuf, 0);
    this._socklen = data.length;
    return;
  }
  
  // skip to header
  var packet = data.slice(8, 8 + packetLen); // not sure if this helps
  
  // decrypt
  if (this.sessionKey) {
    var aes = crypto.createDecipheriv('aes-256-ecb', this.sessionKey, '');
    aes.setAutoPadding(false);
    var iv = aes.update(packet.slice(0, 16)) + aes.final();
    
    aes = crypto.createDecipheriv('aes-256-cbc', this.sessionKey, iv);
    packet = aes.update(packet.slice(16)) + aes.final();
    packet = new Buffer(packet, 'binary'); //TODO: remove for node.js 0.9
  }
  
  this.netMsgReceived(packet);
  
  // there might be more packets in this chunk
  if (data.length > 8 + packetLen) {
    this.emit('debug', util.format('Got %d bytes instead of %d, recursing', data.length, 8 + packetLen));
    this._readPacket(data.slice(8 + packetLen));
  }
};

module.exports = Connection;
