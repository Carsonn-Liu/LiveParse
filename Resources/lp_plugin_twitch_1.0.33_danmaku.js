(function () {
const __tw_danmakuSessions = {};
const __tw_sharedGlobalKey = "__lp_plugin_twitch_1_0_33_shared";
const __tw_defaultWebSocketURL = "wss://irc-ws.chat.twitch.tv:443";
const __tw_capability = "CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership";
const __tw_connectionUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

function _tw_shared() {
  const shared = globalThis[__tw_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"twitch shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _tw_throw(code, message, context) {
  const shared = globalThis[__tw_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _tw_str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function _tw_parseLogin(input) {
  const shared = _tw_shared();
  if (shared && typeof shared.parseLogin === "function") {
    return shared.parseLogin(input);
  }
  return _tw_str(input).trim().replace(/^@+/, "").toLowerCase();
}

function _tw_int(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

function _tw_textWrite(text) {
  return {
    kind: "text",
    text: _tw_str(text)
  };
}

function _tw_timerOff() {
  return { mode: "off" };
}

function _tw_session(connectionId) {
  const key = _tw_str(connectionId);
  const session = __tw_danmakuSessions[key];
  if (!session) {
    _tw_throw("INVALID_STATE", "danmaku session not found", { connectionId: key });
  }
  return session;
}

function _tw_tagMap(raw) {
  const out = {};
  const input = _tw_str(raw);
  if (!input) return out;
  const parts = input.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx)] = _tw_unescapeTag(part.slice(idx + 1));
  }
  return out;
}

function _tw_unescapeTag(value) {
  return _tw_str(value)
    .replace(/\\s/g, " ")
    .replace(/\\:/g, ";")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");
}

function _tw_parseColor(value) {
  const raw = _tw_str(value).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(raw)) return 0xffffff;
  return parseInt(raw.slice(1), 16) >>> 0;
}

function _tw_splitPrefix(prefix) {
  const source = _tw_str(prefix);
  const bang = source.indexOf("!");
  if (bang >= 0) {
    return {
      nick: source.slice(0, bang),
      host: source.slice(bang + 1)
    };
  }
  return { nick: source, host: "" };
}

function _tw_parseLine(line, messages, writes) {
  const raw = _tw_str(line).replace(/\r$/, "");
  if (!raw) return;

  if (raw.startsWith("PING ")) {
    writes.push(_tw_textWrite(raw.replace(/^PING\s+/, "PONG ") + "\r\n"));
    return;
  }

  let rest = raw;
  let tags = {};
  let prefix = "";

  if (rest.startsWith("@")) {
    const spaceIdx = rest.indexOf(" ");
    if (spaceIdx < 0) return;
    tags = _tw_tagMap(rest.slice(1, spaceIdx));
    rest = rest.slice(spaceIdx + 1);
  }

  if (rest.startsWith(":")) {
    const spaceIdx = rest.indexOf(" ");
    if (spaceIdx < 0) return;
    prefix = rest.slice(1, spaceIdx);
    rest = rest.slice(spaceIdx + 1);
  }

  const trailingIdx = rest.indexOf(" :");
  const middle = trailingIdx >= 0 ? rest.slice(0, trailingIdx) : rest;
  const trailing = trailingIdx >= 0 ? rest.slice(trailingIdx + 2) : "";
  const parts = middle.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return;

  const command = parts[0];
  if (command !== "PRIVMSG") return;

  const prefixInfo = _tw_splitPrefix(prefix);
  const nickname = _tw_str(tags["display-name"] || prefixInfo.nick);
  const text = _tw_str(trailing);
  if (!nickname || !text) return;

  messages.push({
    nickname: nickname,
    text: text,
    color: _tw_parseColor(tags.color)
  });
}

const __twDanmakuDriver = {
  async getDanmakuPlan(login) {
    const normalizedLogin = _tw_parseLogin(login);
    if (!normalizedLogin) {
      _tw_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    }
    const anonId = Math.floor(Math.random() * 900000 + 100000);
    const nickname = `justinfan${anonId}`;
    return {
      args: {
        roomId: normalizedLogin,
        channel: `#${normalizedLogin}`,
        url: __tw_defaultWebSocketURL,
        nickname: nickname,
        capability: __tw_capability
      },
      headers: {
        "User-Agent": __tw_connectionUserAgent
      },
      transport: {
        kind: "websocket",
        url: __tw_defaultWebSocketURL,
        frameType: "text"
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "twitch_irc_text",
        protocolVersion: "1"
      }
    };
  },

  async createDanmakuSession(payload) {
    const connectionId = _tw_str(payload && payload.connectionId);
    if (!connectionId) _tw_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    const args = payload && payload.args ? payload.args : {};
    const roomId = _tw_parseLogin(args.roomId);
    const channel = _tw_str(args.channel || (roomId ? `#${roomId}` : ""));
    const nickname = _tw_str(args.nickname);
    if (!roomId) _tw_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    if (!nickname) _tw_throw("INVALID_ARGS", "nickname is required", { field: "nickname" });

    __tw_danmakuSessions[connectionId] = {
      connectionId: connectionId,
      roomId: roomId,
      channel: channel,
      nickname: nickname,
      capability: _tw_str(args.capability || __tw_capability)
    };

    return {
      ok: true,
      timer: _tw_timerOff()
    };
  },

  async onDanmakuOpen(payload) {
    const session = _tw_session(payload && payload.connectionId);
    return {
      writes: [
        _tw_textWrite(session.capability + "\r\n"),
        _tw_textWrite("PASS SCHMOOPIIE\r\n"),
        _tw_textWrite(`NICK ${session.nickname}\r\n`),
        _tw_textWrite(`JOIN ${session.channel}\r\n`)
      ],
      timer: _tw_timerOff()
    };
  },

  async onDanmakuFrame(payload) {
    _tw_session(payload && payload.connectionId);
    const text = _tw_str(payload && payload.text);
    const messages = [];
    const writes = [];
    for (const line of text.split(/\n/)) {
      _tw_parseLine(line, messages, writes);
    }
    return {
      writes: writes,
      messages: messages,
      timer: _tw_timerOff()
    };
  },

  async onDanmakuTick(payload) {
    _tw_session(payload && payload.connectionId);
    return {
      writes: [],
      timer: _tw_timerOff()
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _tw_str(payload && payload.connectionId);
    if (connectionId) delete __tw_danmakuSessions[connectionId];
    return {
      ok: true
    };
  }
};

globalThis.__twDanmakuDriver = __twDanmakuDriver;
})();
