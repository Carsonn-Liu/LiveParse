(function () {
const __yy_danmakuSessions = {};
const __yy_sharedGlobalKey = "__lp_plugin_yy_1_0_2_shared";
const __yy_wsURLTemplate = "wss://h5-sinchl.yy.com/websocket?appid=yymwebh5&version=3.2.10&uuid=%UUID%&sign=a8d7eef2";
const __yy_defaultOrigin = "https://www.yy.com";
const __yy_pingIntervalMs = 25000;
const __yy_seenLimit = 4000;

const __yy_uri = {
  cliAPLoginAuthReq2: 779268,
  cliAPLoginAuthRes: 778500,
  cliAPLoginAuthRes2: 779524,
  anonymousLogin: 19822,
  anonymousLoginRes: 20078,
  loginAP: 775684,
  loginAPRes: 775940,
  pingAP: 794116,
  appPong: 794372,
  svcApRouterReq: 512011,
  svcApRouterRes: 512267,
  chlApRouterReq: 513035,
  chlApRouterRes: 513291,
  joinSvcUserGroupV2: 537944,
  leaveSvcUserGroupV2: 538200,
  subSvcTypesV2: 538456,
  dlUserGroupMsg: 533080,
  joinChannelReq: 2048258,
  joinChannelRes: 2048514,
  leaveChannelReq: 2049794,
  channelInfoReq: 3096834,
  chatCtrlReq: 3143682,
  chatAuthReq: 3655682,
  channelUserInfoReqA: 3125762,
  channelUserInfoReqB: 3126274,
  channelUserInfoReqC: 3125250,
  channelMaixuReq: 3854338,
  ulSvcMsgByUid: 79960,
  dlSvcMsgByUid: 80216,
  dlSvcMsgBySid: 28760,
  pHistoryChatReq: 3117144,
  pHistoryChatRes: 3117400,
  textChatMsgRes: 3104600
};

const __yy_appId = {
  apService: 259,
  chatService: 31,
  serviceAppids: [15068, 15065, 15067, 15066]
};

function _yy_shared() {
  const shared = globalThis[__yy_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"yy shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _yy_throw(code, message, context) {
  const shared = globalThis[__yy_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _yy_str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function _yy_num(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function _yy_writeBinary(bytes) {
  return {
    kind: "binary",
    bytesBase64: _yy_bytesToBase64(bytes)
  };
}

function _yy_timer(enabled) {
  return enabled ? { mode: "heartbeat", intervalMs: __yy_pingIntervalMs } : { mode: "off" };
}

function _yy_bytesToBase64(bytes) {
  if (typeof btoa !== "function") _yy_throw("UNSUPPORTED", "btoa is unavailable", {});
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] & 0xff);
  return btoa(binary);
}

function _yy_base64ToBytes(value) {
  if (typeof atob !== "function") _yy_throw("UNSUPPORTED", "atob is unavailable", {});
  const raw = atob(_yy_str(value));
  const out = [];
  for (let i = 0; i < raw.length; i += 1) out.push(raw.charCodeAt(i) & 0xff);
  return out;
}

function _yy_asciiBytes(text) {
  const str = _yy_str(text);
  const out = [];
  for (let i = 0; i < str.length; i += 1) out.push(str.charCodeAt(i) & 0xff);
  return out;
}

function _yy_utf8Bytes(text) {
  const str = _yy_str(text);
  const encoded = unescape(encodeURIComponent(str));
  const out = [];
  for (let i = 0; i < encoded.length; i += 1) out.push(encoded.charCodeAt(i) & 0xff);
  return out;
}

function _yy_utf16LEBytes(text) {
  const str = _yy_str(text);
  const out = [];
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    out.push(code & 0xff, (code >>> 8) & 0xff);
  }
  return out;
}

function _yy_asciiString(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i] & 0xff);
  return out;
}

function _yy_utf8String(bytes) {
  try {
    return decodeURIComponent(escape(_yy_asciiString(bytes)));
  } catch (e) {
    return _yy_asciiString(bytes);
  }
}

function _yy_utf16LEString(bytes) {
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out += String.fromCharCode((bytes[i] & 0xff) | ((bytes[i + 1] & 0xff) << 8));
  }
  return out;
}

function _yy_u8(value) { return [value & 0xff]; }
function _yy_u16(value) { return [value & 0xff, (value >>> 8) & 0xff]; }
function _yy_u32(value) {
  const v = Number(value) >>> 0;
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}
function _yy_u64(value) {
  let v = BigInt(value);
  const out = [];
  for (let i = 0; i < 8; i += 1) {
    out.push(Number(v & 0xffn));
    v >>= 8n;
  }
  return out;
}

