var Steam = require('../steam_client');
var EMsg = Steam.EMsg;
var EUdpPacketType = Steam.EUdpPacketType;
var EUniverse = Steam.EUniverse;
var EResult = Steam.EResult;

require('ref');


var UdpHeader = {
  MAGIC: 0x31305356,
  baseSize: 36,
  
  serialize: function(object) {
    var buffer = new Buffer(36);
    
    buffer.writeUInt32LE(object.magic || UdpHeader.MAGIC, 0);
    buffer.writeUInt16LE(object.payloadSize || 0, 4);
    buffer.writeUInt8(object.packetType || EUdpPacketType.Invalid, 6);
    buffer.writeUInt8(object.flags || 0, 7);
    buffer.writeUInt32LE(object.sourceConnID || 512, 8);
    buffer.writeUInt32LE(object.destConnID || 0, 12);
    buffer.writeUInt32LE(object.seqThis || 0, 16);
    buffer.writeUInt32LE(object.seqAck || 0, 20);
    buffer.writeUInt32LE(object.packetsInMsg || 0, 24);
    buffer.writeUInt32LE(object.msgStartSeq || 0, 28);
    buffer.writeUInt32LE(object.msgSize || 0, 32);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.magic = buffer.readUInt32LE(0);
    object.payloadSize = buffer.readUInt16LE(4);
    object.packetType = buffer.readUInt8(6);
    object.flags = buffer.readUInt8(7);
    object.sourceConnID = buffer.readUInt32LE(8);
    object.destConnID = buffer.readUInt32LE(12);
    object.seqThis = buffer.readUInt32LE(16);
    object.seqAck = buffer.readUInt32LE(20);
    object.packetsInMsg = buffer.readUInt32LE(24);
    object.msgStartSeq = buffer.readUInt32LE(28);
    object.msgSize = buffer.readUInt32LE(32);
    
    return object;
  }
};

Steam.Internal.UdpHeader = UdpHeader;


var ChallengeData = {
  CHALLENGE_MASK: 0xA426DF2B,
  baseSize: 8,
  
  serialize: function(object) {
    var buffer = new Buffer(8);
    
    buffer.writeUInt32LE(object.challengeValue || 0, 0);
    buffer.writeUInt32LE(object.serverLoad || 0, 4);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.challengeValue = buffer.readUInt32LE(0);
    object.serverLoad = buffer.readUInt32LE(4);
    
    return object;
  }
};

Steam.Internal.ChallengeData = ChallengeData;


