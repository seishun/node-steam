var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;


Steam.SteamTrading = function(steamClient) {
  steamClient.on('message', function(header, body, callback) {
    if (header.msg in handlers) {
      // this is so hacky I don't even
      handlers[header.msg].call(steamClient, body, callback);
    }
  });
};


// Methods

var prototype = Steam.SteamClient.prototype;

prototype.trade = function(user) {
  this._send({ msg: EMsg.EconTrading_InitiateTradeRequest, proto: {} }, new schema.CMsgTrading_InitiateTradeRequest({
    otherSteamid: user
  }));
};

prototype.respondToTrade = function(tradeId, acceptTrade) {
  this._send({ msg: EMsg.EconTrading_InitiateTradeResponse, proto: {} }, new schema.CMsgTrading_InitiateTradeResponse({
    tradeRequestId: tradeId,
    response: +!acceptTrade
  }));
};

prototype.cancelTrade = function(user) {
  this._send({ msg: EMsg.EconTrading_CancelTradeRequest, proto: {} }, new schema.CMsgTrading_CancelTradeRequest({
    otherSteamid: user
  }));
};


// Handlers

var handlers = {};

handlers[EMsg.EconTrading_InitiateTradeProposed] = function(data) {
  var tradeProp = schema.CMsgTrading_InitiateTradeRequest.decode(data);
  this.emit('tradeProposed', tradeProp.tradeRequestId, tradeProp.otherSteamid.toString(), tradeProp.otherName);
};

handlers[EMsg.EconTrading_InitiateTradeResult] = function(data) {
  var tradeResult = schema.CMsgTrading_InitiateTradeResponse.decode(data);
  this.emit('tradeResult', tradeResult.tradeRequestId, tradeResult.response, tradeResult.otherSteamid.toString());
};

handlers[EMsg.EconTrading_StartSession] = function(data) {
  var startSess = schema.CMsgTrading_StartSession.decode(data);
  this.emit('sessionStart', startSess.otherSteamid.toString());
};
