// Xiaohongshu rwp (red-websocket-protocol) danmaku driver.
//
// Host owns transport (WebSocket framing + reconnect + timers).
// Plugin owns protocol: AUTH → BIZ_REGISTER → JOIN_ROOM, 25 s liveHeartBeat,
// SYNC frame decoding. Signing / sid acquisition happens in the plugin's
// getDanmaku() via Host.http.request(signing:{profile:"xhs_live_web"}).

(function () {
  const __xhs_sessions = {};
  const __xhs_defaultHeartbeatMs = 25000;

  function _xhs_raise(code, message, context) {
    if (globalThis.Host && typeof Host.raise === "function") {
      Host.raise(code, message, context || {});
    }
    if (globalThis.Host && typeof Host.makeError === "function") {
      throw Host.makeError(code || "UNKNOWN", message || "", context || {});
    }
    throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
  }

  function _xhs_str(value) { return value === undefined || value === null ? "" : String(value); }
  function _xhs_trim(value) { return _xhs_str(value).trim(); }

  function _xhs_parseJSON(text) {
    try { return JSON.parse(_xhs_str(text) || "{}"); } catch (e) { return null; }
  }

  // base64 → UTF-8 string. Plugin JSCore on iOS has no TextDecoder, so the
  // host's native helper is the only reliable path. atob() alone returns a
  // latin-1 view of the bytes and would corrupt any non-ASCII text.
  function _xhs_base64DecodeToUTF8(base64) {
    const raw = _xhs_str(base64);
    if (!raw) return "";
    try {
      if (globalThis.Host && Host.crypto && typeof Host.crypto.base64Decode === "function") {
        return Host.crypto.base64Decode(raw);
      }
    } catch (_) {}
    // Fallback: atob (binary string, 1 char = 1 byte) → manual UTF-8 decode.
    try {
      if (typeof atob !== "function") return "";
      const binary = atob(raw);
      return _xhs_utf8DecodeBinary(binary);
    } catch (e) { return ""; }
  }

  function _xhs_utf8DecodeBinary(binary) {
    let out = "";
    let i = 0;
    const n = binary.length;
    while (i < n) {
      const c = binary.charCodeAt(i);
      if (c < 0x80) {
        out += String.fromCharCode(c);
        i += 1;
      } else if (c < 0xc0) {
        // stray continuation byte — skip
        i += 1;
      } else if (c < 0xe0 && i + 1 < n) {
        const c2 = binary.charCodeAt(i + 1);
        out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
        i += 2;
      } else if (c < 0xf0 && i + 2 < n) {
        const c2 = binary.charCodeAt(i + 1);
        const c3 = binary.charCodeAt(i + 2);
        out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
        i += 3;
      } else if (i + 3 < n) {
        const c2 = binary.charCodeAt(i + 1);
        const c3 = binary.charCodeAt(i + 2);
        const c4 = binary.charCodeAt(i + 3);
        const cp = ((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f);
        const h = 0xd800 | ((cp - 0x10000) >> 10);
        const l = 0xdc00 | ((cp - 0x10000) & 0x3ff);
        out += String.fromCharCode(h) + String.fromCharCode(l);
        i += 4;
      } else {
        out += String.fromCharCode(c);
        i += 1;
      }
    }
    return out;
  }

  // UTF-8 string → base64. No host helper available, so we do it in pure JS.
  // Used for the liveHeartBeat body (may contain a Chinese nickname).
  function _xhs_base64EncodeUTF8(text) {
    const binary = _xhs_utf8EncodeToBinary(_xhs_str(text));
    try {
      if (typeof btoa === "function") return btoa(binary);
    } catch (_) {}
    return _xhs_b64FromBinary(binary);
  }

  function _xhs_utf8EncodeToBinary(str) {
    let out = "";
    for (let i = 0; i < str.length; i++) {
      let cp = str.charCodeAt(i);
      if (cp >= 0xd800 && cp < 0xdc00 && i + 1 < str.length) {
        const lo = str.charCodeAt(i + 1);
        cp = 0x10000 + (((cp & 0x3ff) << 10) | (lo & 0x3ff));
        i += 1;
      }
      if (cp < 0x80) {
        out += String.fromCharCode(cp);
      } else if (cp < 0x800) {
        out += String.fromCharCode(0xc0 | (cp >> 6));
        out += String.fromCharCode(0x80 | (cp & 0x3f));
      } else if (cp < 0x10000) {
        out += String.fromCharCode(0xe0 | (cp >> 12));
        out += String.fromCharCode(0x80 | ((cp >> 6) & 0x3f));
        out += String.fromCharCode(0x80 | (cp & 0x3f));
      } else {
        out += String.fromCharCode(0xf0 | (cp >> 18));
        out += String.fromCharCode(0x80 | ((cp >> 12) & 0x3f));
        out += String.fromCharCode(0x80 | ((cp >> 6) & 0x3f));
        out += String.fromCharCode(0x80 | (cp & 0x3f));
      }
    }
    return out;
  }

  const _XHS_B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function _xhs_b64FromBinary(binary) {
    let out = "";
    let i = 0;
    const n = binary.length;
    while (i < n) {
      const c1 = binary.charCodeAt(i);
      const c2 = i + 1 < n ? binary.charCodeAt(i + 1) : -1;
      const c3 = i + 2 < n ? binary.charCodeAt(i + 2) : -1;
      out += _XHS_B64_CHARS[c1 >> 2];
      out += _XHS_B64_CHARS[((c1 & 0x03) << 4) | (c2 < 0 ? 0 : (c2 >> 4))];
      out += c2 < 0 ? "=" : _XHS_B64_CHARS[((c2 & 0x0f) << 2) | (c3 < 0 ? 0 : (c3 >> 6))];
      out += c3 < 0 ? "=" : _XHS_B64_CHARS[c3 & 0x3f];
      i += 3;
    }
    return out;
  }

  function _xhs_randomHex(bytes) {
    const n = bytes | 0;
    let out = "";
    const hex = "0123456789abcdef";
    for (let i = 0; i < n * 2; i++) out += hex[Math.floor(Math.random() * 16)];
    return out;
  }

  function _xhs_newMsgId() {
    return `${_xhs_randomHex(6)}-${Date.now().toString(16)}`;
  }

  // rwp packet + signal type constants (reverse-engineered from xhs-pc-web bundle)
  const T_SIGNAL = 2;
  const T_DATA = 3;
  const T_SYNC = 4;
  const S_AUTH = 0;
  const S_BIZ_REGISTER = 1;
  const S_JOIN_ROOM = 8;
  const A_NON_ACK = 0;
  const A_ACK_IMMEDIATELY = 1;

  function _xhs_signalPacket(signalType, payload, ackMode) {
    const mid = _xhs_newMsgId();
    return {
      mid,
      packet: {
        v: 1,
        t: T_SIGNAL,
        m: mid,
        b: { d: { a: ackMode === undefined ? A_ACK_IMMEDIATELY : ackMode, s: signalType, b: payload || {} } }
      }
    };
  }

  function _xhs_authPacket(session) {
    return _xhs_signalPacket(S_AUTH, {
      appId: "xhs-pc",
      authInfo: {
        authType: "generic",
        sid: session.sid,
        uid: session.uid,
        domain: "red"
      },
      deviceInfo: {
        deviceId: session.deviceId,
        fingerprint: session.fingerprint,
        platform: "browser",
        os: "web",
        osVersion: "10.15",
        deviceName: "Chrome",
        appVersion: "131.0.0.0",
        userAgent: session.userAgent
      },
      serviceTag: "",
      bizInfos: [{ bizName: "push", serializeType: "json" }],
      roomInfo: [],
      tagInfo: [],
      extInfo: {},
      state: 1
    });
  }

  function _xhs_bizRegisterPacket() {
    return _xhs_signalPacket(S_BIZ_REGISTER, {
      bizInfo: { bizName: "room", serializeType: "json" },
      register: true
    });
  }

  function _xhs_joinRoomPacket(session) {
    return _xhs_signalPacket(S_JOIN_ROOM, {
      info: { bizName: "room", roomId: session.roomId, roomType: "LIVE" }
    });
  }

  function _xhs_heartbeatPacket(session) {
    const inner = {
      roomId: session.roomId,
      roomType: "LIVE",
      command: 1,
      customData: JSON.stringify({
        type: "viewer_heart",
        priority: 0,
        profile: {
          nickname: session.nickname || "",
          avatar: session.avatar || "",
          user_id: session.uid || "",
          role: 0
        },
        source: "web_live",
        desc: ""
      })
    };
    const bodyB64 = _xhs_base64EncodeUTF8(JSON.stringify(inner));
    const mid = _xhs_newMsgId();
    return {
      mid,
      packet: {
        v: 1, t: T_DATA, m: mid,
        b: { d: { a: A_NON_ACK, c: "liveHeartBeat", biz: "room", b: bodyB64, e: {}, s: "rrmp.o.l" } }
      }
    };
  }

  function _xhs_writeText(packet) {
    return { kind: "text", text: JSON.stringify(packet) };
  }

  function _xhs_session(connectionId) {
    const s = __xhs_sessions[_xhs_trim(connectionId)];
    if (!s) _xhs_raise("INVALID_ARGS", "xhs rwp session not found", { connectionId: _xhs_trim(connectionId) });
    return s;
  }

  // ---- SYNC frame decoding (chat text messages only) ----

  function _xhs_extractMessage(item) {
    if (!item || typeof item !== "object") return null;
    const raw = _xhs_str(item.d);
    if (!raw) return null;
    const innerText = _xhs_base64DecodeToUTF8(raw);
    if (!innerText) return null;
    const inner = _xhs_parseJSON(innerText);
    if (!inner || typeof inner !== "object") return null;
    let cd = inner.customData;
    if (typeof cd === "string") {
      const parsed = _xhs_parseJSON(cd);
      if (parsed && typeof parsed === "object") cd = parsed;
    }
    if (!cd || typeof cd !== "object") return null;
    const type = _xhs_str(cd.type);
    // Only surface actual chat text. Filter out audience_join / praise / pk_change /
    // live_banner_resource / letter_refresh etc. so the UI is not flooded.
    if (type !== "text") return null;
    const text = _xhs_trim(cd.content || cd.text || cd.desc);
    if (!text) return null;
    const profile = (cd.profile && typeof cd.profile === "object") ? cd.profile : {};
    const nickname = _xhs_trim(profile.nickname || profile.nick_name || profile.name) || "";
    return { text, nickname, color: 16777215 };
  }

  const driver = {
    async createDanmakuSession(payload) {
      const connectionId = _xhs_trim(payload && payload.connectionId);
      if (!connectionId) _xhs_raise("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
      const args = (payload && payload.args && typeof payload.args === "object") ? payload.args : {};

      const roomId = _xhs_trim(args.roomId || payload.roomId);
      if (!roomId) _xhs_raise("INVALID_ARGS", "roomId is required", { field: "roomId" });
      const sid = _xhs_trim(args.sid);
      if (!sid) _xhs_raise("AUTH_REQUIRED", "rwp sid (a_lt) is required; expected fetched by getDanmaku()", {});
      const uid = _xhs_trim(args.uid);
      if (!uid) _xhs_raise("AUTH_REQUIRED", "rwp uid is required; expected fetched by getDanmaku()", {});
      const deviceId = _xhs_trim(args.deviceId) || _xhs_randomHex(8);
      const fingerprint = _xhs_trim(args.fingerprint) || String(Date.now());
      const userAgent = _xhs_trim(args.userAgent);
      const nickname = _xhs_trim(args.nickname || "");
      const avatar = _xhs_trim(args.avatar || "");
      const heartbeatMs = Math.max(1000, Number(_xhs_trim(args.heartbeatMs)) || __xhs_defaultHeartbeatMs);

      __xhs_sessions[connectionId] = {
        connectionId, roomId, sid, uid, deviceId, fingerprint, userAgent,
        nickname, avatar, heartbeatMs,
        phase: "init",
        authMid: "", bizMid: "", joinMid: "",
        seenBusinessMsgIds: {}
      };

      // Deliver the initial history (up to 5 messages from join_comment_info snapshot)
      // immediately so the UI is not empty before the first WS SYNC frame arrives.
      let history = [];
      const rawHistory = _xhs_trim(args.historyMessagesJSON);
      if (rawHistory) {
        try {
          const parsed = JSON.parse(rawHistory);
          if (Array.isArray(parsed)) {
            for (const m of parsed) {
              const text = _xhs_trim(m && m.text);
              if (!text) continue;
              history.push({
                text,
                nickname: _xhs_trim(m && m.nickname) || "",
                color: Number(m && m.color) || 16777215
              });
            }
          }
        } catch (_) {}
      }

      return history.length ? { ok: true, messages: history } : { ok: true };
    },

    async onDanmakuOpen(payload) {
      const session = _xhs_session(payload && payload.connectionId);
      const { mid, packet } = _xhs_authPacket(session);
      session.phase = "auth_sent";
      session.authMid = mid;
      return { writes: [_xhs_writeText(packet)] };
    },

    async onDanmakuFrame(payload) {
      const session = _xhs_session(payload && payload.connectionId);
      const frameType = _xhs_trim(payload && payload.frameType);
      if (frameType !== "text") return {};
      const pkt = _xhs_parseJSON(payload && payload.text);
      if (!pkt || typeof pkt !== "object") return {};

      const t = Number(pkt.t);
      const mid = _xhs_str(pkt.m);
      const body = (pkt.b && typeof pkt.b === "object") ? pkt.b : {};
      const ack = (body.a && typeof body.a === "object") ? body.a : null;

      // ---- SIGNAL ack routing ----
      if (t === T_SIGNAL && ack) {
        const code = ack.c === undefined ? 0 : Number(ack.c);

        if (mid && mid === session.authMid) {
          if (code !== 0) {
            _xhs_raise("AUTH_REQUIRED", "xhs rwp auth rejected", {
              roomId: session.roomId, code: String(code), msg: _xhs_str(ack.m)
            });
          }
          const { mid: bizMid, packet: bizPkt } = _xhs_bizRegisterPacket();
          session.phase = "biz_sent";
          session.bizMid = bizMid;
          return { writes: [_xhs_writeText(bizPkt)] };
        }

        if (mid && mid === session.bizMid) {
          if (code !== 0) {
            _xhs_raise("INVALID_RESPONSE", "xhs rwp biz_register rejected", {
              roomId: session.roomId, code: String(code), msg: _xhs_str(ack.m)
            });
          }
          const { mid: joinMid, packet: joinPkt } = _xhs_joinRoomPacket(session);
          session.phase = "join_sent";
          session.joinMid = joinMid;
          return { writes: [_xhs_writeText(joinPkt)] };
        }

        if (mid && mid === session.joinMid) {
          if (code !== 0) {
            _xhs_raise("INVALID_RESPONSE", "xhs rwp join_room rejected", {
              roomId: session.roomId, code: String(code), msg: _xhs_str(ack.m)
            });
          }
          session.phase = "streaming";
          const { packet: hbPkt } = _xhs_heartbeatPacket(session);
          return {
            writes: [_xhs_writeText(hbPkt)],
            timer: { mode: "heartbeat", intervalMs: session.heartbeatMs }
          };
        }
        return {};
      }

      // ---- SYNC (server pushes chat + events) ----
      if (t === T_SYNC) {
        const d = (body.d && typeof body.d === "object") ? body.d : {};
        const items = Array.isArray(d.b) ? d.b : [];
        const messages = [];
        for (const item of items) {
          const msgId = item && item.m ? _xhs_str(item.m) : "";
          if (msgId && session.seenBusinessMsgIds[msgId]) continue;
          if (msgId) session.seenBusinessMsgIds[msgId] = true;
          const m = _xhs_extractMessage(item);
          if (m) messages.push(m);
        }
        return messages.length ? { messages } : {};
      }

      return {};
    },

    async onDanmakuTick(payload) {
      const session = _xhs_session(payload && payload.connectionId);
      const reason = _xhs_trim(payload && payload.reason);
      if (reason !== "heartbeat") return {};
      if (session.phase !== "streaming") return {};
      const { packet } = _xhs_heartbeatPacket(session);
      return {
        writes: [_xhs_writeText(packet)],
        timer: { mode: "heartbeat", intervalMs: session.heartbeatMs }
      };
    },

    async destroyDanmakuSession(payload) {
      const connectionId = _xhs_trim(payload && payload.connectionId);
      if (connectionId) delete __xhs_sessions[connectionId];
      return { ok: true };
    }
  };

  globalThis.__xhsDanmakuDriver = driver;
})();
