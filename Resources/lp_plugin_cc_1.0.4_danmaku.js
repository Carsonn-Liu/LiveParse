(function () {
const __cc_danmakuSessions = {};
const __cc_sharedGlobalKey = "__lp_plugin_cc_1_0_4_shared";
const __cc_defaultWebSocketURL = "wss://wslink.cc.163.com/conn";
const __cc_defaultHeartbeatIntervalMs = 60000;
const __cc_bbCodeTags = [
  "emts", "wmp", "pic", "giftpic", "flash", "link", "roomlink",
  "grouplink", "taillamp", "img", "comic", "font", "userCard", "jumplink"
];

function _cc_shared() {
  const shared = globalThis[__cc_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"cc shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _cc_throw(code, message, context) {
  const shared = globalThis[__cc_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _cc_str(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function _cc_num(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function _cc_safeJsonParse(text) {
  try {
    return JSON.parse(_cc_str(text));
  } catch (e) {
    return null;
  }
}

function _cc_sockjsText(value) {
  return {
    kind: "text",
    text: _cc_str(value)
  };
}

function _cc_sockjsFrame(message) {
  const json = JSON.stringify(message || {});
  return JSON.stringify([json]);
}

function _cc_sendJSON(message) {
  return _cc_sockjsText(_cc_sockjsFrame(message));
}

function _cc_filterBBCode(text) {
  let result = _cc_str(text);
  for (const tag of __cc_bbCodeTags) {
    const pattern = new RegExp(`\\[${tag}\\].*?\\[/${tag}\\]`, "gis");
    result = result.replace(pattern, "");
  }
  return result.trim();
}

function _cc_collectMessagesFromPayload(payload, out) {
  if (!payload || typeof payload !== "object") return;
  if (_cc_str(payload.cmd) !== "pub") return;
  const data = payload.data;
  const list = data && Array.isArray(data.list) ? data.list : [];
  for (const item of list) {
    const text = _cc_filterBBCode(item && item.msg_body);
    if (!text) continue;
    out.push({
      text,
      nickname: _cc_str(item && item.nick),
      color: 16777215
    });
  }
}

function _cc_parseSockJSArrayText(text, out) {
  const items = _cc_safeJsonParse(text);
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const payload = _cc_safeJsonParse(item);
    if (payload) _cc_collectMessagesFromPayload(payload, out);
  }
}

function _cc_session(connectionId) {
  const key = _cc_str(connectionId);
  const session = __cc_danmakuSessions[key];
  if (!session) {
    _cc_throw("INVALID_STATE", "danmaku session not found", { connectionId: key });
  }
  return session;
}

function _cc_subscribeWrite(session) {
  return _cc_sendJSON({
    cmd: "sub",
    data: {
      groups: [session.subscriptionGroup]
    }
  });
}

function _cc_heartbeatWrite() {
  return _cc_sendJSON({ cmd: "heartbeat" });
}

function _cc_timer(intervalMs) {
  return {
    mode: "polling",
    intervalMs: intervalMs
  };
}

function _cc_pad3(value) {
  const n = Math.max(0, Math.min(999, Math.floor(_cc_num(value, 0))));
  return String(n).padStart(3, "0");
}

function _cc_randomSessionId() {
  return Math.random().toString(16).slice(2, 10).padEnd(8, "0");
}

function _cc_splitSocketURL(rawURL) {
  const source = _cc_str(rawURL) || __cc_defaultWebSocketURL;
  const match = source.match(/^(wss?):\/\/([^\/?#]+)(\/[^?#]*)?(\?[^#]*)?$/i);
  if (match && match[2]) {
    return {
      authority: match[2],
      path: match[3] || "/conn",
      query: match[4] || ""
    };
  }
  return {
    authority: "wslink.cc.163.com",
    path: "/conn",
    query: ""
  };
}

function _cc_buildSockJSURL(rawURL) {
  const parts = _cc_splitSocketURL(rawURL);
  if (/\/websocket$/i.test(parts.path || "")) {
    return `wss://${parts.authority}${parts.path}${parts.query}`;
  }

  let basePath = parts.path || "";
  if (!basePath) basePath = "/conn";
  basePath = basePath.replace(/\/+$/, "");
  if (!basePath) basePath = "/conn";

  return `wss://${parts.authority}${basePath}/${_cc_pad3(Math.random() * 1000)}/${_cc_randomSessionId()}/websocket${parts.query}`;
}

const __ccDanmakuDriver = {
  async getDanmakuPlan(roomId) {
    const resp = await Host.http.request({
      url: `https://api.cc.163.com/v1/activitylives/anchor/lives?anchor_ccid=${encodeURIComponent(_cc_str(roomId))}`,
      method: "GET",
      headers: {
        "User-Agent": _cc_str(_cc_shared().userAgent)
      },
      timeout: 20
    });
    const obj = _cc_safeJsonParse(resp && resp.bodyText) || {};
    const data = obj && obj.data ? obj.data : {};
    const channelData = data[_cc_str(roomId)] || Object.values(data)[0] || null;
    if (!channelData || !channelData.channel_id || !channelData.room_id) {
      _cc_throw("NOT_FOUND", "channel_id not found", { roomId: _cc_str(roomId) });
    }

    const channelId = _cc_str(channelData.channel_id);
    const heartbeatIntervalMs = _cc_num(channelData.heartbeat_interval || __cc_defaultHeartbeatIntervalMs, __cc_defaultHeartbeatIntervalMs);
    const sockJSURL = _cc_buildSockJSURL(__cc_defaultWebSocketURL);

    return {
      args: {
        url: __cc_defaultWebSocketURL,
        ws_url: sockJSURL,
        channel_id: channelId,
        subscription_group: `roomchat_${channelId}`,
        heartbeat_interval: _cc_str(heartbeatIntervalMs)
      },
      headers: {
        "User-Agent": _cc_str(_cc_shared().userAgent)
      },
      transport: {
        kind: "websocket",
        url: sockJSURL,
        frameType: "text"
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "cc_sockjs_json",
        protocolVersion: "1"
      }
    };
  },

  async createDanmakuSession(payload) {
    const connectionId = _cc_str(payload && payload.connectionId);
    if (!connectionId) _cc_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    const args = payload && payload.args ? payload.args : {};
    const subscriptionGroup = _cc_str(args.subscription_group);
    if (!subscriptionGroup) _cc_throw("INVALID_ARGS", "subscription_group is required", { field: "subscription_group" });

    __cc_danmakuSessions[connectionId] = {
      connectionId,
      subscriptionGroup,
      heartbeatIntervalMs: Math.max(_cc_num(args.heartbeat_interval, __cc_defaultHeartbeatIntervalMs), 1000),
      opened: false
    };

    return {
      ok: true,
      timer: _cc_timer(__cc_danmakuSessions[connectionId].heartbeatIntervalMs)
    };
  },

  async onDanmakuOpen(payload) {
    const session = _cc_session(payload && payload.connectionId);
    return {
      writes: session.opened ? [_cc_subscribeWrite(session)] : [],
      timer: _cc_timer(session.heartbeatIntervalMs)
    };
  },

  async onDanmakuFrame(payload) {
    const session = _cc_session(payload && payload.connectionId);
    const text = _cc_str(payload && payload.text);
    if (!text) {
      return {
        writes: [],
        messages: [],
        timer: _cc_timer(session.heartbeatIntervalMs)
      };
    }

    const frameType = text.charAt(0);
    const messages = [];
    const writes = [];

    if (frameType === "o") {
      if (!session.opened) {
        session.opened = true;
        writes.push(_cc_subscribeWrite(session));
      }
    } else if (frameType === "h") {
      // SockJS heartbeat frame, no-op.
    } else if (frameType === "a") {
      _cc_parseSockJSArrayText(text.slice(1), messages);
    } else if (frameType === "c") {
      // Close frame. Let the host reconnect using its existing lifecycle.
    } else {
      const payloadObject = _cc_safeJsonParse(text);
      if (payloadObject) _cc_collectMessagesFromPayload(payloadObject, messages);
    }

    return {
      writes,
      messages,
      timer: _cc_timer(session.heartbeatIntervalMs)
    };
  },

  async onDanmakuTick(payload) {
    const session = _cc_session(payload && payload.connectionId);
    return {
      writes: session.opened ? [_cc_heartbeatWrite()] : [],
      timer: _cc_timer(session.heartbeatIntervalMs)
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _cc_str(payload && payload.connectionId);
    if (connectionId) delete __cc_danmakuSessions[connectionId];
    return {
      ok: true
    };
  }
};

globalThis.__ccDanmakuDriver = __ccDanmakuDriver;
})();