function _yy_concat() {
  const out = [];
  for (let i = 0; i < arguments.length; i += 1) {
    const part = arguments[i] || [];
    for (let j = 0; j < part.length; j += 1) out.push(part[j] & 0xff);
  }
  return out;
}

function _yy_encodeASCIIString16(value) {
  const bytes = _yy_asciiBytes(value);
  return _yy_concat(_yy_u16(bytes.length), bytes);
}

function _yy_encodeUTF8String16(value) {
  const bytes = _yy_utf8Bytes(value);
  return _yy_concat(_yy_u16(bytes.length), bytes);
}

function _yy_encodeBytes16(bytes) {
  return _yy_concat(_yy_u16((bytes || []).length), bytes || []);
}

function _yy_encodeBytes32(bytes) {
  return _yy_concat(_yy_u32((bytes || []).length), bytes || []);
}

function _yy_buildFrame(uri, payload) {
  const body = payload || [];
  return _yy_concat(_yy_u32(10 + body.length), _yy_u32(uri), _yy_u16(200), body);
}

function _yy_parseFrame(bytes) {
  if (!bytes || bytes.length < 10) return null;
  const totalLen = _yy_readUInt32LE(bytes, 0);
  const uri = _yy_readUInt32LE(bytes, 4);
  const magic = _yy_readUInt16LE(bytes, 8);
  if (magic !== 200 || totalLen < 10 || totalLen > bytes.length) return null;
  return { uri: uri, payload: bytes.slice(10, totalLen) };
}

function _yy_reader(bytes) {
  return {
    bytes: bytes || [],
    offset: 0,
    isAtEnd() { return this.offset >= this.bytes.length; },
    readUInt8() {
      if (this.offset + 1 > this.bytes.length) throw new Error("outOfRange");
      return this.bytes[this.offset++] & 0xff;
    },
    readUInt16LE() {
      if (this.offset + 2 > this.bytes.length) throw new Error("outOfRange");
      const value = _yy_readUInt16LE(this.bytes, this.offset);
      this.offset += 2;
      return value;
    },
    readUInt32LE() {
      if (this.offset + 4 > this.bytes.length) throw new Error("outOfRange");
      const value = _yy_readUInt32LE(this.bytes, this.offset);
      this.offset += 4;
      return value >>> 0;
    },
    readUInt64LE() {
      if (this.offset + 8 > this.bytes.length) throw new Error("outOfRange");
      let value = 0n;
      for (let i = 0; i < 8; i += 1) value |= BigInt(this.bytes[this.offset + i] & 0xff) << BigInt(i * 8);
      this.offset += 8;
      return value;
    },
    readBytes(count) {
      if (count < 0 || this.offset + count > this.bytes.length) throw new Error("outOfRange");
      const value = this.bytes.slice(this.offset, this.offset + count);
      this.offset += count;
      return value;
    },
    readBytes16() { return this.readBytes(this.readUInt16LE()); },
    readBytes32() { return this.readBytes(this.readUInt32LE()); },
    readASCIIString16() { return _yy_asciiString(this.readBytes16()); },
    readUTF8String16() { return _yy_utf8String(this.readBytes16()); },
    readUTF8String32() { return _yy_utf8String(this.readBytes(this.readUInt32LE())); },
    readUTF16LEString32() { return _yy_utf16LEString(this.readBytes(this.readUInt32LE())); }
  };
}

function _yy_readUInt16LE(bytes, offset) {
  return ((bytes[offset] & 0xff) | ((bytes[offset + 1] & 0xff) << 8)) >>> 0;
}

function _yy_readUInt32LE(bytes, offset) {
  return (((bytes[offset] & 0xff)) |
    ((bytes[offset + 1] & 0xff) << 8) |
    ((bytes[offset + 2] & 0xff) << 16) |
    ((bytes[offset + 3] & 0xff) << 24)) >>> 0;
}

function _yy_parseAPRouter(payload) {
  const reader = _yy_reader(payload);
  try {
    return {
      from: reader.readASCIIString16(),
      ruri: reader.readUInt32LE(),
      resCode: reader.readUInt16LE(),
      body: reader.readBytes32(),
      headers: reader.readBytes32()
    };
  } catch (e) {
    return null;
  }
}

function _yy_appendRouterChunk(out, field, valueBytes) {
  const value = valueBytes || [];
  const descriptor = ((field & 0xff) << 24) | ((4 + value.length) & 0x00ffffff);
  out.push.apply(out, _yy_u32(descriptor >>> 0));
  out.push.apply(out, value);
}

