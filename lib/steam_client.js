'use strict';

const ByteBuffer = require('bytebuffer');
const EventEmitter = require('events').EventEmitter;
const Steam = module.exports = require('steam-resources');
const AdmZip = require('adm-zip');


const schema = Steam.Internal;
const KILO = 1000;
const DEFAULT_TIMEOUT = 1000;
const ALIVE_TIMEOUT = 0;
const OFFSET_PAYLOAD = 4;
const E_MSG_OFFSET = 0;
const ZERO = 0;
const DOUBLE = 2;
const CLIENT_CM_COUNT = 4;
const KEY_SIZE = 128;


Steam._processProto = function (proto) {
    proto = proto.toRaw(false, true);
    (function deleteNulls(proto) {
        for (const field in proto) {
            if (proto.hasOwnProperty(field)) {
                if (proto[field] === null) {
                    delete proto[field];
                } else if (typeof proto[field] === 'object') {
                    deleteNulls(proto[field]);
                }
            }

        }
    })(proto);
    return proto;
};

const EMsg = Steam.EMsg;

const PROTO_MASK = 0x80000000;


function SteamClient() {
    EventEmitter.call(this);
}

require('util').inherits(SteamClient, EventEmitter);


// Methods

Steam.servers = require('./servers');

SteamClient.prototype.connect = function () {
    this.disconnect();

    this._jobs = {};
    this._currentJobID = 0;

    this.sessionID = 0;

    const server = Steam.servers[Math.floor(Math.random() * Steam.servers.length)];
    this.emit('debug', `connecting to ${server.host}:${server.port}`);

    this._connection = new (require('./connection'))();
    this._connection.on('packet', this._netMsgReceived.bind(this));
    this._connection.on('close', this._disconnected.bind(this));

    const self = this;

    this._connection.on('error', err => {

        // it's ok, we'll reconnect after 'close'
        self.emit('debug', `socket error: ${err}`);
    });

    this._connection.on('connect', () => {
        self.emit('debug', 'connected');
        delete self._timeout;
    });

    this._connection.on('end', () => {
        self.emit('debug', 'socket ended');
    });

    this._connection.setTimeout(DEFAULT_TIMEOUT, () => {
        self.emit('debug', 'socket timed out');
        self._connection.destroy();
    });

    this._connection.connect(server.port, server.host);
};

SteamClient.prototype.disconnect = function () {
    if (this._connection) {
        this._connection.destroy();
        this._connection.removeAllListeners();
        delete this._connection;
        if (this.loggedOn) {
            this.loggedOn = false;
            clearInterval(this._heartBeatFunc);
        }
        this.connected = false;
    } else if (this._scheduledConnection) {

        // there was an error and we're currently waiting
        clearTimeout(this._scheduledConnection);
        delete this._scheduledConnection;
    }
};

SteamClient.prototype._send = function (header, body, callback) {
    let sourceJobID = 0;
    if (callback) {
        sourceJobID = ++this._currentJobID;
        this._jobs[sourceJobID] = callback;
    }

    if (header.msg === EMsg.ChannelEncryptResponse) {
        header.sourceJobID = sourceJobID;
        header = new schema.MsgHdr(header);

    } else if (header.proto) {
        header.proto.client_sessionid = this.sessionID;
        header.proto.steamid = this.steamID;
        header.proto.jobid_source = sourceJobID;
        header = new schema.MsgHdrProtoBuf(header);

    } else {
        header.steamID = this.steamID;
        header.sessionID = this.sessionID;
        header.sourceJobID = sourceJobID;
        header = new schema.ExtendedClientMsgHdr(header);
    }

    this._connection.send(Buffer.concat([header.toBuffer(), body]));
};

SteamClient.prototype.send = function (header, body, callback) {

    // ignore any target job ID
    if (header.proto) {
        delete header.proto.jobid_target;
    } else {
        delete header.targetJobID;
    }
    this._send(header, body, callback);
};

SteamClient.prototype._netMsgReceived = function (data) {
    const rawEMsg = data.readUInt32LE(E_MSG_OFFSET);
    const eMsg = rawEMsg & ~PROTO_MASK;

    data = ByteBuffer.wrap(data, ByteBuffer.LITTLE_ENDIAN);

    let header,
        sourceJobID,
        targetJobID;
    if (eMsg === EMsg.ChannelEncryptRequest || eMsg === EMsg.ChannelEncryptResult) {
        header = schema.MsgHdr.decode(data);
        sourceJobID = header.sourceJobID;
        targetJobID = header.targetJobID;

    } else if (rawEMsg & PROTO_MASK) {
        header = schema.MsgHdrProtoBuf.decode(data);
        header.proto = Steam._processProto(header.proto);
        if (!this.sessionID && header.headerLength > ZERO) {
            this.sessionID = header.proto.client_sessionid;
            this.steamID = header.proto.steamid;
        }
        sourceJobID = header.proto.jobid_source;
        targetJobID = header.proto.jobid_target;

    } else {
        header = schema.ExtendedClientMsgHdr.decode(data);
        sourceJobID = header.sourceJobID;
        targetJobID = header.targetJobID;
    }

    const body = data.toBuffer();

    if (eMsg in handlers) {
        handlers[header.msg].call(this, body);
    }

    let callback = function (header, body, callback) {
        if (header.proto) {
            header.proto.jobid_target = sourceJobID;
        } else {
            header.targetJobID = sourceJobID;
        }
        this._send(header, body, callback);
    }.bind(this);
    if (sourceJobID === '18446744073709551615') {
        callback = () => {
            this.emit('debug', 'sourceJobID === 18446744073709551615');
        };
    }

    if (targetJobID in this._jobs) {
        this._jobs[targetJobID](header, body, callback);
    } else {
        this.emit('message', header, body, callback);
    }
};

