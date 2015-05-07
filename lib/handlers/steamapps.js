var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

prototype.picsGetChangesSince = function(lastChangeNumber, sendAppChangelist, sendPackageChangelist, callback) {
  this._send(EMsg.ClientPICSChangesSinceRequest | protoMask, new schema.CMsgClientPICSChangesSinceRequest({
    sinceChangeNumber: lastChangeNumber,
    sendAppInfoChanges: sendAppChangelist,
    sendPackageInfoChanges: sendPackageChangelist
  }), callback);
};

prototype.picsGetProductInfo = function(apps, packages, callback) {
  apps = apps || [];
  packages = packages || [];
  
  var i;
  for(i = 0; i < apps.length; i++) {
    if(typeof apps[i] === 'number') {
      apps[i] = {"appid": apps[i]};
    }
  }
  
  for(i = 0; i < packages.length; i++) {
    if(typeof packages[i] === 'number') {
      packages[i] = {"packageid": packages[i]};
    }
  }
  
  this._send(EMsg.ClientPICSProductInfoRequest | protoMask, new schema.CMsgClientPICSProductInfoRequest({
    packages: packages,
    apps: apps
  }), callback);
};

prototype.picsGetAccessToken = function(apps, packages, callback) {
  this._send(EMsg.ClientPICSAccessTokenRequest | protoMask, new schema.CMsgClientPICSAccessTokenRequest({
    "packageids": packages || [],
    "appids": apps || []
  }), callback);
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.ClientPICSChangesSinceResponse] = function(data, callback) {
  var proto = schema.CMsgClientPICSChangesSinceResponse.decode(data);
  callback(proto);
};

handlers[EMsg.ClientPICSProductInfoResponse] = function(data, callback) {
  var proto = schema.CMsgClientPICSProductInfoResponse.decode(data);
  var apps = {};
  (proto.apps || []).forEach(function(app) {
    apps[app.appid] = app;
    if(app.buffer) {
      app.data = require('vdf').parse(app.buffer.toString('utf8'));
    }
  });
  
  var packages = {};
  (proto.packages || []).forEach(function(pkg) {
    packages[pkg.packageid] = pkg;
    if(pkg.buffer) {
      pkg.data = require('binarykvparser').parse(pkg.buffer);
    }
  });
  
  proto.apps = apps;
  proto.packages = packages;
  
  callback(proto);
};

handlers[EMsg.ClientPICSAccessTokenResponse] = function(data, callback) {
  var proto = schema.CMsgClientPICSAccessTokenResponse.decode(data);
  var apps = {};
  (proto.appAccessTokens || []).forEach(function(app) {
    apps[app.appid] = app.accessToken
  });
  
  var packages = {};
  (proto.packageAccessTokens || []).forEach(function(pkg) {
    packages[pkg.packageid] = pkg.accessToken;
  });
  
  proto.appAccessTokens = apps;
  proto.packageAccessTokens = packages;
  callback(proto);
};
