(function () {
const __panda_danmakuSessions = {};
const __panda_sharedGlobalKey = "__lp_plugin_panda_1_0_3_shared";

function _panda_shared() {
  const shared = globalThis[__panda_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"panda shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _panda_throw(code, message, context) {
  const shared = globalThis[__panda_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _panda_str(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function _panda_num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function _panda_jsonLine(value) {
  return `${JSON.stringify(value)}\n`;
}

function _panda_textWrite(value) {
  return {
    kind: "text",
    text: _panda_jsonLine(value)
  };
}

function _panda_safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function _panda_base64UrlToText(value) {
  if (typeof atob !== "function") return "";
  const normalized = _panda_str(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const raw = atob(padded);
    const bytes = [];
    for (let i = 0; i < raw.length; i += 1) {
      bytes.push(`%${(`00${raw.charCodeAt(i).toString(16)}`).slice(-2)}`);
    }
    return decodeURIComponent(bytes.join(""));
  } catch (e) {
    return "";
  }
}

function _panda_decodeJwtPayload(token) {
  const parts = _panda_str(token).split(".");
  if (parts.length < 2) return null;
  return _panda_safeJsonParse(_panda_base64UrlToText(parts[1]));
}

function _panda_jwtChannel(token) {
  const payload = _panda_decodeJwtPayload(token);
  return _panda_str(payload && payload.info && payload.info.channel);
}

function _panda_jwtExpiresAt(token) {
  const payload = _panda_decodeJwtPayload(token);
  return _panda_num(payload && payload.exp, 0);
}

function _panda_getByKeys(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function _panda_messageFromObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  const text = _panda_getByKeys(obj, [
    "text",
    "message",
    "msg",
    "content",
    "comment",
    "chat",
    "chatMsg",
    "chatMessage",
    "body"
  ]);
  if (!text) return null;

  let nickname = _panda_getByKeys(obj, [
    "nickname",
    "nick",
    "userNick",
    "userName",
    "name",
    "senderName",
    "authorName",
    "fromNick"
  ]);
  const user = obj.user || obj.member || obj.sender || obj.author || obj.from;
  if (!nickname && user && typeof user === "object") {
    nickname = _panda_getByKeys(user, ["nickname", "nick", "userNick", "userName", "name"]);
  }

  return {
    text: _panda_str(text),
    nickname: _panda_str(nickname),
    color: 16777215
  };
}

function _panda_collectDanmakuMessages(value, out, depth) {
  if (!value || typeof value !== "object" || depth > 8) return;

  const message = _panda_messageFromObject(value);
  if (message) {
    out.push(message);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      _panda_collectDanmakuMessages(item, out, depth + 1);
    }
    return;
  }

  for (const key of ["data", "message", "payload", "pub", "publication", "items", "list", "chat"]) {
    if (value[key]) _panda_collectDanmakuMessages(value[key], out, depth + 1);
  }
}

function _panda_parseCentrifugeMessages(frame) {
  const messages = [];
  const lines = _panda_str(frame).split(/\n+/).map(function (line) {
    return line.trim();
  }).filter(Boolean);

  for (const line of lines) {
    const obj = _panda_safeJsonParse(line);
    if (!obj) continue;
    if (obj.push) _panda_collectDanmakuMessages(obj.push, messages, 0);
    if (obj.result && !obj.id) _panda_collectDanmakuMessages(obj.result, messages, 0);
    if (obj.pub || obj.publication || obj.data) _panda_collectDanmakuMessages(obj, messages, 0);
  }

  return messages;
}

function _panda_danmakuSession(connectionId) {
  const session = __panda_danmakuSessions[_panda_str(connectionId)];
  if (!session) _panda_throw("INVALID_STATE", "danmaku session not found", { connectionId: _panda_str(connectionId) });
  return session;
}

const __pandaDanmakuDriver = {
  async getDanmakuPlan(roomId, userId, authMode) {
    const shared = _panda_shared();
    const requestAuthMode = authMode || "platform_cookie";
    const member = await shared.fetchMember(roomId || userId, requestAuthMode);
    const info = member && member.bjInfo ? member.bjInfo : {};
    const idx = _panda_str(userId || info.idx || roomId);
    const resolvedRoomId = _panda_str(info.id || roomId || userId);
    const play = await shared.fetchLivePlay(idx, resolvedRoomId, requestAuthMode);
    if (!play || play.result === false) {
      _panda_throw("UPSTREAM", _panda_str(play && play.message) || "play api failed", { roomId: _panda_str(roomId), userId: idx });
    }

    return {
      args: {
        roomId: resolvedRoomId,
        channel: _panda_str(_panda_jwtChannel(play.token) || play.channel || idx),
        token: _panda_str(play.token || ""),
        tokenExpiresAt: _panda_str(_panda_jwtExpiresAt(play.token) || ""),
        chatServerUrl: _panda_str(play.chatServer && play.chatServer.url),
        chatServerToken: _panda_str(play.chatServer && play.chatServer.token),
        roomInfo: _panda_str(play.roomInfo || "")
      },
      headers: {
        "User-Agent": _panda_str(shared.defaultUA),
        "Origin": _panda_str(shared.webBase),
        "Referer": `${_panda_str(shared.webBase)}/play/${encodeURIComponent(resolvedRoomId)}`
      },
      transport: {
        kind: "websocket",
        url: _panda_str(shared.chatSocketUrl),
        frameType: "text"
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "panda_centrifuge_json",
        protocolVersion: "1"
      }
    };
  },

  async createDanmakuSession(payload) {
    const connectionId = _panda_str(payload && payload.connectionId ? payload.connectionId : "");
    if (!connectionId) _panda_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    const args = payload && payload.args ? payload.args : {};
    const token = _panda_str(args.token);
    const channel = _panda_str(args.channel || _panda_jwtChannel(token));
    if (!token || !channel) {
      _panda_throw("INVALID_ARGS", "danmaku token or channel is empty", {
        hasToken: token ? "1" : "0",
        channel
      });
    }

    __panda_danmakuSessions[connectionId] = {
      connectionId,
      token,
      channel,
      nextId: 1,
      connectId: 0,
      subscribeId: 0,
      connected: false,
      subscribed: false
    };

    return {
      ok: true,
      timer: {
        mode: "off"
      }
    };
  },

  async onDanmakuOpen(payload) {
    const session = _panda_danmakuSession(payload && payload.connectionId);
    const id = session.nextId;
    session.nextId += 1;
    session.connectId = id;

    return {
      writes: [_panda_textWrite({
        params: {
          token: session.token,
          name: "js"
        },
        method: 0,
        id
      })],
      timer: {
        mode: "off"
      }
    };
  },

  async onDanmakuFrame(payload) {
    const session = _panda_danmakuSession(payload && payload.connectionId);
    const text = _panda_str(payload && payload.text ? payload.text : "");
    const writes = [];
    const messages = [];
    const lines = text.split(/\n+/).map(function (line) {
      return line.trim();
    }).filter(Boolean);

    for (const line of lines) {
      const obj = _panda_safeJsonParse(line);
      if (!obj) continue;

      if (obj.id === session.connectId && obj.result) {
        session.connected = true;
        if (!session.subscribeId) {
          const id = session.nextId;
          session.nextId += 1;
          session.subscribeId = id;
          writes.push(_panda_textWrite({
            method: 1,
            params: {
              channel: session.channel
            },
            id
          }));
        }
      }

      if (obj.id === session.subscribeId && obj.result) {
        session.subscribed = true;
      }
    }

    const parsedMessages = _panda_parseCentrifugeMessages(text);
    for (const message of parsedMessages) {
      messages.push(message);
    }

    return {
      messages,
      writes,
      timer: {
        mode: "off"
      }
    };
  },

  async onDanmakuTick(payload) {
    _panda_danmakuSession(payload && payload.connectionId);
    return {
      writes: [],
      timer: {
        mode: "off"
      }
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _panda_str(payload && payload.connectionId ? payload.connectionId : "");
    if (connectionId) delete __panda_danmakuSessions[connectionId];
    return {
      ok: true
    };
  }
};

globalThis.__pandaDanmakuDriver = __pandaDanmakuDriver;
})();
