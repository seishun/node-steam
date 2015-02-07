exports.Token = function(name, value) {
  this.name = name;
  this.value = value;
};

var pattern =
  '(\\s+)|' + // whitespace
  '([;])|' + // terminator
  
  '["](.+?)["]|' + // string
  
  '//(.*)$|' + // comment
  
  '(-?[a-zA-Z_0-9][a-zA-Z0-9_:.]*)|' + // identifier
  '[#]([a-zA-Z]*)|' + // preprocess
  
  '([{}<>\\]=|])|' + // operator
  '([^\\s]+)'; // invalid

var groupNames = [
  , 'whitespace'
  , 'terminator'
  , 'string'
  , 'comment'
  , 'identifier'
  , 'preprocess'
  , 'operator'
  , 'invalid'
];

var regexPattern = new RegExp(pattern, 'gm');

exports.tokenizeString = function(buffer) {
  var match;

  var tokenList = [];
  while ((match = regexPattern.exec(buffer))) {
    for (var i = 0; i < match.length; i++) {
      if (match[i] && i > 1) {
        var groupName = groupNames[i];
        
        if (groupName == 'comment')
          continue; // don't create tokens for comments
        
        tokenList.push(new exports.Token(groupName, match[i]));
      }
    }
  }
  
  return tokenList;
};
