const _kick_liveType = "10";
const _kick_platformId = "kick";
const _kick_userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const _kick_playbackUserAgent = "libmpv";
const _kick_playbackHeaders = {
  "User-Agent": _kick_playbackUserAgent,
  Referer: "https://kick.com/",
  Origin: "https://kick.com"
};
const _kick_defaultPageSize = 20;
const _kick_topCategoryOrder = ["irl", "games", "music", "gambling", "creative"];
const _kick_categoryCacheKey = "kick_categories_v1";
const _kick_categoryCacheTtlMs = 24 * 60 * 60 * 1000;
const _kick_officialApiBase = "https://api.kick.com";
const _kick_oauthTokenEndpoint = "https://id.kick.com/oauth/token";
const _kick_rscBrowseReferer = "https://kick.com/browse/categories";
const _kick_fallbackCategories = [
  { id: "just-chatting", title: "Just Chatting" },
  { id: "slots-casino", title: "Slots & Casino" },
  { id: "call-of-duty", title: "Call of Duty" },
  { id: "league-of-legends", title: "League of Legends" },
  { id: "valorant", title: "VALORANT" }
];
const _kick_runtime = {
  cookie: "",
  oauth: {
    accessToken: "",
    tokenType: "Bearer",
    expiresAt: 0
  }
};

function _kick_throw(code, message, context) {
  if (globalThis.Host && typeof Host.raise === "function") {
    Host.raise(code, message, context || {});
  }
  if (globalThis.Host && typeof Host.makeError === "function") {
    throw Host.makeError(code || "UNKNOWN", message || "", context || {});
  }
  throw new Error(
    `LP_PLUGIN_ERROR:${JSON.stringify({
      code: String(code || "UNKNOWN"),
      message: String(message || ""),
      context: context || {}
    })}`
  );
}

function _kick_str(v) {
  return v === undefined || v === null ? "" : String(v);
}

