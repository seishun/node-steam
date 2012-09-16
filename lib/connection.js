var crypto = require('crypto');
var MAGIC = 'VT01';

module.exports = function(endPoint) {
  
  var sock = require('net').connect(27017, endPoint, function() {
    this.emitter.emit('connected');
  }.bind(this));
  
  sock.on('data', function readPacket(data) {
    if (this.sockbuf) {
      data.copy(this.sockbuf, this.socklen);
      data = this.sockbuf;
      delete this.sockbuf;
    }
    var packetLen = data.readUInt32LE(0);
    var packetMagic = data.toString('ascii', 4, 8);
    if (packetMagic != MAGIC) {
      this.emitter.emit('debug', 'Got a packet with invalid magic!');
    }
    
    // skip to header
    var packet = data.slice(8);
    if (packet.length < packetLen) {
      this.emitter.emit('debug', 'Expected package length ' + packetLen + ', got ' + packet.length);
      this.sockbuf = new Buffer(packetLen + 8);
      data.copy(this.sockbuf, 0);
      this.socklen = data.length;
      return;
    }
    
    // decrypt
    if (this.sessionKey) {
      var aes = crypto.createDecipheriv('aes-256-ecb', this.sessionKey.toString('binary'), ''); // node.js 0.6 compatibility
//      aes.setAutoPadding(false);
      var iv = aes.update(packet.slice(0,17)); // nothing outside of 17 to 32 inclusive works
//      iv += aes.final();  // this returns nothing
      
      aes = crypto.createDecipheriv('aes-256-cbc', this.sessionKey.toString('binary'), iv.toString('binary')); // node.js 0.6 compatibility
      packet = aes.update(packet.slice(16)) + aes.final();
      packet = new Buffer(packet, 'binary'); //TODO: remove when node.js fixes their shit
    }
    
    this.netMsgReceived(packet);
    
    // there might be more packets in this chunk
    if (data.length > 8 + packetLen) {
      this.emitter.emit('debug', 'expected ' + packetLen + ', got ' + data.length);
      readPacket(data.slice(8 + packetLen));
    }
  }.bind(this));
  
  
  this.send = function(data) {
    // encrypt
    if (this.sessionKey) {
      var iv = crypto.randomBytes(16);
      var aes = crypto.createCipheriv('aes-256-ecb', this.sessionKey.toString('binary'), ''); // node.js 0.6 compatibility
//      aes.setAutoPadding(false);
      var cryptedIv = aes.update(iv);
      
      aes = crypto.createCipheriv('aes-256-cbc', this.sessionKey.toString('binary'), iv.toString('binary')); // node.js 0.6 compatibility
      var cipherText = aes.update(data) + aes.final();
      
      data = new Buffer(cryptedIv + cipherText, 'binary');
    }
    
    var buffer = new Buffer(4 + 4 + data.length);
    buffer.writeUInt32LE(data.length, 0);
    buffer.write(MAGIC, 4);
    data.copy(buffer, 8);
    sock.write(buffer);
  };

};