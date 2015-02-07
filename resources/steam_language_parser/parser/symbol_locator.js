exports.StrongSymbol = function(classNode, prop) {
  this.class = classNode;
  this.prop = prop;
};

exports.WeakSymbol = function(ident) {
  this.identifier = ident;
};

var identifierPattern = '([a-zA-Z0-9_:]*)';
var fullIdentPattern = '([a-zA-Z0-9_]*?)::([a-zA-Z0-9_]*)';

var identifierRegex = new RegExp(identifierPattern);
var fullIdentRegex = new RegExp(fullIdentPattern);

function findNode(tree, symbol) {
  for (var i = 0; i < tree.childNodes.length; i++) {
    if (tree.childNodes[i].name == symbol) {
      return tree.childNodes[i];
    }
  }
}

exports.lookupSymbol = function(tree, identifier, strongonly) {
  var ident = identifierRegex.exec(identifier);
  
  if (!ident) {
    throw new Error("Invalid identifier specified " + identifier);
  }
  
  var classNode;
  
  if (!~identifier.indexOf('::')) {
    classNode = findNode(tree, ident[0]);
    
    if (!classNode) {
      if (strongonly) {
        throw new Error("Invalid weak symbol " + identifier);
      } else {
        return new exports.WeakSymbol(identifier);
      }
    } else {
      return new exports.StrongSymbol(classNode);
    }
  } else {
    ident = fullIdentRegex.exec(identifier);
    
    if (!ident) {
      throw new Error("Couldn't parse full identifier");
    }
    
    classNode = findNode(tree, ident[1]);
    
    if (!classNode) {
      throw new Error("Invalid class in identifier " + identifier);
    }
    
    var propNode = findNode(classNode, ident[2]);
    
    if (!propNode) {
      throw new Error("Invalid property in identifier " + identifier);
    }
    
    return new exports.StrongSymbol(classNode, propNode);
  }
  
  throw new Error("Invalid symbol");
};
