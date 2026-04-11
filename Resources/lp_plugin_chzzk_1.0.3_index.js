const _cz_platformId = "chzzk";
const _cz_liveType = "13";
const _cz_webUA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const _cz_playbackUserAgent = "libmpv";
const _cz_defaultPageSize = 20;
const _cz_categoriesPageSize = 50;
const _cz_categoryRoomsPageSize = 50;
const _cz_runtime = {
  categoryCursorCache: {}
};
const _cz_defaultHeaders = {
  "User-Agent": _cz_webUA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,ko;q=0.7",
  Origin: "https://chzzk.naver.com",
  Referer: "https://chzzk.naver.com/"
};
const _cz_qualityRank = {
  "2160p": 2160,
  "1440p": 1440,
  "1080p": 1080,
  "720p": 720,
  "540p": 540,
  "480p": 480,
  "360p": 360,
  "270p": 270,
  "240p": 240,
  "144p": 144,
  AUDIO: 1
};
const _cz_categoryTitleMap = {
  League_of_Legends: "League of Legends",
  Valorant: "VALORANT",
  Player_Unknowns_Battle_Grounds: "PUBG: BATTLEGROUNDS",
  Black_Survival_Eternal_Return: "Eternal Return",
  MapleStory: "MapleStory",
  FC_Online: "FC Online",
  OVERWATCH: "Overwatch",
  Lost_Ark: "Lost Ark",
  Dungeon_Fighter: "Dungeon Fighter",
  Escape_from_Tarkov: "Escape from Tarkov",
  Project_Zomboid: "Project Zomboid",
  Rimworld: "RimWorld",
  Pokemon_Champions: "Pokemon Champions",
  Black_Myth_Wukong: "Black Myth: Wukong",
  PowerWash_Simulator2: "PowerWash Simulator 2",
  Crime_Scene_Cleaner: "Crime Scene Cleaner",
  Sid_Meiers_Civilization_VI: "Sid Meier's Civilization VI",
  World_of_Warcraft_Midnight: "World of Warcraft: Midnight",
  Dangerous_Mountain_Together: "Dangerous Mountain Together",
  talk: "Talk",
  music: "Music",
  vtuber: "VTuber",
  baseball: "Baseball"
};
const _cz_builtinCategories = [
  {
    id: "GAME",
    title: "游戏",
    icon: "",
    biz: "",
    subList: [
      { id: "GAME:League_of_Legends", parentId: "GAME", title: "League of Legends", icon: "", biz: "" },
      { id: "GAME:Valorant", parentId: "GAME", title: "VALORANT", icon: "", biz: "" },
      { id: "GAME:Player_Unknowns_Battle_Grounds", parentId: "GAME", title: "PUBG: BATTLEGROUNDS", icon: "", biz: "" },
      { id: "GAME:MapleStory", parentId: "GAME", title: "MapleStory", icon: "", biz: "" },
      { id: "GAME:FC_Online", parentId: "GAME", title: "FC Online", icon: "", biz: "" },
      { id: "GAME:Black_Survival_Eternal_Return", parentId: "GAME", title: "Eternal Return", icon: "", biz: "" }
    ]
  },
  {
    id: "ETC",
    title: "综合",
    icon: "",
    biz: "",
    subList: [
      { id: "ETC:talk", parentId: "ETC", title: "Talk", icon: "", biz: "" },
      { id: "ETC:vtuber", parentId: "ETC", title: "VTuber", icon: "", biz: "" },
      { id: "ETC:music", parentId: "ETC", title: "Music", icon: "", biz: "" }
    ]
  }
];

function _cz_throw(code, message, context) {
  if (globalThis.Host && typeof Host.raise === "function") {
    Host.raise(code, message, context || {});
  }
  if (globalThis.Host && typeof Host.makeError === "function") {
    throw Host.makeError(code || "UNKNOWN", message || "", context || {});
  }
  throw new Error(
    "LP_PLUGIN_ERROR:" +
      JSON.stringify({
        code: String(code || "UNKNOWN"),
        message: String(message || ""),
        context: context || {}
      })
  );
}

function _cz_str(value) {
  return value === null || value === undefined ? "" : String(value);
}