function _yy_buildAPRouterHeaders(realUri, appid, uid, serviceName, extentProps, clientCtx) {
  const out = [];
  _yy_appendRouterChunk(out, 1, _yy_u32(realUri));
  _yy_appendRouterChunk(out, 2, _yy_concat(_yy_u32(appid), _yy_u32(uid), _yy_u32(0)));
  _yy_appendRouterChunk(out, 4, _yy_concat(_yy_u32(0), _yy_u32(0)));
  _yy_appendRouterChunk(out, 5, _yy_u32(0));
  _yy_appendRouterChunk(out, 6, _yy_concat(
    _yy_u32(0),
    _yy_u32(0),
    _yy_u16(0),
    _yy_encodeASCIIString16(serviceName || ""),
    _yy_u16(0),
    _yy_u32(0)
  ));

  const props = extentProps || {};
  const keys = Object.keys(props).map(function (key) { return Number(key); }).sort(function (a, b) { return a - b; });
  const field7 = [];
  field7.push.apply(field7, _yy_u32(keys.length));
  for (const key of keys) {
    field7.push.apply(field7, _yy_u32(key));
    field7.push.apply(field7, _yy_encodeBytes16(props[key] || []));
  }
  _yy_appendRouterChunk(out, 7, field7);
  _yy_appendRouterChunk(out, 8, _yy_encodeASCIIString16(clientCtx || ""));
  out.push.apply(out, _yy_u32(0xff787878));
  return out;
}

function _yy_buildAPRouterFrame(outerURI, ruri, body, headers) {
  return _yy_buildFrame(outerURI, _yy_concat(
    _yy_encodeASCIIString16(""),
    _yy_u32(ruri),
    _yy_u16(0),
    _yy_encodeBytes32(body || []),
    _yy_encodeBytes32(headers || [])
  ));
}

function _yy_buildUlSvcMsgByUid(appid, topSid, uid, payload, statType, subSid, ext) {
  const out = [];
  out.push.apply(out, _yy_u16(appid));
  out.push.apply(out, _yy_u32(topSid));
  out.push.apply(out, _yy_u32(uid));
  out.push.apply(out, _yy_encodeBytes32(payload || []));
  out.push.apply(out, _yy_u32(0));
  out.push.apply(out, _yy_u8(0));
  out.push.apply(out, _yy_u8(statType));
  out.push.apply(out, _yy_u32(subSid));
  out.push.apply(out, _yy_u32(0));
  out.push.apply(out, _yy_u32(0));

  const extMap = ext || {};
  const keys = Object.keys(extMap).map(function (key) { return Number(key); }).sort(function (a, b) { return a - b; });
  out.push.apply(out, _yy_u32(keys.length));
  for (const key of keys) {
    out.push.apply(out, _yy_u32(key));
    out.push.apply(out, _yy_encodeASCIIString16(extMap[key] || ""));
  }

  out.push.apply(out, _yy_u16(0));
  out.push.apply(out, _yy_u32(0));
  out.push.apply(out, _yy_u32(uid));
  out.push.apply(out, _yy_u32(0));
  out.push.apply(out, _yy_u32(0));
  out.push.apply(out, _yy_u32(0));
  return out;
}

function _yy_parseDlSvcMsgByUid(data) {
  const reader = _yy_reader(data);
  try {
    return {
      appid: reader.readUInt16LE(),
      uid: reader.readUInt32LE(),
      payload: reader.readBytes32(),
      suid: reader.readUInt32LE(),
      code: reader.readUInt32LE(),
      seqId: reader.readUInt32LE(),
      flags: reader.readUInt32LE()
    };
  } catch (e) {
    return null;
  }
}

function _yy_parseDlSvcMsgBySid(data) {
  const reader = _yy_reader(data);
  try {
    return {
      appid: reader.readUInt16LE(),
      topSid: reader.readUInt32LE(),
      payload: reader.readBytes16()
    };
  } catch (e) {
    return null;
  }
}

function _yy_parseDlUsrGroupMsg(data) {
  const reader = _yy_reader(data);
  try {
    reader.readUInt64LE();
    reader.readUInt64LE();
    return {
      appid: reader.readUInt32LE(),
      msg: reader.readBytes32(),
      seqNum: reader.readUInt64LE(),
      srvId: reader.readUInt64LE(),
      ruri: reader.readUInt32LE(),
      subSvcName: reader.readASCIIString16()
    };
  } catch (e) {
    return null;
  }
}

function _yy_buildSubServiceTypes(uri, uid, appids) {
  const payload = [];
  payload.push.apply(payload, _yy_u32(uid));
  payload.push.apply(payload, _yy_u32(0));
  payload.push.apply(payload, _yy_u32((appids || []).length));
  for (const appid of appids || []) payload.push.apply(payload, _yy_u32(appid));
  return _yy_buildFrame(uri, payload);
}

