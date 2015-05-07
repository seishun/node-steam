var util = require('util');
var MAGIC = 'VT01';
module.exports = function(Socket) {
  
  var Socket = Socket || require('net').Socket;
  
  var Connection = function () {
    Socket.call(this);
    this.on('readable', this._readPacket.bind(this));
  }
  
  util.inherits(Connection, Socket);
  
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
  
  Connection.prototype._readPacket = function() {
    if (!this._packetLen) {
      var header = this.read(8);
      if (!header) {
        return;
      }
      this._packetLen = header.readUInt32LE(0);
    }
    
    var packet = this.read(this._packetLen);
    
    if (!packet) {
      this.emit('debug', 'incomplete packet');
      return;
    }
    
    delete this._packetLen;
    
    // decrypt
    if (this.sessionKey) {
      packet = require('./crypto_helper').symmetricDecrypt(packet, this.sessionKey);
    }
    
    this.emit('packet', packet);
    
    // keep reading until there's nothing left
    this._readPacket();
  };
  
  return Connection;
}