var ConnectData = {
  CHALLENGE_MASK: ChallengeData.CHALLENGE_MASK,
  baseSize: 4,
  
  serialize: function(object) {
    var buffer = new Buffer(4);
    
    buffer.writeUInt32LE(object.challengeValue || 0, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.challengeValue = buffer.readUInt32LE(0);
    
    return object;
  }
};

Steam.Internal.ConnectData = ConnectData;


var Accept = {
  baseSize: 0,
  
  serialize: function(object) {
    var buffer = new Buffer(0);
    
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    
    return object;
  }
};

Steam.Internal.Accept = Accept;


var Datagram = {
  baseSize: 0,
  
  serialize: function(object) {
    var buffer = new Buffer(0);
    
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    
    return object;
  }
};

Steam.Internal.Datagram = Datagram;


var Disconnect = {
  baseSize: 0,
  
  serialize: function(object) {
    var buffer = new Buffer(0);
    
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    
    return object;
  }
};

Steam.Internal.Disconnect = Disconnect;


var MsgHdr = {
  baseSize: 20,
  
  serialize: function(object) {
    var buffer = new Buffer(20);
    
    buffer.writeInt32LE(object.msg || EMsg.Invalid, 0);
    buffer.writeUInt64LE(object.targetJobID || '18446744073709551615', 4);
    buffer.writeUInt64LE(object.sourceJobID || '18446744073709551615', 12);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.msg = buffer.readInt32LE(0);
    object.targetJobID = buffer.readUInt64LE(4);
    object.sourceJobID = buffer.readUInt64LE(12);
    
    return object;
  }
};

Steam.Internal.MsgHdr = MsgHdr;


var ExtendedClientMsgHdr = {
  baseSize: 36,
  
  serialize: function(object) {
    var buffer = new Buffer(36);
    
    buffer.writeInt32LE(object.msg || EMsg.Invalid, 0);
    buffer.writeUInt8(object.headerSize || 36, 4);
    buffer.writeUInt16LE(object.headerVersion || 2, 5);
    buffer.writeUInt64LE(object.targetJobID || '18446744073709551615', 7);
    buffer.writeUInt64LE(object.sourceJobID || '18446744073709551615', 15);
    buffer.writeUInt8(object.headerCanary || 239, 23);
    buffer.writeUInt64LE(object.steamID || 0, 24);
    buffer.writeInt32LE(object.sessionID || 0, 32);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.msg = buffer.readInt32LE(0);
    object.headerSize = buffer.readUInt8(4);
    object.headerVersion = buffer.readUInt16LE(5);
    object.targetJobID = buffer.readUInt64LE(7);
    object.sourceJobID = buffer.readUInt64LE(15);
    object.headerCanary = buffer.readUInt8(23);
    object.steamID = buffer.readUInt64LE(24);
    object.sessionID = buffer.readInt32LE(32);
    
    return object;
  }
};

Steam.Internal.ExtendedClientMsgHdr = ExtendedClientMsgHdr;


var MsgHdrProtoBuf = {
  baseSize: 8,
  
  serialize: function(object) {
    var bufProto = Steam.Internal.CMsgProtoBufHeader.serialize(object.proto || {});
    object.headerLength = bufProto.length;
    var buffer = new Buffer(8 + bufProto.length);
    
    buffer.writeInt32LE(object.msg || EMsg.Invalid, 0);
    buffer.writeInt32LE(object.headerLength || 0, 4);
    bufProto.copy(buffer, 8);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.msg = buffer.readInt32LE(0);
    object.headerLength = buffer.readInt32LE(4);
    object.proto = Steam.Internal.CMsgProtoBufHeader.parse(buffer.slice(8, 8 + object.headerLength));
    
    return object;
  }
};

Steam.Internal.MsgHdrProtoBuf = MsgHdrProtoBuf;


var MsgGCHdrProtoBuf = {
  baseSize: 8,
  
  serialize: function(object) {
    var bufProto = Steam.GC.Internal.CMsgProtoBufHeader.serialize(object.proto || {});
    object.headerLength = bufProto.length;
    var buffer = new Buffer(8 + bufProto.length);
    
    buffer.writeUInt32LE(object.msg || 0, 0);
    buffer.writeInt32LE(object.headerLength || 0, 4);
    bufProto.copy(buffer, 8);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.msg = buffer.readUInt32LE(0);
    object.headerLength = buffer.readInt32LE(4);
    object.proto = Steam.GC.Internal.CMsgProtoBufHeader.parse(buffer.slice(8, 8 + object.headerLength));
    
    return object;
  }
};

Steam.Internal.MsgGCHdrProtoBuf = MsgGCHdrProtoBuf;


var MsgGCHdr = {
  baseSize: 18,
  
  serialize: function(object) {
    var buffer = new Buffer(18);
    
    buffer.writeUInt16LE(object.headerVersion || 1, 0);
    buffer.writeUInt64LE(object.targetJobID || '18446744073709551615', 2);
    buffer.writeUInt64LE(object.sourceJobID || '18446744073709551615', 10);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.headerVersion = buffer.readUInt16LE(0);
    object.targetJobID = buffer.readUInt64LE(2);
    object.sourceJobID = buffer.readUInt64LE(10);
    
    return object;
  }
};

Steam.Internal.MsgGCHdr = MsgGCHdr;


var MsgClientJustStrings = {
  baseSize: 0,
  
  serialize: function(object) {
    var buffer = new Buffer(0);
    
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    
    return object;
  }
};

Steam.Internal.MsgClientJustStrings = MsgClientJustStrings;


var MsgClientGenericResponse = {
  baseSize: 4,
  
  serialize: function(object) {
    var buffer = new Buffer(4);
    
    buffer.writeInt32LE(object.result || 0, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    
    return object;
  }
};

Steam.Internal.MsgClientGenericResponse = MsgClientGenericResponse;


var MsgChannelEncryptRequest = {
  PROTOCOL_VERSION: 1,
  baseSize: 8,
  
  serialize: function(object) {
    var buffer = new Buffer(8);
    
    buffer.writeUInt32LE(object.protocolVersion || MsgChannelEncryptRequest.PROTOCOL_VERSION, 0);
    buffer.writeInt32LE(object.universe || EUniverse.Invalid, 4);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.protocolVersion = buffer.readUInt32LE(0);
    object.universe = buffer.readInt32LE(4);
    
    return object;
  }
};

Steam.Internal.MsgChannelEncryptRequest = MsgChannelEncryptRequest;


var MsgChannelEncryptResponse = {
  baseSize: 8,
  
  serialize: function(object) {
    var buffer = new Buffer(8);
    
    buffer.writeUInt32LE(object.protocolVersion || MsgChannelEncryptRequest.PROTOCOL_VERSION, 0);
    buffer.writeUInt32LE(object.keySize || 128, 4);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.protocolVersion = buffer.readUInt32LE(0);
    object.keySize = buffer.readUInt32LE(4);
    
    return object;
  }
};

Steam.Internal.MsgChannelEncryptResponse = MsgChannelEncryptResponse;


var MsgChannelEncryptResult = {
  baseSize: 4,
  
  serialize: function(object) {
    var buffer = new Buffer(4);
    
    buffer.writeInt32LE(object.result || EResult.Invalid, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    
    return object;
  }
};

Steam.Internal.MsgChannelEncryptResult = MsgChannelEncryptResult;


var MsgClientNewLoginKey = {
  baseSize: 24,
  
  serialize: function(object) {
    var buffer = new Buffer(24);
    
    buffer.writeUInt32LE(object.uniqueID || 0, 0);
    object.loginKey && object.loginKey.copy(buffer, 4);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.uniqueID = buffer.readUInt32LE(0);
    object.loginKey = buffer.slice(4, 4 + 20);
    
    return object;
  }
};

Steam.Internal.MsgClientNewLoginKey = MsgClientNewLoginKey;


var MsgClientNewLoginKeyAccepted = {
  baseSize: 4,
  
  serialize: function(object) {
    var buffer = new Buffer(4);
    
    buffer.writeUInt32LE(object.uniqueID || 0, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.uniqueID = buffer.readUInt32LE(0);
    
    return object;
  }
};

Steam.Internal.MsgClientNewLoginKeyAccepted = MsgClientNewLoginKeyAccepted;


var MsgClientLogon = {
  ObfuscationMask: 0xBAADF00D,
  CurrentProtocol: 65575,
  ProtocolVerMajorMask: 0xFFFF0000,
  ProtocolVerMinorMask: 0xFFFF,
  ProtocolVerMinorMinGameServers: 4,
  ProtocolVerMinorMinForSupportingEMsgMulti: 12,
  ProtocolVerMinorMinForSupportingEMsgClientEncryptPct: 14,
  ProtocolVerMinorMinForExtendedMsgHdr: 17,
  ProtocolVerMinorMinForCellId: 18,
  ProtocolVerMinorMinForSessionIDLast: 19,
  ProtocolVerMinorMinForServerAvailablityMsgs: 24,
  ProtocolVerMinorMinClients: 25,
  ProtocolVerMinorMinForOSType: 26,
  ProtocolVerMinorMinForCegApplyPESig: 27,
  ProtocolVerMinorMinForMarketingMessages2: 27,
  ProtocolVerMinorMinForAnyProtoBufMessages: 28,
  ProtocolVerMinorMinForProtoBufLoggedOffMessage: 28,
  ProtocolVerMinorMinForProtoBufMultiMessages: 28,
  ProtocolVerMinorMinForSendingProtocolToUFS: 30,
  ProtocolVerMinorMinForMachineAuth: 33,
  baseSize: 0,
  
  serialize: function(object) {
    var buffer = new Buffer(0);
    
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    
    return object;
  }
};

Steam.Internal.MsgClientLogon = MsgClientLogon;


var MsgClientVACBanStatus = {
  baseSize: 4,
  
  serialize: function(object) {
    var buffer = new Buffer(4);
    
    buffer.writeUInt32LE(object.numBans || 0, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.numBans = buffer.readUInt32LE(0);
    
    return object;
  }
};

Steam.Internal.MsgClientVACBanStatus = MsgClientVACBanStatus;


var MsgClientAppUsageEvent = {
  baseSize: 14,
  
  serialize: function(object) {
    var buffer = new Buffer(14);
    
    buffer.writeInt32LE(object.appUsageEvent || 0, 0);
    buffer.writeUInt64LE(object.gameID || 0, 4);
    buffer.writeUInt16LE(object.offline || 0, 12);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.appUsageEvent = buffer.readInt32LE(0);
    object.gameID = buffer.readUInt64LE(4);
    object.offline = buffer.readUInt16LE(12);
    
    return object;
  }
};

Steam.Internal.MsgClientAppUsageEvent = MsgClientAppUsageEvent;


var MsgClientEmailAddrInfo = {
  baseSize: 9,
  
  serialize: function(object) {
    var buffer = new Buffer(9);
    
    buffer.writeUInt32LE(object.passwordStrength || 0, 0);
    buffer.writeUInt32LE(object.flagsAccountSecurityPolicy || 0, 4);
    buffer.writeUInt8(object.validated || 0, 8);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.passwordStrength = buffer.readUInt32LE(0);
    object.flagsAccountSecurityPolicy = buffer.readUInt32LE(4);
    object.validated = buffer.readUInt8(8);
    
    return object;
  }
};

Steam.Internal.MsgClientEmailAddrInfo = MsgClientEmailAddrInfo;


var MsgClientUpdateGuestPassesList = {
  baseSize: 12,
  
  serialize: function(object) {
    var buffer = new Buffer(12);
    
    buffer.writeInt32LE(object.result || 0, 0);
    buffer.writeInt32LE(object.countGuestPassesToGive || 0, 4);
    buffer.writeInt32LE(object.countGuestPassesToRedeem || 0, 8);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    object.countGuestPassesToGive = buffer.readInt32LE(4);
    object.countGuestPassesToRedeem = buffer.readInt32LE(8);
    
    return object;
  }
};

Steam.Internal.MsgClientUpdateGuestPassesList = MsgClientUpdateGuestPassesList;


var MsgClientRequestedClientStats = {
  baseSize: 4,
  
  serialize: function(object) {
    var buffer = new Buffer(4);
    
    buffer.writeInt32LE(object.countStats || 0, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.countStats = buffer.readInt32LE(0);
    
    return object;
  }
};

Steam.Internal.MsgClientRequestedClientStats = MsgClientRequestedClientStats;


var MsgClientP2PIntroducerMessage = {
  baseSize: 1466,
  
  serialize: function(object) {
    var buffer = new Buffer(1466);
    
    buffer.writeUInt64LE(object.steamID || 0, 0);
    buffer.writeInt32LE(object.routingType || 0, 8);
    object.data && object.data.copy(buffer, 12);
    buffer.writeUInt32LE(object.dataLen || 0, 1462);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamID = buffer.readUInt64LE(0);
    object.routingType = buffer.readInt32LE(8);
    object.data = buffer.slice(12, 12 + 1450);
    object.dataLen = buffer.readUInt32LE(1462);
    
    return object;
  }
};

Steam.Internal.MsgClientP2PIntroducerMessage = MsgClientP2PIntroducerMessage;


var MsgClientOGSBeginSession = {
  baseSize: 17,
  
  serialize: function(object) {
    var buffer = new Buffer(17);
    
    buffer.writeUInt8(object.accountType || 0, 0);
    buffer.writeUInt64LE(object.accountId || 0, 1);
    buffer.writeUInt32LE(object.appId || 0, 9);
    buffer.writeUInt32LE(object.timeStarted || 0, 13);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.accountType = buffer.readUInt8(0);
    object.accountId = buffer.readUInt64LE(1);
    object.appId = buffer.readUInt32LE(9);
    object.timeStarted = buffer.readUInt32LE(13);
    
    return object;
  }
};

Steam.Internal.MsgClientOGSBeginSession = MsgClientOGSBeginSession;


var MsgClientOGSBeginSessionResponse = {
  baseSize: 14,
  
  serialize: function(object) {
    var buffer = new Buffer(14);
    
    buffer.writeInt32LE(object.result || 0, 0);
    buffer.writeUInt8(object.collectingAny || 0, 4);
    buffer.writeUInt8(object.collectingDetails || 0, 5);
    buffer.writeUInt64LE(object.sessionId || 0, 6);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    object.collectingAny = buffer.readUInt8(4);
    object.collectingDetails = buffer.readUInt8(5);
    object.sessionId = buffer.readUInt64LE(6);
    
    return object;
  }
};

Steam.Internal.MsgClientOGSBeginSessionResponse = MsgClientOGSBeginSessionResponse;


var MsgClientOGSEndSession = {
  baseSize: 20,
  
  serialize: function(object) {
    var buffer = new Buffer(20);
    
    buffer.writeUInt64LE(object.sessionId || 0, 0);
    buffer.writeUInt32LE(object.timeEnded || 0, 8);
    buffer.writeInt32LE(object.reasonCode || 0, 12);
    buffer.writeInt32LE(object.countAttributes || 0, 16);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.sessionId = buffer.readUInt64LE(0);
    object.timeEnded = buffer.readUInt32LE(8);
    object.reasonCode = buffer.readInt32LE(12);
    object.countAttributes = buffer.readInt32LE(16);
    
    return object;
  }
};

Steam.Internal.MsgClientOGSEndSession = MsgClientOGSEndSession;


var MsgClientOGSEndSessionResponse = {
  baseSize: 4,
  
  serialize: function(object) {
    var buffer = new Buffer(4);
    
    buffer.writeInt32LE(object.result || 0, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    
    return object;
  }
};

Steam.Internal.MsgClientOGSEndSessionResponse = MsgClientOGSEndSessionResponse;


var MsgClientOGSWriteRow = {
  baseSize: 12,
  
  serialize: function(object) {
    var buffer = new Buffer(12);
    
    buffer.writeUInt64LE(object.sessionId || 0, 0);
    buffer.writeInt32LE(object.countAttributes || 0, 8);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.sessionId = buffer.readUInt64LE(0);
    object.countAttributes = buffer.readInt32LE(8);
    
    return object;
  }
};

Steam.Internal.MsgClientOGSWriteRow = MsgClientOGSWriteRow;


var MsgClientGetFriendsWhoPlayGame = {
  baseSize: 8,
  
  serialize: function(object) {
    var buffer = new Buffer(8);
    
    buffer.writeUInt64LE(object.gameId || 0, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.gameId = buffer.readUInt64LE(0);
    
    return object;
  }
};

Steam.Internal.MsgClientGetFriendsWhoPlayGame = MsgClientGetFriendsWhoPlayGame;


var MsgClientGetFriendsWhoPlayGameResponse = {
  baseSize: 16,
  
  serialize: function(object) {
    var buffer = new Buffer(16);
    
    buffer.writeInt32LE(object.result || 0, 0);
    buffer.writeUInt64LE(object.gameId || 0, 4);
    buffer.writeUInt32LE(object.countFriends || 0, 12);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    object.gameId = buffer.readUInt64LE(4);
    object.countFriends = buffer.readUInt32LE(12);
    
    return object;
  }
};

Steam.Internal.MsgClientGetFriendsWhoPlayGameResponse = MsgClientGetFriendsWhoPlayGameResponse;


var MsgGSPerformHardwareSurvey = {
  baseSize: 4,
  
  serialize: function(object) {
    var buffer = new Buffer(4);
    
    buffer.writeUInt32LE(object.flags || 0, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.flags = buffer.readUInt32LE(0);
    
    return object;
  }
};

Steam.Internal.MsgGSPerformHardwareSurvey = MsgGSPerformHardwareSurvey;


var MsgGSGetPlayStatsResponse = {
  baseSize: 16,
  
  serialize: function(object) {
    var buffer = new Buffer(16);
    
    buffer.writeInt32LE(object.result || 0, 0);
    buffer.writeInt32LE(object.rank || 0, 4);
    buffer.writeUInt32LE(object.lifetimeConnects || 0, 8);
    buffer.writeUInt32LE(object.lifetimeMinutesPlayed || 0, 12);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    object.rank = buffer.readInt32LE(4);
    object.lifetimeConnects = buffer.readUInt32LE(8);
    object.lifetimeMinutesPlayed = buffer.readUInt32LE(12);
    
    return object;
  }
};

Steam.Internal.MsgGSGetPlayStatsResponse = MsgGSGetPlayStatsResponse;


var MsgGSGetReputationResponse = {
  baseSize: 27,
  
  serialize: function(object) {
    var buffer = new Buffer(27);
    
    buffer.writeInt32LE(object.result || 0, 0);
    buffer.writeUInt32LE(object.reputationScore || 0, 4);
    buffer.writeUInt8(object.banned || 0, 8);
    buffer.writeUInt32LE(object.bannedIp || 0, 9);
    buffer.writeUInt16LE(object.bannedPort || 0, 13);
    buffer.writeUInt64LE(object.bannedGameId || 0, 15);
    buffer.writeUInt32LE(object.timeBanExpires || 0, 23);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    object.reputationScore = buffer.readUInt32LE(4);
    object.banned = buffer.readUInt8(8);
    object.bannedIp = buffer.readUInt32LE(9);
    object.bannedPort = buffer.readUInt16LE(13);
    object.bannedGameId = buffer.readUInt64LE(15);
    object.timeBanExpires = buffer.readUInt32LE(23);
    
    return object;
  }
};

Steam.Internal.MsgGSGetReputationResponse = MsgGSGetReputationResponse;


var MsgGSDeny = {
  baseSize: 12,
  
  serialize: function(object) {
    var buffer = new Buffer(12);
    
    buffer.writeUInt64LE(object.steamId || 0, 0);
    buffer.writeInt32LE(object.denyReason || 0, 8);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamId = buffer.readUInt64LE(0);
    object.denyReason = buffer.readInt32LE(8);
    
    return object;
  }
};

Steam.Internal.MsgGSDeny = MsgGSDeny;


var MsgGSApprove = {
  baseSize: 8,
  
  serialize: function(object) {
    var buffer = new Buffer(8);
    
    buffer.writeUInt64LE(object.steamId || 0, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamId = buffer.readUInt64LE(0);
    
    return object;
  }
};

Steam.Internal.MsgGSApprove = MsgGSApprove;


var MsgGSKick = {
  baseSize: 16,
  
  serialize: function(object) {
    var buffer = new Buffer(16);
    
    buffer.writeUInt64LE(object.steamId || 0, 0);
    buffer.writeInt32LE(object.denyReason || 0, 8);
    buffer.writeInt32LE(object.waitTilMapChange || 0, 12);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamId = buffer.readUInt64LE(0);
    object.denyReason = buffer.readInt32LE(8);
    object.waitTilMapChange = buffer.readInt32LE(12);
    
    return object;
  }
};

Steam.Internal.MsgGSKick = MsgGSKick;


var MsgGSGetUserGroupStatus = {
  baseSize: 16,
  
  serialize: function(object) {
    var buffer = new Buffer(16);
    
    buffer.writeUInt64LE(object.steamIdUser || 0, 0);
    buffer.writeUInt64LE(object.steamIdGroup || 0, 8);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamIdUser = buffer.readUInt64LE(0);
    object.steamIdGroup = buffer.readUInt64LE(8);
    
    return object;
  }
};

Steam.Internal.MsgGSGetUserGroupStatus = MsgGSGetUserGroupStatus;


var MsgGSGetUserGroupStatusResponse = {
  baseSize: 24,
  
  serialize: function(object) {
    var buffer = new Buffer(24);
    
    buffer.writeUInt64LE(object.steamIdUser || 0, 0);
    buffer.writeUInt64LE(object.steamIdGroup || 0, 8);
    buffer.writeInt32LE(object.clanRelationship || 0, 16);
    buffer.writeInt32LE(object.clanRank || 0, 20);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamIdUser = buffer.readUInt64LE(0);
    object.steamIdGroup = buffer.readUInt64LE(8);
    object.clanRelationship = buffer.readInt32LE(16);
    object.clanRank = buffer.readInt32LE(20);
    
    return object;
  }
};

Steam.Internal.MsgGSGetUserGroupStatusResponse = MsgGSGetUserGroupStatusResponse;


var MsgClientJoinChat = {
  baseSize: 9,
  
  serialize: function(object) {
    var buffer = new Buffer(9);
    
    buffer.writeUInt64LE(object.steamIdChat || 0, 0);
    buffer.writeUInt8(object.isVoiceSpeaker || 0, 8);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamIdChat = buffer.readUInt64LE(0);
    object.isVoiceSpeaker = buffer.readUInt8(8);
    
    return object;
  }
};

Steam.Internal.MsgClientJoinChat = MsgClientJoinChat;


var MsgClientChatEnter = {
  baseSize: 41,
  
  serialize: function(object) {
    var buffer = new Buffer(41);
    
    buffer.writeUInt64LE(object.steamIdChat || 0, 0);
    buffer.writeUInt64LE(object.steamIdFriend || 0, 8);
    buffer.writeInt32LE(object.chatRoomType || 0, 16);
    buffer.writeUInt64LE(object.steamIdOwner || 0, 20);
    buffer.writeUInt64LE(object.steamIdClan || 0, 28);
    buffer.writeUInt8(object.chatFlags || 0, 36);
    buffer.writeInt32LE(object.enterResponse || 0, 37);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamIdChat = buffer.readUInt64LE(0);
    object.steamIdFriend = buffer.readUInt64LE(8);
    object.chatRoomType = buffer.readInt32LE(16);
    object.steamIdOwner = buffer.readUInt64LE(20);
    object.steamIdClan = buffer.readUInt64LE(28);
    object.chatFlags = buffer.readUInt8(36);
    object.enterResponse = buffer.readInt32LE(37);
    
    return object;
  }
};

Steam.Internal.MsgClientChatEnter = MsgClientChatEnter;


var MsgClientChatMsg = {
  baseSize: 20,
  
  serialize: function(object) {
    var buffer = new Buffer(20);
    
    buffer.writeUInt64LE(object.steamIdChatter || 0, 0);
    buffer.writeUInt64LE(object.steamIdChatRoom || 0, 8);
    buffer.writeInt32LE(object.chatMsgType || 0, 16);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamIdChatter = buffer.readUInt64LE(0);
    object.steamIdChatRoom = buffer.readUInt64LE(8);
    object.chatMsgType = buffer.readInt32LE(16);
    
    return object;
  }
};

Steam.Internal.MsgClientChatMsg = MsgClientChatMsg;


var MsgClientChatMemberInfo = {
  baseSize: 12,
  
  serialize: function(object) {
    var buffer = new Buffer(12);
    
    buffer.writeUInt64LE(object.steamIdChat || 0, 0);
    buffer.writeInt32LE(object.type || 0, 8);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamIdChat = buffer.readUInt64LE(0);
    object.type = buffer.readInt32LE(8);
    
    return object;
  }
};

Steam.Internal.MsgClientChatMemberInfo = MsgClientChatMemberInfo;


var MsgClientChatAction = {
  baseSize: 20,
  
  serialize: function(object) {
    var buffer = new Buffer(20);
    
    buffer.writeUInt64LE(object.steamIdChat || 0, 0);
    buffer.writeUInt64LE(object.steamIdUserToActOn || 0, 8);
    buffer.writeInt32LE(object.chatAction || 0, 16);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamIdChat = buffer.readUInt64LE(0);
    object.steamIdUserToActOn = buffer.readUInt64LE(8);
    object.chatAction = buffer.readInt32LE(16);
    
    return object;
  }
};

Steam.Internal.MsgClientChatAction = MsgClientChatAction;


var MsgClientChatActionResult = {
  baseSize: 24,
  
  serialize: function(object) {
    var buffer = new Buffer(24);
    
    buffer.writeUInt64LE(object.steamIdChat || 0, 0);
    buffer.writeUInt64LE(object.steamIdUserActedOn || 0, 8);
    buffer.writeInt32LE(object.chatAction || 0, 16);
    buffer.writeInt32LE(object.actionResult || 0, 20);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.steamIdChat = buffer.readUInt64LE(0);
    object.steamIdUserActedOn = buffer.readUInt64LE(8);
    object.chatAction = buffer.readInt32LE(16);
    object.actionResult = buffer.readInt32LE(20);
    
    return object;
  }
};

Steam.Internal.MsgClientChatActionResult = MsgClientChatActionResult;


var MsgClientGetNumberOfCurrentPlayers = {
  baseSize: 8,
  
  serialize: function(object) {
    var buffer = new Buffer(8);
    
    buffer.writeUInt64LE(object.gameID || 0, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.gameID = buffer.readUInt64LE(0);
    
    return object;
  }
};

Steam.Internal.MsgClientGetNumberOfCurrentPlayers = MsgClientGetNumberOfCurrentPlayers;


var MsgClientGetNumberOfCurrentPlayersResponse = {
  baseSize: 8,
  
  serialize: function(object) {
    var buffer = new Buffer(8);
    
    buffer.writeInt32LE(object.result || 0, 0);
    buffer.writeUInt32LE(object.numPlayers || 0, 4);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    object.numPlayers = buffer.readUInt32LE(4);
    
    return object;
  }
};

Steam.Internal.MsgClientGetNumberOfCurrentPlayersResponse = MsgClientGetNumberOfCurrentPlayersResponse;


var MsgClientSetIgnoreFriend = {
  baseSize: 17,
  
  serialize: function(object) {
    var buffer = new Buffer(17);
    
    buffer.writeUInt64LE(object.mySteamId || 0, 0);
    buffer.writeUInt64LE(object.steamIdFriend || 0, 8);
    buffer.writeUInt8(object.ignore || 0, 16);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.mySteamId = buffer.readUInt64LE(0);
    object.steamIdFriend = buffer.readUInt64LE(8);
    object.ignore = buffer.readUInt8(16);
    
    return object;
  }
};

Steam.Internal.MsgClientSetIgnoreFriend = MsgClientSetIgnoreFriend;


var MsgClientSetIgnoreFriendResponse = {
  baseSize: 12,
  
  serialize: function(object) {
    var buffer = new Buffer(12);
    
    buffer.writeUInt64LE(object.unknown || 0, 0);
    buffer.writeInt32LE(object.result || 0, 8);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.unknown = buffer.readUInt64LE(0);
    object.result = buffer.readInt32LE(8);
    
    return object;
  }
};

Steam.Internal.MsgClientSetIgnoreFriendResponse = MsgClientSetIgnoreFriendResponse;


var MsgClientLoggedOff = {
  baseSize: 12,
  
  serialize: function(object) {
    var buffer = new Buffer(12);
    
    buffer.writeInt32LE(object.result || 0, 0);
    buffer.writeInt32LE(object.secMinReconnectHint || 0, 4);
    buffer.writeInt32LE(object.secMaxReconnectHint || 0, 8);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    object.secMinReconnectHint = buffer.readInt32LE(4);
    object.secMaxReconnectHint = buffer.readInt32LE(8);
    
    return object;
  }
};

Steam.Internal.MsgClientLoggedOff = MsgClientLoggedOff;


var MsgClientLogOnResponse = {
  baseSize: 28,
  
  serialize: function(object) {
    var buffer = new Buffer(28);
    
    buffer.writeInt32LE(object.result || 0, 0);
    buffer.writeInt32LE(object.outOfGameHeartbeatRateSec || 0, 4);
    buffer.writeInt32LE(object.inGameHeartbeatRateSec || 0, 8);
    buffer.writeUInt64LE(object.clientSuppliedSteamId || 0, 12);
    buffer.writeUInt32LE(object.ipPublic || 0, 20);
    buffer.writeUInt32LE(object.serverRealTime || 0, 24);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    object.outOfGameHeartbeatRateSec = buffer.readInt32LE(4);
    object.inGameHeartbeatRateSec = buffer.readInt32LE(8);
    object.clientSuppliedSteamId = buffer.readUInt64LE(12);
    object.ipPublic = buffer.readUInt32LE(20);
    object.serverRealTime = buffer.readUInt32LE(24);
    
    return object;
  }
};

Steam.Internal.MsgClientLogOnResponse = MsgClientLogOnResponse;


var MsgClientSendGuestPass = {
  baseSize: 13,
  
  serialize: function(object) {
    var buffer = new Buffer(13);
    
    buffer.writeUInt64LE(object.giftId || 0, 0);
    buffer.writeUInt8(object.giftType || 0, 8);
    buffer.writeUInt32LE(object.accountId || 0, 9);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.giftId = buffer.readUInt64LE(0);
    object.giftType = buffer.readUInt8(8);
    object.accountId = buffer.readUInt32LE(9);
    
    return object;
  }
};

Steam.Internal.MsgClientSendGuestPass = MsgClientSendGuestPass;


var MsgClientSendGuestPassResponse = {
  baseSize: 4,
  
  serialize: function(object) {
    var buffer = new Buffer(4);
    
    buffer.writeInt32LE(object.result || 0, 0);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    
    return object;
  }
};

Steam.Internal.MsgClientSendGuestPassResponse = MsgClientSendGuestPassResponse;


var MsgClientServerUnavailable = {
  baseSize: 16,
  
  serialize: function(object) {
    var buffer = new Buffer(16);
    
    buffer.writeUInt64LE(object.jobidSent || 0, 0);
    buffer.writeUInt32LE(object.eMsgSent || 0, 8);
    buffer.writeInt32LE(object.eServerTypeUnavailable || 0, 12);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.jobidSent = buffer.readUInt64LE(0);
    object.eMsgSent = buffer.readUInt32LE(8);
    object.eServerTypeUnavailable = buffer.readInt32LE(12);
    
    return object;
  }
};

Steam.Internal.MsgClientServerUnavailable = MsgClientServerUnavailable;


var MsgClientCreateChat = {
  baseSize: 53,
  
  serialize: function(object) {
    var buffer = new Buffer(53);
    
    buffer.writeInt32LE(object.chatRoomType || 0, 0);
    buffer.writeUInt64LE(object.gameId || 0, 4);
    buffer.writeUInt64LE(object.steamIdClan || 0, 12);
    buffer.writeInt32LE(object.permissionOfficer || 0, 20);
    buffer.writeInt32LE(object.permissionMember || 0, 24);
    buffer.writeInt32LE(object.permissionAll || 0, 28);
    buffer.writeUInt32LE(object.membersMax || 0, 32);
    buffer.writeUInt8(object.chatFlags || 0, 36);
    buffer.writeUInt64LE(object.steamIdFriendChat || 0, 37);
    buffer.writeUInt64LE(object.steamIdInvited || 0, 45);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.chatRoomType = buffer.readInt32LE(0);
    object.gameId = buffer.readUInt64LE(4);
    object.steamIdClan = buffer.readUInt64LE(12);
    object.permissionOfficer = buffer.readInt32LE(20);
    object.permissionMember = buffer.readInt32LE(24);
    object.permissionAll = buffer.readInt32LE(28);
    object.membersMax = buffer.readUInt32LE(32);
    object.chatFlags = buffer.readUInt8(36);
    object.steamIdFriendChat = buffer.readUInt64LE(37);
    object.steamIdInvited = buffer.readUInt64LE(45);
    
    return object;
  }
};

Steam.Internal.MsgClientCreateChat = MsgClientCreateChat;


var MsgClientCreateChatResponse = {
  baseSize: 24,
  
  serialize: function(object) {
    var buffer = new Buffer(24);
    
    buffer.writeInt32LE(object.result || 0, 0);
    buffer.writeUInt64LE(object.steamIdChat || 0, 4);
    buffer.writeInt32LE(object.chatRoomType || 0, 12);
    buffer.writeUInt64LE(object.steamIdFriendChat || 0, 16);
    
    return buffer;
  },
  
  parse: function(buffer) {
    var object = {};
    
    object.result = buffer.readInt32LE(0);
    object.steamIdChat = buffer.readUInt64LE(4);
    object.chatRoomType = buffer.readInt32LE(12);
    object.steamIdFriendChat = buffer.readUInt64LE(16);
    
    return object;
  }
};

Steam.Internal.MsgClientCreateChatResponse = MsgClientCreateChatResponse;
