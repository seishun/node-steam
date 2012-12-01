require('ref');

var Type = {
  None: 0,
  String: 1,
  Int32: 2,
  Float32: 3,
  Pointer: 4,
  WideString: 5,
  Color: 6,
  UInt64: 7,
  End: 8,
};

exports.parse = function(buffer) {
  var object = {};
  buffer.pos |= 0; // make it zero if undefined
  
  while (true) {
    var type = buffer.readUInt8(buffer.pos);
    buffer.pos += 1;
    
    if (type == Type.End)
      break;
    
    var name = buffer.readCString(buffer.pos);
    buffer.pos += Buffer.byteLength(name) + 1;
    
    switch (type) {
      case Type.None:
        object[name] = exports.parse(buffer);
        break;
      
      case Type.String:
        object[name] = buffer.readCString(buffer.pos);
        buffer.pos += Buffer.byteLength(object[name]) + 1;
        break;
      
      case Type.Int32:
      case Type.Color:
      case Type.Pointer:
        object[name] = buffer.readInt32LE(buffer.pos);
        buffer.pos += 4;
        break;
      
      case Type.UInt64:
        object[name] = buffer.readUInt64LE(buffer.pos);
        buffer.pos += 8;
        break;
      
      case Type.Float32:
        object[name] = buffer.readFloatLE(buffer.pos);
        buffer.pos += 4;
        break;
    }
  }
  
  return object;
};
