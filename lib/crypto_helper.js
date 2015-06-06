var crypto = require('crypto');
var publicKey = require('fs').readFileSync(__dirname + '/public.pub');

exports.generateSessionKey = function() {
  var sessionKey = require('crypto').randomBytes(32);
  var cryptedSessionKey = require('crypto').publicEncrypt(publicKey, sessionKey);
  return {
    plain: sessionKey,
    encrypted: cryptedSessionKey
  };
};

exports.symmetricEncrypt = function(input, key) {
  var iv = crypto.randomBytes(16);
  var aesIv = crypto.createCipheriv('aes-256-ecb', key, '');
  aesIv.setAutoPadding(false);
  aesIv.end(iv);
  
  var aesData = crypto.createCipheriv('aes-256-cbc', key, iv);
  aesData.end(input);
  
  return Buffer.concat([aesIv.read(), aesData.read()]);
};

exports.symmetricDecrypt = function(input, key) {
  var aesIv = crypto.createDecipheriv('aes-256-ecb', key, '');
  aesIv.setAutoPadding(false);
  aesIv.end(input.slice(0, 16));
  
  var aesData = crypto.createDecipheriv('aes-256-cbc', key, aesIv.read());
  aesData.end(input.slice(16));
  
  return aesData.read();
};
