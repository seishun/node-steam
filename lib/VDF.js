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

exports.decode = function(buffer) {
  var object = {};
  
  while (true) {
    var type = buffer.readUint8();
    
    if (type == Type.End)
      break;
    
    var name = buffer.readCString();
    
    switch (type) {
      case Type.None:
        object[name] = exports.decode(buffer);
        break;
      
      case Type.String:
        object[name] = buffer.readCString();
        break;
      
      case Type.Int32:
      case Type.Color:
      case Type.Pointer:
        object[name] = buffer.readInt32();
        break;
      
      case Type.UInt64:
        object[name] = buffer.readUint64();
        break;
      
      case Type.Float32:
        object[name] = buffer.readFloat();
        break;
    }
  }
  
  return object;
};
