(function () {
const __cz_danmakuSessions = {};
const __cz_sharedGlobalKey = "__lp_plugin_chzzk_1_0_3_shared";
const __cz_chatWebSocketURL = "wss://kr-ss1.chat.naver.com/chat";
const __cz_protocolVersion = "3";
const __cz_serviceId = "game";
const __cz_defaultDeviceType = 2001;
const __cz_recentMessageCount = 50;

function _cz_shared() {
  const shared = globalThis[__cz_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"chzzk shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _cz_throw(code, message, context) {
  const shared = globalThis[__cz_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _cz_str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function _cz_parseJSON(text, fallback) {
  try {
    return JSON.parse(_cz_str(text));
  } catch (_) {
    return fallback;
  }
}

function _cz_payloadObject(payload) {
  return payload && typeof payload === "object" ? Object.assign({}, payload) : { roomId: payload };
}

function _cz_textWrite(text) {
  return {
    kind: "text",
    text: _cz_str(text)
  };
}

function _cz_timerOff() {
  return { mode: "off" };
}

function _cz_session(connectionId) {
  const key = _cz_str(connectionId);
  const session = __cz_danmakuSessions[key];
  if (!session) {
    _cz_throw("INVALID_STATE", "danmaku session not found", { connectionId: key });
  }
  return session;
}

function _cz_nextTid(session) {
  session.nextTid = Number(session.nextTid) > 0 ? Number(session.nextTid) + 1 : 1;
  return session.nextTid;
}

function _cz_hexColorToInt(value) {
  const normalized = _cz_str(value).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return 0xffffff;
  return parseInt(normalized.slice(1), 16) >>> 0;
}

function _cz_jsonOrSelf(value, fallback) {
  if (value && typeof value === "object") return value;
  return _cz_parseJSON(value, fallback === undefined ? null : fallback);
}

function _cz_connectPacket(session) {
  return JSON.stringify({
    ver: __cz_protocolVersion,
    cmd: 100,
    svcid: __cz_serviceId,
    cid: session.chatChannelId,
    tid: _cz_nextTid(session),
    bdy: {
      uid: null,
      devType: __cz_defaultDeviceType,
      devName: session.userAgent,
      accTkn: session.accessToken,
      auth: session.auth
    }
  });
}

function _cz_recentChatPacket(session, count) {
  return JSON.stringify({
    ver: __cz_protocolVersion,
    cmd: 5101,
    svcid: __cz_serviceId,
    cid: session.chatChannelId,
    sid: session.sid,
    tid: _cz_nextTid(session),
    bdy: {
      recentMessageCount: Math.max(1, Number(count) || __cz_recentMessageCount)
    }
  });
}

function _cz_pongPacket() {
  return JSON.stringify({
    ver: __cz_protocolVersion,
    cmd: 10000
  });
}

function _cz_messageItemsFromBody(body) {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body.messageList)) return body.messageList;
  if (Array.isArray(body.messages)) return body.messages;
  if (Array.isArray(body.chatList)) return body.chatList;
  if (Array.isArray(body.list)) return body.list;
  return [];
}

function _cz_messageFromItem(item) {
  const profile = _cz_jsonOrSelf(item && item.profile, {});
  const text = _cz_str(
    item && (
      item.message ||
      item.msg ||
      item.content ||
      item.msgContent
    )
  ).trim();
  if (!text) return null;

  return {
    nickname: _cz_str(
      item && item.nickname ||
      profile && profile.nickname ||
      item && item.userName
    ),
    text: text,
    color: _cz_hexColorToInt(profile && profile.title && profile.title.color)
  };
}

function _cz_collectMessages(packet) {
  const body = packet && packet.bdy ? packet.bdy : null;
  const items = _cz_messageItemsFromBody(body);
  const messages = [];
  for (const item of items) {
    const message = _cz_messageFromItem(item);
    if (message) messages.push(message);
  }
  return messages;
}

const __czDanmakuDriver = {
  async getDanmakuPlan(payload) {
    const shared = _cz_shared();
    const runtimePayload = _cz_payloadObject(payload);
    const roomId = _cz_str(runtimePayload.roomId || runtimePayload.userId).trim();
    if (!roomId) {
      _cz_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    }

    const liveDetail = await shared.fetchLiveDetail(roomId, runtimePayload);
    const status = _cz_str(liveDetail && liveDetail.status).toUpperCase();
    if (status && status !== "OPEN" && status !== "PLAYABLE" && status !== "LIVE") {
      _cz_throw("NOT_LIVE", "chzzk room is not live", { roomId: roomId, status: status });
    }

    const chatChannelId = _cz_str(
      liveDetail && (
        liveDetail.chatChannelId ||
        liveDetail.chat && liveDetail.chat.channelId
      )
    );
    if (!chatChannelId) {
      _cz_throw("INVALID_RESPONSE", "chzzk chatChannelId not found", { roomId: roomId });
    }

    const accessToken = await shared.fetchChatAccessToken(chatChannelId, runtimePayload);
    const token = _cz_str(accessToken && accessToken.accessToken);
    if (!token) {
      _cz_throw("AUTH_REQUIRED", "chzzk accessToken not found", { roomId: roomId, chatChannelId: chatChannelId });
    }

    return {
      args: {
        roomId: roomId,
        chatChannelId: chatChannelId,
        accessToken: token,
        extraToken: _cz_str(accessToken && accessToken.extraToken),
        auth: "READ",
        url: __cz_chatWebSocketURL
      },
      headers: {
        Origin: "https://chzzk.naver.com",
        Referer: `https://chzzk.naver.com/live/${encodeURIComponent(roomId)}`,
        "User-Agent": _cz_str(shared.userAgent || "")
      },
      transport: {
        kind: "websocket",
        url: __cz_chatWebSocketURL,
        frameType: "text"
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "chzzk_chat_text",
        protocolVersion: "1"
      }
    };
  },

  async createDanmakuSession(payload) {
    const shared = _cz_shared();
    const connectionId = _cz_str(payload && payload.connectionId);
    if (!connectionId) {
      _cz_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    }
    const args = payload && payload.args ? payload.args : {};
    const chatChannelId = _cz_str(args.chatChannelId);
    const accessToken = _cz_str(args.accessToken);
    if (!chatChannelId) _cz_throw("INVALID_ARGS", "chatChannelId is required", { field: "chatChannelId" });
    if (!accessToken) _cz_throw("INVALID_ARGS", "accessToken is required", { field: "accessToken" });

    __cz_danmakuSessions[connectionId] = {
      connectionId: connectionId,
      roomId: _cz_str(args.roomId),
      chatChannelId: chatChannelId,
      accessToken: accessToken,
      extraToken: _cz_str(args.extraToken),
      auth: _cz_str(args.auth || "READ"),
      sid: "",
      nextTid: 0,
      userAgent: _cz_str(shared.userAgent || "")
    };

    return {
      ok: true,
      timer: _cz_timerOff()
    };
  },

  async onDanmakuOpen(payload) {
    const session = _cz_session(payload && payload.connectionId);
    return {
      writes: [_cz_textWrite(_cz_connectPacket(session))],
      timer: _cz_timerOff()
    };
  },

  async onDanmakuFrame(payload) {
    const session = _cz_session(payload && payload.connectionId);
    const frame = _cz_parseJSON(payload && payload.text, null);
    if (!frame || typeof frame !== "object") {
      return {
        messages: [],
        writes: [],
        timer: _cz_timerOff()
      };
    }

    const cmd = Number(frame.cmd);
    if (cmd === 10100) {
      const retCode = Number(frame.retCode);
      if (retCode !== 0) {
        _cz_throw("AUTH_FAILED", _cz_str(frame.retMsg || "chzzk chat connect failed"), {
          roomId: session.roomId,
          chatChannelId: session.chatChannelId,
          retCode: retCode
        });
      }
      session.sid = _cz_str(frame && frame.bdy && frame.bdy.sid);
      return {
        messages: [],
        writes: session.sid ? [_cz_textWrite(_cz_recentChatPacket(session, __cz_recentMessageCount))] : [],
        timer: _cz_timerOff()
      };
    }

    if (cmd === 0) {
      return {
        messages: [],
        writes: [_cz_textWrite(_cz_pongPacket())],
        timer: _cz_timerOff()
      };
    }

    if (cmd === 15101 || cmd === 93101) {
      return {
        messages: _cz_collectMessages(frame),
        writes: [],
        timer: _cz_timerOff()
      };
    }

    return {
      messages: [],
      writes: [],
      timer: _cz_timerOff()
    };
  },

  async onDanmakuTick(payload) {
    _cz_session(payload && payload.connectionId);
    return {
      writes: [],
      timer: _cz_timerOff()
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _cz_str(payload && payload.connectionId);
    if (connectionId) delete __cz_danmakuSessions[connectionId];
    return { ok: true };
  }
};

globalThis.__czDanmakuDriver = __czDanmakuDriver;
})();
