const __panda_platformId = "panda";
const __panda_liveType = "12";
const __panda_apiBase = "https://api.pandalive.co.kr";
const __panda_webBase = "https://www.pandalive.co.kr";
const __panda_chatSocketUrl = "wss://chat-ws.neolive.kr/connection/websocket";
const __panda_defaultUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const __panda_danmakuSessions = {};

const __panda_defaultHeaders = {
  "User-Agent": __panda_defaultUA,
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Origin": __panda_webBase
};

const __panda_playbackHeaders = {
  "User-Agent": __panda_defaultUA,
  "Origin": __panda_webBase,
  "Referer": `${__panda_webBase}/`
};

function _panda_throw(code, message, context) {
  if (globalThis.Host && typeof Host.raise === "function") {
    Host.raise(code, message, context || {});
  }
  if (globalThis.Host && typeof Host.makeError === "function") {
    throw Host.makeError(code || "UNKNOWN", message || "", context || {});
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

function _panda_isNumeric(value) {
  return /^\d+$/.test(_panda_str(value).trim());
}

function _panda_firstURL(text) {
  const m = _panda_str(text).match(/https?:\/\/[^\s"'<>|]+/);
  return m ? String(m[0]).replace(/[),，。】]+$/g, "") : "";
}

function _panda_firstMatch(text, re) {
  const m = _panda_str(text).match(re);
  return m && m[1] ? String(m[1]) : "";
}

function _panda_formBody(params) {
  const pairs = [];
  for (const key of Object.keys(params || {})) {
    const value = params[key];
    if (value === null || value === undefined) continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.join("&");
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

async function _panda_request(options, authMode) {
  const headers = Object.assign({}, __panda_defaultHeaders, options.headers || {});
  return await Host.http.request({
    platformId: __panda_platformId,
    authMode: authMode || "none",
    request: {
      url: options.url,
      method: options.method || "GET",
      headers,
      body: options.body || null,
      timeout: options.timeout || 20
    }
  });
}

async function _panda_post(path, params, referer, authMode) {
  const resp = await _panda_request({
    url: `${__panda_apiBase}${path}`,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Referer": referer || __panda_webBase
    },
    body: _panda_formBody(params || {})
  }, authMode);

  try {
    return JSON.parse(resp.bodyText || "{}");
  } catch (e) {
    _panda_throw("INVALID_RESPONSE", "invalid json response", { path });
  }
}

function _panda_sortPayload(categoryId, page, pageSize) {
  const id = _panda_str(categoryId || "user");
  const limit = Math.max(1, Math.min(_panda_num(pageSize, 24), 60));
  const currentPage = Math.max(1, _panda_num(page, 1));
  const offset = (currentPage - 1) * limit;

  if (id === "hot") return { onlyNewBj: "N", orderBy: "hot", limit, offset };
  if (id === "new") return { onlyNewBj: "N", orderBy: "new", limit, offset };
  if (id === "newbj") return { onlyNewBj: "Y", orderBy: "user", limit, offset };
  return { onlyNewBj: "N", orderBy: "user", limit, offset };
}

function _panda_toRoomModel(item) {
  const media = item && item.media ? item.media : item;
  const userId = _panda_str(media && media.userId ? media.userId : item && item.userId);
  const userIdx = _panda_str(media && media.userIdx ? media.userIdx : item && item.userIdx);
  const userNick = _panda_str(media && media.userNick ? media.userNick : item && item.userNick);
  const title = _panda_str(media && media.title ? media.title : item && item.channelTitle);
  const cover = _panda_str(
    (media && (media.thumbUrl || media.thumbUrlOrigin || media.ivsThumbnail || media.userImg)) ||
    (item && (item.thumbUrl || item.thumbUrlOrigin || item.userImg)) ||
    ""
  );
  const head = _panda_str(
    (media && media.userImg) ||
    (item && (item.userImg || item.thumbUrl)) ||
    cover
  );

  return {
    userName: userNick,
    roomTitle: title || (userNick ? `${userNick}` : ""),
    roomCover: cover,
    userHeadImg: head,
    liveType: __panda_liveType,
    liveState: media && media.isLive ? "1" : "3",
    userId: userIdx,
    roomId: userId || userIdx,
    liveWatchedCount: _panda_str((media && (media.user || media.playCnt)) || (item && item.userCnt) || "")
  };
}

function _panda_toSearchRoomModel(item) {
  return {
    userName: _panda_str(item && item.userNick),
    roomTitle: _panda_str(item && item.userNick),
    roomCover: _panda_str(item && item.thumbUrl),
    userHeadImg: _panda_str(item && item.thumbUrl),
    liveType: __panda_liveType,
    liveState: "3",
    userId: _panda_str(item && item.userIdx),
    roomId: _panda_str(item && item.userId),
    liveWatchedCount: _panda_str(item && (item.scoreMonth || item.scoreWeek || ""))
  };
}

function _panda_toDetailModel(member, play) {
  const info = member && member.bjInfo ? member.bjInfo : {};
  const media = play && play.media ? play.media : null;
  const liveState = media && media.isLive ? "1" : "0";
  const cover = _panda_str((media && (media.thumbUrl || media.ivsThumbnail || media.userImg)) || info.channelBannerUrl || info.thumbUrl || "");
  const head = _panda_str((media && media.userImg) || info.thumbUrl || cover);

  return {
    userName: _panda_str((media && media.userNick) || info.nick),
    roomTitle: _panda_str((media && media.title) || info.channelTitle || info.channelDesc || info.nick),
    roomCover: cover,
    userHeadImg: head,
    liveType: __panda_liveType,
    liveState,
    userId: _panda_str((media && media.userIdx) || info.idx),
    roomId: _panda_str((media && media.userId) || info.id || info.idx),
    liveWatchedCount: _panda_str((media && (media.user || media.playCnt)) || info.scoreWatch || "")
  };
}

async function _panda_fetchMember(roomId, authMode) {
  const id = _panda_str(roomId).trim();
  if (!id) _panda_throw("INVALID_ARGS", "roomId is empty", { field: "roomId" });
  if (_panda_isNumeric(id)) {
    return {
      result: true,
      bjInfo: {
        idx: Number(id),
        id,
        nick: id,
        thumbUrl: ""
      }
    };
  }

  const obj = await _panda_post("/v1/member/bj", { userId: id }, `${__panda_webBase}/play/${encodeURIComponent(id)}`, authMode);
  if (!obj || obj.result === false || !obj.bjInfo) {
    _panda_throw("NOT_FOUND", _panda_str(obj && obj.message) || "member not found", { roomId: id });
  }
  return obj;
}

async function _panda_fetchLivePlay(userIdx, roomId, authMode) {
  const refererId = _panda_str(roomId || userIdx);
  return await _panda_post(
    "/v1/live/play",
    {
      action: "watch",
      userId: _panda_str(userIdx)
    },
    `${__panda_webBase}/play/${encodeURIComponent(refererId)}`,
    authMode
  );
}

async function _panda_fetchLiveList(categoryId, page, pageSize, authMode) {
  const payload = _panda_sortPayload(categoryId, page, pageSize);
  const obj = await _panda_post("/v1/live/index", payload, `${__panda_webBase}/live`, authMode);
  if (!obj || obj.result === false || !Array.isArray(obj.list)) {
    _panda_throw("INVALID_RESPONSE", _panda_str(obj && obj.message) || "missing live list", { id: _panda_str(categoryId) });
  }
  return obj.list.map(_panda_toRoomModel);
}

async function _panda_search(keyword, page, pageSize, authMode) {
  const limit = Math.max(1, Math.min(_panda_num(pageSize, 20), 60));
  const currentPage = Math.max(1, _panda_num(page, 1));
  const obj = await _panda_post(
    "/v1/live/bj_list",
    {
      searchVal: _panda_str(keyword),
      limit,
      offset: (currentPage - 1) * limit
    },
    `${__panda_webBase}/live`,
    authMode
  );
  if (!obj || obj.result === false || !Array.isArray(obj.list)) {
    _panda_throw("INVALID_RESPONSE", _panda_str(obj && obj.message) || "missing search list", { keyword: _panda_str(keyword) });
  }
  return obj.list.map(_panda_toSearchRoomModel);
}

async function _panda_getRoomDetail(roomId, userId, authMode) {
  const member = await _panda_fetchMember(roomId, authMode);
  const info = member && member.bjInfo ? member.bjInfo : {};
  const idx = _panda_str(userId || info.idx || roomId);
  let play = null;

  if (idx) {
    const obj = await _panda_fetchLivePlay(idx, info.id || roomId, authMode);
    if (obj && obj.result !== false) {
      play = obj;
    } else if (obj && obj.errorData && obj.errorData.code && String(obj.errorData.code) !== "castEnd") {
      play = null;
    }
  }

  return _panda_toDetailModel(member, play);
}

function _panda_extractPlaylist(play) {
  const playlist = play && play.PlayList ? play.PlayList : {};
  const out = [];
  const seen = {};
  for (const key of ["hls3", "hls2", "hls"]) {
    const list = playlist[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    const first = list[0];
    const url = _panda_str(first && first.url);
    if (!url || seen[url]) continue;
    seen[url] = true;
    out.push({
      key,
      title: _panda_str((first && first.name) || "自动"),
      url
    });
  }
  return out;
}

async function _panda_getPlayback(roomId, userId, authMode) {
  const member = await _panda_fetchMember(roomId, authMode);
  const info = member && member.bjInfo ? member.bjInfo : {};
  const idx = _panda_str(userId || info.idx || roomId);
  if (!idx) _panda_throw("INVALID_ARGS", "userId is required", { roomId: _panda_str(roomId) });

  const play = await _panda_fetchLivePlay(idx, info.id || roomId, authMode);
  if (!play || play.result === false) {
    _panda_throw("UPSTREAM", _panda_str(play && play.message) || "play api failed", { roomId: _panda_str(roomId), userId: idx });
  }

  const media = play.media || {};
  if (media.isLive === false) {
    _panda_throw("NOT_LIVE", "broadcast has ended", { roomId: _panda_str(roomId), userId: idx });
  }
  if (media.isPw === true) {
    _panda_throw("UNSUPPORTED", "password protected room", { roomId: _panda_str(roomId), userId: idx });
  }

  const playlist = _panda_extractPlaylist(play);
  if (playlist.length === 0) {
    _panda_throw("INVALID_RESPONSE", "missing hls playlist", { roomId: _panda_str(roomId), userId: idx });
  }

  return playlist.map(function (item) {
    return {
      cdn: item.key,
      qualitys: [{
        roomId: _panda_str(info.id || roomId),
        title: item.title,
        qn: 0,
        url: item.url,
        liveCodeType: "m3u8",
        liveType: __panda_liveType,
        userAgent: __panda_defaultUA,
        headers: Object.assign({}, __panda_playbackHeaders, {
          "Referer": `${__panda_webBase}/play/${encodeURIComponent(_panda_str(info.id || roomId))}`
        })
      }]
    };
  });
}

async function _panda_resolveShare(shareCode, authMode) {
  const input = _panda_str(shareCode).trim();
  if (!input) _panda_throw("INVALID_ARGS", "shareCode is empty", { field: "shareCode" });

  let roomId = _panda_firstMatch(input, /pandalive\.co\.kr\/(?:[^/]+\/)?play\/([^/?#\s]+)/i);
  if (roomId) return decodeURIComponent(roomId);

  roomId = _panda_firstMatch(input, /(?:userId|roomId)=([^&#\s]+)/i);
  if (roomId) return decodeURIComponent(roomId);

  const url = _panda_firstURL(input);
  if (url) {
    roomId = _panda_firstMatch(url, /pandalive\.co\.kr\/(?:[^/]+\/)?play\/([^/?#\s]+)/i);
    if (roomId) return decodeURIComponent(roomId);

    const resp = await _panda_request({
      url,
      method: "GET",
      headers: {
        "Referer": __panda_webBase
      }
    }, authMode);
    roomId = _panda_firstMatch(resp.url || "", /pandalive\.co\.kr\/(?:[^/]+\/)?play\/([^/?#\s]+)/i);
    if (roomId) return decodeURIComponent(roomId);
    roomId = _panda_firstMatch(resp.bodyText || "", /(?:canonical|og:url)[^>]+\/play\/([^"'?#<]+)/i);
    if (roomId) return decodeURIComponent(roomId);
  }

  if (/^[a-zA-Z0-9_.-]{2,64}$/.test(input)) return input;
  _panda_throw("NOT_FOUND", "roomId not found", { shareCode: input });
}

globalThis.LiveParsePlugin = {
  apiVersion: 1,

  async getCategories() {
    return [
      {
        id: "live",
        title: "LIVE",
        icon: "",
        biz: "",
        subList: [
          { id: "user", parentId: "live", title: "观看人数", icon: "", biz: "orderBy=user&onlyNewBj=N" },
          { id: "hot", parentId: "live", title: "热门", icon: "", biz: "orderBy=hot&onlyNewBj=N" },
          { id: "new", parentId: "live", title: "最新", icon: "", biz: "orderBy=new&onlyNewBj=N" },
          { id: "newbj", parentId: "live", title: "NEW BJ", icon: "", biz: "orderBy=user&onlyNewBj=Y" }
        ]
      }
    ];
  },

  async getRooms(payload) {
    const id = _panda_str(payload && payload.id ? payload.id : "user");
    const page = payload && payload.page ? Number(payload.page) : 1;
    const pageSize = payload && payload.pageSize ? Number(payload.pageSize) : 24;
    return await _panda_fetchLiveList(id, page, pageSize, "platform_cookie");
  },

  async getPlayback(payload) {
    const roomId = _panda_str(payload && payload.roomId ? payload.roomId : "");
    const userId = _panda_str(payload && payload.userId ? payload.userId : "");
    if (!roomId && !userId) _panda_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    return await _panda_getPlayback(roomId || userId, userId, "platform_cookie");
  },

  async search(payload) {
    const keyword = _panda_str(payload && payload.keyword ? payload.keyword : "");
    const page = payload && payload.page ? Number(payload.page) : 1;
    const pageSize = payload && payload.pageSize ? Number(payload.pageSize) : 20;
    if (!keyword) _panda_throw("INVALID_ARGS", "keyword is required", { field: "keyword" });
    return await _panda_search(keyword, page, pageSize, "platform_cookie");
  },

  async getRoomDetail(payload) {
    const roomId = _panda_str(payload && payload.roomId ? payload.roomId : "");
    const userId = _panda_str(payload && payload.userId ? payload.userId : "");
    if (!roomId && !userId) _panda_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    return await _panda_getRoomDetail(roomId || userId, userId, "platform_cookie");
  },

  async getLiveState(payload) {
    const roomId = _panda_str(payload && payload.roomId ? payload.roomId : "");
    const userId = _panda_str(payload && payload.userId ? payload.userId : "");
    if (!roomId && !userId) _panda_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    const info = await _panda_getRoomDetail(roomId || userId, userId, "platform_cookie");
    return {
      liveState: _panda_str(info && info.liveState ? info.liveState : "3")
    };
  },

  async resolveShare(payload) {
    const shareCode = _panda_str(payload && payload.shareCode ? payload.shareCode : "");
    if (!shareCode) _panda_throw("INVALID_ARGS", "shareCode is required", { field: "shareCode" });
    const roomId = await _panda_resolveShare(shareCode, "platform_cookie");
    return await _panda_getRoomDetail(roomId, "", "platform_cookie");
  },

  async getDanmaku(payload) {
    const roomId = _panda_str(payload && payload.roomId ? payload.roomId : "");
    const userId = _panda_str(payload && payload.userId ? payload.userId : "");
    if (!roomId && !userId) _panda_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });

    const member = await _panda_fetchMember(roomId || userId, "platform_cookie");
    const info = member && member.bjInfo ? member.bjInfo : {};
    const idx = _panda_str(userId || info.idx || roomId);
    const play = await _panda_fetchLivePlay(idx, info.id || roomId || userId, "platform_cookie");
    if (!play || play.result === false) {
      _panda_throw("UPSTREAM", _panda_str(play && play.message) || "play api failed", { roomId: _panda_str(roomId), userId: idx });
    }

    return {
      args: {
        roomId: _panda_str(info.id || roomId || userId),
        channel: _panda_str(_panda_jwtChannel(play.token) || play.channel || idx),
        token: _panda_str(play.token || ""),
        tokenExpiresAt: _panda_str(_panda_jwtExpiresAt(play.token) || ""),
        chatServerUrl: _panda_str(play.chatServer && play.chatServer.url),
        chatServerToken: _panda_str(play.chatServer && play.chatServer.token),
        roomInfo: _panda_str(play.roomInfo || "")
      },
      headers: {
        "User-Agent": __panda_defaultUA,
        "Origin": __panda_webBase,
        "Referer": `${__panda_webBase}/play/${encodeURIComponent(_panda_str(info.id || roomId || userId))}`
      },
      transport: {
        kind: "websocket",
        url: __panda_chatSocketUrl,
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
