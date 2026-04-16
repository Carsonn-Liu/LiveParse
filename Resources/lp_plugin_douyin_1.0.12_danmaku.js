(function () {
const __dy_danmakuSessions = {};
const __dy_sharedGlobalKey = "__lp_plugin_douyin_1_0_12_shared";
const __dy_defaultHeartbeatIntervalMs = 10000;

function _dy_shared() {
  const shared = globalThis[__dy_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"douyin shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _dy_throw(code, message, context) {
  const shared = globalThis[__dy_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _dy_str(value) {
  const shared = globalThis[__dy_sharedGlobalKey];
  if (shared && typeof shared.toString === "function") {
    return shared.toString(value);
  }
  return value === null || value === undefined ? "" : String(value);
}

function _dy_bytesToBase64(bytes) {
  if (typeof btoa !== "function") {
    _dy_throw("UNSUPPORTED", "btoa is unavailable", {});
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] & 0xff);
  }
  return btoa(binary);
}

function _dy_base64ToBytes(value) {
  if (typeof atob !== "function") {
    _dy_throw("UNSUPPORTED", "atob is unavailable", {});
  }
  const raw = atob(_dy_str(value));
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    out.push(raw.charCodeAt(i) & 0xff);
  }
  return out;
}

function _dy_binaryWrite(bytes) {
  return {
    kind: "binary",
    bytesBase64: _dy_bytesToBase64(bytes || [])
  };
}

function _dy_timer(intervalMs) {
  return {
    mode: "heartbeat",
    intervalMs: intervalMs
  };
}

function _dy_session(connectionId) {
  const key = _dy_str(connectionId);
  const session = __dy_danmakuSessions[key];
  if (!session) {
    _dy_throw("INVALID_STATE", "douyin danmaku session not found", { connectionId: key });
  }
  return session;
}

function _dy_notReadyContext(session, reason) {
  return {
    connectionId: session.connectionId,
    roomId: session.roomId,
    protocolId: "douyin_ws_protobuf",
    reason: _dy_str(reason)
  };
}

function _dy_inflateGzip(bytes, session) {
  const source = bytes || [];
  if (globalThis.fflate && typeof globalThis.fflate.gunzipSync === "function") {
    try {
      return Array.from(globalThis.fflate.gunzipSync(new Uint8Array(source)) || []);
    } catch (e) {
      _dy_throw("DECODE_FAILED", "douyin gzip decode failed", _dy_notReadyContext(session, e && e.message ? e.message : "fflate gunzip failed"));
    }
  }
  if (typeof globalThis.__lp_douyin_gzip_inflate === "function") {
    return globalThis.__lp_douyin_gzip_inflate(source);
  }
  if (globalThis.Host && Host.runtime) {
    if (typeof Host.runtime.inflateGzip === "function") {
      return Host.runtime.inflateGzip(source);
    }
    if (typeof Host.runtime.decompressGzip === "function") {
      return Host.runtime.decompressGzip(source);
    }
  }
  _dy_throw("UNSUPPORTED", "douyin gzip helper is unavailable", _dy_notReadyContext(session, "missing fflate or host gzip helper"));
}

function _dy_readVarint(bytes, offset) {
  let value = 0;
  let shift = 0;
  let idx = offset;

  while (idx < bytes.length && shift <= 63) {
    const b = bytes[idx++] & 0xff;
    value += (b & 0x7f) * Math.pow(2, shift);
    if ((b & 0x80) === 0) {
      return { value: value, offset: idx };
    }
    shift += 7;
  }

  return null;
}

function _dy_writeVarint(value) {
  const out = [];
  let v = Math.max(0, Number(value || 0));

  while (v >= 0x80) {
    out.push((v % 128) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v & 0x7f);
  return out;
}

function _dy_readLengthDelimited(bytes, offset) {
  const lengthInfo = _dy_readVarint(bytes, offset);
  if (!lengthInfo) return null;

  const length = Number(lengthInfo.value || 0);
  const start = lengthInfo.offset;
  const end = start + length;
  if (end > bytes.length) return null;

  return {
    bytes: bytes.slice(start, end),
    offset: end
  };
}

function _dy_skipField(bytes, offset, wireType) {
  if (wireType === 0) {
    const v = _dy_readVarint(bytes, offset);
    return v ? v.offset : -1;
  }
  if (wireType === 1) {
    return offset + 8 <= bytes.length ? offset + 8 : -1;
  }
  if (wireType === 2) {
    const ld = _dy_readLengthDelimited(bytes, offset);
    return ld ? ld.offset : -1;
  }
  if (wireType === 5) {
    return offset + 4 <= bytes.length ? offset + 4 : -1;
  }
  return -1;
}

function _dy_utf8Encode(str) {
  const out = [];
  const source = _dy_str(str);
  for (let i = 0; i < source.length; i += 1) {
    const c = source.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6));
      out.push(0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      i += 1;
      if (i >= source.length) break;
      const c2 = source.charCodeAt(i);
      const u = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (u >> 18));
      out.push(0x80 | ((u >> 12) & 0x3f));
      out.push(0x80 | ((u >> 6) & 0x3f));
      out.push(0x80 | (u & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12));
      out.push(0x80 | ((c >> 6) & 0x3f));
      out.push(0x80 | (c & 0x3f));
    }
  }
  return out;
}