function _yy_parseFrameHeaderAtStart(data) {
  if (!data || data.length < 10) return null;
  const totalLen = _yy_readUInt32LE(data, 0);
  const uri = _yy_readUInt32LE(data, 4);
  const magic = _yy_readUInt16LE(data, 8);
  if (magic !== 200 || totalLen < 10 || totalLen > data.length) return null;
  return { uri: uri, payload: data.slice(10, totalLen), totalLen: totalLen };
}

function _yy_findFramedPacket(data, targetURI) {
  if (!data || data.length < 10) return null;
  for (let idx = 0; idx <= data.length - 10; idx += 1) {
    const totalLen = _yy_readUInt32LE(data, idx);
    if (totalLen < 10 || idx + totalLen > data.length) continue;
    const uri = _yy_readUInt32LE(data, idx + 4);
    const magic = _yy_readUInt16LE(data, idx + 8);
    if (magic !== 200) continue;
    if (targetURI && uri !== targetURI) continue;
    return { uri: uri, payload: data.slice(idx + 10, idx + totalLen) };
  }
  return null;
}

function _yy_extractChatText(raw) {
  const text = _yy_str(raw);
  const match = text.match(/data="([^"]+)"/);
  return match ? match[1] : text;
}

function _yy_parseTextChatMsg(payload) {
  const reader = _yy_reader(payload);
  try {
    const fromUid = reader.readUInt32LE();
    const topSid = reader.readUInt32LE();
    const subSid = reader.readUInt32LE();
    reader.readUInt16LE();
    reader.readUInt32LE();
    reader.readUTF8String32();
    reader.readUInt32LE();
    reader.readUInt32LE();
    const msg = reader.readUTF16LEString32();
    reader.readUInt32LE();
    reader.readASCIIString16();
    reader.readASCIIString16();
    const nick = reader.readUTF8String16();
    const extraCount = reader.readUInt32LE();
    for (let i = 0; i < extraCount; i += 1) {
      reader.readUInt16LE();
      reader.readASCIIString16();
    }
    return { fromUid: fromUid, topSid: topSid, subSid: subSid, nick: nick, msg: msg };
  } catch (e) {
    return null;
  }
}

function _yy_parseHistoryChatResponse(payload) {
  const reader = _yy_reader(payload);
  try {
    reader.readUInt32LE();
    reader.readUInt32LE();
    reader.readUInt32LE();
    const count = reader.readUInt32LE();
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const entry = reader.readBytes16();
      const framed = _yy_parseFrameHeaderAtStart(entry);
      if (!framed || framed.uri !== __yy_uri.textChatMsgRes) continue;
      const chat = _yy_parseTextChatMsg(framed.payload);
      if (chat) out.push(chat);
    }
    return out;
  } catch (e) {
    return [];
  }
}

function _yy_dedupeAndPushMessages(session, chats, out) {
  for (const chat of chats || []) {
    const content = _yy_extractChatText(chat && chat.msg).trim();
    const nick = _yy_str(chat && chat.nick).trim();
    if (!content) continue;
    const key = `${_yy_str(chat && chat.fromUid)}|${_yy_str(chat && chat.topSid)}|${_yy_str(chat && chat.subSid)}|${nick}|${content}`;
    if (session.seenSet[key]) continue;
    session.seenSet[key] = true;
    session.seenQueue.push(key);
    if (session.seenQueue.length > __yy_seenLimit) {
      const stale = session.seenQueue.shift();
      delete session.seenSet[stale];
    }
    out.push({
      text: content,
      nickname: nick || "YY用户",
      color: 0xFFFFFF
    });
  }
}

function _yy_handleServiceFrameBuffer(session, buffer, messages) {
  const framed = _yy_parseFrameHeaderAtStart(buffer);
  if (framed) {
    _yy_handleInnerFrame(session, framed.uri, framed.payload, messages);
    return;
  }

  const historyPacket = _yy_findFramedPacket(buffer, __yy_uri.pHistoryChatRes);
  if (historyPacket) {
    _yy_dedupeAndPushMessages(session, _yy_parseHistoryChatResponse(historyPacket.payload), messages);
    return;
  }

  const chatPacket = _yy_findFramedPacket(buffer, __yy_uri.textChatMsgRes);
  if (chatPacket) {
    const chat = _yy_parseTextChatMsg(chatPacket.payload);
    if (chat) _yy_dedupeAndPushMessages(session, [chat], messages);
  }
}

function _yy_handleInnerFrame(session, uri, payload, messages) {
  switch (uri) {
    case __yy_uri.pHistoryChatRes:
      _yy_dedupeAndPushMessages(session, _yy_parseHistoryChatResponse(payload), messages);
      break;
    case __yy_uri.textChatMsgRes: {
      const chat = _yy_parseTextChatMsg(payload);
      if (chat) _yy_dedupeAndPushMessages(session, [chat], messages);
      break;
    }
    case __yy_uri.dlSvcMsgByUid: {
      const dlUid = _yy_parseDlSvcMsgByUid(payload);
      if (dlUid) _yy_handleServiceFrameBuffer(session, dlUid.payload, messages);
      break;
    }
    case __yy_uri.dlSvcMsgBySid: {
      const dlSid = _yy_parseDlSvcMsgBySid(payload);
      if (dlSid) _yy_handleServiceFrameBuffer(session, dlSid.payload, messages);
      break;
    }
    default:
      break;
  }
}

