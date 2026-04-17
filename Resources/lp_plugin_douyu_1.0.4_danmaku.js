(function () {
const __douyu_danmakuSessions = {};
const __douyu_sharedGlobalKey = "__lp_plugin_douyu_1_0_4_shared";
const __douyu_defaultWebSocketURL = "wss://danmuproxy.douyu.com:8506/";
const __douyu_heartbeatIntervalMs = 45000;
const __douyu_connectionUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.43";

function _douyu_shared() {
  const shared = globalThis[__douyu_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"douyu shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _douyu_throw(code, message, context) {
  const shared = globalThis[__douyu_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _douyu_str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function _douyu_u8(value) {
  return value & 0xff;
}

function _douyu_u32LE(value) {
  const v = Number(value) >>> 0;
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}

function _douyu_utf8Encode(text) {
  const input = _douyu_str(text);
  const out = [];
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6));
      out.push(0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      i += 1;
      if (i >= input.length) break;
      const c2 = input.charCodeAt(i);
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

function _douyu_utf8Decode(bytes) {
  const input = Array.isArray(bytes) ? bytes : [];
  let out = "";
  let i = 0;
  while (i < input.length) {
    const c = input[i++] & 0xff;
    if ((c & 0x80) === 0) {
      out += String.fromCharCode(c);
    } else if ((c & 0xe0) === 0xc0) {
      if (i >= input.length) break;
      const c2 = input[i++] & 0x3f;
      out += String.fromCharCode(((c & 0x1f) << 6) | c2);
    } else if ((c & 0xf0) === 0xe0) {
      if (i + 1 >= input.length) break;
      const c21 = input[i++] & 0x3f;
      const c22 = input[i++] & 0x3f;
      out += String.fromCharCode(((c & 0x0f) << 12) | (c21 << 6) | c22);
    } else {
      if (i + 2 >= input.length) break;
      const c31 = input[i++] & 0x3f;
      const c32 = input[i++] & 0x3f;
      const c33 = input[i++] & 0x3f;
      let u = ((c & 0x07) << 18) | (c31 << 12) | (c32 << 6) | c33;
      u -= 0x10000;
      out += String.fromCharCode(0xd800 + ((u >> 10) & 0x3ff));
      out += String.fromCharCode(0xdc00 + (u & 0x3ff));
    }
  }
  return out;
}

function _douyu_bytesToBase64(bytes) {
  if (typeof btoa !== "function") _douyu_throw("UNSUPPORTED", "btoa is unavailable", {});
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] & 0xff);
  return btoa(binary);
}

function _douyu_base64ToBytes(value) {
  if (typeof atob !== "function") _douyu_throw("UNSUPPORTED", "atob is unavailable", {});
  const raw = atob(_douyu_str(value));
  const out = [];
  for (let i = 0; i < raw.length; i += 1) out.push(raw.charCodeAt(i) & 0xff);
  return out;
}

function _douyu_binaryWrite(bytes) {
  return {
    kind: "binary",
    bytesBase64: _douyu_bytesToBase64(bytes)
  };
}

function _douyu_timer() {
  return {
    mode: "polling",
    intervalMs: __douyu_heartbeatIntervalMs
  };
}

function _douyu_readInt32LE(bytes, index) {
  return (bytes[index] & 0xff)
    | ((bytes[index + 1] & 0xff) << 8)
    | ((bytes[index + 2] & 0xff) << 16)
    | ((bytes[index + 3] & 0xff) << 24);
}

function _douyu_escape(text) {
  return _douyu_str(text).replace(/@/g, "@A").replace(/\//g, "@S");
}

function _douyu_unescape(text) {
  return _douyu_str(text)
    .replace(/@S/g, "/")
    .replace(/@A/g, "@");
}

function _douyu_encodePacket(message) {
  const payload = _douyu_utf8Encode(_douyu_str(message));
  const totalLen = payload.length + 9;
  return []
    .concat(_douyu_u32LE(totalLen))
    .concat(_douyu_u32LE(totalLen))
    .concat([0xb1, 0x02, 0x00, 0x00])
    .concat(payload)
    .concat([0x00]);
}

function _douyu_pickField(message, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(escapedKey + "@=(.*?)/").exec(_douyu_str(message));
  return match && match[1] ? _douyu_unescape(match[1]) : "";
}

function _douyu_mapColor(raw) {
  switch (Number(raw)) {
    case 1: return 0xff0000;
    case 2: return 0x1e7df0;
    case 3: return 0x7ac84b;
    case 4: return 0xff7f00;
    case 5: return 0x9b39f4;
    case 6: return 0xff69b4;
    default: return 0xffffff;
  }
}

function _douyu_parseMessages(bytes) {
  const input = Array.isArray(bytes) ? bytes : [];
  const messages = [];
  let offset = 0;
  while (offset + 12 <= input.length) {
    const packetLen = _douyu_readInt32LE(input, offset);
    const bodyLen = packetLen - 8;
    if (packetLen <= 0 || bodyLen <= 0 || offset + 4 + packetLen > input.length) break;
    const bodyStart = offset + 12;
    const bodyEnd = offset + 4 + packetLen;
    const body = input.slice(bodyStart, bodyEnd);
    const text = _douyu_utf8Decode(body).replace(/\u0000+$/g, "");
    if (text.indexOf("type@=chatmsg/") >= 0) {
      messages.push({
        nickname: _douyu_pickField(text, "nn"),
        text: _douyu_pickField(text, "txt"),
        color: _douyu_mapColor(_douyu_pickField(text, "col"))
      });
    }
    offset += 4 + packetLen;
  }
  return messages.filter(function (item) {
    return !!_douyu_str(item.text);
  });
}

function _douyu_session(connectionId) {
  const key = _douyu_str(connectionId);
  const session = __douyu_danmakuSessions[key];
  if (!session) {
    _douyu_throw("INVALID_STATE", "danmaku session not found", { connectionId: key });
  }
  return session;
}

function _douyu_loginWrite(roomId) {
  return _douyu_binaryWrite(_douyu_encodePacket(`type@=loginreq/roomid@=${_douyu_escape(roomId)}/`));
}

function _douyu_joinWrite(roomId) {
  return _douyu_binaryWrite(_douyu_encodePacket(`type@=joingroup/rid@=${_douyu_escape(roomId)}/gid@=-9999/`));
}

function _douyu_heartbeatWrite() {
  return _douyu_binaryWrite(_douyu_encodePacket("type@=mrkl/"));
}

const __douyuDanmakuDriver = {
  async getDanmakuPlan(roomId) {
    const rid = _douyu_str(roomId).trim();
    if (!rid) _douyu_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    return {
      args: {
        roomId: rid,
        url: __douyu_defaultWebSocketURL
      },
      headers: {
        "User-Agent": __douyu_connectionUserAgent
      },
      transport: {
        kind: "websocket",
        url: __douyu_defaultWebSocketURL,
        frameType: "binary"
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "douyu_ws_stt",
        protocolVersion: "1"
      }
    };
  },

  async createDanmakuSession(payload) {
    const connectionId = _douyu_str(payload && payload.connectionId);
    if (!connectionId) _douyu_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    const args = payload && payload.args ? payload.args : {};
    const roomId = _douyu_str(args.roomId);
    if (!roomId) _douyu_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });

    __douyu_danmakuSessions[connectionId] = {
      connectionId: connectionId,
      roomId: roomId
    };

    return {
      ok: true,
      timer: _douyu_timer()
    };
  },

  async onDanmakuOpen(payload) {
    const session = _douyu_session(payload && payload.connectionId);
    return {
      writes: [_douyu_loginWrite(session.roomId), _douyu_joinWrite(session.roomId)],
      timer: _douyu_timer()
    };
  },

  async onDanmakuFrame(payload) {
    const session = _douyu_session(payload && payload.connectionId);
    return {
      writes: [],
      messages: _douyu_parseMessages(_douyu_base64ToBytes(payload && payload.bytesBase64 ? payload.bytesBase64 : "")),
      timer: _douyu_timer()
    };
  },

  async onDanmakuTick(payload) {
    _douyu_session(payload && payload.connectionId);
    return {
      writes: [_douyu_heartbeatWrite()],
      timer: _douyu_timer()
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _douyu_str(payload && payload.connectionId);
    if (connectionId) delete __douyu_danmakuSessions[connectionId];
    return {
      ok: true
    };
  }
};

globalThis.__douyuDanmakuDriver = __douyuDanmakuDriver;
})();