function _dy_utf8Decode(bytes) {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++] & 0xff;
    if ((c & 0x80) === 0) {
      out += String.fromCharCode(c);
    } else if ((c & 0xe0) === 0xc0) {
      if (i >= bytes.length) break;
      const c2 = bytes[i++] & 0x3f;
      out += String.fromCharCode(((c & 0x1f) << 6) | c2);
    } else if ((c & 0xf0) === 0xe0) {
      if (i + 1 >= bytes.length) break;
      const c21 = bytes[i++] & 0x3f;
      const c22 = bytes[i++] & 0x3f;
      out += String.fromCharCode(((c & 0x0f) << 12) | (c21 << 6) | c22);
    } else {
      if (i + 2 >= bytes.length) break;
      const c31 = bytes[i++] & 0x3f;
      const c32 = bytes[i++] & 0x3f;
      const c33 = bytes[i++] & 0x3f;
      let u = ((c & 0x07) << 18) | (c31 << 12) | (c32 << 6) | c33;
      u -= 0x10000;
      out += String.fromCharCode(0xd800 + ((u >> 10) & 0x3ff));
      out += String.fromCharCode(0xdc00 + (u & 0x3ff));
    }
  }
  return out;
}

function _dy_appendFieldVarint(out, fieldNumber, value) {
  const key = (fieldNumber << 3) | 0;
  const k = _dy_writeVarint(key);
  for (let i = 0; i < k.length; i += 1) out.push(k[i]);
  const v = _dy_writeVarint(value);
  for (let i = 0; i < v.length; i += 1) out.push(v[i]);
}

function _dy_appendFieldBytes(out, fieldNumber, dataBytes) {
  const key = (fieldNumber << 3) | 2;
  const k = _dy_writeVarint(key);
  for (let i = 0; i < k.length; i += 1) out.push(k[i]);

  const bytes = dataBytes || [];
  const len = _dy_writeVarint(bytes.length);
  for (let i = 0; i < len.length; i += 1) out.push(len[i]);
  for (let i = 0; i < bytes.length; i += 1) out.push(bytes[i]);
}

function _dy_appendFieldString(out, fieldNumber, text) {
  _dy_appendFieldBytes(out, fieldNumber, _dy_utf8Encode(text));
}

function _dy_parsePushFrame(bytes) {
  const frame = {
    logId: 0,
    payloadType: "",
    payload: []
  };

  let offset = 0;
  while (offset < bytes.length) {
    const keyInfo = _dy_readVarint(bytes, offset);
    if (!keyInfo) break;
    offset = keyInfo.offset;

    const fieldNumber = Math.floor(keyInfo.value / 8);
    const wireType = keyInfo.value & 0x07;

    if (fieldNumber === 2 && wireType === 0) {
      const logId = _dy_readVarint(bytes, offset);
      if (!logId) break;
      frame.logId = Number(logId.value || 0);
      offset = logId.offset;
    } else if (fieldNumber === 7 && wireType === 2) {
      const payloadType = _dy_readLengthDelimited(bytes, offset);
      if (!payloadType) break;
      frame.payloadType = _dy_utf8Decode(payloadType.bytes);
      offset = payloadType.offset;
    } else if (fieldNumber === 8 && wireType === 2) {
      const payload = _dy_readLengthDelimited(bytes, offset);
      if (!payload) break;
      frame.payload = payload.bytes;
      offset = payload.offset;
    } else {
      const skipped = _dy_skipField(bytes, offset, wireType);
      if (skipped < 0) break;
      offset = skipped;
    }
  }

  return frame;
}