function _yy_serviceGroups(session) {
  return [
    { tLow: 1, tHigh: 0, idLow: session.topSid, idHigh: 0 },
    { tLow: 2, tHigh: 0, idLow: session.subSid, idHigh: 0 },
    { tLow: 1024, tHigh: __yy_appId.apService, idLow: session.topSid, idHigh: session.subSid },
    { tLow: 768, tHigh: __yy_appId.apService, idLow: 0, idHigh: session.subSid },
    { tLow: 256, tHigh: __yy_appId.apService, idLow: 0, idHigh: session.subSid },
    { tLow: 256, tHigh: __yy_appId.apService, idLow: session.topSid, idHigh: session.subSid }
  ];
}

function _yy_type4Groups() {
  const s1 = 1 << 16;
  const s19 = 19 << 16;
  return [
    { tLow: 4, tHigh: 0, idLow: 1, idHigh: s1 },
    { tLow: 4, tHigh: 0, idLow: 1, idHigh: s19 },
    { tLow: 4, tHigh: 0, idLow: 1, idHigh: s1 | 1 },
    { tLow: 4, tHigh: 0, idLow: 1, idHigh: s19 | 1 },
    { tLow: 4, tHigh: 0, idLow: 4, idHigh: s1 },
    { tLow: 4, tHigh: 0, idLow: 4, idHigh: s19 },
    { tLow: 4, tHigh: 0, idLow: 4, idHigh: s1 | 1 },
    { tLow: 4, tHigh: 0, idLow: 4, idHigh: s19 | 1 }
  ];
}

function _yy_buildSvcUserGroupV2(uri, session, groups) {
  const payload = [];
  payload.push.apply(payload, _yy_u32(session.uid));
  payload.push.apply(payload, _yy_u32(0));
  payload.push.apply(payload, _yy_u32((groups || []).length));
  for (const group of groups || []) {
    payload.push.apply(payload, _yy_u32(group.tLow));
    payload.push.apply(payload, _yy_u32(group.tHigh));
    payload.push.apply(payload, _yy_u32(group.idLow));
    payload.push.apply(payload, _yy_u32(group.idHigh));
  }
  payload.push.apply(payload, _yy_encodeASCIIString16(""));
  return _yy_buildFrame(uri, payload);
}

function _yy_nextTrace(session) {
  session.traceCounter = (session.traceCounter + 1) >>> 0;
  return `F${session.uid}_yymwebh5_${session.tracePrefix}_${session.traceCounter}`;
}

function _yy_buildHistoryChatRequest(session, limit) {
  return _yy_buildFrame(__yy_uri.pHistoryChatReq, _yy_concat(
    _yy_u32(session.topSid),
    _yy_u32(session.subSid),
    _yy_u32(session.uid),
    _yy_u32(session.uid),
    _yy_u32(0),
    _yy_u32(0),
    _yy_u32(0),
    _yy_u32(limit),
    _yy_u32(0),
    _yy_encodeASCIIString16("")
  ));
}

function _yy_buildHistoryChatRouter(session, limit) {
  const historyReq = _yy_buildHistoryChatRequest(session, limit);
  const ulSvc = _yy_buildUlSvcMsgByUid(
    __yy_appId.chatService,
    session.topSid,
    session.uid,
    historyReq,
    __yy_appId.chatService & 0xff,
    session.subSid,
    { 7: "" }
  );
  const headers = _yy_buildAPRouterHeaders(
    __yy_uri.ulSvcMsgByUid,
    __yy_appId.apService,
    session.uid,
    "",
    { 103: _yy_utf8Bytes(_yy_nextTrace(session)) },
    ""
  );
  return _yy_buildAPRouterFrame(__yy_uri.svcApRouterReq, __yy_uri.ulSvcMsgByUid, ulSvc, headers);
}

function _yy_buildChannelRouterReq(session, ruri, body, service, withKey10000) {
  const props = {
    1: _yy_u32(session.topSid),
    103: _yy_utf8Bytes(_yy_nextTrace(session))
  };
  if (withKey10000) props[10000] = _yy_u32(session.topSid);
  const headers = _yy_buildAPRouterHeaders(ruri, __yy_appId.apService, session.uid, service, props, "");
  return _yy_buildAPRouterFrame(__yy_uri.chlApRouterReq, ruri, body, headers);
}

