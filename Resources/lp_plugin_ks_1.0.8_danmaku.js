(function () {
const __ks_danmakuSessions = {};
const __ks_sharedGlobalKey = "__lp_plugin_ks_1_0_8_shared";
const __ks_pollingURL = "https://live.kuaishou.com/live_api/liveroom/recall";
const __ks_pollingIntervalMs = 3000;

function _ks_shared() {
  const shared = globalThis[__ks_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"ks shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _ks_throw(code, message, context) {
  const shared = globalThis[__ks_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _ks_str(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function _ks_safeJsonParse(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch (e) {
    return null;
  }
}

function _ks_firstNonEmpty(value, keys) {
  if (!value || typeof value !== "object") return "";
  for (const key of keys) {
    const current = value[key];
    if (typeof current === "string" && current.trim()) return current.trim();
    if (typeof current === "number" && Number.isFinite(current)) return String(current);
  }
  return "";
}

function _ks_messageFromObject(value) {
  if (!value || typeof value !== "object") return null;
  const text = _ks_firstNonEmpty(value, ["content", "comment", "text", "message", "msg", "caption"]);
  if (!text) return null;

  let nickname = _ks_firstNonEmpty(value, ["userName", "nickname", "nickName", "name", "nick", "authorName"]);
  const user = value.user || value.author || value.sender || value.owner || value.commentUser;
  if (!nickname && user && typeof user === "object") {
    nickname = _ks_firstNonEmpty(user, ["userName", "nickname", "nickName", "name", "nick"]);
  }

  const colorRaw = value.color || value.textColor || value.fontColor;
  const colorNum = Number(colorRaw);
  return {
    text: _ks_str(text),
    nickname: _ks_str(nickname),
    color: Number.isFinite(colorNum) && colorNum >= 0 ? (colorNum >>> 0) : 16777215
  };
}

function _ks_collectMessages(value, out, seen, depth) {
  if (depth > 8 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) _ks_collectMessages(item, out, seen, depth + 1);
    return;
  }
  if (typeof value !== "object") return;

  const message = _ks_messageFromObject(value);
  if (message) {
    const dedupeKey = `${message.nickname}::${message.text}`;
    if (!seen[dedupeKey]) {
      seen[dedupeKey] = true;
      out.push(message);
    }
  }

  for (const key of [
    "commentFeeds",
    "comments",
    "commentList",
    "feeds",
    "messages",
    "list",
    "items",
    "data",
    "payload"
  ]) {
    if (value[key] !== undefined) {
      _ks_collectMessages(value[key], out, seen, depth + 1);
    }
  }
}

function _ks_findCursor(value, keys, depth) {
  if (depth > 8 || value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = _ks_findCursor(item, keys, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";

  const direct = _ks_firstNonEmpty(value, keys);
  if (direct) return direct;

  for (const nestedKey of ["data", "result", "payload", "cursor", "page", "list", "commentFeeds", "comments"]) {
    if (value[nestedKey] !== undefined) {
      const found = _ks_findCursor(value[nestedKey], keys, depth + 1);
      if (found) return found;
    }
  }
  return "";
}

function _ks_makePollHeaders(headers) {
  const base = headers && typeof headers === "object" ? headers : {};
  return {
    "Content-Type": _ks_str(base["Content-Type"] || base["content-type"] || "application/json"),
    "Referer": _ks_str(base.Referer || base.referer || "https://live.kuaishou.com/"),
    "User-Agent": _ks_str(base["User-Agent"] || base["user-agent"] || _ks_shared().userAgent || "")
  };
}

function _ks_makePollPayload(session) {
  return {
    liveStreamId: _ks_str(session.liveStreamId),
    feedTypeCursorMap: {
      "1": 0,
      "2": 0
    }
  };
}

function _ks_makePoll(session) {
  return {
    method: "POST",
    headers: _ks_makePollHeaders(session.headers),
    bodyText: JSON.stringify(_ks_makePollPayload(session))
  };
}

function _ks_base64ToBytes(value) {
  const raw = atob(_ks_str(value));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i) & 0xff;
  return out;
}

function _ks_protoReadVarint(bytes, state) {
  let result = 0;
  let factor = 1;
  let count = 0;
  while (state.offset < bytes.length && count < 10) {
    const byte = bytes[state.offset++];
    result += (byte & 0x7f) * factor;
    if ((byte & 0x80) === 0) return result;
    factor *= 128;
    count += 1;
  }
  throw new Error("invalid protobuf varint");
}

function _ks_protoReadLengthDelimited(bytes, state) {
  const length = _ks_protoReadVarint(bytes, state);
  const start = state.offset;
  const end = start + length;
  if (end > bytes.length) throw new Error("protobuf length exceeds buffer");
  state.offset = end;
  return bytes.subarray(start, end);
}

function _ks_protoUtf8(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  try {
    return decodeURIComponent(escape(out));
  } catch (e) {
    return out;
  }
}

function _ks_protoSkipField(bytes, wireType, state) {
  if (wireType === 0) {
    _ks_protoReadVarint(bytes, state);
    return;
  }
  if (wireType === 1) {
    state.offset = Math.min(bytes.length, state.offset + 8);
    return;
  }
  if (wireType === 2) {
    _ks_protoReadLengthDelimited(bytes, state);
    return;
  }
  if (wireType === 5) {
    state.offset = Math.min(bytes.length, state.offset + 4);
    return;
  }
  throw new Error(`unsupported protobuf wire type: ${wireType}`);
}

function _ks_parseSimpleUserInfo(bytes) {
  const state = { offset: 0 };
  const user = { userName: "" };
  while (state.offset < bytes.length) {
    const tag = _ks_protoReadVarint(bytes, state);
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x07;
    if (fieldNumber === 2 && wireType === 2) {
      user.userName = _ks_protoUtf8(_ks_protoReadLengthDelimited(bytes, state));
      continue;
    }
    _ks_protoSkipField(bytes, wireType, state);
  }
  return user;
}

function _ks_parseWebCommentFeed(bytes) {
  const state = { offset: 0 };
  const feed = {
    id: "",
    content: "",
    color: "",
    time: 0,
    user: null
  };
  while (state.offset < bytes.length) {
    const tag = _ks_protoReadVarint(bytes, state);
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x07;
    if (wireType === 2) {
      const chunk = _ks_protoReadLengthDelimited(bytes, state);
      if (fieldNumber === 1) {
        feed.id = _ks_protoUtf8(chunk);
      } else if (fieldNumber === 2) {
        feed.user = _ks_parseSimpleUserInfo(chunk);
      } else if (fieldNumber === 3) {
        feed.content = _ks_protoUtf8(chunk);
      } else if (fieldNumber === 6) {
        feed.color = _ks_protoUtf8(chunk);
      }
      continue;
    }
    if (wireType === 0) {
      const value = _ks_protoReadVarint(bytes, state);
      if (fieldNumber === 9) feed.time = value;
      continue;
    }
    _ks_protoSkipField(bytes, wireType, state);
  }
  return feed;
}

function _ks_parseColor(value) {
  const text = _ks_str(value).trim();
  if (!text) return 16777215;
  const hex = text.charAt(0) === "#" ? text.slice(1) : text;
  const parsed = parseInt(hex, 16);
  return Number.isFinite(parsed) && parsed >= 0 ? (parsed >>> 0) : 16777215;
}

function _ks_collectHistoryEntries(body) {
  const dataObject = body && typeof body === "object" ? (body.data || {}) : {};
  const backTraceFeedMap = dataObject && typeof dataObject === "object" ? (dataObject.backTraceFeedMap || {}) : {};
  const commentFeedData = backTraceFeedMap["1"] || backTraceFeedMap[1] || null;
  const historyFeedList = commentFeedData && Array.isArray(commentFeedData.historyFeedList) ? commentFeedData.historyFeedList : [];
  const entries = [];
  for (let index = 0; index < historyFeedList.length; index++) {
    try {
      const feed = _ks_parseWebCommentFeed(_ks_base64ToBytes(historyFeedList[index]));
      const content = _ks_str(feed.content).trim();
      if (!content) continue;
      const nickname = _ks_str(feed.user && feed.user.userName);
      const key = _ks_str(feed.id) || `${_ks_str(feed.time)}|${nickname}|${content}`;
      entries.push({
        key,
        time: Number(feed.time) || 0,
        sequence: index,
        nickname,
        text: content,
        color: _ks_parseColor(feed.color)
      });
    } catch (e) {
      // Ignore malformed history frames and continue parsing the rest.
    }
  }
  entries.sort(function (lhs, rhs) {
    if (lhs.time !== rhs.time) return lhs.time - rhs.time;
    return lhs.sequence - rhs.sequence;
  });
  return entries;
}

function _ks_session(connectionId) {
  const key = _ks_str(connectionId);
  const session = __ks_danmakuSessions[key];
  if (!session) {
    _ks_throw("INVALID_STATE", "danmaku session not found", { connectionId: key });
  }
  return session;
}

const __ksDanmakuDriver = {
  async getDanmakuPlan(roomId) {
    const shared = _ks_shared();
    const roomBundle = await shared.getLiveRoomBundle(roomId);
    const current = shared.pickCurrentPlayItem(roomBundle.liveData);

    let liveStreamId = _ks_str(current && current.liveStream && current.liveStream.id ? current.liveStream.id : "");
    if (!liveStreamId) {
      liveStreamId = _ks_str(shared.extractLiveStreamIdFallback(roomBundle.html));
    }
    if (!liveStreamId) {
      _ks_throw("NOT_FOUND", "liveStreamId not found", { roomId: _ks_str(roomId) });
    }

    return {
      args: {
        "_danmu_type": "http_polling",
        "_polling_url": __ks_pollingURL,
        "_polling_method": "POST",
        "_polling_interval": String(__ks_pollingIntervalMs),
        "liveStreamId": liveStreamId,
        "cursor_comment": "0",
        "cursor_like": "0"
      },
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://live.kuaishou.com/",
        "User-Agent": _ks_str(shared.userAgent)
      },
      transport: {
        kind: "http_polling",
        url: __ks_pollingURL,
        polling: {
          method: "POST",
          intervalMs: __ks_pollingIntervalMs,
          sendOnConnect: true
        }
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "ks_recall_json",
        protocolVersion: "1"
      }
    };
  },

  async createDanmakuSession(payload) {
    const connectionId = _ks_str(payload && payload.connectionId ? payload.connectionId : "");
    if (!connectionId) _ks_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    const args = payload && payload.args ? payload.args : {};
    const liveStreamId = _ks_str(args.liveStreamId);
    if (!liveStreamId) _ks_throw("INVALID_ARGS", "liveStreamId is required", { field: "liveStreamId" });

    __ks_danmakuSessions[connectionId] = {
      connectionId: connectionId,
      liveStreamId: liveStreamId,
      cursorComment: _ks_str(args.cursor_comment || "0"),
      cursorLike: _ks_str(args.cursor_like || "0"),
      headers: payload && payload.headers ? payload.headers : null,
      seenKeys: {},
      didEmitInitialHistory: false
    };

    const session = __ks_danmakuSessions[connectionId];
    return {
      ok: true,
      poll: _ks_makePoll(session),
      timer: {
        mode: "polling",
        intervalMs: __ks_pollingIntervalMs
      }
    };
  },

  async onDanmakuOpen() {
    return {
      timer: {
        mode: "polling",
        intervalMs: __ks_pollingIntervalMs
      }
    };
  },

  async onDanmakuFrame(payload) {
    const session = _ks_session(payload && payload.connectionId);
    const text = _ks_str(payload && payload.text ? payload.text : "");
    const body = _ks_safeJsonParse(text) || {};
    const messages = [];
    const entries = _ks_collectHistoryEntries(body);
    if (entries.length > 0) {
      if (!session.didEmitInitialHistory) {
        for (const entry of entries) {
          session.seenKeys[entry.key] = true;
          messages.push({
            text: entry.text,
            nickname: entry.nickname,
            color: entry.color
          });
        }
        session.didEmitInitialHistory = true;
      } else {
        for (const entry of entries) {
          if (session.seenKeys[entry.key]) continue;
          session.seenKeys[entry.key] = true;
          messages.push({
            text: entry.text,
            nickname: entry.nickname,
            color: entry.color
          });
        }
      }
    } else {
      _ks_collectMessages(body, messages, {}, 0);
    }

    return {
      messages: messages,
      poll: _ks_makePoll(session),
      timer: {
        mode: "polling",
        intervalMs: __ks_pollingIntervalMs
      }
    };
  },

  async onDanmakuTick(payload) {
    const session = _ks_session(payload && payload.connectionId);
    return {
      poll: _ks_makePoll(session),
      timer: {
        mode: "polling",
        intervalMs: __ks_pollingIntervalMs
      }
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _ks_str(payload && payload.connectionId ? payload.connectionId : "");
    if (connectionId) delete __ks_danmakuSessions[connectionId];
    return {
      ok: true
    };
  }
};

globalThis.__ksDanmakuDriver = __ksDanmakuDriver;
})();