function _cz_int(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function _cz_parseJSON(text, fallback) {
  try {
    return JSON.parse(_cz_str(text));
  } catch (_) {
    return fallback;
  }
}

function _cz_runtimePayload(payload) {
  return payload && typeof payload === "object" ? Object.assign({}, payload) : {};
}

function _cz_cacheKey(prefix, pageSize, id) {
  return [prefix, String(pageSize || ""), _cz_str(id || "")].join(":");
}

function _cz_getCachedCursor(store, key, page) {
  if (!store || !store[key]) return null;
  return store[key][page] || null;
}

function _cz_setCachedCursor(store, key, page, cursor) {
  if (!store[key]) store[key] = {};
  store[key][page] = cursor || null;
}

function _cz_page(value) {
  return Math.max(1, _cz_int(value, 1));
}

function _cz_pageSize(value) {
  return Math.max(1, Math.min(50, _cz_int(value, _cz_defaultPageSize)));
}

function _cz_pickRuntimeCookie(payload) {
  const runtimePayload = _cz_runtimePayload(payload);
  const headers =
    runtimePayload.headers && typeof runtimePayload.headers === "object"
      ? runtimePayload.headers
      : null;
  return _cz_str(runtimePayload.cookie || (headers && (headers.Cookie || headers.cookie)) || "");
}

async function _cz_request(request, payload, authMode) {
  const runtimePayload = _cz_runtimePayload(payload);
  const headers = Object.assign({}, _cz_defaultHeaders, request.headers || {});
  const cookie = _cz_pickRuntimeCookie(runtimePayload);
  if (cookie && !headers.Cookie) {
    headers.Cookie = cookie;
  }

  return await Host.http.request({
    platformId: _cz_platformId,
    authMode: authMode || "none",
    request: {
      url: _cz_str(request.url),
      method: request.method || "GET",
      headers: headers,
      body: request.body || null,
      timeout: request.timeout || 20
    }
  });
}

function _cz_ensureStatus(resp, context) {
  const status = _cz_int(resp && resp.status, 0);
  if (status >= 200 && status < 300) return;
  _cz_throw("UPSTREAM", "chzzk request failed", Object.assign({ status: status }, context || {}));
}

async function _cz_requestJSON(request, payload, authMode) {
  const resp = await _cz_request(request, payload, authMode);
  _cz_ensureStatus(resp, { url: request.url });
  const data = _cz_parseJSON(resp && resp.bodyText, null);
  if (!data || (data.code && Number(data.code) !== 200)) {
    _cz_throw("INVALID_RESPONSE", "chzzk response invalid", {
      url: request.url,
      status: resp && resp.status,
      code: data && data.code,
      message: data && data.message
    });
  }
  return data.content;
}

async function _cz_requestJSONFallback(urls, payload, headers) {
  let lastError = null;
  for (const url of urls) {
    try {
      return await _cz_requestJSON({
        url: url,
        headers: headers || {}
      }, payload);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  _cz_throw("UPSTREAM", "chzzk fallback request failed", { urls: urls });
}

function _cz_buildCategoryLivesURL(pair, pageSize, cursor) {
  const params = [
    "size=" + encodeURIComponent(String(pageSize))
  ];
  if (cursor && cursor.concurrentUserCount !== undefined && cursor.concurrentUserCount !== null) {
    params.push("concurrentUserCount=" + encodeURIComponent(String(cursor.concurrentUserCount)));
  }
  if (cursor && cursor.liveId) {
    params.push("liveId=" + encodeURIComponent(String(cursor.liveId)));
  }
  return (
    "https://api.chzzk.naver.com/service/v2/categories/" +
    encodeURIComponent(pair.type) +
    "/" +
    encodeURIComponent(pair.category) +
    "/lives?" +
    params.join("&")
  );
}

function _cz_formatThumbnail(url) {
  const source = _cz_str(url);
  if (!source) return "";
  return source.indexOf("{type}") >= 0 ? source.replace("{type}", "480") : source;
}

function _cz_contentArray(content) {
  if (Array.isArray(content && content.data)) return content.data;
  if (Array.isArray(content && content.liveInfoResponseList)) return content.liveInfoResponseList;
  return [];
}

function _cz_liveStateFromStatus(status) {
  const normalized = _cz_str(status).toUpperCase();
  if (normalized === "OPEN" || normalized === "STARTED" || normalized === "PLAYABLE" || normalized === "LIVE") {
    return "1";
  }
  if (normalized === "CLOSE" || normalized === "CLOSED" || normalized === "ENDED" || normalized === "END") {
    return "0";
  }
  return "3";
}

function _cz_categoryPair(rawId) {
  const value = _cz_str(rawId).trim();
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length < 2) return null;
  return {
    type: _cz_str(parts[0]).trim(),
    category: parts.slice(1).join(":").trim()
  };
}

function _cz_prettyCategoryTitle(item) {
  const categoryId = _cz_str(item && (item.categoryId || item.liveCategory || item.categoryValue)).trim();
  if (_cz_categoryTitleMap[categoryId]) return _cz_categoryTitleMap[categoryId];

  if (categoryId) {
    return categoryId
      .replace(/_/g, " ")
      .replace(/\b\w/g, function (m) {
        return m.toUpperCase();
      });
  }

  const title = _cz_str(
    (item && (item.categoryName || item.categoryValue || item.liveCategoryValue || item.liveCategory)) || ""
  ).trim();
  return title || "Unknown";
}

function _cz_liveToModel(item) {
  const live = item && item.live ? item.live : item;
  const channel = (item && item.channel) || (live && live.channel) || {};
  const channelId = _cz_str(live && (live.channelId || channel.channelId) || channel.channelId);
  const roomId = channelId || _cz_str(live && live.liveId);
  const title = _cz_str(live && live.liveTitle);
  return {
    userName: _cz_str(channel.channelName || live && live.channelName),
    roomTitle: title,
    roomCover: _cz_formatThumbnail(
      live && (live.liveImageUrl || live.defaultThumbnailImageUrl || live.thumbnailImageUrl)
    ),
    userHeadImg: _cz_str(channel.channelImageUrl || live && live.channelImageUrl),
    liveState: _cz_liveStateFromStatus(live && (live.status || live.liveStatus)),
    userId: channelId,
    roomId: roomId,
    liveWatchedCount: _cz_str(
      live && (live.concurrentUserCount || live.accumulateCount || live.readCount || live.followerCount)
    )
  };
}

function _cz_detailToModel(channel, liveDetail, liveStatus) {
  const source = liveDetail || liveStatus || {};
  return {
    userName: _cz_str(channel && channel.channelName),
    roomTitle: _cz_str(source.liveTitle || channel && channel.channelName),
    roomCover: _cz_formatThumbnail(source.liveImageUrl || source.defaultThumbnailImageUrl || channel && channel.channelImageUrl),
    userHeadImg: _cz_str(channel && channel.channelImageUrl),
    liveState: _cz_liveStateFromStatus(source.status),
    userId: _cz_str(channel && channel.channelId),
    roomId: _cz_str(channel && channel.channelId),
    liveWatchedCount: _cz_str(source.concurrentUserCount || source.accumulateCount || channel && channel.followerCount)
  };
}

function _cz_qualityValue(track) {
  const id = _cz_str(track && track.encodingTrackId).toUpperCase();
  if (track && track.audioOnly) return _cz_qualityRank.AUDIO;
  if (_cz_qualityRank[id]) return _cz_qualityRank[id];
  const height = _cz_int(track && track.videoHeight, 0);
  if (height > 0) return height;
  const match = _cz_str(track && track.encodingTrackId).match(/(\d{3,4})p/i);
  return match ? _cz_int(match[1], 0) : 0;
}

function _cz_qualityLabel(track) {
  if (track && track.audioOnly) return "音频";
  const explicit = _cz_str(track && track.encodingTrackId);
  if (explicit) return explicit;
  const height = _cz_int(track && track.videoHeight, 0);
  return height > 0 ? `${height}p` : "原画";
}

function _cz_buildPlayback(playbackJson, roomId) {
  const playback = typeof playbackJson === "string" ? _cz_parseJSON(playbackJson, null) : playbackJson;
  const mediaList = playback && Array.isArray(playback.media) ? playback.media : [];
  if (mediaList.length < 1) {
    _cz_throw("INVALID_RESPONSE", "chzzk livePlaybackJson missing media", { roomId: _cz_str(roomId) });
  }

  const groups = [];
  for (const media of mediaList) {
    const tracks = Array.isArray(media.encodingTrack) ? media.encodingTrack.slice() : [];
    tracks.sort(function (a, b) {
      return _cz_qualityValue(b) - _cz_qualityValue(a);
    });

    const items = [];
    for (const track of tracks) {
      const path = _cz_str(track && track.path) || _cz_str(media && media.path);
      if (!path) continue;
      items.push({
        roomId: _cz_str(roomId),
        title: _cz_qualityLabel(track),
        qn: _cz_qualityValue(track),
        url: path,
        liveCodeType: "m3u8",
        liveType: _cz_liveType,
        userAgent: _cz_playbackUserAgent,
        headers: {
          "User-Agent": _cz_playbackUserAgent,
          Referer: "https://chzzk.naver.com/",
          Origin: "https://chzzk.naver.com"
        }
      });
    }

    if (items.length > 0) {
      groups.push({
        cdn: _cz_str(media && (media.mediaId || media.protocol || media.latency || "default")),
        qualitys: items
      });
    }
  }

  if (groups.length < 1) {
    _cz_throw("INVALID_RESPONSE", "chzzk playback list empty", { roomId: _cz_str(roomId) });
  }
  return groups;
}

async function _cz_fetchCategories(payload) {
  const content = await _cz_requestJSON({
    url:
      "https://api.chzzk.naver.com/service/v1/categories/live?size=" +
      encodeURIComponent(String(_cz_categoriesPageSize)) +
      "&offset=0",
    headers: {
      Referer: "https://chzzk.naver.com/category/live"
    }
  }, payload);

  const data = _cz_contentArray(content);
  if (data.length < 1) return _cz_builtinCategories;

  const roots = {};
  for (const item of data) {
    const type = _cz_str(item && item.categoryType).trim() || "OTHER";
    const categoryId = _cz_str(item && (item.categoryId || item.liveCategory || item.categoryValue)).trim();
    if (!categoryId) continue;
    if (!roots[type]) {
      roots[type] = {
        id: type,
        title: type === "GAME" ? "游戏" : type === "ETC" ? "综合" : type,
        icon: _cz_str(item && item.posterImageUrl),
        biz: "",
        subList: []
      };
    }
    roots[type].subList.push({
      id: `${type}:${categoryId}`,
      parentId: type,
      title: _cz_prettyCategoryTitle(item),
      icon: _cz_str(item && item.posterImageUrl),
      biz: ""
    });
  }

  const list = Object.keys(roots)
    .sort()
    .map(function (key) {
      const root = roots[key];
      if (!root.icon && root.subList.length > 0) {
        root.icon = _cz_str(root.subList[0].icon);
      }
      root.subList.sort(function (a, b) {
        return a.title.localeCompare(b.title);
      });
      return root;
    })
    .filter(function (item) {
      return item.subList.length > 0;
    });
  return list.length > 0 ? list : _cz_builtinCategories;
}

async function _cz_fetchLivesByCategory(pair, page, pageSize, payload) {
  const referer = "https://chzzk.naver.com/category/" + encodeURIComponent(pair.category);
  const effectivePageSize = _cz_categoryRoomsPageSize;
  const cacheKey = _cz_cacheKey("category", effectivePageSize, pair.type + ":" + pair.category);
  _cz_setCachedCursor(_cz_runtime.categoryCursorCache, cacheKey, 1, {
    concurrentUserCount: null,
    liveId: null
  });

  const currentCursor = _cz_getCachedCursor(_cz_runtime.categoryCursorCache, cacheKey, page);
  if (page > 1 && !currentCursor) return [];

  const content = await _cz_requestJSONFallback([
    _cz_buildCategoryLivesURL(pair, effectivePageSize, currentCursor),
    "https://api.chzzk.naver.com/service/v1/categories/" +
      encodeURIComponent(pair.type) +
      "/" +
      encodeURIComponent(pair.category) +
      "/lives?size=" +
      encodeURIComponent(String(effectivePageSize)) +
      "&offset=" +
      encodeURIComponent(String((page - 1) * effectivePageSize))
  ], payload, {
    Referer: referer
  });
  const nextCursor = content && content.page && content.page.next ? content.page.next : null;
  _cz_setCachedCursor(_cz_runtime.categoryCursorCache, cacheKey, page + 1, nextCursor);
  return _cz_contentArray(content);
}

async function _cz_fetchLives(page, pageSize, payload) {
  const offset = (page - 1) * pageSize;
  const content = await _cz_requestJSON({
    url:
      "https://api.chzzk.naver.com/service/v1/lives?size=" +
      encodeURIComponent(String(pageSize)) +
      "&offset=" +
      encodeURIComponent(String(offset)),
    headers: {
      Referer: "https://chzzk.naver.com/lives"
    }
  }, payload);
  return _cz_contentArray(content);
}

async function _cz_searchLives(keyword, page, pageSize, payload) {
  const offset = (page - 1) * pageSize;
  const encodedKeyword = encodeURIComponent(keyword);
  const content = await _cz_requestJSON({
    url:
      "https://api.chzzk.naver.com/service/v1/search/lives?keyword=" +
      encodedKeyword +
      "&size=" +
      encodeURIComponent(String(pageSize)) +
      "&offset=" +
      encodeURIComponent(String(offset)),
    headers: {
      Referer: "https://chzzk.naver.com/search?keyword=" + encodedKeyword
    }
  }, payload);
  return _cz_contentArray(content);
}

async function _cz_searchChannels(keyword, page, pageSize, payload) {
  const offset = (page - 1) * pageSize;
  const encodedKeyword = encodeURIComponent(keyword);
  const content = await _cz_requestJSON({
    url:
      "https://api.chzzk.naver.com/service/v1/search/channels?keyword=" +
      encodedKeyword +
      "&size=" +
      encodeURIComponent(String(pageSize)) +
      "&offset=" +
      encodeURIComponent(String(offset)) +
      "&withFirstChannelContent=false",
    headers: {
      Referer: "https://chzzk.naver.com/search?keyword=" + encodedKeyword
    }
  }, payload);
  return _cz_contentArray(content);
}

async function _cz_fetchChannel(channelId, payload) {
  return await _cz_requestJSON({
    url: "https://api.chzzk.naver.com/service/v1/channels/" + encodeURIComponent(channelId),
    headers: {
      Referer: "https://chzzk.naver.com/live/" + encodeURIComponent(channelId)
    }
  }, payload);
}

async function _cz_fetchLiveDetail(channelId, payload) {
  const referer = "https://chzzk.naver.com/live/" + encodeURIComponent(channelId);
  return await _cz_requestJSONFallback([
    "https://api.chzzk.naver.com/service/v3/channels/" + encodeURIComponent(channelId) + "/live-detail",
    "https://api.chzzk.naver.com/service/v1/channels/" + encodeURIComponent(channelId) + "/live-detail"
  ], payload, {
    Referer: referer
  });
}

async function _cz_fetchLiveStatus(channelId, payload) {
  const referer = "https://chzzk.naver.com/live/" + encodeURIComponent(channelId);
  return await _cz_requestJSONFallback([
    "https://api.chzzk.naver.com/polling/v3/channels/" + encodeURIComponent(channelId) + "/live-status?includePlayerRecommendContent=false",
    "https://api.chzzk.naver.com/polling/v2/channels/" + encodeURIComponent(channelId) + "/live-status",
    "https://api.chzzk.naver.com/polling/v1/channels/" + encodeURIComponent(channelId) + "/live-status"
  ], payload, {
    Referer: referer
  });
}

async function _cz_getRoomDetailByChannelId(channelId, payload) {
  const normalized = _cz_str(channelId).trim();
  if (!/^[0-9a-f]{32}$/i.test(normalized)) {
    _cz_throw("INVALID_ARGS", "channelId/roomId is required", { roomId: channelId });
  }

  const channel = await _cz_fetchChannel(normalized, payload);
  let liveDetail = null;
  let liveStatus = null;

  try {
    liveStatus = await _cz_fetchLiveStatus(normalized, payload);
  } catch (_) {}
  try {
    liveDetail = await _cz_fetchLiveDetail(normalized, payload);
  } catch (_) {}

  return _cz_detailToModel(channel, liveDetail, liveStatus);
}

function _cz_parseShareCode(input) {
  const source = _cz_str(input).trim();
  if (!source) return "";
  if (/^[0-9a-f]{32}$/i.test(source)) return source;
  const match = source.match(/chzzk\.naver\.com\/(?:live|channel)\/([0-9a-f]{32})/i);
  return match && match[1] ? match[1] : "";
}

globalThis.LiveParsePlugin = {
  apiVersion: 1,

  async getCategories(payload) {
    try {
      return await _cz_fetchCategories(payload);
    } catch (_) {
      return _cz_builtinCategories;
    }
  },

  async getRooms(payload) {
    const runtimePayload = _cz_runtimePayload(payload);
    const page = _cz_page(runtimePayload.page);
    const pageSize = _cz_pageSize(runtimePayload.pageSize || runtimePayload.size);
    const rawId = _cz_str(runtimePayload.id || runtimePayload.categoryId || runtimePayload.parentId);
    const pair = _cz_categoryPair(rawId);
    const data = pair
      ? await _cz_fetchLivesByCategory(pair, page, pageSize, runtimePayload)
      : await _cz_fetchLives(page, pageSize, runtimePayload);
    return data.map(_cz_liveToModel);
  },

  async getPlayback(payload) {
    const runtimePayload = _cz_runtimePayload(payload);
    const roomId = _cz_str(runtimePayload.roomId || runtimePayload.userId).trim();
    if (!roomId) {
      _cz_throw("INVALID_ARGS", "roomId is required", {});
    }
    const detail = await _cz_fetchLiveDetail(roomId, runtimePayload);
    if (_cz_liveStateFromStatus(detail && detail.status) !== "1") {
      _cz_throw("NOT_LIVE", "channel is not live", { roomId: roomId });
    }
    return _cz_buildPlayback(detail && detail.livePlaybackJson, roomId);
  },

  async search(payload) {
    const runtimePayload = _cz_runtimePayload(payload);
    const keyword = _cz_str(runtimePayload.keyword || runtimePayload.text || runtimePayload.q).trim();
    if (!keyword) {
      _cz_throw("INVALID_ARGS", "keyword is required", {});
    }
    const page = _cz_page(runtimePayload.page);
    const pageSize = _cz_pageSize(runtimePayload.pageSize || runtimePayload.size);

    const liveItems = await _cz_searchLives(keyword, page, pageSize, runtimePayload);
    const results = liveItems.map(_cz_liveToModel);
    if (results.length > 0) return results;

    const channelItems = await _cz_searchChannels(keyword, page, pageSize, runtimePayload);
    return channelItems.map(function (item) {
      return _cz_liveToModel({
        channel: item && item.channel ? item.channel : item,
        live: {
          channelId: item && item.channel && item.channel.channelId,
          channelName: item && item.channel && item.channel.channelName,
          channelImageUrl: item && item.channel && item.channel.channelImageUrl,
          liveTitle: item && item.channel && item.channel.channelDescription,
          status: item && item.channel && item.channel.openLive ? "OPEN" : "CLOSE",
          followerCount: item && item.channel && item.channel.followerCount
        }
      });
    });
  },

  async getRoomDetail(payload) {
    const runtimePayload = _cz_runtimePayload(payload);
    const roomId = _cz_str(runtimePayload.roomId || runtimePayload.userId).trim();
    return await _cz_getRoomDetailByChannelId(roomId, runtimePayload);
  },

  async getLiveState(payload) {
    const runtimePayload = _cz_runtimePayload(payload);
    const roomId = _cz_str(runtimePayload.roomId || runtimePayload.userId).trim();
    if (!roomId) {
      _cz_throw("INVALID_ARGS", "roomId is required", {});
    }
    const status = await _cz_fetchLiveStatus(roomId, runtimePayload);
    return {
      liveState: _cz_liveStateFromStatus(status && status.status)
    };
  },

  async resolveShare(payload) {
    const runtimePayload = _cz_runtimePayload(payload);
    const shareCode = _cz_str(runtimePayload.shareCode || runtimePayload.url || runtimePayload.text).trim();
    const channelId = _cz_parseShareCode(shareCode);
    if (!channelId) {
      _cz_throw("INVALID_ARGS", "shareCode is invalid", { shareCode: shareCode });
    }
    return await _cz_getRoomDetailByChannelId(channelId, runtimePayload);
  },

  async getDanmaku() {
    return {
      args: {},
      headers: null
    };
  }
};
