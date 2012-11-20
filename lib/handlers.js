var Steam = require('./steam_client');

var EChatInfoType = Steam.EChatInfoType;
var EMsg = Steam.EMsg;
var EResult = Steam.EResult;

var handlers = Steam.SteamClient.prototype._handlers = {};
var schema = Steam.Internal;

var protoMask = 0x80000000;
var pubKey = require('fs').readFileSync(__dirname + '/public.pub');
var rsa = require('ursa').createPublicKey(pubKey);

handlers[EMsg.ChannelEncryptRequest] = function(data) {    
//  var encRequest = schema.MsgChannelEncryptRequest.parse(data);
  
  this._tempSessionKey = require('crypto').randomBytes(32);
  var cryptedSessKey = rsa.encrypt(this._tempSessionKey);
  var keyCrc = require('crc').buffer.crc32(cryptedSessKey);
  
  var encResp = schema.MsgChannelEncryptResponse.serialize({});
  var body = new Buffer(encResp.length + 128 + 4 + 4); // key, crc, trailer
  
  encResp.copy(body, 0);
  cryptedSessKey.copy(body, encResp.length);
  body.writeInt32LE(keyCrc, encResp.length + 128);
  body.writeUInt32LE(0, encResp.length + 128 + 4); // TODO: check if the trailer is required
  
  this._send(EMsg.ChannelEncryptResponse, body);
};

handlers[EMsg.ChannelEncryptResult] = function(data) {
  var encResult = schema.MsgChannelEncryptResult.parse(data);
  
  if (encResult.result == EResult.OK) {
    this._connection.sessionKey = this._tempSessionKey;
  } else {
    this.emit('error', new Error("Encryption fail: " + encResult.result));
    return;
  }
  
  this.emit('connected');
  
  this._send(EMsg.ClientLogon | protoMask, schema.CMsgClientLogon.serialize({
    accountName: this._username,
    password: this._password,
    protocolVersion: 65575,
    authCode: this._authCode
  }));
};

handlers[EMsg.Multi] = function(data) {
  var msgMulti = schema.CMsgMulti.parse(data);
  
  var payload = msgMulti.messageBody;
      
  if (msgMulti.sizeUnzipped) {
    var zip = new (require('adm-zip'))(payload);
    payload = zip.readFile('z');
  }
  
  while (payload.length) {
    var subSize = payload.readUInt32LE(0);
    this._netMsgReceived(payload.slice(4, 4 + subSize));
    payload = payload.slice(4 + subSize);
  }
};

handlers[EMsg.ClientLogOnResponse] = function(data) {
  var logonResp = schema.CMsgClientLogonResponse.parse(data);
  
  if (logonResp.eresult == EResult.OK) {
    var hbDelay = logonResp.outOfGameHeartbeatSeconds;
    
    clearInterval(this._heartBeatFunc);
    this._heartBeatFunc = setInterval(function() {
      this._send(EMsg.ClientHeartBeat, schema.CMsgClientHeartBeat.serialize({}));
    }.bind(this), hbDelay * 1000);
    
    this.emit('loggedOn');
    return;
  }
  
  if (logonResp.eresult == EResult.TryAnotherCM || logonResp.eresult == EResult.ServiceUnavailable && this._sessionID) {
    this.logOn(this._username, this._password, this._authCode); // retry
    return;
  }
  
  switch (logonResp.eresult) {
    case EResult.InvalidPassword:
      this.emit('error', new Error('Invalid password'));
      break;
    
    case EResult.ServiceUnavailable:
      this.emit('error', new Error('Steam is down'));
      break;
    
    case EResult.AccountLogonDenied:
      this.emit('error', new Error('SteamGuard'));
      break;
    
    default:
      this.emit('error', new Error('Logon fail: ' + logonResp.eresult));
  }
};

handlers[EMsg.ClientNewLoginKey] = function(data) {
  var loginKey = schema.CMsgClientNewLoginKey.parse(data);
  
  this._send(EMsg.ClientNewLoginKeyAccepted | protoMask, schema.CMsgClientNewLoginKeyAccepted.serialize({
    uniqueId: loginKey.uniqueId
  }));
  
  // yes, number -> string -> ASCII bytes -> base64
  this._webSessionID = new Buffer(loginKey.uniqueId.toString()).toString('base64');
  
  this._send(EMsg.ClientRequestWebAPIAuthenticateUserNonce | protoMask, schema.CMsgClientRequestWebAPIAuthenticateUserNonce.serialize({}));
};

