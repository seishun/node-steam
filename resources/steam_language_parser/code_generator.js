var symbol_locator = require('./parser/symbol_locator');
var token_analyzer = require('./parser/token_analyzer');

function TypeInfo(size, unsigned) {
  this.size = size;
  this.signed = !unsigned;
  this.signedType = unsigned;
}

var defaultType = 'uint';
var weakTypeMap = {
  byte: new TypeInfo(1),
  short: new TypeInfo(2),
  ushort: new TypeInfo(2, 'short'),
  int: new TypeInfo(4),
  uint: new TypeInfo(4, 'int'),
  long: new TypeInfo(8),
  ulong: new TypeInfo(8, 'long'),
};

exports.getTypeOfSize = function(size, unsigned) {
  for (var key in weakTypeMap) {
    if (weakTypeMap[key].size == size) {
      if (unsigned && !weakTypeMap[key].signed)
        return key;
      else if (weakTypeMap[key].signed)
        return key;
      else if (!weakTypeMap[key].signed)
        return weakTypeMap[key].signedType;
    }
  }
  
  return 'bad';
};

exports.getTypeSize = function(prop) {
  var sym = prop.type;
  
  // no static size for proto
  if (prop.flags == 'proto') {
    return 0;
  }
  
  if (sym instanceof symbol_locator.WeakSymbol) {
    var key = sym.identifier;
    
    if (!weakTypeMap[key]) {
      key = defaultType;
    }
    
    if (prop.flagsOpt) {
      return +prop.flagsOpt;
    }
    
    return weakTypeMap[key].size;
  } else if (sym instanceof symbol_locator.StrongSymbol) {
    if (sym.class instanceof token_analyzer.EnumNode) {
      var enode = sym.class;
      
      if (enode.type instanceof symbol_locator.WeakSymbol)
        return weakTypeMap[enode.type.identifier].size;
      else
        return weakTypeMap[defaultType].size;
    }
  }
  
  return 0;
};

exports.emitCode = function(root, gen, sb, nspace, supportsGC, internalFile) {
  gen.emitNamespace(sb, false, nspace);
  
  var level = 0;
  if (gen.supportsNamespace())
    level = 1;
  
  if (internalFile)
    gen.emitSerialBase(sb, level, supportsGC);
  
  root.childNodes.forEach(function(n) {
    gen.emitNode(n, sb, level);
  });
  
  gen.emitNamespace(sb, true, nspace);
};
