var pubKey = require('fs').readFileSync(__dirname + '/public.pub');
require('ref');

module.exports = function(client) {
  var tempSessionKey;
  
  client.handlers = {
    ChannelEncryptRequest: function(data) {    
  //  var protocolVersion = body.readUInt32LE(0);
  //  var universe = body.readUInt32LE(4);
  
      var rsa = require('ursa').createPublicKey(pubKey);
      tempSessionKey = require('crypto').randomBytes(32);
      var cryptedSessKey = rsa.encrypt(tempSessionKey);
      var keyCrc = require('crc').buffer.crc32(cryptedSessKey);
      
      var body = new Buffer(4 + 4 + 128 + 4 + 4); // ProtocolVersion, KeySize, key, crc, trailer
      body.writeUInt32LE(1, 0); // ProtocolVersion
      body.writeUInt32LE(128, 4); // KeySize
      
      cryptedSessKey.copy(body, 8);
      body.writeInt32LE(keyCrc, 8 + 128);
      body.writeUInt32LE(0, 8 + 128 + 4); // TODO: check if the trailer is required
        
      client.send('ChannelEncryptResponse', body);
    },
    
    
    ChannelEncryptResult: function(data) {      
      var result = data.readInt32LE(0);
      
      if (result == 1) {
        client.connection.sessionKey = tempSessionKey;
      }
      
      client.send('ClientLogon', {
        accountName: client.username,
        password: client.password,
        protocolVersion: 65575
      });
    },
    
    
    Multi: function(data) {    
      var payload = data.messageBody;
      
      if (data.sizeUnzipped) {
        var zip = new (require('adm-zip'))(payload);
        payload = zip.readFile('z');
      }
      
      while (payload.length) {
        var subSize = payload.readUInt32LE(0);
        client.netMsgReceived(payload.slice(4, 4 + subSize)); // TODO: test without end
        payload = payload.slice(4 + subSize);
      }
    },
    
    
    ClientLogonResponse: function(data) {                
      if (data.eresult == 1) { //OK
//        client.emit('loggedOn');
        var hbDelay = data.outOfGameHeartbeatSeconds;
        
        setInterval(function() {
          client.send('ClientHeartBeat', {});
        }, hbDelay * 1000);
      } else {
        client.emit('debug', 'Logon error:');
        client.emit('debug', data);
      }
    },
    
    
    ClientVACBanStatus: function(data) {
      // this is the first packet that contains the extended header, so we can now safely use all API
      
      client.emit('loggedOn');
    },
    
    
    ClientChatInvite: function(data) {
      client.emit('chatInvite', data.steamIdChat, data.chatName, data.steamIdPatron);
    },
    
    
    ClientChatMsg: function(data) {
      var chatter = data.readUInt64LE(0);
      var chatRoom = data.readUInt64LE(8);
      var msgType = data.readInt32LE(16);
      var message = data.slice(20).toString();
      
      // the following is probably what Steam does
      var nullpos = message.indexOf('\u0000');
      if (nullpos != -1) {
        message = message.slice(0, nullpos);
      }
      client.emit('chatMsg', chatter, message, chatRoom, msgType);
    },
    
    
    ClientChatMemberInfo: function(data) {
      // 8 bytes chatroom + 4 bytes chat info type ( + 8 bytes actedon + 4 bytes statechange + 8 bytes actedby)
      var type = data.readInt32LE(8);
      if (type == 1) { // State Change
        var steamIdChat = data.readUInt64LE(0);
        var chatterActedOn = data.readUInt64LE(12);
        var stateChange = data.readInt32LE(20);
        var chatterActedBy = data.readUInt64LE(24);
        client.emit({
          0x01: 'entered',
          0x02: 'left',
          0x04: 'disconnected',
          0x08: 'kicked',
          0x10: 'banned'
        }[stateChange], chatterActedOn, steamIdChat, chatterActedBy);
      }
    },
    
    
    ClientPersonaState: function(data) {
      data.friends.forEach(function(friend) {
        client.users[friend.friendid] = friend.playerName; // might need to check whether it's defined
        // TODO: other data
      });
//      console.log(data);
    },
    
    
    ClientClanState: function(data) {
      if (data.announcements) {
        client.emit('announcement', data.steamidClan, data.announcements[0].headline); // TODO: more data
      }
    }
  };
};