function _yy_buildJoinChannelRouterReq(session) {
  const body = _yy_concat(
    _yy_u32(session.uid),
    _yy_u32(session.topSid),
    _yy_u32(session.subSid),
    _yy_u32(0),
    _yy_u32(session.uid),
    _yy_u32(0)
  );
  const headers = _yy_buildAPRouterHeaders(
    __yy_uri.joinChannelReq,
    __yy_appId.apService,
    session.uid,
    "channelAuther",
    {
      1: _yy_u32(session.topSid),
      103: _yy_utf8Bytes(_yy_nextTrace(session))
    },
    ""
  );
  return _yy_buildAPRouterFrame(__yy_uri.chlApRouterReq, __yy_uri.joinChannelReq, body, headers);
}

function _yy_buildChannelBootstrapRequests(session) {
  return [
    _yy_buildChannelRouterReq(session, __yy_uri.leaveChannelReq, _yy_concat(
      _yy_u32(session.uid),
      _yy_u32(session.topSid),
      _yy_u32(session.uid),
      _yy_u32(0)
    ), "channelAuther", true),
    _yy_buildJoinChannelRouterReq(session),
    _yy_buildChannelRouterReq(session, __yy_uri.channelInfoReq, _yy_concat([0, 0, 0], _yy_u32(session.topSid)), "channelInfo", true),
    _yy_buildChannelRouterReq(session, __yy_uri.chatCtrlReq, _yy_u32(session.topSid), "chatCtrl", true),
    _yy_buildChannelRouterReq(session, __yy_uri.channelUserInfoReqA, _yy_concat(
      _yy_u32(session.topSid), _yy_u32(1), _yy_u32(0), _yy_u32(0), _yy_u32(1), _yy_u32(0), _yy_u32(0)
    ), "channelUserInfo", true),
    _yy_buildChannelRouterReq(session, __yy_uri.chatAuthReq, _yy_concat(
      _yy_u32(session.topSid), _yy_u32(session.subSid), _yy_u32(session.uid), _yy_u32(session.uid), _yy_u32(0), _yy_u16(0)
    ), "chatCtrl", true),
    _yy_buildChannelRouterReq(session, __yy_uri.channelUserInfoReqB, _yy_concat(
      _yy_u32(session.topSid), _yy_u32(session.subSid), _yy_u32(2), _yy_u32(0)
    ), "channelUserInfo", true),
    _yy_buildChannelRouterReq(session, __yy_uri.channelUserInfoReqC, _yy_concat(
      _yy_u32(session.topSid), _yy_u32(0)
    ), "channelUserInfo", true),
    _yy_buildChannelRouterReq(session, __yy_uri.channelMaixuReq, _yy_concat(
      _yy_u32(session.topSid), _yy_u32(session.subSid), _yy_u32(session.uid), _yy_u32(session.uid), _yy_u32(0)
    ), "channelMaixu", true)
  ];
}

function _yy_buildAnonymousLoginRequest() {
  const anonPayload = _yy_concat(
    _yy_encodeASCIIString16(""),
    _yy_u32(0),
    _yy_encodeASCIIString16("B8-97-5A-17-AD-4D"),
    _yy_encodeASCIIString16("B8-97-5A-17-AD-4D"),
    _yy_u32(0),
    _yy_encodeASCIIString16("yymwebh5")
  );
  return _yy_buildFrame(__yy_uri.cliAPLoginAuthReq2, _yy_concat(
    _yy_encodeASCIIString16(""),
    _yy_u32(__yy_uri.anonymousLogin),
    _yy_encodeBytes32(anonPayload)
  ));
}

function _yy_buildPLoginAPRequest(session) {
  const authInfo = _yy_concat(
    _yy_encodeASCIIString16(session.passport),
    _yy_encodeASCIIString16(session.password),
    _yy_u32(0),
    _yy_u32(0),
    _yy_u32(0),
    _yy_encodeASCIIString16("yytianlaitv"),
    _yy_encodeASCIIString16("B8-97-5A-17-AD-4D"),
    _yy_encodeASCIIString16(""),
    _yy_u32(0),
    _yy_u32(0),
    _yy_u32(0),
    _yy_u32(0),
    _yy_encodeASCIIString16(session.wsUUID)
  );
  return _yy_buildFrame(__yy_uri.loginAP, _yy_concat(
    _yy_encodeBytes32(authInfo),
    _yy_u32(__yy_appId.apService),
    _yy_u32(session.uid),
    _yy_u32(0),
    _yy_u8(0),
    _yy_encodeBytes16([]),
    _yy_encodeBytes16(session.cookie),
    _yy_encodeASCIIString16(`${__yy_appId.apService}:0`)
  ));
}

