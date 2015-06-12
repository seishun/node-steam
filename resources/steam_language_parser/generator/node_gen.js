var ByteBuffer = require('bytebuffer');
var Steam = require('../../..');
var code_generator = require('../code_generator');
var symbol_locator = require('../parser/symbol_locator');
var token_analyzer = require('../parser/token_analyzer');

var readerTypeMap = {
  byte: 'Byte',
  short: 'Int16',
  ushort: 'Uint16',
  int: 'Int32',
  uint: 'Uint32',
  long: 'Int64',
  ulong: 'Uint64'
};

var protoMask = 0x80000000;

exports.emitNamespace = function() {};

exports.emitSerialBase = function() {};

exports.emitType = function(sym) {
  if (sym instanceof symbol_locator.WeakSymbol) {
    return sym.identifier;
  } else if (sym instanceof symbol_locator.StrongSymbol) {
    if (!sym.prop) {
      return sym.class.name;
    } else {
      return (Steam.Internal[sym.class.name] || Steam[sym.class.name])[sym.prop.name];
    }
  }
  
  return 'INVALID';
};

exports.emitNode = function(n) {
  if (n instanceof token_analyzer.ClassNode) {
    emitClassNode(n);
  } else if (n instanceof token_analyzer.EnumNode) {
    emitEnumNode(n);
  }
};

function emitEnumNode(enode) {
  var obj = Steam[enode.name] = {};
  enode.childNodes.forEach(function(prop) {
    obj[prop.name] = prop.default.map(function(sym) {
      return obj[sym.identifier] || +sym.identifier;
    }).reduce(function(value, ident) {
      return value | ident;
    });
  });
}

function emitClassNode(cnode) {
  emitClassConstructor(cnode);
  var baseSize = emitClassProperties(cnode);
  
  emitClassEncoder(cnode, baseSize);
  emitClassDecoder(cnode, baseSize);
}

function emitClassConstructor(cnode) {
  Steam.Internal[cnode.name] = function(object) {
    object = object || {};
    
    cnode.childNodes.forEach(function(prop) {
      var defsym = prop.default[0];
      var defflags = prop.flags;
      
      if (defflags == 'const') {
        return;
      }
      
      var symname = prop.name;
      var ctor = exports.emitType(defsym);
      
      if (defflags == 'proto') {
        ctor = new (exports.emitType(prop.type).split('.').slice(1).reduce(function(obj, prop) {
          return obj[prop];
        }, Steam))(object[symname] || {});
      } else if (!defsym) {
        if (prop.flagsOpt) {
          ctor = object[symname] ?
            ByteBuffer.isBuffer(object[symname]) ?
              object[symname]
              : ByteBuffer.wrap(object[symname])
            : new ByteBuffer(code_generator.getTypeSize(prop));
        } else {
          if (~['long', 'ulong'].indexOf(exports.emitType(prop.type))) {
            ctor = ByteBuffer.Long.fromValue(object[symname] || 0);
          } else {
            ctor = object[symname] || 0;
          }
        }
      } else if (~['long', 'ulong'].indexOf(exports.emitType(prop.type))) {
        ctor = ByteBuffer.Long.fromValue(object[symname] || (ctor == 'ulong.MaxValue' ? ByteBuffer.Long.MAX_UNSIGNED_VALUE : ctor));
      } else {
        ctor = object[symname] || +ctor;
      }
      
      this[symname] = ctor;
    }.bind(this));
  };
}

function emitClassProperties(cnode) {
  var baseClassSize = 0;
  
  cnode.childNodes.forEach(function(prop) {
    var propName = prop.name;
    
    if (prop.flags == 'const') {
      var ctor = exports.emitType(prop.default[0]);
      Steam.Internal[cnode.name][propName] = +ctor;
      return;
    }
    
    var size = code_generator.getTypeSize(prop);
    baseClassSize += size;
  });
  
  return baseClassSize;
}

function emitClassEncoder(cnode, baseSize) {
  Steam.Internal[cnode.name].prototype.encode = function() {
    // first emit variable length members
    var varLengthProps = [];
    
    cnode.childNodes.forEach(function(prop) {
      var size = code_generator.getTypeSize(prop);
      
      if (!size) {
        var bb = this[prop.name].encode();
        
        if (prop.flagsOpt != null) {
          this[prop.flagsOpt] = bb.limit;
        }
        
        varLengthProps.push(bb);
      }
    }.bind(this));
    
    var bb = new ByteBuffer(baseSize + varLengthProps.reduce(function(capacity, bb) {
      return capacity + bb.limit;
    }, 0), ByteBuffer.LITTLE_ENDIAN);
    
    // next emit writers
    cnode.childNodes.forEach(function(prop) {
      var typestr = exports.emitType(prop.type);
      var size = code_generator.getTypeSize(prop);
      
      if (prop.flags == 'proto') {
        varLengthProps.shift().copyTo(bb);
        return;
      } else if (prop.flags == 'const') {
        return;
      }
      
      if (!readerTypeMap[typestr]) {
        typestr = code_generator.getTypeOfSize(size, exports.supportsUnsignedTypes());
      }
      
      if (prop.flagsOpt) {
        this[prop.name].copyTo(bb);
      } else {
        bb['write' + readerTypeMap[typestr]](~['protomask', 'protomaskgc'].indexOf(prop.flags) ?
          this[prop.name] | protoMask
          : this[prop.name]);
      }
    }.bind(this));
    
    bb.flip();
    return bb;
  };
  
  Steam.Internal[cnode.name].prototype.toBuffer = function() {
    return this.encode().toBuffer();
  };
}

function emitClassDecoder(cnode) {
  Steam.Internal[cnode.name].decode = function(buffer) {
    if (!ByteBuffer.isByteBuffer(buffer)) {
      buffer = ByteBuffer.wrap(buffer, ByteBuffer.LITTLE_ENDIAN);
    }
    
    var object = {};
    cnode.childNodes.forEach(function(prop) {
      var typestr = exports.emitType(prop.type);
      var size = code_generator.getTypeSize(prop);
      
      var defflags = prop.flags;
      var symname = prop.name;
      
      if (defflags == 'const') {
        return;
      }
      
      if (!size) {
        // assume protobuf
        object[symname] = typestr.split('.').slice(1).reduce(function(obj, prop) {
          return obj[prop];
        }, Steam).decode(buffer.slice(buffer.offset, buffer.offset + object[prop.flagsOpt]));
        buffer.skip(object[prop.flagsOpt]);
      } else {
        if (!readerTypeMap[typestr]) {
          typestr = code_generator.getTypeOfSize(size, exports.supportsUnsignedTypes());
        }
        
        if (prop.flagsOpt) {
          object[symname] = buffer.slice(buffer.offset, buffer.offset + +prop.flagsOpt);
          buffer.skip(+prop.flagsOpt);
        } else {
          object[symname] = buffer['read' + readerTypeMap[typestr]]();
          if (~['protomask', 'protomaskgc'].indexOf(prop.flags)) {
            object[symname] &= ~protoMask;
          }
        }
      }
    });
    
    return object;
  };
}

exports.supportsUnsignedTypes = function() {
  return true;
};

exports.supportsNamespace = function() {
  return true;
};
