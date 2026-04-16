(function () {
const __bili_danmakuSessions = {};
const __bili_sharedGlobalKey = "__lp_plugin_bilibili_1_0_10_shared";
const __bili_connectionUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const __bili_connectionReferer = "https://live.bilibili.com/";

function _bili_shared() {
  const shared = globalThis[__bili_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"bilibili shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _bili_throw(code, message, context) {
  const shared = globalThis[__bili_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _bili_u8(value) {
  return value & 0xff;
}

function _bili_readUInt16BE(bytes, offset) {
  return ((bytes[offset] & 0xff) << 8) | (bytes[offset + 1] & 0xff);
}

function _bili_readUInt32BE(bytes, offset) {
  return (((bytes[offset] & 0xff) << 24) >>> 0)
    | ((bytes[offset + 1] & 0xff) << 16)
    | ((bytes[offset + 2] & 0xff) << 8)
    | (bytes[offset + 3] & 0xff);
}

function _bili_utf8Encode(str) {
  const input = String(str || "");
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

function _bili_utf8Decode(bytes) {
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

function _bili_makePacket(operation, bodyText) {
  const body = _bili_utf8Encode(String(bodyText || ""));
  const totalLen = body.length + 16;
  const out = [];
  out.push(_bili_u8(totalLen >> 24), _bili_u8(totalLen >> 16), _bili_u8(totalLen >> 8), _bili_u8(totalLen));
  out.push(0x00, 0x10);
  out.push(0x00, 0x01);
  out.push(_bili_u8(operation >> 24), _bili_u8(operation >> 16), _bili_u8(operation >> 8), _bili_u8(operation));
  out.push(0x00, 0x00, 0x00, 0x01);
  for (let i = 0; i < body.length; i += 1) out.push(body[i]);
  return out;
}

function _bili_splitJSONObjectCandidates(text) {
  const input = String(text || "");
  const parts = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charAt(i);
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "\"") inString = false;
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}") {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          parts.push(input.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }

  if (parts.length === 0 && input.trim()) parts.push(input.trim());
  return parts;
}

function _bili_getPath(obj, keys) {
  let current = obj;
  for (let i = 0; i < keys.length; i += 1) {
    if (!current || typeof current !== "object") return undefined;
    current = current[keys[i]];
  }
  return current;
}

function _bili_normalizeColor(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed >>> 0;
}

function _bili_collectMessageFromJSON(payload, out) {
  if (!payload || typeof payload !== "object") return;

  const cmd = String(payload.cmd || "");
  if (cmd.indexOf("DANMU_MSG") === 0) {
    const text = _bili_getPath(payload, ["info", 1]);
    const nickname = _bili_getPath(payload, ["info", 2, 1]);
    const color = _bili_normalizeColor(_bili_getPath(payload, ["info", 0, 3]), 0xFFFFFF);
    if (typeof text === "string" && typeof nickname === "string") {
      out.push({ nickname, text, color });
    }
    return;
  }

  if (cmd === "SUPER_CHAT_MESSAGE") {
    const nickname = _bili_getPath(payload, ["data", "uinfo", "base", "origin_info", "name"]);
    const text = _bili_getPath(payload, ["data", "message"]);
    const color = _bili_normalizeColor(_bili_getPath(payload, ["data", "background_bottom_color"]), 0xFFFFFF);
    if (typeof nickname === "string" && typeof text === "string") {
      out.push({
        nickname: nickname,
        text: `醒目留言: ${text}`,
        color: color
      });
    }
  }
}

function _bili_parseBodyToMessages(bodyBytes, out) {
  const text = _bili_utf8Decode(bodyBytes || []);
  const parts = _bili_splitJSONObjectCandidates(text);
  for (let i = 0; i < parts.length; i += 1) {
    try {
      _bili_collectMessageFromJSON(JSON.parse(parts[i]), out);
    } catch (e) {
    }
  }
}

function _bili_inflateZlib(bytes) {
  if (typeof globalThis.__lp_bili_inflate_zlib === "function") {
    return globalThis.__lp_bili_inflate_zlib(bytes || []);
  }
  if (globalThis.fflate && typeof globalThis.fflate.unzlibSync === "function") {
    try {
      return Array.from(globalThis.fflate.unzlibSync(new Uint8Array(bytes || [])));
    } catch (e) {
    }
  }
  if (globalThis.Host && Host.runtime && typeof Host.runtime.inflateZlib === "function") {
    return Host.runtime.inflateZlib(bytes || []);
  }
  _bili_throw("UNSUPPORTED", "bilibili zlib helper is unavailable", {});
}

function _bili_parsePackets(bytes, out) {
  const data = bytes || [];
  let offset = 0;

  while (offset + 16 <= data.length) {
    const packetLen = _bili_readUInt32BE(data, offset);
    if (packetLen < 16 || offset + packetLen > data.length) break;

    const headerLen = _bili_readUInt16BE(data, offset + 4);
    const protocolVer = _bili_readUInt16BE(data, offset + 6);
    const operation = _bili_readUInt32BE(data, offset + 8);
    if (headerLen < 16 || headerLen > packetLen) {
      offset += packetLen;
      continue;
    }

    const body = data.slice(offset + headerLen, offset + packetLen);
    if (protocolVer === 2) {
      const inflated = _bili_inflateZlib(body);
      if (inflated && inflated.length > 0) _bili_parsePackets(inflated, out);
    } else if (operation === 5) {
      _bili_parseBodyToMessages(body, out);
    }

    offset += packetLen;
  }
}

function _bili_authPacket(uid, roomId, token, buvid) {
  return _bili_makePacket(7, JSON.stringify({
    uid: Number(uid || 0),
    roomid: Number(roomId || 0),
    protover: 2,
    buvid: String(buvid || ""),
    platform: "web",
    type: 2,
    key: String(token || ""),
    clientver: "1.8.2"
  }));
}

function _bili_heartbeatPacket() {
  return _bili_makePacket(2, "{}");
}

function _bili_bytesToBase64(bytes) {
  if (typeof btoa !== "function") _bili_throw("UNSUPPORTED", "btoa is unavailable", {});
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] & 0xff);
  return btoa(binary);
}

function _bili_base64ToBytes(value) {
  if (typeof atob !== "function") _bili_throw("UNSUPPORTED", "atob is unavailable", {});
  const raw = atob(String(value || ""));
  const out = [];
  for (let i = 0; i < raw.length; i += 1) out.push(raw.charCodeAt(i) & 0xff);
  return out;
}

function _bili_binaryWrite(bytes) {
  return {
    kind: "binary",
    bytesBase64: _bili_bytesToBase64(bytes)
  };
}

function _bili_danmakuSession(connectionId) {
  const session = __bili_danmakuSessions[String(connectionId || "")];
  if (!session) {
    _bili_throw("INVALID_STATE", "danmaku session not found", {
      connectionId: String(connectionId || "")
    });
  }
  return session;
}

async function _bili_getDanmukuArgs(roomId, headers, authMode) {
  const shared = _bili_shared();
  const connectionHeaders = headers && typeof headers === "object"
    ? headers
    : {
      "User-Agent": __bili_connectionUserAgent,
      Referer: __bili_connectionReferer
    };
  const buvids = await shared.getBuvid3And4(authMode);
  const loginUID = typeof shared.getLoginUID === "function"
    ? String(await shared.getLoginUID(authMode) || "0")
    : "0";
  const buvid = String(buvids.b3 || "");

  const roomInfo = await shared.getLiveLatestInfo(roomId, connectionHeaders, authMode);
  const danmuDetail = await shared.getRoomDanmuDetail(roomInfo.roomId, connectionHeaders, authMode);
  const hostList = danmuDetail && danmuDetail.host_list ? danmuDetail.host_list : [];
  const firstHost = hostList.length > 0 ? hostList[0] : null;
  const wsHost = firstHost && firstHost.host
    ? String(firstHost.host)
    : "broadcastlv.chat.bilibili.com";
  const wsPort = firstHost && Number.isFinite(Number(firstHost.wss_port)) && Number(firstHost.wss_port) > 0
    ? String(Number(firstHost.wss_port))
    : "";
  const wsURL = wsPort ? `wss://${wsHost}:${wsPort}/sub` : `wss://${wsHost}/sub`;
  console.log(`[bilibili][danmaku] auth uid=${loginUID}`);
  console.log(`[bilibili][danmaku] hostEntry=${JSON.stringify(firstHost || null)}`);
  console.log(`[bilibili][danmaku] final transport.url=${wsURL}`);

  return {
    args: {
      roomId: String(roomInfo.roomId || roomId),
      uid: loginUID,
      buvid: String(buvid || ""),
      token: String((danmuDetail && danmuDetail.token) || ""),
      host: wsHost,
      wss_port: wsPort
    },
    headers: connectionHeaders,
    transport: {
      kind: "websocket",
      url: wsURL,
      frameType: "binary"
    },
    runtime: {
      driver: "plugin_js_v1",
      protocolId: "bilibili_ws",
      protocolVersion: "1"
    }
  };
}

globalThis.__biliDanmakuDriver = {
  async getDanmakuPlan(roomId, headers, authMode) {
    return await _bili_getDanmukuArgs(roomId, headers, authMode);
  },

  async createDanmakuSession(payload) {
    const connectionId = String(payload && payload.connectionId ? payload.connectionId : "");
    const args = payload && payload.args ? payload.args : {};
    const roomId = String((args && args.roomId) || (payload && payload.roomId) || "");
    if (!connectionId) _bili_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    if (!roomId) _bili_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });

    __bili_danmakuSessions[connectionId] = {
      connectionId: connectionId,
      roomId: roomId,
      uid: String(args.uid || "0"),
      buvid: String(args.buvid || ""),
      token: String(args.token || "")
    };

    return {
      ok: true,
      timer: {
        mode: "off"
      }
    };
  },

  async onDanmakuOpen(payload) {
    const session = _bili_danmakuSession(payload && payload.connectionId);
    return {
      writes: [
        _bili_binaryWrite(_bili_authPacket(session.uid, session.roomId, session.token, session.buvid))
      ],
      timer: {
        mode: "heartbeat",
        intervalMs: 60000
      }
    };
  },

  async onDanmakuFrame(payload) {
    const frameType = String(payload && payload.frameType ? payload.frameType : "");
    if (frameType !== "binary") return { messages: [], writes: [] };

    const out = [];
    _bili_parsePackets(_bili_base64ToBytes(payload && payload.bytesBase64 ? payload.bytesBase64 : ""), out);
    return { messages: out, writes: [] };
  },

  async onDanmakuTick(payload) {
    _bili_danmakuSession(payload && payload.connectionId);
    return {
      writes: [_bili_binaryWrite(_bili_heartbeatPacket())],
      timer: {
        mode: "heartbeat",
        intervalMs: 60000
      }
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = String(payload && payload.connectionId ? payload.connectionId : "");
    if (connectionId) delete __bili_danmakuSessions[connectionId];
    return { ok: true };
  }
};
})();