handlers[EMsg.ClientRequestWebAPIAuthenticateUserNonceResponse] = function(data) {
  var nonce = schema.CMsgClientRequestWebAPIAuthenticateUserNonceResponse.parse(data);
  
  var sessionKey = require('crypto').randomBytes(32);
  var cryptedSessionKey = rsa.encrypt(sessionKey);
  var cryptedLoginKey = require('./crypto_helper').symmetricEncrypt(nonce.webapiAuthenticateUserNonce, sessionKey);
  
  require('superagent')
    .post('http://api.steampowered.com/ISteamUserAuth/AuthenticateUser/v1')
    .send('steamid=' + this.steamID
      + '&sessionkey=' + escape(cryptedSessionKey.toString('binary'))
      + '&encrypted_loginkey=' + escape(cryptedLoginKey.toString('binary'))
    )
    .end(function(res) {
      if (res.ok) {
        this.emit('webLoggedOn', this._webSessionID, res.body.authenticateuser.token);
      }
      else {
        this.emit('debug', 'Web authentication failed, retrying');
        this._send(EMsg.ClientRequestWebAPIAuthenticateUserNonce | protoMask, schema.CMsgClientRequestWebAPIAuthenticateUserNonce.serialize({}));
      }
    }.bind(this));
};

handlers[EMsg.ClientLoggedOff] = function(data) {
  clearInterval(this._heartBeatFunc);
  
  var loggedOff = schema.CMsgClientLoggedOff.parse(data);
  
  if (loggedOff.eresult == EResult.ServiceUnavailable) {
    this.logOn(this._username, this._password, this._authCode); // retry
  }
  this.emit('loggedOff', loggedOff.eresult);
};

handlers[EMsg.ClientPersonaState] = function(data) {
  var perState = schema.CMsgClientPersonaState.parse(data);
  
  perState.friends.forEach(function(friend) {
    this._users[friend.friendid] = friend.playerName; // might need to check whether it's defined
    // TODO: other data
  }.bind(this));
//  console.log(data);
};

handlers[EMsg.ClientChatMsg] = function(data) {
  var chatMsg = schema.MsgClientChatMsg.parse(data);
  var message = data.slice(schema.MsgClientChatMsg.baseSize).toString();
  
  // the following is probably what Steam does
  var nullpos = message.indexOf('\u0000');
  if (nullpos != -1) {
    message = message.slice(0, nullpos);
  }
  
  this.emit('chatMsg', chatMsg.steamIdChatter, message, chatMsg.steamIdChatRoom, chatMsg.chatMsgType);
};

handlers[EMsg.ClientChatMemberInfo] = function(data) {
  var membInfo = schema.MsgClientChatMemberInfo.parse(data);
  
  // 8 bytes actedon + 4 bytes statechange + 8 bytes actedby
  var payload = data.slice(schema.MsgClientChatMemberInfo.baseSize);
  
  if (membInfo.type == EChatInfoType.StateChange) {
    var chatterActedOn = payload.readUInt64LE(0);
    var stateChange = payload.readInt32LE(8);
    var chatterActedBy = payload.readUInt64LE(12);
    this.emit({
      0x01: 'entered',
      0x02: 'left',
      0x04: 'disconnected',
      0x08: 'kicked',
      0x10: 'banned'
    }[stateChange], chatterActedOn, membInfo.steamIdChat, chatterActedBy);
  }
};

handlers[EMsg.ClientChatInvite] = function(data) {
  var chatInvite = schema.CMsgClientChatInvite.parse(data);
  this.emit('chatInvite', chatInvite.steamIdChat, chatInvite.chatName, chatInvite.steamIdPatron);
};

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

handlers[EMsg.ClientClanState] = function(data) {
  var clanState = schema.CMsgClientClanState.parse(data);
  if (clanState.announcements) {
    this.emit('announcement', clanState.steamidClan, clanState.announcements[0].headline); // TODO: more data
  }
};