function _yy_bootstrapWrites(session) {
  const fullGroups = _yy_serviceGroups(session);
  const baseGroups = fullGroups.slice(0, 2);
  const writes = [];
  writes.push(_yy_writeBinary(_yy_buildSvcUserGroupV2(__yy_uri.leaveSvcUserGroupV2, session, fullGroups)));
  writes.push(_yy_writeBinary(_yy_buildSvcUserGroupV2(__yy_uri.leaveSvcUserGroupV2, session, baseGroups)));
  for (const req of _yy_buildChannelBootstrapRequests(session)) writes.push(_yy_writeBinary(req));
  writes.push(_yy_writeBinary(_yy_buildSvcUserGroupV2(__yy_uri.joinSvcUserGroupV2, session, fullGroups)));
  writes.push(_yy_writeBinary(_yy_buildSvcUserGroupV2(__yy_uri.joinSvcUserGroupV2, session, baseGroups)));
  writes.push(_yy_writeBinary(_yy_buildSubServiceTypes(__yy_uri.subSvcTypesV2, session.uid, __yy_appId.serviceAppids)));
  for (const group of _yy_type4Groups()) {
    writes.push(_yy_writeBinary(_yy_buildSvcUserGroupV2(__yy_uri.joinSvcUserGroupV2, session, [group])));
  }
  writes.push(_yy_writeBinary(_yy_buildHistoryChatRouter(session, 5)));
  writes.push(_yy_writeBinary(_yy_buildHistoryChatRouter(session, 5)));
  session.pingEnabled = true;
  return writes;
}

function _yy_session(connectionId) {
  const key = _yy_str(connectionId);
  const session = __yy_danmakuSessions[key];
  if (!session) _yy_throw("INVALID_STATE", "danmaku session not found", { connectionId: key });
  return session;
}

function _yy_handleLoginAuthResponse(session, payload) {
  const reader = _yy_reader(payload);
  try {
    reader.readASCIIString16();
    reader.readUInt32LE();
    const ruri = reader.readUInt32LE();
    const inner = reader.readBytes32();
    if (ruri !== __yy_uri.anonymousLoginRes) return [];

    const anon = _yy_reader(inner);
    anon.readASCIIString16();
    const resCode = anon.readUInt32LE();
    if (resCode !== 0 && resCode !== 200) return [];

    session.uid = anon.readUInt32LE();
    anon.readUInt32LE();
    session.passport = anon.readASCIIString16();
    session.password = anon.readASCIIString16();
    session.cookie = anon.readBytes16();
    anon.readBytes16();

    return [_yy_writeBinary(_yy_buildPLoginAPRequest(session))];
  } catch (e) {
    return [];
  }
}

function _yy_handleAPLoginResponse(session, payload) {
  const reader = _yy_reader(payload);
  try {
    reader.readUInt32LE();
    const resCode = reader.readUInt32LE();
    reader.readASCIIString16();
    reader.readUInt32LE();
    reader.readUInt16LE();
    reader.readUInt32LE();
    reader.readUInt32LE();
    if (resCode !== 0 && resCode !== 200) return [];
    session.apLoggedIn = true;
    return _yy_bootstrapWrites(session);
  } catch (e) {
    return [];
  }
}

function _yy_handleRouter(session, payload, messages) {
  const router = _yy_parseAPRouter(payload);
  if (!router) return;
  switch (router.ruri) {
    case __yy_uri.dlSvcMsgByUid: {
      const dlUid = _yy_parseDlSvcMsgByUid(router.body);
      if (dlUid) _yy_handleServiceFrameBuffer(session, dlUid.payload, messages);
      break;
    }
    case __yy_uri.dlSvcMsgBySid: {
      const dlSid = _yy_parseDlSvcMsgBySid(router.body);
      if (dlSid) _yy_handleServiceFrameBuffer(session, dlSid.payload, messages);
      break;
    }
    case __yy_uri.pHistoryChatRes:
      _yy_dedupeAndPushMessages(session, _yy_parseHistoryChatResponse(router.body), messages);
      break;
    default:
      _yy_handleServiceFrameBuffer(session, router.body, messages);
      break;
  }
}

