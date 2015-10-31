var ByteBuffer = require('bytebuffer');


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
  if(typeof(buffer.readUint8) != "function"){
    buffer = ByteBuffer.wrap(buffer);
  }
  if(buffer.offset != buffer.limit) {
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
  }

  return object;
};

function _encode(object, buffer, name){
  switch (typeof object) {
    case 'object':
      buffer.writeByte(Type.None);
      buffer.writeCString(name);
      for (var index in object) {
        if(object.hasOwnProperty(index)) {
          _encode(object[index], buffer, index);
        }
      }
      buffer.writeByte(Type.End);
      break;
    case 'string':
      buffer.writeByte(Type.String);
      buffer.writeCString(name);
      buffer.writeCString(object ? object : null);
      break;
    case 'number':
      buffer.writeByte(Type.String);
      buffer.writeCString(name);
      buffer.writeCString(object.toString());
      break;
  }
}
exports.encode = function(object){
  if(!buffer){
    var buffer = new ByteBuffer();
  }
  for(var item in object){
    if(object.hasOwnProperty(item)) {
      _encode(object[item], buffer, item);
    }
  }
  buffer.writeByte(Type.End);
  buffer.flip();
  return buffer;
};