function _kick_int(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function _kick_parseJSON(text, fallback) {
  try {
    return JSON.parse(_kick_str(text));
  } catch (_) {
    return fallback;
  }
}

function _kick_decodeHTML(text) {
  return _kick_str(text)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function _kick_slugify(text) {
  return _kick_decodeHTML(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function _kick_normalizeCookie(cookie) {
  return _kick_str(cookie).trim();
}

function _kick_runtimePayload(payload) {
  return payload && typeof payload === "object" ? Object.assign({}, payload) : {};
}

function _kick_normalizeAccessToken(token) {
  return _kick_str(token).trim().replace(/^Bearer\s+/i, "");
}

function _kick_pickOAuthObject(payload) {
  const runtimePayload = _kick_runtimePayload(payload);
  return runtimePayload.oauth && typeof runtimePayload.oauth === "object"
    ? runtimePayload.oauth
    : runtimePayload;
}

function _kick_pickPayloadAccessToken(payload) {
  const source = _kick_pickOAuthObject(payload);
  return _kick_normalizeAccessToken(
    source.accessToken ||
      source.access_token ||
      source.bearerToken ||
      source.oauthToken ||
      source.token
  );
}

function _kick_pickAccessToken(payload) {
  return _kick_pickPayloadAccessToken(payload) || _kick_normalizeAccessToken(_kick_runtime.oauth.accessToken);
}

function _kick_pickClientCredentials(payload) {
  const source = _kick_pickOAuthObject(payload);
  return {
    clientId: _kick_str(source.clientId || source.client_id).trim(),
    clientSecret: _kick_str(source.clientSecret || source.client_secret).trim()
  };
}

function _kick_hasOAuthInput(payload) {
  const credentials = _kick_pickClientCredentials(payload);
  return !!(
    _kick_pickPayloadAccessToken(payload) ||
    (credentials.clientId && credentials.clientSecret)
  );
}

function _kick_isRuntimeTokenFresh() {
  return !!(
    _kick_runtime.oauth.accessToken &&
    (!_kick_runtime.oauth.expiresAt || _kick_runtime.oauth.expiresAt > Date.now() + 60 * 1000)
  );
}

function _kick_encodeForm(data) {
  return Object.keys(data || {})
    .map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(_kick_str(data[key]));
    })
    .join("&");
}

function _kick_parseURLPathSlug(input) {
  const value = _kick_str(input).trim();
  if (!value) return "";

  const withoutAt = value.replace(/^@+/, "");
  if (/^[a-z0-9_\-]{2,60}$/i.test(withoutAt)) {
    return withoutAt.toLowerCase();
  }

  const m = value.match(/kick\.com\/([a-z0-9_\-]{2,60})/i);
  if (m && m[1]) return _kick_str(m[1]).toLowerCase();

  const m2 = value.match(/\/([a-z0-9_\-]{2,60})(?:\?|#|$)/i);
  if (m2 && m2[1]) return _kick_str(m2[1]).toLowerCase();

  return "";
}

function _kick_pickArray(obj, keys) {
  for (const key of keys) {
    const val = obj && obj[key];
    if (Array.isArray(val)) return val;
  }
  return [];
}

function _kick_isAggregateCategoryId(categoryId) {
  const target = _kick_str(categoryId).trim().toLowerCase();
  return !target || [
    "all",
    "root",
    "games",
    "recommended",
    "browse",
    "livestreams",
    "featured",
    "live"
  ].indexOf(target) >= 0;
}

function _kick_pickThumbnailURL(obj) {
  if (!obj || typeof obj !== "object") return "";

  if (obj.thumbnail && typeof obj.thumbnail === "object") {
    const nested = _kick_pickThumbnailURL(obj.thumbnail);
    if (nested) return nested;
  }

  const direct = [
    obj.thumbnail,
    obj.thumbnail_url,
    obj.preview_image,
    obj.cover,
    obj.poster,
    obj.src,
    obj.url
  ];
  for (const val of direct) {
    const text = _kick_str(val).trim();
    if (text) return text;
  }

  if (obj.thumbnails && typeof obj.thumbnails === "object") {
    for (const key of ["1080", "720", "480", "320", "284", "160", "src", "url"]) {
      const text = _kick_str(obj.thumbnails[key]).trim();
      if (text) return text;
    }
    for (const val of Object.values(obj.thumbnails)) {
      const text = _kick_str(val).trim();
      if (text) return text;
    }
  }

  return "";
}

function _kick_pickLiveStream(channelObj) {
  if (!channelObj || typeof channelObj !== "object") return null;
  if (channelObj.livestream && typeof channelObj.livestream === "object") {
    return channelObj.livestream;
  }
  if (channelObj.live_stream && typeof channelObj.live_stream === "object") {
    return channelObj.live_stream;
  }
  if (channelObj.metadata || channelObj.playback_url || channelObj.thumbnail_url) {
    return {
      session_title: _kick_str(channelObj && channelObj.metadata && channelObj.metadata.title),
      title: _kick_str(channelObj && channelObj.metadata && channelObj.metadata.title),
      viewer_count: _kick_int(channelObj && channelObj.viewers_count, 0),
      thumbnail: _kick_str(channelObj && channelObj.thumbnail_url),
      playback_url: _kick_str(channelObj && channelObj.playback_url),
      category: (channelObj && channelObj.metadata && channelObj.metadata.category) || null,
      started_at: _kick_str(channelObj && channelObj.started_at)
    };
  }
  if (
    channelObj.is_live === true ||
    channelObj.session_title ||
    channelObj.stream_title ||
    channelObj.viewer_count !== undefined ||
    channelObj.category ||
    channelObj.thumbnail ||
    channelObj.thumbnails ||
    channelObj.source
  ) {
    const categoryObj =
      channelObj.category && typeof channelObj.category === "object" ? channelObj.category : null;
    const categories = Array.isArray(channelObj.categories)
      ? channelObj.categories
      : (categoryObj ? [categoryObj] : []);
    return {
      id: _kick_str(channelObj.stream_id || channelObj.id || channelObj.channel_id),
      session_title: _kick_str(channelObj.session_title || channelObj.stream_title || channelObj.title),
      title: _kick_str(channelObj.title || channelObj.stream_title || channelObj.session_title),
      viewer_count: _kick_int(
        channelObj.viewer_count !== undefined ? channelObj.viewer_count : channelObj.viewers_count,
        0
      ),
      thumbnail: _kick_pickThumbnailURL(channelObj),
      playback_url: _kick_str(channelObj.playback_url || channelObj.source || channelObj.stream_url),
      category: categoryObj,
      categories: categories,
      started_at: _kick_str(channelObj.start_time || channelObj.started_at || channelObj.created_at),
      is_live: channelObj.is_live === true
    };
  }
  return null;
}

function _kick_pickCategoryFromChannel(channelObj, livestreamObj) {
  if (livestreamObj && livestreamObj.category && typeof livestreamObj.category === "object") {
    return livestreamObj.category;
  }

  const fromLive = _kick_pickArray(livestreamObj || {}, ["categories", "recent_categories"]);
  if (fromLive.length > 0) return fromLive[0];

  const fromChannel = _kick_pickArray(channelObj || {}, ["recent_categories", "categories"]);
  if (fromChannel.length > 0) return fromChannel[0];

  return null;
}

function _kick_categoryToModel(raw) {
  const id = _kick_str(raw && (raw.slug || raw.id || raw.category_id)).trim();
  const title = _kick_str(raw && (raw.name || raw.title || raw.display_name)).trim();
  if (!id || !title) return null;

  return {
    id: id,
    title: title,
    icon: _kick_str(raw && (raw.icon || (raw.banner && raw.banner.url) || raw.thumbnail || "")),
    biz: ""
  };
}

function _kick_officialCategoryToModel(raw) {
  const id = _kick_str(raw && (raw.id || raw.category_id)).trim();
  const title = _kick_str(raw && (raw.name || raw.title || raw.display_name)).trim();
  if (!id || !title) return null;

  return {
    id: id,
    parentId: "root",
    title: title,
    icon: _kick_str(raw && (raw.thumbnail || raw.icon || raw.image || "")),
    biz: JSON.stringify({
      source: "official",
      categoryId: id
    })
  };
}

function _kick_buildTopCategoryList(rawCategories) {
  const groups = new Map();

  rawCategories.forEach(function (raw) {
    if (!raw || typeof raw !== "object") return;
    const parent = raw.category && typeof raw.category === "object" ? raw.category : null;
    const parentId = _kick_str(parent && parent.slug).trim().toLowerCase();
    const parentTitle = _kick_str(parent && parent.name).trim();
    if (!parentId || !parentTitle) return;
    if (_kick_topCategoryOrder.indexOf(parentId) < 0) return;
    if (groups.has(parentId)) return;

    groups.set(parentId, {
      id: parentId,
      parentId: "root",
      title: parentTitle,
      icon: _kick_str(parent && parent.icon),
      biz: ""
    });
  });

  const subList = _kick_topCategoryOrder
    .filter(function (id) {
      return groups.has(id);
    })
    .map(function (id) {
      return groups.get(id);
    });

  return [
    {
      id: "root",
      title: "Kick",
      icon: "",
      biz: "",
      subList: subList
    }
  ];
}

function _kick_buildOfficialCategoryList(rawCategories) {
  const seen = new Set();
  const subList = [];

  rawCategories.forEach(function (raw) {
    const item = _kick_officialCategoryToModel(raw);
    if (!item) return;
    const key = _kick_str(item.id).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    subList.push(item);
  });

  return [
    {
      id: "root",
      title: "Kick",
      icon: "",
      biz: JSON.stringify({ source: "official" }),
      subList: subList
    }
  ];
}

function _kick_toRoomModel(channelObj) {
  const channel = channelObj || {};
  const livestream = _kick_pickLiveStream(channel);
  const user = channel.user || (channel.streamer && channel.streamer.user) || {};

  const roomId = _kick_str(channel.slug || user.slug || user.username || channel.name || channel.id);
  const category = _kick_pickCategoryFromChannel(channel, livestream);
  const categoryId = _kick_str(category && (category.slug || category.id || category.category_id));
  const liveState = livestream || channel.is_live === true ? "1" : "0";
  const roomCover = _kick_pickThumbnailURL((livestream && typeof livestream === "object") ? livestream : channel);
  const userName = _kick_str(user.username || user.slug || channel.slug || roomId);
  const userId = _kick_str(
    channel.channel_id ||
    channel.id ||
    user.id ||
    user.user_id ||
    userName ||
    roomId
  );

  return {
    userName: userName,
    roomTitle: _kick_str((livestream && (livestream.session_title || livestream.title)) || ""),
    roomCover: roomCover,
    userHeadImg: _kick_str(
      user.profilepic ||
        user.profile_pic ||
        user.avatar ||
        user.avatar_url ||
        channel.profile_picture ||
        channel.profile_pic ||
        ""
    ),
    liveType: _kick_liveType,
    liveState: liveState,
    userId: userId,
    roomId: roomId,
    liveWatchedCount: _kick_str((livestream && (livestream.viewer_count || livestream.viewers || livestream.watch_count)) || 0),
    biz: categoryId
  };
}

function _kick_categoryMatch(channelObj, targetId) {
  const target = _kick_str(targetId).trim().toLowerCase();
  if (_kick_isAggregateCategoryId(target)) {
    return true;
  }

  const livestream = _kick_pickLiveStream(channelObj);
  const candidates = [];

  const pushCategory = function (cat) {
    if (!cat || typeof cat !== "object") return;
    candidates.push(_kick_str(cat.slug).toLowerCase());
    candidates.push(_kick_str(cat.name).toLowerCase());
    candidates.push(_kick_str(cat.id).toLowerCase());
    candidates.push(_kick_str(cat.category_id).toLowerCase());
  };

  const pushTag = function (tag) {
    const text = _kick_slugify(tag);
    if (text) candidates.push(text);
  };

  if (livestream && livestream.category && typeof livestream.category === "object") {
    pushCategory(livestream.category);
  }

  _kick_pickArray(livestream || {}, ["categories", "recent_categories"]).forEach(pushCategory);
  _kick_pickArray(channelObj || {}, ["recent_categories", "categories"]).forEach(pushCategory);
  _kick_pickArray(livestream || {}, ["tags"]).forEach(pushTag);
  _kick_pickArray(channelObj || {}, ["tags"]).forEach(pushTag);

  return candidates.some(function (x) {
    return x && x === target;
  });
}

async function _kick_storageGet(key) {
  try {
    if (globalThis.Host && Host.storage && typeof Host.storage.get === "function") {
      return await Host.storage.get(key);
    }
  } catch (_) {}
  return null;
}

async function _kick_storageSet(key, value) {
  try {
    if (globalThis.Host && Host.storage && typeof Host.storage.set === "function") {
      await Host.storage.set(key, value);
    }
  } catch (_) {}
}

function _kick_pickRuntimeCookie(payload) {
  const runtimePayload = _kick_runtimePayload(payload);
  let runtimeCookie = _kick_normalizeCookie(runtimePayload.cookie || _kick_runtime.cookie);
  const runtimeHeaders =
    runtimePayload.headers && typeof runtimePayload.headers === "object"
      ? runtimePayload.headers
      : null;

  if (!runtimeCookie && runtimeHeaders) {
    runtimeCookie = _kick_normalizeCookie(runtimeHeaders.cookie || runtimeHeaders.Cookie);
  }

  return runtimeCookie;
}

function _kick_buildRequestAttempts(baseHeaders, sessionOptions) {
  const options = sessionOptions || {};
  const runtimeCookie = _kick_pickRuntimeCookie(options.payload);
  const attempts = [];
  const seen = new Set();

  const pushAttempt = function (authMode, extraHeaders) {
    const headers = Object.assign({}, baseHeaders || {}, extraHeaders || {});
    if (headers.Cookie && headers.cookie) {
      delete headers.cookie;
    }

    const cookieKey = _kick_normalizeCookie(headers.Cookie || headers.cookie);
    const key = `${authMode || "none"}|${cookieKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push({
      authMode: authMode || null,
      headers: headers
    });
  };

  if (runtimeCookie) {
    pushAttempt(null, { Cookie: runtimeCookie });
  } else if (options.usePlatformCookie) {
    pushAttempt("platform_cookie");
  } else if (options.allowAnonymousRequest) {
    pushAttempt(null);
  }

  if (attempts.length === 0) {
    if (options.usePlatformCookie) {
      pushAttempt("platform_cookie");
    } else {
      pushAttempt(null);
    }
  }

  return attempts;
}

async function _kick_requestWithSession(options, sessionOptions, validateResponse) {
  const merged = Object.assign({}, options || {});
  const attempts = _kick_buildRequestAttempts(merged.headers || {}, sessionOptions);
  let lastResp = null;
  let lastError = null;

  for (const attempt of attempts) {
    try {
      const resp = await _kick_request(
        Object.assign({}, merged, {
          headers: attempt.headers
        }),
        attempt.authMode
      );
      lastResp = resp;
      if (!validateResponse || validateResponse(resp, attempt)) {
        return resp;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResp) return lastResp;
  if (lastError) throw lastError;
  _kick_throw("REQUEST_FAILED", "kick request failed", { url: _kick_str(merged.url) });
}

async function _kick_request(options, authMode) {
  const merged = Object.assign({}, options || {});
  const headers = Object.assign(
    {
      "User-Agent": _kick_userAgent,
      Accept: "application/json, text/plain, */*",
      Referer: "https://kick.com/",
      Origin: "https://kick.com"
    },
    (options && options.headers) || {}
  );
  if (!merged.timeout) merged.timeout = 20;

  if (authMode) {
    return await Host.http.request({
      platformId: _kick_platformId,
      authMode: authMode,
      request: {
        url: merged.url,
        method: merged.method || "GET",
        headers: headers,
        body: merged.body || null,
        timeout: merged.timeout
      }
    });
  }

  merged.headers = headers;
  return await Host.http.request(merged);
}

async function _kick_fetchJSON(url, sessionOptions) {
  const resp = await _kick_requestWithSession(
    {
      url: url,
      method: "GET"
    },
    sessionOptions,
    function (candidateResp) {
      return _kick_parseJSON(candidateResp && candidateResp.bodyText, null) !== null;
    }
  );

  const body = _kick_parseJSON(resp && resp.bodyText, null);
  if (body === null || body === undefined) {
    _kick_throw("INVALID_RESPONSE", "invalid kick response json", { url: url });
  }
  return body;
}

async function _kick_fetchJSONStrict(url, payload) {
  return await _kick_fetchJSON(url, {
    payload: payload,
    usePlatformCookie: true
  });
}

async function _kick_exchangeClientCredentials(payload) {
  const credentials = _kick_pickClientCredentials(payload);
  if (!credentials.clientId || !credentials.clientSecret) {
    _kick_throw("INVALID_ARGS", "kick oauth clientId/clientSecret are required", {
      fields: ["clientId", "clientSecret"]
    });
  }

  const resp = await _kick_request({
    url: _kick_oauthTokenEndpoint,
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: _kick_encodeForm({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret
    }),
    timeout: 20
  });

  const body = _kick_parseJSON(resp && resp.bodyText, null);
  const statusCode = _kick_int(resp && (resp.statusCode || resp.status), 0);
  if (!body || statusCode >= 400 || !_kick_normalizeAccessToken(body.access_token)) {
    _kick_throw("AUTH_FAILED", "kick oauth token exchange failed", {
      statusCode: statusCode,
      message: _kick_str(body && (body.message || body.error || body.error_description))
    });
  }

  const expiresIn = _kick_int(body.expires_in, 0);
  _kick_runtime.oauth = {
    accessToken: _kick_normalizeAccessToken(body.access_token),
    tokenType: _kick_str(body.token_type || "Bearer"),
    expiresAt: expiresIn > 0 ? Date.now() + Math.max(1, expiresIn - 60) * 1000 : 0
  };

  return {
    accessToken: _kick_runtime.oauth.accessToken,
    tokenType: _kick_runtime.oauth.tokenType,
    expiresAt: _kick_runtime.oauth.expiresAt
  };
}

async function _kick_ensureOfficialAccessToken(payload) {
  const source = _kick_pickOAuthObject(payload);
  const directToken = _kick_normalizeAccessToken(
    source.accessToken ||
      source.access_token ||
      source.bearerToken ||
      source.oauthToken ||
      source.token
  );

  if (directToken) {
    const expiresIn = _kick_int(source.expiresIn || source.expires_in, 0);
    _kick_runtime.oauth = {
      accessToken: directToken,
      tokenType: _kick_str(source.tokenType || source.token_type || "Bearer"),
      expiresAt: expiresIn > 0 ? Date.now() + Math.max(1, expiresIn - 60) * 1000 : 0
    };
    return directToken;
  }

  if (_kick_isRuntimeTokenFresh()) {
    return _kick_runtime.oauth.accessToken;
  }

  const credentials = _kick_pickClientCredentials(payload);
  if (credentials.clientId && credentials.clientSecret) {
    const token = await _kick_exchangeClientCredentials(payload);
    return token.accessToken;
  }

  return "";
}

async function _kick_fetchOfficialJSON(url, payload) {
  const accessToken = await _kick_ensureOfficialAccessToken(payload);
  if (!accessToken) {
    _kick_throw("AUTH_REQUIRED", "kick official api requires oauth token", {});
  }

  const resp = await _kick_request({
    url: url,
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: "Bearer " + accessToken
    },
    timeout: 20
  });

  const body = _kick_parseJSON(resp && resp.bodyText, null);
  const statusCode = _kick_int(resp && (resp.statusCode || resp.status), 0);
  if (!body || statusCode >= 400) {
    _kick_throw("INVALID_RESPONSE", "invalid kick official api response", {
      url: url,
      statusCode: statusCode,
      message: _kick_str(body && (body.message || body.error || body.error_description))
    });
  }
  return body;
}

async function _kick_fetchText(url, headers, payload, validateResponse) {
  const resp = await _kick_requestWithSession(
    {
      url: url,
      method: "GET",
      headers: headers || {}
    },
    {
      payload: payload,
      usePlatformCookie: true
    },
    function (candidateResp, attempt) {
      if (typeof validateResponse === "function") {
        return validateResponse(candidateResp, attempt);
      }
      return _kick_str(candidateResp && candidateResp.bodyText).length > 0;
    }
  );

  return _kick_str(resp && resp.bodyText);
}

function _kick_buildPlaybackHeaders(payload) {
  const headers = Object.assign({}, _kick_playbackHeaders);
  const runtimeCookie = _kick_pickRuntimeCookie(payload);
  if (runtimeCookie) {
    headers.Cookie = runtimeCookie;
  }
  return headers;
}

function _kick_normalizeCategoryList(rawList, limit) {
  const maxCount = Math.max(1, Math.min(500, _kick_int(limit, 200)));
  const list = Array.isArray(rawList) ? rawList : [];
  const result = [];
  const seen = new Set();

  for (const raw of list) {
    const item = _kick_categoryToModel(raw);
    if (!item) continue;
    const key = _kick_str(item.id).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= maxCount) break;
  }

  return result;
}

async function _kick_loadCategoryCache(limit) {
  const raw = await _kick_storageGet(_kick_categoryCacheKey);
  const payload = typeof raw === "string" ? _kick_parseJSON(raw, null) : raw;
  if (!payload || typeof payload !== "object") {
    return { fresh: false, categories: [] };
  }

  const updatedAt = _kick_int(payload.updatedAt, 0);
  const age = Date.now() - updatedAt;
  const categories = _kick_normalizeCategoryList(payload.categories, limit);

  return {
    fresh: updatedAt > 0 && age >= 0 && age <= _kick_categoryCacheTtlMs,
    categories: categories
  };
}

async function _kick_saveCategoryCache(categories) {
  const normalized = _kick_normalizeCategoryList(categories, 500);
  if (!normalized.length) return;

  await _kick_storageSet(
    _kick_categoryCacheKey,
    JSON.stringify({
      version: "1",
      updatedAt: Date.now(),
      categories: normalized
    })
  );
}

function _kick_extractCategoryArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const direct = _kick_pickArray(payload, ["categories", "items", "result", "data"]);
  if (direct.length > 0) return direct;

  if (payload.data && typeof payload.data === "object") {
    return _kick_pickArray(payload.data, ["categories", "items", "result", "data"]);
  }

  return [];
}

async function _kick_fetchCategories(limit, payload) {
  const maxCount = Math.max(20, Math.min(300, _kick_int(limit, 120)));
  const endpoint = "https://kick.com/api/v1/subcategories?limit=" + encodeURIComponent(String(maxCount)) + "&page=1";
  const obj = await _kick_fetchJSONStrict(endpoint, payload);
  const categories = _kick_normalizeCategoryList(_kick_extractCategoryArray(obj), maxCount);
  if (categories.length === 0) {
    _kick_throw("INVALID_RESPONSE", "kick subcategories response is empty", { url: endpoint });
  }
  return categories;
}

async function _kick_fetchRawCategories(limit, payload) {
  const maxCount = Math.max(20, Math.min(300, _kick_int(limit, 200)));
  const endpoint = "https://kick.com/api/v1/subcategories?limit=" + encodeURIComponent(String(maxCount)) + "&page=1";
  const obj = await _kick_fetchJSONStrict(endpoint, payload);
  const rawList = _kick_extractCategoryArray(obj).filter(function (item) {
    return item && typeof item === "object";
  });
  if (rawList.length === 0) {
    _kick_throw("INVALID_RESPONSE", "kick subcategories response is empty", { url: endpoint });
  }
  return rawList;
}

function _kick_pickNextCursor(payload) {
  if (!payload || typeof payload !== "object") return "";
  return _kick_str(
    payload.next_cursor ||
      payload.nextCursor ||
      payload.cursor ||
      (payload.data && payload.data.next_cursor) ||
      (payload.pagination && (payload.pagination.next_cursor || payload.pagination.cursor))
  ).trim();
}

async function _kick_fetchOfficialRawCategories(limit, payload) {
  const maxCount = Math.max(20, Math.min(500, _kick_int(limit, 300)));
  const pageLimit = Math.min(100, maxCount);
  const result = [];
  const seen = new Set();
  let cursor = "";

  for (let page = 0; page < 10 && result.length < maxCount; page += 1) {
    const query = ["limit=" + encodeURIComponent(String(pageLimit))];
    if (cursor) query.push("cursor=" + encodeURIComponent(cursor));
    const endpoint = _kick_officialApiBase + "/public/v2/categories?" + query.join("&");
    const obj = await _kick_fetchOfficialJSON(endpoint, payload);
    const items = _kick_extractCategoryArray(obj).filter(function (item) {
      return item && typeof item === "object";
    });

    items.forEach(function (item) {
      const id = _kick_str(item && (item.id || item.category_id)).trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      result.push(item);
    });

    cursor = _kick_pickNextCursor(obj);
    if (!cursor || items.length === 0) break;
  }

  if (result.length === 0) {
    _kick_throw("INVALID_RESPONSE", "kick official categories response is empty", {});
  }
  return result.slice(0, maxCount);
}

function _kick_parseBizJSON(biz) {
  const raw = _kick_str(biz).trim();
  if (!raw) return null;
  return _kick_parseJSON(raw, null);
}

function _kick_pickOfficialCategoryId(categoryId, payload) {
  const runtimePayload = _kick_runtimePayload(payload);
  const biz = _kick_parseBizJSON(runtimePayload.biz);
  const fromBiz = _kick_str(biz && (biz.categoryId || biz.category_id)).trim();
  if (fromBiz) return fromBiz;

  const target = _kick_str(categoryId).trim();
  return /^\d+$/.test(target) ? target : "";
}

async function _kick_resolveRoomsQuery(categoryId, payload) {
  const target = _kick_str(categoryId).trim().toLowerCase();
  if (_kick_isAggregateCategoryId(target)) {
    return { streamCategory: "", exactCategoryId: "", requestedCategoryId: target };
  }

  if (["games", "irl", "music", "gambling", "creative"].indexOf(target) >= 0) {
    return { streamCategory: target, exactCategoryId: "", requestedCategoryId: target };
  }

  const rawCategories = await _kick_fetchRawCategories(200, payload);
  const matched = rawCategories.find(function (item) {
    const slug = _kick_str(item && item.slug).trim().toLowerCase();
    return slug === target;
  });
  if (!matched) {
    return { streamCategory: "", exactCategoryId: "", requestedCategoryId: target };
  }

  const parentCategory = matched.category && typeof matched.category === "object"
    ? _kick_str(matched.category.slug).trim().toLowerCase()
    : "";
  return {
    streamCategory: parentCategory || "",
    exactCategoryId: "",
    requestedCategoryId: target
  };
}

function _kick_resolveRoomsQueryFromParent(categoryId, parentId) {
  const child = _kick_str(categoryId).trim().toLowerCase();
  const parent = _kick_str(parentId).trim().toLowerCase();
  if (!parent || parent === "root") return null;
  if (_kick_topCategoryOrder.indexOf(parent) < 0) return null;
  return { streamCategory: parent, exactCategoryId: "", requestedCategoryId: child || parent };
}

function _kick_extractChannelArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of ["data", "livestreams", "channels", "result"]) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      for (const nestedKey of ["data", "items", "livestreams", "channels"]) {
        if (Array.isArray(candidate[nestedKey])) return candidate[nestedKey];
      }
    }
  }

  return [];
}

function _kick_randomRSCKey() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  ).slice(0, 12);
}

function _kick_buildCategoryRSCStateTree(slug) {
  return encodeURIComponent(
    JSON.stringify([
      "children",
      ["locale", "en", "d"],
      "children",
      "(base)",
      "children",
      "category",
      [
        "category",
        {
          children: [
            ["categorySlug", _kick_str(slug).trim().toLowerCase(), "d"],
            { children: ["__PAGE__", {}, "$undefined", "$undefined", true] },
            null,
            null,
            true
          ]
        },
        null,
        null,
        true
      ]
    ])
  );
}

function _kick_findMatchingJSONObjectEnd(text, start) {
  const source = _kick_str(text);
  if (!source || start < 0 || source[start] !== "{") return -1;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function _kick_extractRSCChannels(payload) {
  if (!payload || typeof payload !== "object") return [];
  if (payload.data && Array.isArray(payload.data.livestreams)) {
    return payload.data.livestreams;
  }
  if (Array.isArray(payload.livestreams)) {
    return payload.livestreams;
  }
  if (Array.isArray(payload.pages)) {
    for (const page of payload.pages) {
      if (page && page.data && Array.isArray(page.data.livestreams)) {
        return page.data.livestreams;
      }
    }
  }
  return [];
}

function _kick_extractRSCJSONPayload(text, marker) {
  const source = _kick_str(text);
  const needle = _kick_str(marker) || "\"livestreams\":[";
  let cursor = 0;

  while (cursor >= 0 && cursor < source.length) {
    const markerIndex = source.indexOf(needle, cursor);
    if (markerIndex < 0) break;

    let start = source.lastIndexOf("{", markerIndex);
    let attempts = 0;

    while (start >= 0 && attempts < 64) {
      const end = _kick_findMatchingJSONObjectEnd(source, start);
      if (end > markerIndex) {
        const parsed = _kick_parseJSON(source.slice(start, end + 1), null);
        if (parsed) {
          const channels = _kick_extractRSCChannels(parsed);
          if (channels.length > 0) {
            return parsed;
          }
        }
      }

      start = source.lastIndexOf("{", start - 1);
      attempts += 1;
    }

    cursor = markerIndex + needle.length;
  }

  return null;
}

function _kick_slicePage(list, page, pageSize) {
  const items = Array.isArray(list) ? list : [];
  const p = Math.max(1, _kick_int(page, 1));
  const size = Math.max(1, Math.min(100, _kick_int(pageSize, _kick_defaultPageSize)));
  const start = (p - 1) * size;
  return items.slice(start, start + size);
}

async function _kick_fetchSubcategoryRSCChannels(categorySlug, payload) {
  const slug = _kick_str(categorySlug).trim().toLowerCase();
  if (!slug) {
    _kick_throw("INVALID_ARGS", "missing kick subcategory slug", { categorySlug: categorySlug });
  }

  const endpoint =
    "https://kick.com/category/" +
    encodeURIComponent(slug) +
    "?_rsc=" +
    encodeURIComponent(_kick_randomRSCKey());
  const text = await _kick_fetchText(
    endpoint,
    {
      Accept: "text/x-component, */*;q=0.1",
      RSC: "1",
      "Next-Url": "/en/browse/categories",
      "Next-Router-State-Tree": _kick_buildCategoryRSCStateTree(slug),
      Referer: _kick_rscBrowseReferer,
      Origin: "https://kick.com"
    },
    payload,
    function (candidateResp) {
      const bodyText = _kick_str(candidateResp && candidateResp.bodyText);
      return bodyText.indexOf("\"livestreams\":[") >= 0;
    }
  );

  const parsed = _kick_extractRSCJSONPayload(text, "\"livestreams\":[");
  const channels = _kick_extractRSCChannels(parsed)
    .map(_kick_pickChannelFromItem)
    .filter(function (x) {
      return !!x;
    });

  if (channels.length === 0) {
    _kick_throw("INVALID_RESPONSE", "kick category rsc response is empty", {
      categorySlug: slug,
      url: endpoint
    });
  }

  return channels;
}


function _kick_pickChannelFromItem(item) {
  if (!item || typeof item !== "object") return null;

  if (item.data && item.data.account && item.data.account.channel) {
    const ch = Object.assign({}, item.data.account.channel);
    ch.user = item.data.account.user || ch.user || {};
    return ch;
  }

  if (item.account && item.account.channel) {
    const ch = Object.assign({}, item.account.channel);
    ch.user = item.account.user || ch.user || {};
    return ch;
  }

  if (item.streamer && item.metadata) {
    const ch = Object.assign({}, (item.streamer && item.streamer.channel) || {});
    ch.user = (item.streamer && item.streamer.user) || {};
    ch.streamer = item.streamer;
    ch.livestream = {
      id: _kick_str(item.id),
      session_title: _kick_str(item.metadata && item.metadata.title),
      title: _kick_str(item.metadata && item.metadata.title),
      viewer_count: _kick_int(item.viewers_count, 0),
      thumbnail: _kick_str(item.thumbnail_url),
      playback_url: _kick_str(item.playback_url),
      category: (item.metadata && item.metadata.category) || null,
      categories: item.metadata && item.metadata.category ? [item.metadata.category] : [],
      started_at: _kick_str(item.started_at)
    };
    return ch;
  }

  if (item.channel && typeof item.channel === "object") {
    const merged = Object.assign({}, item.channel);
    const mergedUser = Object.assign({}, merged.user || item.user || {});
    if (!mergedUser.id) {
      mergedUser.id = _kick_str(
        item.user_id ||
        merged.user_id ||
        merged.id ||
        item.channel_id ||
        item.id
      );
    }
    if (!mergedUser.username) {
      mergedUser.username = _kick_str(
        item.username ||
        merged.username ||
        merged.slug ||
        item.slug
      );
    }
    if (!mergedUser.slug) {
      mergedUser.slug = _kick_str(
        merged.slug ||
        mergedUser.username ||
        item.slug
      );
    }
    if (!mergedUser.profile_pic) {
      mergedUser.profile_pic = _kick_str(
        merged.profile_pic ||
        merged.profilepic ||
        item.profile_pic ||
        item.profilepic
      );
    }
    if (Object.keys(mergedUser).length > 0) {
      merged.user = mergedUser;
    }
    if (Array.isArray(item.tags) && !Array.isArray(merged.tags)) {
      merged.tags = item.tags.slice();
    }
    if (item.category && !merged.category) {
      merged.category = item.category;
    }
    if (Array.isArray(item.categories) && !Array.isArray(merged.categories)) {
      merged.categories = item.categories.slice();
    }
    if (item.livestream && !merged.livestream) {
      merged.livestream = item.livestream;
    } else if (
      !merged.livestream &&
      (
        item.is_live !== undefined ||
        item.session_title ||
        item.viewer_count !== undefined ||
        item.category ||
        item.categories ||
        item.tags ||
        item.thumbnail ||
        item.thumbnails ||
        item.source ||
        item.created_at
      )
    ) {
      merged.livestream = {
        id: _kick_str(item.id || item.stream_id || item.channel_id),
        session_title: _kick_str(item.session_title || item.title),
        title: _kick_str(item.title || item.session_title),
        viewer_count: _kick_int(
          item.viewer_count !== undefined ? item.viewer_count : item.viewers_count,
          0
        ),
        thumbnail: _kick_pickThumbnailURL(item),
        playback_url: _kick_str(item.playback_url || item.source || item.stream_url || merged.playback_url),
        category: item.category && typeof item.category === "object" ? item.category : null,
        categories: Array.isArray(item.categories)
          ? item.categories
          : (item.category && typeof item.category === "object" ? [item.category] : []),
        tags: Array.isArray(item.tags) ? item.tags.slice() : [],
        started_at: _kick_str(item.start_time || item.started_at || item.created_at),
        is_live: item.is_live === true
      };
    }
    return merged;
  }

  if (item.slug || item.user || item.livestream || item.recent_categories) {
    return item;
  }

  return null;
}

async function _kick_fetchLiveChannels(page, pageSize, payload, streamCategory) {
  const p = Math.max(1, _kick_int(page, 1));
  const size = Math.max(1, Math.min(100, _kick_int(pageSize, _kick_defaultPageSize)));
  const lang = "en";
  const query = [
    "page=" + encodeURIComponent(String(p)),
    "limit=" + encodeURIComponent(String(size))
  ];
  const category = _kick_str(streamCategory).trim().toLowerCase();
  if (category) {
    query.push("category=" + encodeURIComponent(category));
  }
  const endpoint = "https://kick.com/stream/livestreams/" + lang + "?" + query.join("&");
  const obj = await _kick_fetchJSONStrict(endpoint, payload);
  return _kick_extractChannelArray(obj)
    .map(_kick_pickChannelFromItem)
    .filter(function (x) {
      return !!x;
    });
}

async function _kick_fetchOfficialLiveChannels(page, pageSize, payload, categoryId) {
  const p = Math.max(1, _kick_int(page, 1));
  const size = Math.max(1, Math.min(100, _kick_int(pageSize, _kick_defaultPageSize)));
  const fetchLimit = Math.min(100, p * size);
  const query = [
    "limit=" + encodeURIComponent(String(fetchLimit)),
    "sort=viewer_count"
  ];
  const officialCategoryId = _kick_str(categoryId).trim();
  if (officialCategoryId) {
    query.push("category_id=" + encodeURIComponent(officialCategoryId));
  }

  const endpoint = _kick_officialApiBase + "/public/v1/livestreams?" + query.join("&");
  const obj = await _kick_fetchOfficialJSON(endpoint, payload);
  const channels = _kick_extractChannelArray(obj)
    .map(_kick_pickChannelFromItem)
    .filter(function (x) {
      return !!x;
    });

  const start = (p - 1) * size;
  return channels.slice(start, start + size);
}

async function _kick_searchChannels(keyword, payload) {
  const q = _kick_str(keyword).trim();
  if (!q) return [];

  const endpoint = "https://kick.com/api/search?searched_word=" + encodeURIComponent(q);
  const obj = await _kick_fetchJSONStrict(endpoint, payload);
  return _kick_extractChannelArray(obj)
    .map(_kick_pickChannelFromItem)
    .filter(function (x) {
      return !!x;
    });
}

async function _kick_fetchChannelBySlug(slug, payload) {
  const value = _kick_parseURLPathSlug(slug);
  if (!value) {
    _kick_throw("INVALID_ARGS", "roomId/userId is required", { slug: slug });
  }

  const endpoint = "https://kick.com/api/v1/channels/" + encodeURIComponent(value);
  const obj = await _kick_fetchJSONStrict(endpoint, payload);
  const channel = _kick_pickChannelFromItem(obj);
  if (channel && (_kick_str(channel.slug) || _kick_str(channel.id))) {
    return channel;
  }
  _kick_throw("NOT_FOUND", "channel not found", { slug: value });
}

async function _kick_fetchChannelLivestreamBySlug(slug, payload) {
  const value = _kick_parseURLPathSlug(slug);
  if (!value) return null;

  const endpoint = "https://api.kick.com/private/v1/channels/" + encodeURIComponent(value) + "/livestream";
  const obj = await _kick_fetchJSONStrict(endpoint, payload);
  const raw = obj && obj.data ? obj.data : obj;
  if (raw && raw.livestream && typeof raw.livestream === "object") {
    return raw.livestream;
  }
  return null;
}

async function _kick_roomDetailFromPayload(payload) {
  const runtimePayload = _kick_runtimePayload(payload);
  const roomId = _kick_str(runtimePayload.roomId);
  const userId = _kick_str(runtimePayload.userId);
  const slug = _kick_parseURLPathSlug(roomId || userId);
  const channel = await _kick_fetchChannelBySlug(slug, runtimePayload);
  const liveFromChannel = await _kick_fetchChannelLivestreamBySlug(slug, runtimePayload);
  if (liveFromChannel && typeof liveFromChannel === "object") {
    channel.livestream = {
      id: _kick_str(liveFromChannel.id),
      session_title: _kick_str(liveFromChannel.metadata && liveFromChannel.metadata.title),
      title: _kick_str(liveFromChannel.metadata && liveFromChannel.metadata.title),
      viewer_count: _kick_int(liveFromChannel.viewers_count, 0),
      thumbnail: _kick_str(liveFromChannel.thumbnail_url),
      playback_url: _kick_str(liveFromChannel.playback_url),
      category: (liveFromChannel.metadata && liveFromChannel.metadata.category) || null,
      categories: liveFromChannel.metadata && liveFromChannel.metadata.category ? [liveFromChannel.metadata.category] : []
    };
  }

  return channel;
}

function _kick_extractPlaybackURL(payload) {
  if (!payload || typeof payload !== "object") return "";

  const directCandidates = [
    payload.playback_url,
    payload.playbackUrl,
    payload.url,
    payload.hls,
    payload.hls_url
  ];
  for (const val of directCandidates) {
    const text = _kick_str(val).trim();
    if (/^https?:\/\/.+\.m3u8/i.test(text)) return text;
  }

  const nested = payload.data && typeof payload.data === "object" ? payload.data : null;
  if (nested) {
    return _kick_extractPlaybackURL(nested);
  }

  return "";
}

async function _kick_fetchPlaybackURLBySlug(slug, payload) {
  const value = _kick_parseURLPathSlug(slug);
  if (!value) return "";
  const endpoint = "https://kick.com/api/v2/channels/" + encodeURIComponent(value) + "/playback-url";
  const obj = await _kick_fetchJSONStrict(endpoint, payload);
  return _kick_extractPlaybackURL(obj);
}

async function _kick_preflightPlaybackURL(url, payload) {
  const target = _kick_str(url).trim();
  if (!target) return { ok: false, statusCode: 0, bodyText: "" };

  try {
    const resp = await _kick_requestWithSession(
      {
        url: target,
        method: "GET",
        headers: _kick_buildPlaybackHeaders(payload),
        timeout: 15
      },
      {
        payload: payload,
        usePlatformCookie: true
      },
      function (candidateResp) {
        const statusCode = _kick_int(candidateResp && (candidateResp.statusCode || candidateResp.status), 0);
        return statusCode >= 200 && statusCode < 300;
      }
    );

    const statusCode = _kick_int(resp && (resp.statusCode || resp.status), 0);
    return {
      ok: statusCode >= 200 && statusCode < 300,
      statusCode: statusCode,
      bodyText: _kick_str(resp && resp.bodyText)
    };
  } catch (error) {
    const message = _kick_str(error && error.message);
    return {
      ok: false,
      statusCode: 0,
      bodyText: message
    };
  }
}

function _kick_dedupeRooms(rooms) {
  const seen = new Set();
  const result = [];

  for (const room of rooms) {
    const key = _kick_str(room && room.roomId).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(room);
  }

  return result;
}

async function _kick_extractQualities(masterUrl, defaultQualityObj, payload) {
  const result = [];
  try {
    const resp = await _kick_requestWithSession(
      {
        url: masterUrl,
        method: "GET",
        headers: _kick_buildPlaybackHeaders(payload),
        timeout: 10
      },
      {
        payload: payload,
        usePlatformCookie: true
      },
      function (candidateResp) {
        const statusCode = _kick_int(candidateResp && (candidateResp.statusCode || candidateResp.status), 0);
        return statusCode >= 200 && statusCode < 300;
      }
    );
    const text = _kick_str(resp && resp.bodyText);
    if (!text || text.indexOf("#EXTM3U") < 0) {
      return [defaultQualityObj];
    }

    const lines = text.split(/\r?\n/);
    let currentRes = "";
    let currentBandwidth = 0;

    for (const line of lines) {
      const l = line.trim();
      if (!l) continue;
      
      if (l.startsWith("#EXT-X-STREAM-INF:")) {
        const resMatch = l.match(/RESOLUTION=\d+x(\d+)/i);
        if (resMatch && resMatch[1]) {
          currentRes = resMatch[1] + "p";
        }
        const bwMatch = l.match(/BANDWIDTH=(\d+)/i);
        if (bwMatch && bwMatch[1]) {
          currentBandwidth = parseInt(bwMatch[1], 10);
        }
      } else if (!l.startsWith("#")) {
        if (currentRes || currentBandwidth > 0) {
          let chunkUrl = l;
          if (!chunkUrl.startsWith("http://") && !chunkUrl.startsWith("https://")) {
            const urlParts = masterUrl.split("?");
            const basePath = urlParts[0].substring(0, urlParts[0].lastIndexOf("/") + 1);
            chunkUrl = basePath + chunkUrl;
            if (urlParts.length > 1 && chunkUrl.indexOf("?") < 0) {
              const sep = chunkUrl.indexOf("?") < 0 ? "?" : "&";
              chunkUrl += sep + urlParts[1];
            }
          }
          
          let title = currentRes || (Math.round(currentBandwidth / 1000) + "kbps");
          let qn = parseInt(currentRes.replace("p", ""), 10) || currentBandwidth;
          
          result.push(Object.assign({}, defaultQualityObj, {
            title: title,
            qn: qn,
            url: chunkUrl
          }));
          
          currentRes = "";
          currentBandwidth = 0;
        }
      }
    }
  } catch (_) {}

  if (result.length > 0) {
    result.sort(function(a, b) { return b.qn - a.qn; });
    const autoObj = Object.assign({}, defaultQualityObj, {
      title: "Auto",
      qn: 10000,
      url: masterUrl
    });
    result.unshift(autoObj);
    return result;
  }
  
  return [defaultQualityObj];
}

globalThis.LiveParsePlugin = {
  apiVersion: 1,

  async setCookie(payload) {
    const cookie = typeof payload === "string"
      ? _kick_normalizeCookie(payload)
      : _kick_pickRuntimeCookie(payload);
    _kick_runtime.cookie = cookie;
    return { ok: true };
  },

  async clearCookie() {
    _kick_runtime.cookie = "";
    return { ok: true };
  },

  async setOAuth(payload) {
    const runtimePayload = _kick_runtimePayload(payload);
    await _kick_ensureOfficialAccessToken(runtimePayload);
    return {
      ok: true,
      tokenType: _kick_runtime.oauth.tokenType || "Bearer",
      expiresAt: _kick_runtime.oauth.expiresAt || 0
    };
  },

  async clearOAuth() {
    _kick_runtime.oauth = {
      accessToken: "",
      tokenType: "Bearer",
      expiresAt: 0
    };
    return { ok: true };
  },

  async getCategories(payload) {
    const runtimePayload = _kick_runtimePayload(payload);
    if (_kick_hasOAuthInput(runtimePayload) || _kick_isRuntimeTokenFresh()) {
      const rawOfficialCategories = await _kick_fetchOfficialRawCategories(500, runtimePayload);
      const officialCategories = _kick_buildOfficialCategoryList(rawOfficialCategories);
      if (officialCategories[0].subList.length === 0) {
        _kick_throw("INVALID_RESPONSE", "kick official categories are empty", {});
      }
      return officialCategories;
    }

    const rawCategories = await _kick_fetchRawCategories(200, runtimePayload);
    const categories = _kick_buildTopCategoryList(rawCategories);
    if (categories.length === 0) {
      _kick_throw("INVALID_RESPONSE", "kick top categories are empty", {});
    }
    return categories;
  },

  async getRooms(payload) {
    const runtimePayload = _kick_runtimePayload(payload);
    const categoryId = _kick_str(runtimePayload.id) || "all";
    const parentId = _kick_str(runtimePayload.parentId);
    const page = Math.max(1, _kick_int(runtimePayload.page, 1));
    const pageSize = Math.max(1, Math.min(50, _kick_int(runtimePayload.pageSize, _kick_defaultPageSize)));

    if (_kick_hasOAuthInput(runtimePayload) || _kick_isRuntimeTokenFresh()) {
      const officialCategoryId = _kick_pickOfficialCategoryId(categoryId, runtimePayload);
      if (officialCategoryId || _kick_isAggregateCategoryId(categoryId)) {
        const channels = await _kick_fetchOfficialLiveChannels(page, pageSize, runtimePayload, officialCategoryId);
        const rooms = channels
          .map(_kick_toRoomModel)
          .filter(function (room) {
            return _kick_str(room.roomId) && _kick_str(room.liveState) === "1";
          });
        return _kick_dedupeRooms(rooms);
      }
    }

    const query = _kick_resolveRoomsQueryFromParent(categoryId, parentId) || await _kick_resolveRoomsQuery(categoryId, runtimePayload);
    const channels = await _kick_fetchLiveChannels(page, pageSize, runtimePayload, query.streamCategory);
    const rooms = channels
      .map(_kick_toRoomModel)
      .filter(function (room) {
        return _kick_str(room.roomId) && _kick_str(room.liveState) === "1";
      });

    return _kick_dedupeRooms(rooms);
  },

  async getPlayback(payload) {
    const runtimePayload = _kick_runtimePayload(payload);
    const channel = await _kick_roomDetailFromPayload(runtimePayload);
    const livestream = _kick_pickLiveStream(channel);

    if (!livestream) {
      _kick_throw("NOT_LIVE", "channel is offline", {
        roomId: _kick_str(channel && channel.slug)
      });
    }

    let m3u8 = _kick_str(
      (livestream && (livestream.playback_url || livestream.source)) ||
        channel.playback_url ||
        ""
    );

    if (!m3u8) {
      m3u8 = await _kick_fetchPlaybackURLBySlug(_kick_str(channel && channel.slug), runtimePayload);
    }

    if (!m3u8) {
      _kick_throw("INVALID_RESPONSE", "missing playback url", {
        roomId: _kick_str(channel && channel.slug)
      });
    }

    const finalCheck = await _kick_preflightPlaybackURL(m3u8, runtimePayload);
    if (!finalCheck.ok) {
      _kick_throw("REQUIRES_AUTH", "kick playback is access-controlled and returned 403", {
        roomId: _kick_str(channel && channel.slug),
        statusCode: _kick_int(finalCheck.statusCode, 0),
        detail: _kick_str(finalCheck.bodyText).slice(0, 240),
        tip: "请先在 App 内登录 Kick；如宿主走插件同步，也可通过 setCookie 注入会话"
      });
    }

    const playbackHeaders = _kick_buildPlaybackHeaders(runtimePayload);
    const defaultItem = {
      roomId: _kick_str(channel && channel.slug),
      title: "Auto",
      qn: 0,
      url: m3u8,
      liveCodeType: "m3u8",
      liveType: _kick_liveType,
      userAgent: _kick_playbackUserAgent,
      headers: playbackHeaders
    };

    const finalQualitys = await _kick_extractQualities(m3u8, defaultItem, runtimePayload);

    return [
      {
        cdn: "kick",
        qualitys: finalQualitys
      }
    ];
  },

  async search(payload) {
    const runtimePayload = _kick_runtimePayload(payload);
    const keyword = _kick_str(runtimePayload.keyword).trim();
    if (!keyword) {
      _kick_throw("INVALID_ARGS", "keyword is required", { field: "keyword" });
    }

    const page = Math.max(1, _kick_int(runtimePayload.page, 1));
    const pageSize = Math.max(1, Math.min(50, _kick_int(runtimePayload.pageSize, _kick_defaultPageSize)));

    const channels = await _kick_searchChannels(keyword, runtimePayload);
    const rooms = _kick_dedupeRooms(
      channels
        .map(_kick_toRoomModel)
        .filter(function (room) {
          return _kick_str(room.roomId).length > 0;
        })
    );

    const start = (page - 1) * pageSize;
    return rooms.slice(start, start + pageSize);
  },

  async getRoomDetail(payload) {
    const runtimePayload = _kick_runtimePayload(payload);
    const channel = await _kick_roomDetailFromPayload(runtimePayload);
    return _kick_toRoomModel(channel);
  },

  async getLiveState(payload) {
    const runtimePayload = _kick_runtimePayload(payload);
    const detail = await this.getRoomDetail(runtimePayload);
    return {
      liveState: _kick_str(detail && detail.liveState ? detail.liveState : "3")
    };
  },

  async resolveShare(payload) {
    const runtimePayload = _kick_runtimePayload(payload);
    const shareCode = _kick_str(runtimePayload.shareCode).trim();
    if (!shareCode) {
      _kick_throw("INVALID_ARGS", "shareCode is required", { field: "shareCode" });
    }

    const slug = _kick_parseURLPathSlug(shareCode);
    if (!slug) {
      _kick_throw("PARSE", "cannot parse kick shareCode", { shareCode: shareCode });
    }

    return await this.getRoomDetail(Object.assign({}, runtimePayload, { roomId: slug }));
  },

  async getDanmaku(payload) {
    return {
      args: {
        roomId: _kick_str(payload && payload.roomId),
        _danmu_type: "http_polling",
        _polling_url: "https://kick.com/"
      },
      headers: null
    };
  }
};
