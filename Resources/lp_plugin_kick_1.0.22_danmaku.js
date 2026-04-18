(function () {
const __kick_danmakuSessions = {};
const __kick_sharedGlobalKey = "__lp_plugin_kick_1_0_22_shared";
const __kick_defaultHeartbeatMs = 120000;
const __kick_pusherAppKey = "32cbd69e4b950bf97679";
const __kick_pusherCluster = "us2";
const __kick_pusherVersion = "8.4.0";

function _kick_shared() {
  const shared = globalThis[__kick_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"kick shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _kick_throw(code, message, context) {
  const shared = globalThis[__kick_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _kick_str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function _kick_parseJSON(text, fallback) {
  try {
    return JSON.parse(_kick_str(text));
  } catch (_) {
    return fallback;
  }
}

function _kick_parsePayload(payload) {
  return payload && typeof payload === "object" ? Object.assign({}, payload) : { roomId: payload };
}

function _kick_hexColorToInt(value) {
  const normalized = _kick_str(value).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return 0xffffff;
  return parseInt(normalized.slice(1), 16) >>> 0;
}

function _kick_textWrite(text) {
  return {
    kind: "text",
    text: _kick_str(text)
  };
}

function _kick_timer(intervalMs) {
  return {
    mode: "heartbeat",
    intervalMs: Math.max(10000, Number(intervalMs) || __kick_defaultHeartbeatMs)
  };
}

function _kick_timerOff() {
  return { mode: "off" };
}

function _kick_session(connectionId) {
  const key = _kick_str(connectionId);
  const session = __kick_danmakuSessions[key];
  if (!session) {
    _kick_throw("INVALID_STATE", "danmaku session not found", { connectionId: key });
  }
  return session;
}

function _kick_wsURL() {
  return `wss://ws-${__kick_pusherCluster}.pusher.com/app/${__kick_pusherAppKey}?protocol=7&client=js&version=${encodeURIComponent(__kick_pusherVersion)}&flash=false`;
}

function _kick_subscribePacket(session) {
  return JSON.stringify({
    event: "pusher:subscribe",
    data: {
      auth: "",
      channel: session.channelName
    }
  });
}

function _kick_pingPacket() {
  return JSON.stringify({
    event: "pusher:ping",
    data: {}
  });
}

function _kick_pongPacket() {
  return JSON.stringify({
    event: "pusher:pong",
    data: {}
  });
}

function _kick_parsePusherData(value) {
  if (value && typeof value === "object") return value;
  return _kick_parseJSON(value, null);
}

function _kick_firstText(values) {
  for (const value of values || []) {
    const text = _kick_str(value).trim();
    if (text) return text;
  }
  return "";
}

function _kick_extractMessage(eventData) {
  const sender = eventData && typeof eventData.sender === "object" ? eventData.sender : {};
  const identity = sender && typeof sender.identity === "object" ? sender.identity : {};
  const text = _kick_firstText([
    eventData && eventData.content,
    eventData && eventData.message,
    eventData && eventData.msg,
    eventData && eventData.chat && eventData.chat.content
  ]);
  const nickname = _kick_firstText([
    sender.username,
    sender.slug,
    sender.name,
    eventData && eventData.username,
    eventData && eventData.sender_username
  ]);

  if (!text) return null;
  return {
    nickname: nickname,
    text: text,
    color: _kick_hexColorToInt(identity.color || sender.color || eventData && eventData.color)
  };
}

const __kickDanmakuDriver = {
  async getDanmakuPlan(payload) {
    const shared = _kick_shared();
    const runtimePayload = _kick_parsePayload(payload);
    const slug = typeof shared.parseRoomSlug === "function"
      ? shared.parseRoomSlug(runtimePayload.roomId || runtimePayload.userId || "")
      : _kick_str(runtimePayload.roomId || runtimePayload.userId).trim().toLowerCase();
    if (!slug) {
      _kick_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    }

    const chatroom = await shared.fetchChatroom(slug, runtimePayload);
    const chatroomId = _kick_str(
      chatroom && (
        chatroom.id ||
        chatroom.chatroom_id ||
        chatroom.chatroomId ||
        chatroom.chatroom && chatroom.chatroom.id
      )
    );
    if (!chatroomId) {
      _kick_throw("INVALID_RESPONSE", "kick chatroom id not found", { roomId: slug });
    }

    const wsURL = _kick_wsURL();
    return {
      args: {
        roomId: slug,
        chatroomId: chatroomId,
        channelName: `chatrooms.${chatroomId}.v2`,
        url: wsURL,
        heartbeat_interval_ms: String(__kick_defaultHeartbeatMs)
      },
      headers: {
        Origin: "https://kick.com",
        Referer: `https://kick.com/${encodeURIComponent(slug)}`,
        "User-Agent": _kick_str(shared.userAgent || "")
      },
      transport: {
        kind: "websocket",
        url: wsURL,
        frameType: "text"
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "kick_pusher_text",
        protocolVersion: "1"
      }
    };
  },

  async createDanmakuSession(payload) {
    const connectionId = _kick_str(payload && payload.connectionId);
    if (!connectionId) {
      _kick_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    }
    const args = payload && payload.args ? payload.args : {};
    const roomId = _kick_str(args.roomId);
    const chatroomId = _kick_str(args.chatroomId);
    if (!roomId) _kick_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    if (!chatroomId) _kick_throw("INVALID_ARGS", "chatroomId is required", { field: "chatroomId" });

    __kick_danmakuSessions[connectionId] = {
      connectionId: connectionId,
      roomId: roomId,
      chatroomId: chatroomId,
      channelName: _kick_str(args.channelName || `chatrooms.${chatroomId}.v2`),
      heartbeatIntervalMs: Math.max(10000, Number(args.heartbeat_interval_ms) || __kick_defaultHeartbeatMs)
    };

    return {
      ok: true,
      timer: _kick_timerOff()
    };
  },

  async onDanmakuOpen(payload) {
    _kick_session(payload && payload.connectionId);
    return {
      writes: [],
      timer: _kick_timerOff()
    };
  },

  async onDanmakuFrame(payload) {
    const session = _kick_session(payload && payload.connectionId);
    const text = _kick_str(payload && payload.text);
    const frame = _kick_parseJSON(text, null);
    if (!frame || typeof frame !== "object") {
      return {
        messages: [],
        writes: [],
        timer: _kick_timer(session.heartbeatIntervalMs)
      };
    }

    const eventName = _kick_str(frame.event);
    if (eventName === "pusher:connection_established") {
      const data = _kick_parsePusherData(frame.data);
      const activityTimeoutMs = Number(data && data.activity_timeout) > 0
        ? Math.max(10000, Number(data.activity_timeout) * 1000)
        : session.heartbeatIntervalMs;
      session.heartbeatIntervalMs = activityTimeoutMs;
      session.socketId = _kick_str(data && data.socket_id);
      return {
        messages: [],
        writes: [_kick_textWrite(_kick_subscribePacket(session))],
        timer: _kick_timer(session.heartbeatIntervalMs)
      };
    }

    if (eventName === "pusher:ping") {
      return {
        messages: [],
        writes: [_kick_textWrite(_kick_pongPacket())],
        timer: _kick_timer(session.heartbeatIntervalMs)
      };
    }

    if (eventName.indexOf("ChatMessageEvent") >= 0) {
      const data = _kick_parsePusherData(frame.data) || {};
      const message = _kick_extractMessage(data);
      return {
        messages: message ? [message] : [],
        writes: [],
        timer: _kick_timer(session.heartbeatIntervalMs)
      };
    }

    return {
      messages: [],
      writes: [],
      timer: _kick_timer(session.heartbeatIntervalMs)
    };
  },

  async onDanmakuTick(payload) {
    const session = _kick_session(payload && payload.connectionId);
    return {
      writes: [_kick_textWrite(_kick_pingPacket())],
      timer: _kick_timer(session.heartbeatIntervalMs)
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _kick_str(payload && payload.connectionId);
    if (connectionId) delete __kick_danmakuSessions[connectionId];
    return { ok: true };
  }
};

globalThis.__kickDanmakuDriver = __kickDanmakuDriver;
})();
