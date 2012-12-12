var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

prototype.trade = function(user) {
  this._send(EMsg.EconTrading_InitiateTradeRequest | protoMask, schema.CMsgTrading_InitiateTradeRequest.serialize({
    otherSteamid: user
  }));
};

prototype.respondToTrade = function(tradeId, acceptTrade) {
  this._send(EMsg.EconTrading_InitiateTradeResponse | protoMask, schema.CMsgTrading_InitiateTradeResponse.serialize({
    tradeRequestId: tradeId,
    response: !acceptTrade
  }));
};

prototype.cancelTrade = function(user) {
  this._send(EMsg.EconTrading_CancelTradeRequest | protoMask, schema.CMsgTrading_CancelTradeRequest.serialize({
    otherSteamid: user
  }));
};


// Handlers

var handlers = prototype._handlers;

handlers[EMsg.EconTrading_InitiateTradeProposed] = function(data) {
  var tradeProp = schema.CMsgTrading_InitiateTradeRequest.parse(data);
  this.emit('tradeProposed', tradeProp.tradeRequestId, tradeProp.otherSteamid, tradeProp.otherName);
};

handlers[EMsg.EconTrading_InitiateTradeResult] = function(data) {
  var tradeResult = schema.CMsgTrading_InitiateTradeResponse.parse(data);
  this.emit('tradeResult', tradeResult.tradeRequestId, tradeResult.response, tradeResult.otherSteamid);
};

handlers[EMsg.EconTrading_StartSession] = function(data) {
  var startSess = schema.CMsgTrading_StartSession.parse(data);
  this.emit('sessionStart', startSess.otherSteamid);
};