SteamClient.prototype._disconnected = function (had_error) {
    this.emit('debug', `socket closed${had_error ? ' with an error' : ''}`);
    delete this._connection;

    if (this.connected) {
        if (this.loggedOn) {
            this.emit('debug', 'unexpected disconnection');
            this.loggedOn = false;
            clearInterval(this._heartBeatFunc);
        }
        this.connected = false;
        this.emit('error', new Error('Disconnected'));
        return;
    }

    if (!had_error) {
        this.connect();
        return;
    }

    const timeout = this._timeout || DEFAULT_TIMEOUT;
    this.emit('debug', `waiting ${timeout} secs`);
    this._scheduledConnection = setTimeout(() => {
        delete this._scheduledConnection;
        this.connect();
    }, timeout * KILO);
    this._timeout = timeout * DOUBLE;
};


// Handlers

const handlers = {};

handlers[EMsg.ChannelEncryptRequest] = function () {

    // assume server isn't dead
    this._connection.setTimeout(ALIVE_TIMEOUT);

    //  var encRequest = schema.MsgChannelEncryptRequest.decode(data);
    this.emit('debug', 'encrypt request');

    const sessionKey = require('steam-crypto').generateSessionKey();
    this._tempSessionKey = sessionKey.plain;
    const keyCrc = require('buffer-crc32').signed(sessionKey.encrypted);

    const encResp = new schema.MsgChannelEncryptResponse().encode();
    const body = new ByteBuffer(encResp.limit + KEY_SIZE + OFFSET_PAYLOAD + OFFSET_PAYLOAD, ByteBuffer.LITTLE_ENDIAN);

    body.append(encResp);
    body.append(sessionKey.encrypted);
    body.writeInt32(keyCrc);
    body.writeUint32(E_MSG_OFFSET);
    body.flip();

    this.send({msg: EMsg.ChannelEncryptResponse}, body.toBuffer());
};

handlers[EMsg.ChannelEncryptResult] = function (data) {
    const encResult = schema.MsgChannelEncryptResult.decode(data);

    if (encResult.result === Steam.EResult.OK) {
        this._connection.sessionKey = this._tempSessionKey;
    } else {
        this.emit('error', new Error(`Encryption fail: ${encResult.result}`));
        return;
    }

    this.connected = true;
    this.emit('connected');
};

handlers[EMsg.Multi] = function (data) {
    const msgMulti = schema.CMsgMulti.decode(data);

    let payload = msgMulti.message_body.toBuffer();

    if (msgMulti.size_unzipped) {
        const zip = new AdmZip(payload);
        payload = zip.readFile('z');
    }

    // stop handling if user disconnected
    while (payload.length && this.connected) {
        const subSize = payload.readUInt32LE(ZERO);
        this._netMsgReceived(payload.slice(OFFSET_PAYLOAD, OFFSET_PAYLOAD + subSize));
        payload = payload.slice(OFFSET_PAYLOAD + subSize);
    }
};

handlers[EMsg.ClientLogOnResponse] = function (data) {
    const logonResp = schema.CMsgClientLogonResponse.decode(data);
    const eresult = logonResp.eresult;

    if (eresult === Steam.EResult.OK) {
        const hbDelay = logonResp.out_of_game_heartbeat_seconds;

        this._heartBeatFunc = setInterval(() => {
            this.send({
                msg: EMsg.ClientHeartBeat,
                proto: {}
            }, new schema.CMsgClientHeartBeat().toBuffer());
        }, hbDelay * KILO);

        this.loggedOn = true;
    }

    this.emit('logOnResponse', Steam._processProto(logonResp));
};

handlers[EMsg.ClientLoggedOff] = function (data) {
    this.loggedOn = false;
    clearInterval(this._heartBeatFunc);

    const eresult = schema.CMsgClientLoggedOff.decode(data).eresult;

    this.emit('loggedOff', eresult);
};

handlers[EMsg.ClientCMList] = function (data) {
    const list = schema.CMsgClientCMList.decode(data);
    const servers = list.cm_addresses.map((number, index) => {
        const buf = new Buffer(CLIENT_CM_COUNT);
        buf.writeUInt32BE(number, ZERO);
        return {
            host: [].join.call(buf, '.'),
            port: list.cm_ports[index]
        };
    });

    this.emit('servers', servers);
    Steam.servers = servers;
};


Steam.SteamClient = SteamClient;
require('./handlers/friends');
require('./handlers/game_coordinator');
require('./handlers/rich_presence');
require('./handlers/trading');
require('./handlers/unified_messages');
require('./handlers/user');
