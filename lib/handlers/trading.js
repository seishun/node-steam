var Steam = require('../steam_client');

var EMsg = Steam.EMsg;
var schema = Steam.Internal;

var protoMask = 0x80000000;


// Methods

var prototype = Steam.SteamClient.prototype;

prototype.trade = function(user) {
  this._send(EMsg.EconTrading_InitiateTradeRequest | protoMask, new schema.CMsgTrading_InitiateTradeRequest({
    otherSteamid: user
  }));
};

prototype.respondToTrade = function(tradeId, acceptTrade) {
  this._send(EMsg.EconTrading_InitiateTradeResponse | protoMask, new schema.CMsgTrading_InitiateTradeResponse({
    tradeRequestId: tradeId,
    response: +!acceptTrade
  }));
};

prototype.cancelTrade = function(user) {
  this._send(EMsg.EconTrading_CancelTradeRequest | protoMask, new schema.CMsgTrading_CancelTradeRequest({
    otherSteamid: user
  }));
};


// Handlers

var handlers = prototype._handlers;

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
