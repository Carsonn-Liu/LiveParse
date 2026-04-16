(function () {
const __soop_danmakuSessions = {};
const __soop_sharedGlobalKey = "__lp_plugin_soop_1_0_9_shared";
const __soop_escTab = "\u001b\u0009";
const __soop_ff = 12;
const __soop_heartbeatIntervalMs = 60000;
const __soop_connectionUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const __soop_guestFlag = "16";

function _soop_shared() {
  const shared = globalThis[__soop_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"soop shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _soop_throw(code, message, context) {
  const shared = globalThis[__soop_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _soop_str(value) {
  const shared = globalThis[__soop_sharedGlobalKey];
  if (shared && typeof shared.toString === "function") {
    return shared.toString(value);
  }
  return value === null || value === undefined ? "" : String(value);
}

function _soop_timer(mode, intervalMs) {
  if (mode === "off") {
    return { mode: "off" };
  }
  return {
    mode: "heartbeat",
    intervalMs: intervalMs
  };
}

function _soop_session(connectionId) {
  const key = _soop_str(connectionId);
  const session = __soop_danmakuSessions[key];
  if (!session) {
    _soop_throw("INVALID_STATE", "soop danmaku session not found", { connectionId: key });
  }
  return session;
}

function _soop_asciiBytes(text) {
  const source = _soop_str(text);
  const out = new Uint8Array(source.length);
  for (let i = 0; i < source.length; i++) {
    out[i] = source.charCodeAt(i) & 0xff;
  }
  return out;
}

function _soop_utf8Bytes(text) {
  const source = _soop_str(text);
  if (!source) return new Uint8Array(0);
  const encoded = unescape(encodeURIComponent(source));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    out[i] = encoded.charCodeAt(i) & 0xff;
  }
  return out;
}

function _soop_bytesToText(bytes) {
  let raw = "";
  for (let i = 0; i < bytes.length; i++) {
    raw += String.fromCharCode(bytes[i] & 0xff);
  }
  try {
    return decodeURIComponent(escape(raw));
  } catch (e) {
    return raw;
  }
}

function _soop_concatBytes(parts) {
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    total += part ? part.length : 0;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part || !part.length) continue;
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function _soop_bytesToBase64(bytes) {
  let raw = "";
  for (let i = 0; i < bytes.length; i++) {
    raw += String.fromCharCode(bytes[i] & 0xff);
  }
  return btoa(raw);
}

function _soop_base64ToBytes(value) {
  const raw = atob(_soop_str(value));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i) & 0xff;
  }
  return out;
}

function _soop_binaryWrite(bytes) {
  return {
    kind: "binary",
    bytesBase64: _soop_bytesToBase64(bytes)
  };
}

function _soop_padNumber(value, width) {
  return _soop_str(value).padStart(width, "0");
}

function _soop_makePacket(serviceCode, bodyParts) {
  const body = _soop_concatBytes(bodyParts);
  const header = _soop_asciiBytes(
    __soop_escTab +
      _soop_padNumber(serviceCode, 4) +
      _soop_padNumber(body.length, 6) +
      "00"
  );
  return _soop_concatBytes([header, body]);
}

function _soop_makeLoginPacket(ticket, token, flag1) {
  return _soop_makePacket(1, [
    new Uint8Array([__soop_ff]),
    _soop_asciiBytes(ticket),
    new Uint8Array([__soop_ff]),
    _soop_utf8Bytes(token),
    new Uint8Array([__soop_ff]),
    _soop_asciiBytes(flag1),
    new Uint8Array([__soop_ff])
  ]);
}

function _soop_makeJoinPacket(chatNo, fanTicket) {
  return _soop_makePacket(2, [
    new Uint8Array([__soop_ff]),
    _soop_asciiBytes(chatNo),
    new Uint8Array([__soop_ff]),
    _soop_asciiBytes(fanTicket),
    new Uint8Array([__soop_ff]),
    _soop_asciiBytes("0"),
    new Uint8Array([__soop_ff]),
    new Uint8Array(0),
    new Uint8Array([__soop_ff]),
    new Uint8Array(0),
    new Uint8Array([__soop_ff])
  ]);
}

function _soop_makePingPacket() {
  return _soop_makePacket(0, [new Uint8Array([__soop_ff])]);
}

function _soop_parseBinaryPacket(bytes) {
  if (!bytes || bytes.length < 14) return null;
  const header = _soop_bytesToText(bytes.subarray(0, 14));
  if (header.slice(0, 2) !== __soop_escTab) return null;
  const serviceCode = Number(header.slice(2, 6));
  const bodyLength = Number(header.slice(6, 12));
  const retCode = Number(header.slice(12, 14));
  if (!isFinite(serviceCode) || !isFinite(bodyLength) || !isFinite(retCode)) return null;
  const end = 14 + Math.max(0, bodyLength);
  const body = bytes.subarray(14, Math.min(bytes.length, end));
  const fields = [];
  let start = body.length > 0 && body[0] === __soop_ff ? 1 : 0;
  for (let i = start; i <= body.length; i++) {
    if (i === body.length || body[i] === __soop_ff) {
      fields.push(_soop_bytesToText(body.subarray(start, i)));
      start = i + 1;
    }
  }
  return {
    serviceCode: serviceCode,
    retCode: retCode,
    fields: fields
  };
}

function _soop_colorFromField(value) {
  const number = Number(value);
  if (!isFinite(number) || number <= 0) return 0xffffff;
  const hex = number.toString(16).padStart(6, "0").toUpperCase();
  const reordered = hex.slice(4, 6) + hex.slice(2, 4) + hex.slice(0, 2);
  const parsed = parseInt(reordered, 16);
  return isFinite(parsed) ? parsed : 0xffffff;
}

function _soop_extractLegacyMessages(raw) {
  const packets = _soop_str(raw).split(__soop_escTab);
  const out = [];

  for (let i = 0; i < packets.length; i++) {
    const packet = packets[i];
    if (!packet) continue;
    const fields = packet.split(String.fromCharCode(__soop_ff));
    if (fields.length <= 6) continue;

    const header = _soop_str(fields[0]);
    if (header.length < 4 || header.slice(0, 4) !== "0005") continue;

    const text = _soop_str(fields[1]);
    if (!text) continue;

    out.push({
      text: text,
      nickname: _soop_str(fields[6] || fields[2]),
      color: 0xffffff
    });
  }

  return out;
}

function _soop_extractChatMessages(packet) {
  if (!packet || packet.serviceCode !== 5 || packet.retCode !== 0) return [];
  const fields = packet.fields || [];
  const text = _soop_str(fields[0]);
  if (!text) return [];
  const nickname = _soop_str(fields[5] || fields[1]);
  return [{
    text: text,
    nickname: nickname,
    color: _soop_colorFromField(fields[2])
  }];
}

globalThis.__soopDanmakuDriver = {
  async getDanmakuPlan(payload) {
    const shared = _soop_shared();
    const context = await shared.getDanmakuContext(payload || {});
    const args = context && context.args ? context.args : {};
    const contextHeaders = context && context.headers && typeof context.headers === "object"
      ? context.headers
      : {};
    const headers = {
      "User-Agent": __soop_connectionUserAgent
    };
    const cookie = _soop_str(contextHeaders.Cookie || contextHeaders.cookie);
    if (cookie) headers.cookie = cookie;
    const wsURL = _soop_str(args.ws_url);

    if (!wsURL) {
      return {
        args: args,
        headers: headers
      };
    }

    return {
      args: args,
      headers: headers,
      transport: {
        kind: "websocket",
        url: wsURL,
        frameType: "binary",
        subprotocols: ["chat"]
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "soop_ws_binary",
        protocolVersion: "2"
      }
    };
  },

  async createDanmakuSession(payload) {
    const connectionId = _soop_str(payload && payload.connectionId);
    const args = payload && payload.args ? payload.args : {};
    if (!connectionId) {
      _soop_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    }
    if (!_soop_str(args.chatNo)) {
      _soop_throw("INVALID_ARGS", "soop danmaku args are incomplete", {
        chatNo: _soop_str(args.chatNo),
        bjId: _soop_str(args.bjId)
      });
    }

    __soop_danmakuSessions[connectionId] = {
      connectionId: connectionId,
      roomId: _soop_str(payload && payload.roomId),
      chatNo: _soop_str(args.chatNo),
      fanTicket: _soop_str(args.ftk),
      guestFlag: _soop_str(args.guestFlag || __soop_guestFlag),
      ticket: _soop_str(args.ticket),
      phase: "login_pending"
    };

    return {
      ok: true,
      timer: _soop_timer("off")
    };
  },

  async onDanmakuOpen(payload) {
    const session = _soop_session(payload && payload.connectionId);
    session.phase = "login_pending";
    return {
      writes: [
        _soop_binaryWrite(
          _soop_makeLoginPacket(session.ticket, "", session.guestFlag)
        )
      ],
      timer: _soop_timer("heartbeat", __soop_heartbeatIntervalMs)
    };
  },

  async onDanmakuFrame(payload) {
    const session = _soop_session(payload && payload.connectionId);
    const frameType = _soop_str(payload && payload.frameType);

    if (frameType === "binary") {
      const packet = _soop_parseBinaryPacket(
        _soop_base64ToBytes(payload && payload.bytesBase64)
      );
      if (!packet) return { messages: [], writes: [] };

      if (packet.serviceCode === 1 && packet.retCode === 0 && session.phase === "login_pending") {
        session.phase = "join_pending";
        return {
          messages: [],
          writes: [_soop_binaryWrite(_soop_makeJoinPacket(session.chatNo, session.fanTicket || ""))]
        };
      }

      if (packet.serviceCode === 2 && packet.retCode === 0) {
        session.phase = "active";
        return { messages: [], writes: [] };
      }

      return {
        messages: _soop_extractChatMessages(packet),
        writes: []
      };
    }

    if (frameType === "text") {
      return {
        messages: _soop_extractLegacyMessages(payload && payload.text),
        writes: []
      };
    }

    return { messages: [], writes: [] };
  },

  async onDanmakuTick(payload) {
    _soop_session(payload && payload.connectionId);
    return {
      writes: [_soop_binaryWrite(_soop_makePingPacket())],
      timer: _soop_timer("heartbeat", __soop_heartbeatIntervalMs)
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _soop_str(payload && payload.connectionId);
    if (connectionId) delete __soop_danmakuSessions[connectionId];
    return { ok: true };
  }
};
})();