function _dy_parseResponseMessage(bytes) {
  const msg = {
    method: "",
    payload: []
  };

  let offset = 0;
  while (offset < bytes.length) {
    const keyInfo = _dy_readVarint(bytes, offset);
    if (!keyInfo) break;
    offset = keyInfo.offset;

    const fieldNumber = Math.floor(keyInfo.value / 8);
    const wireType = keyInfo.value & 0x07;

    if (fieldNumber === 1 && wireType === 2) {
      const method = _dy_readLengthDelimited(bytes, offset);
      if (!method) break;
      msg.method = _dy_utf8Decode(method.bytes);
      offset = method.offset;
    } else if (fieldNumber === 2 && wireType === 2) {
      const payload = _dy_readLengthDelimited(bytes, offset);
      if (!payload) break;
      msg.payload = payload.bytes;
      offset = payload.offset;
    } else {
      const skipped = _dy_skipField(bytes, offset, wireType);
      if (skipped < 0) break;
      offset = skipped;
    }
  }

  return msg;
}

function _dy_parseResponse(bytes) {
  const response = {
    messages: [],
    internalExt: "",
    needAck: false
  };

  let offset = 0;
  while (offset < bytes.length) {
    const keyInfo = _dy_readVarint(bytes, offset);
    if (!keyInfo) break;
    offset = keyInfo.offset;

    const fieldNumber = Math.floor(keyInfo.value / 8);
    const wireType = keyInfo.value & 0x07;

    if (fieldNumber === 1 && wireType === 2) {
      const messageField = _dy_readLengthDelimited(bytes, offset);
      if (!messageField) break;
      response.messages.push(_dy_parseResponseMessage(messageField.bytes));
      offset = messageField.offset;
    } else if (fieldNumber === 5 && wireType === 2) {
      const extField = _dy_readLengthDelimited(bytes, offset);
      if (!extField) break;
      response.internalExt = _dy_utf8Decode(extField.bytes);
      offset = extField.offset;
    } else if (fieldNumber === 9 && wireType === 0) {
      const ackField = _dy_readVarint(bytes, offset);
      if (!ackField) break;
      response.needAck = Number(ackField.value || 0) !== 0;
      offset = ackField.offset;
    } else {
      const skipped = _dy_skipField(bytes, offset, wireType);
      if (skipped < 0) break;
      offset = skipped;
    }
  }

  return response;
}

function _dy_parseUser(bytes) {
  const user = { nickname: "" };
  let offset = 0;

  while (offset < bytes.length) {
    const keyInfo = _dy_readVarint(bytes, offset);
    if (!keyInfo) break;
    offset = keyInfo.offset;

    const fieldNumber = Math.floor(keyInfo.value / 8);
    const wireType = keyInfo.value & 0x07;

    if (fieldNumber === 3 && wireType === 2) {
      const nickField = _dy_readLengthDelimited(bytes, offset);
      if (!nickField) break;
      user.nickname = _dy_utf8Decode(nickField.bytes);
      offset = nickField.offset;
    } else {
      const skipped = _dy_skipField(bytes, offset, wireType);
      if (skipped < 0) break;
      offset = skipped;
    }
  }

  return user;
}

function _dy_parseChatMessage(bytes) {
  const chat = {
    content: "",
    nickname: ""
  };
  let offset = 0;

  while (offset < bytes.length) {
    const keyInfo = _dy_readVarint(bytes, offset);
    if (!keyInfo) break;
    offset = keyInfo.offset;

    const fieldNumber = Math.floor(keyInfo.value / 8);
    const wireType = keyInfo.value & 0x07;

    if (fieldNumber === 2 && wireType === 2) {
      const userField = _dy_readLengthDelimited(bytes, offset);
      if (!userField) break;
      chat.nickname = _dy_parseUser(userField.bytes).nickname;
      offset = userField.offset;
    } else if (fieldNumber === 3 && wireType === 2) {
      const contentField = _dy_readLengthDelimited(bytes, offset);
      if (!contentField) break;
      chat.content = _dy_utf8Decode(contentField.bytes);
      offset = contentField.offset;
    } else {
      const skipped = _dy_skipField(bytes, offset, wireType);
      if (skipped < 0) break;
      offset = skipped;
    }
  }

  return chat;
}

function _dy_encodePushFrame(logId, payloadType) {
  const out = [];
  if (Number(logId || 0) > 0) {
    _dy_appendFieldVarint(out, 2, Number(logId || 0));
  }
  _dy_appendFieldString(out, 7, _dy_str(payloadType));
  return out;
}

function _dy_heartbeatPacket() {
  return _dy_encodePushFrame(0, "hb");
}

