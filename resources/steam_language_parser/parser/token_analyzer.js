var language_parser = require('./language_parser');
var lookupSymbol = require('./symbol_locator').lookupSymbol;

exports.Node = function() {
  this.childNodes = [];
};

exports.ClassNode = function() {
  exports.Node.call(this);
};

exports.PropNode = function() {
  exports.Node.call(this);
  this.default = [];
};

exports.EnumNode = function() {
  exports.Node.call(this);
};

exports.analyze = function(tokens) {
  var root = new exports.Node();
  
  while (tokens.length > 0) {
    var cur = tokens.shift();
    
    switch (cur.name) {
      case 'EOF':
        break;
      case 'preprocess':
        var text = expect(tokens, 'string');
        
        if (cur.value == 'import') {
          var parentTokens = language_parser.tokenizeString(require('fs').readFileSync(text.value, { encoding: 'ascii' }));
          
          var newRoot = exports.analyze(parentTokens);
          
          newRoot.childNodes.forEach(function(child) {
            root.childNodes.push(child);
          });
        }
        break;
      case 'identifier':
        var name, op1, op2;
        switch (cur.value) {
          case 'class':
            {
              name = expect(tokens, 'identifier');
              var ident = null, parent = null;
              
              op1 = optional(tokens, 'operator', '<');
              if (op1) {
                ident = expect(tokens, 'identifier');
                op2 = expect(tokens, 'operator', '>');
              }
              
              var expects = optional(tokens, 'identifier', 'expects');
              if (expects) {
                parent = expect(tokens, 'identifier');
              }
              
              var cnode = new exports.ClassNode();
              cnode.name = name.value;
              
              if (ident) {
                cnode.ident = lookupSymbol(root, ident.value, false);
              }
              
              if (parent) {
                //cnode.parent = lookupSymbol(root, parent.value, true);
              }
              
              root.childNodes.push(cnode);
              parseInnerScope(tokens, cnode, root);
            }
            break;
          case 'enum':
            {
              name = expect(tokens, 'identifier');
              var datatype = null;
              
              op1 = optional(tokens, 'operator', '<');
              if (op1) {
                datatype = expect(tokens, 'identifier');
                op2 = expect(tokens, 'operator', '>');
              }
              
              var flag = optional(tokens, 'identifier', 'flags');
              
              var enode = new exports.EnumNode();
              enode.name = name.value;
              
              if (flag) {
                enode.flags = flag.value;
              }
              
              if (datatype) {
                enode.type = lookupSymbol(root, datatype.value, false);
              }
              
              
              root.childNodes.push(enode);
              parseInnerScope(tokens, enode, root);
            }
            break;
        }
        break;
    }
  }
  
  return root;
};

function parseInnerScope(tokens, parent, root) {
  var scope1 = expect(tokens, 'operator', '{');
  var scope2 = optional(tokens, 'operator', '}');
  
  while (!scope2) {
    var pnode = new exports.PropNode();
    
    var t1 = tokens.shift();
    
    var t1op1 = optional(tokens, 'operator', '<');
    var flagop = null;
    
    if (t1op1) {
      flagop = expect(tokens, 'identifier');
      var t1op2 = expect(tokens, 'operator', '>');
      
      pnode.flagsOpt = flagop.value;
    }
    
    var t2 = optional(tokens, 'identifier');
    var t3 = optional(tokens, 'identifier');
    
    if (t3) {
      pnode.name = t3.value;
      pnode.type = lookupSymbol(root, t2.value, false);
      pnode.flags = t1.value;
    } else if (t2) {
      pnode.name = t2.value;
      pnode.type = lookupSymbol(root, t1.value, false);
    } else {
      pnode.name = t1.value;
    }
    
    var defop = optional(tokens, 'operator', '=');
    
    if (defop) {
      while (true) {
        var value = tokens.shift();
        pnode.default.push(lookupSymbol(root, value.value, false));
        
        if (optional(tokens, 'operator', '|'))
          continue;
        
        expect(tokens, 'terminator', ';');
        break;
      }
    } else {
      expect(tokens, 'terminator', ';');
    }
    
    var obsolete = optional(tokens, 'identifier', 'obsolete');
    if (obsolete) {
      pnode.obsolete = '';
      
      var obsoleteReason = optional(tokens, 'string');
      
      if (obsoleteReason)
        pnode.obsolete = obsoleteReason.value;
    }
    
    parent.childNodes.push(pnode);
    
    scope2 = optional(tokens, 'operator', '}');
  }
}

function expect(tokens, name, value) {
  var peek = tokens[0];
  
  if (!peek) {
    return language_parser.Token('EOF', '');
  }
  
  if (peek.name != name || value && peek.value != value) {
    throw new Error("Expecting " + name);
  }
  
  return tokens.shift();
}

function optional(tokens, name, value) {
  var peek = tokens[0];
  
  if (!peek) {
    return new language_parser.Token('EOF', '');
  }
  
  if (peek.name != name || value && peek.value != value) {
    return null;
  }
  
  return tokens.shift();
}
