var crypto = require('crypto');

exports.symmetricEncrypt = function(input, key) {
  var iv = crypto.randomBytes(16);
  var aes = crypto.createCipheriv('aes-256-ecb', key, '');
  aes.setAutoPadding(false);
  var cryptedIv = aes.update(iv) + aes.final();
  
  aes = crypto.createCipheriv('aes-256-cbc', key, iv);
  var cipherText = aes.update(input) + aes.final();
  
  return new Buffer(cryptedIv + cipherText, 'binary');
};

exports.symmetricDecrypt = function(input, key) {
  var aes = crypto.createDecipheriv('aes-256-ecb', key, '');
  aes.setAutoPadding(false);
  var iv = aes.update(input.slice(0, 16)) + aes.final();
  
  aes = crypto.createDecipheriv('aes-256-cbc', key, iv);
  var output = aes.update(input.slice(16)) + aes.final();
  
  return new Buffer(output, 'binary'); //TODO: remove for node.js 0.9
};
