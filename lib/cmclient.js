var EMsg = require('./emsg.js');

var schema = new (require('protobuf').Schema)(require('fs').readFileSync(__dirname + '/steam.desc'));

var servers = [
  '68.142.64.164',
  '68.142.64.165',
  '68.142.91.34',
  '68.142.91.35',
  '68.142.91.36',
  '68.142.116.178',
  '68.142.116.179',
  
  '69.28.145.170',
  '69.28.145.171',
  '69.28.145.172',
  '69.28.156.250',
  
  '72.165.61.185',
  '72.165.61.186',
  '72.165.61.187',
  '72.165.61.188',
  
  '208.111.133.84',
  '208.111.133.85',
  '208.111.158.52',
  '208.111.158.53',
  '208.111.171.82',
  '208.111.171.83'
];

var protoMask = 0x80000000;

module.exports = function(emit) {
  this.handlers = {};
  this.emit = emit;
  
  var server = servers[Math.floor(Math.random() * servers.length)];
  this.connection = new (require('./connection.js'))(server);
  this.connection.emit = this.emit;
  
  this.protoHeader = schema.CMsgProtoBufHeader.serialize({
    clientSessionid: 0,
    steamid: 0x0110000100000000
  }); // temporary header for login

  this.netMsgReceived = function(data) {
    var rawEMsg = data.readUInt32LE(0);
    var eMsg = EMsg.toString[rawEMsg & ~protoMask];
    
    var body;
    if (eMsg == 'ChannelEncryptRequest' || eMsg == 'ChannelEncryptResult') {
      // sourcejobid and targetjobid are useless, so just pass on raw body
      body = data.slice(20);
      
    } else if (rawEMsg & protoMask) {
      var protoSchema = 'CMsg' + eMsg;
      if (!(protoSchema in schema)) {
        this.emit('debug', "Can't parse " + protoSchema + ' (' + eMsg + ')');
        return;
      }
      // parse body, save header
      var headerLength = data.readInt32LE(4);
      this.protoHeader = data.slice(8, 8 + headerLength);
      body = schema[protoSchema].parse(data.slice(8 + headerLength));
      
    } else {
      // 4 bytes emsg - 1 byte header size - 2 bytes header version - 8 bytes targer job id - 8 bytes source job id - 1 byte header canary - 8 bytes steamid - 4 bytes sessionid
        this.extendedHdr = data.slice(4, 36); // TODO: maybe only do this once
        // we need the steamid separately too
        this.steamID = data.slice(24, 32);
        body = data.slice(36);
    } 
    
    if (eMsg in this.handlers) {
      // skip eMsg
      this.handlers[eMsg](body);
    } else {
      this.emit(eMsg, body);
    }
  }.bind(this);
  
  
  this.send = function(eMsg, body) {
    var data;
    
    // serialize the header
    if (eMsg == 'ChannelEncryptResponse') {
      data = new Buffer(4 + 16 + body.length);
      data.writeInt32LE(EMsg.toNumber[eMsg], 0);
      data.fill(0xff, 4, 20);
      body.copy(data, 20);
      
    } else if ('CMsg' + eMsg in schema) {
      // use saved header and serialize message
      var protoHeader = this.protoHeader;
      var protoBody = schema['CMsg' + eMsg].serialize(body);
      
      data = new Buffer(4 + 4 + protoHeader.length + protoBody.length);
      data.writeInt32LE(EMsg.toNumber[eMsg] | protoMask, 0);
      data.writeInt32LE(protoHeader.length, 4);
      protoHeader.copy(data, 8);
      protoBody.copy(data, 8 + protoHeader.length);
      
    } else {
      data = new Buffer(4 + this.extendedHdr.length + body.length);
      data.writeInt32LE(EMsg.toNumber[eMsg], 0);
      this.extendedHdr.copy(data, 4);
      body.copy(data, 4 + this.extendedHdr.length);
    }
    
    this.connection.send(data);
  };

  this.connection.netMsgReceived = this.netMsgReceived;
//  this.connection.emit = this.emit;

  require('./handlers.js')(this);
};