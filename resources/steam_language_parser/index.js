var token_analyzer = require('./parser/token_analyzer');

var codeGen = require('./generator/node_gen');
var languagePath = require('path').join(__dirname, '../steam_language');

var tokenList = require('./parser/language_parser').tokenizeString('steammsg.steamd', languagePath);

var root = token_analyzer.analyze(tokenList, languagePath);

var rootEnumNode = new token_analyzer.Node();
var rootMessageNode = new token_analyzer.Node();

rootEnumNode.childNodes = root.childNodes.filter( function(n) { return n instanceof token_analyzer.EnumNode; });
rootMessageNode.childNodes = root.childNodes.filter( function(n) { return n instanceof token_analyzer.ClassNode; });

require('./code_generator').emitCode(rootEnumNode, codeGen);
require('./code_generator').emitCode(rootMessageNode, codeGen);