function _dy_parseBinaryFrame(bytes, session) {
  const frame = _dy_parsePushFrame(bytes || []);
  const messages = [];
  let ackPacket = null;

  const payload = frame.payload || [];
  if (payload.length === 0) {
    return { messages: messages, ackPacket: ackPacket };
  }

  const decompressed = _dy_inflateGzip(payload, session);
  if (!decompressed || decompressed.length === 0) {
    return { messages: messages, ackPacket: ackPacket };
  }

  const response = _dy_parseResponse(decompressed);
  if (response.needAck) {
    ackPacket = _dy_encodePushFrame(frame.logId, response.internalExt || "");
  }

  for (let i = 0; i < response.messages.length; i += 1) {
    const item = response.messages[i];
    if (item.method !== "WebcastChatMessage") continue;
    const chat = _dy_parseChatMessage(item.payload || []);
    if (!chat.content) continue;
    messages.push({
      nickname: _dy_str(chat.nickname),
      text: _dy_str(chat.content),
      color: 0xFFFFFF
    });
  }

  return {
    messages: messages,
    ackPacket: ackPacket
  };
}

const __douyinDanmakuDriver = {
  async getDanmakuPlan(payload) {
    const shared = _dy_shared();
    const context = await shared.buildDanmakuContext(payload || {});
    const args = {
      room_id: _dy_str(context.finalRoomId),
      compress: "gzip",
      version_code: "180800",
      webcast_sdk_version: "1.0.14-beta.0",
      live_id: "1",
      did_rule: "3",
      user_unique_id: _dy_str(context.userUniqueId),
      identity: "audience",
      signature: _dy_str(context.signature),
      aid: "6383",
      device_platform: "web",
      browser_language: "zh-CN",
      browser_platform: "Win32",
      browser_name: "Mozilla",
      browser_version: _dy_str(shared.userAgent),
      heartbeat_interval_ms: _dy_str(__dy_defaultHeartbeatIntervalMs)
    };

    return {
      args: args,
      headers: {
        "User-Agent": _dy_str(shared.userAgent),
        "cookie": _dy_str(context.cookie)
      },
      transport: {
        kind: "websocket",
        url: shared.buildDanmakuWebSocketURL(args),
        frameType: "binary"
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "douyin_ws_protobuf",
        protocolVersion: "1"
      }
    };
  },

  async createDanmakuSession(payload) {
    const connectionId = _dy_str(payload && payload.connectionId);
    const roomId = _dy_str(payload && payload.roomId);
    if (!connectionId) {
      _dy_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    }

    const args = payload && payload.args ? payload.args : {};
    __dy_danmakuSessions[connectionId] = {
      connectionId: connectionId,
      roomId: roomId,
      url: _dy_str(payload && payload.transport && payload.transport.url),
      heartbeatIntervalMs: Math.max(Number(args.heartbeat_interval_ms || __dy_defaultHeartbeatIntervalMs) || __dy_defaultHeartbeatIntervalMs, 1000)
    };

    return {
      ok: true,
      timer: {
        mode: "off"
      }
    };
  },

  async onDanmakuOpen(payload) {
    const session = _dy_session(payload && payload.connectionId);
    return {
      writes: [_dy_binaryWrite(_dy_heartbeatPacket())],
      timer: _dy_timer(session.heartbeatIntervalMs)
    };
  },

  async onDanmakuFrame(payload) {
    const session = _dy_session(payload && payload.connectionId);
    if (_dy_str(payload && payload.frameType) !== "binary") {
      return {
        messages: [],
        writes: [],
        timer: _dy_timer(session.heartbeatIntervalMs)
      };
    }

    const result = _dy_parseBinaryFrame(_dy_base64ToBytes(payload && payload.bytesBase64), session);
    const writes = [];
    if (result.ackPacket && result.ackPacket.length > 0) {
      writes.push(_dy_binaryWrite(result.ackPacket));
    }

    return {
      messages: result.messages,
      writes: writes,
      timer: _dy_timer(session.heartbeatIntervalMs)
    };
  },

  async onDanmakuTick(payload) {
    const session = _dy_session(payload && payload.connectionId);
    return {
      writes: [_dy_binaryWrite(_dy_heartbeatPacket())],
      timer: _dy_timer(session.heartbeatIntervalMs)
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _dy_str(payload && payload.connectionId);
    if (connectionId) delete __dy_danmakuSessions[connectionId];
    return { ok: true };
  }
};

globalThis.__douyinDanmakuDriver = __douyinDanmakuDriver;
})();