globalThis.__yyDanmakuDriver = {
  async getDanmakuPlan(roomId) {
    const shared = _yy_shared();
    const wsUUID = typeof shared.makeUUIDNoDash === "function"
      ? _yy_str(shared.makeUUIDNoDash())
      : _yy_str(Math.random()).replace(/\D/g, "");
    const wsURL = __yy_wsURLTemplate.replace("%UUID%", encodeURIComponent(wsUUID));
    return {
      args: {
        roomId: _yy_str(roomId),
        sid: _yy_str(roomId),
        ssid: _yy_str(roomId),
        ws_uuid: wsUUID,
        ws_url: wsURL
      },
      headers: {
        "User-Agent": _yy_str(shared.playbackUserAgent || ""),
        Origin: __yy_defaultOrigin
      },
      transport: {
        kind: "websocket",
        url: wsURL,
        frameType: "binary"
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "yy_ws_binary",
        protocolVersion: "1"
      }
    };
  },

  async createDanmakuSession(payload) {
    const connectionId = _yy_str(payload && payload.connectionId);
    const args = payload && payload.args ? payload.args : {};
    const roomId = _yy_str(args.roomId || payload && payload.roomId);
    const topSid = _yy_num(args.sid || roomId, 0);
    const subSid = _yy_num(args.ssid || roomId, topSid);
    if (!connectionId) _yy_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    if (!topSid || !subSid) _yy_throw("INVALID_ARGS", "YY sid/ssid are invalid", { roomId: roomId, sid: _yy_str(args.sid), ssid: _yy_str(args.ssid) });

    __yy_danmakuSessions[connectionId] = {
      connectionId: connectionId,
      roomId: roomId,
      topSid: topSid >>> 0,
      subSid: subSid >>> 0,
      wsUUID: _yy_str(args.ws_uuid),
      uid: 0,
      passport: "",
      password: "",
      cookie: [],
      pingEnabled: false,
      apLoggedIn: false,
      tracePrefix: Math.floor(Math.random() * 90000) + 10000,
      traceCounter: Math.floor(Math.random() * 51) + 30,
      seenSet: Object.create(null),
      seenQueue: []
    };

    return {
      ok: true,
      timer: _yy_timer(false)
    };
  },

  async onDanmakuOpen(payload) {
    _yy_session(payload && payload.connectionId);
    return {
      writes: [_yy_writeBinary(_yy_buildAnonymousLoginRequest())],
      timer: _yy_timer(false)
    };
  },

  async onDanmakuFrame(payload) {
    const session = _yy_session(payload && payload.connectionId);
    const frameType = _yy_str(payload && payload.frameType);
    if (frameType !== "binary") {
      return { writes: [], messages: [], timer: _yy_timer(session.pingEnabled) };
    }

    const parsed = _yy_parseFrame(_yy_base64ToBytes(payload && payload.bytesBase64));
    if (!parsed) {
      return { writes: [], messages: [], timer: _yy_timer(session.pingEnabled) };
    }

    const writes = [];
    const messages = [];

    switch (parsed.uri) {
      case __yy_uri.cliAPLoginAuthRes:
      case __yy_uri.cliAPLoginAuthRes2:
        writes.push.apply(writes, _yy_handleLoginAuthResponse(session, parsed.payload));
        break;
      case __yy_uri.loginAPRes:
        writes.push.apply(writes, _yy_handleAPLoginResponse(session, parsed.payload));
        break;
      case __yy_uri.appPong:
        break;
      case __yy_uri.dlUserGroupMsg: {
        const group = _yy_parseDlUsrGroupMsg(parsed.payload);
        if (group) {
          if (group.ruri === __yy_uri.dlSvcMsgByUid) {
            const dlUid = _yy_parseDlSvcMsgByUid(group.msg);
            if (dlUid) _yy_handleServiceFrameBuffer(session, dlUid.payload, messages);
          } else if (group.ruri === __yy_uri.dlSvcMsgBySid) {
            const dlSid = _yy_parseDlSvcMsgBySid(group.msg);
            if (dlSid) _yy_handleServiceFrameBuffer(session, dlSid.payload, messages);
          } else {
            const textPacket = _yy_findFramedPacket(group.msg, __yy_uri.textChatMsgRes);
            if (textPacket) {
              const chat = _yy_parseTextChatMsg(textPacket.payload);
              if (chat) _yy_dedupeAndPushMessages(session, [chat], messages);
            }
          }
        }
        break;
      }
      case __yy_uri.svcApRouterReq:
      case __yy_uri.svcApRouterRes:
      case __yy_uri.chlApRouterReq:
      case __yy_uri.chlApRouterRes:
        _yy_handleRouter(session, parsed.payload, messages);
        break;
      default:
        break;
    }

    return {
      writes: writes,
      messages: messages,
      timer: _yy_timer(session.pingEnabled)
    };
  },

  async onDanmakuTick(payload) {
    const session = _yy_session(payload && payload.connectionId);
    if (!session.pingEnabled) {
      return { writes: [], timer: _yy_timer(false) };
    }
    return {
      writes: [_yy_writeBinary(_yy_buildFrame(__yy_uri.pingAP, _yy_u32(0)))],
      timer: _yy_timer(true)
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _yy_str(payload && payload.connectionId);
    if (connectionId) delete __yy_danmakuSessions[connectionId];
    return { ok: true };
  }
};
})();
