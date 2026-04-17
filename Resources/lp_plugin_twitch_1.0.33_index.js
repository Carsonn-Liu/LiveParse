const _tw_platformId = "twitch";
const _tw_liveType = "9";
const _tw_clientId = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const _tw_ua =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const _tw_playbackUserAgent = "libmpv";
const _tw_playbackHeaders = {
  "User-Agent": _tw_playbackUserAgent,
  Referer: "https://www.twitch.tv/",
  Origin: "https://www.twitch.tv"
};
const _tw_playbackMaxAttempts = 3;
const _tw_tokenServerURL = "https://ttvtoken.a1015403703-db6.workers.dev/twitch/app-token";
const _tw_defaultPageSize = 20;
const _tw_maxPageSize = 100;
const _tw_roomPrefetchLimit = 30;
const _tw_categoryCacheKey = "twitch_categories_gql_v1";
const _tw_categoryCacheTtlMs = 6 * 60 * 60 * 1000;
const _tw_endCursorSentinel = "__END__";
const _tw_runtime = {
  cookie: "",
  roomCursorCache: {},
  roomListCache: {},
  officialAuth: null
};

const _tw_queryTopGames =
  "query($first:Int!,$after:Cursor){games(first:$first,after:$after){edges{cursor node{id displayName slug viewersCount avatarURL(width:285)}} pageInfo{hasNextPage}}}";
const _tw_queryRootStreams =
  "query($first:Int!,$after:Cursor){streams(first:$first,after:$after){edges{cursor node{id title viewersCount previewImageURL(width:640,height:360) broadcaster{id login displayName profileImageURL(width:70)} game{id displayName slug}}} pageInfo{hasNextPage}}}";
const _tw_queryGameStreams =
  "query($id:ID!,$first:Int!,$after:Cursor){game(id:$id){id displayName slug avatarURL(width:285) streams(first:$first,after:$after){edges{cursor node{id title viewersCount previewImageURL(width:640,height:360) broadcaster{id login displayName profileImageURL(width:70)} game{id displayName slug}}} pageInfo{hasNextPage}}}}";
const _tw_querySearchSuggestions =
  "query($queryFragment:String!,$withOfflineChannelContent:Boolean!){searchSuggestions(queryFragment:$queryFragment,withOfflineChannelContent:$withOfflineChannelContent){edges{node{id text content{__typename ... on SearchSuggestionChannel{id isLive isVerified login profileImageURL(width:50) user{id displayName stream{id viewersCount previewImageURL(width:640,height:360) game{id displayName slug} broadcaster{id broadcastSettings{id title}}}}} ... on SearchSuggestionCategory{id boxArtURL(width:30,height:40) game{id slug}} ... on SearchSuggestionCollection{id slug}}}} tracking{modelTrackingID responseID}}}";
const _tw_queryUserByLogin =
  "query($login:String!){user(login:$login){id login displayName profileImageURL(width:150) followers{totalCount} stream{id title viewersCount createdAt previewImageURL(width:640,height:360) game{id displayName slug}} broadcastSettings{title game{id displayName slug}}}}";
const _tw_queryUserById =
  "query($id:ID!){user(id:$id){id login displayName profileImageURL(width:150) followers{totalCount} stream{id title viewersCount createdAt previewImageURL(width:640,height:360) game{id displayName slug}} broadcastSettings{title game{id displayName slug}}}}";
const _tw_queryPlaybackToken =
  "query($login:String!,$playerType:String!){streamPlaybackAccessToken(channelName:$login,params:{platform:\"web\",playerBackend:\"mediaplayer\",playerType:$playerType}){value signature}}";

function _tw_throw(code, message, context) {
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

function _tw_str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function _tw_int(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function _tw_parseJSON(text, fallback) {
  try {
    return JSON.parse(_tw_str(text));
  } catch (_) {
    return fallback;
  }
}

function _tw_runtimePayload(payload) {
  return payload && typeof payload === "object" ? Object.assign({}, payload) : {};
}

function _tw_roomPageSize(value) {
  return Math.max(1, Math.min(_tw_maxPageSize, _tw_int(value, _tw_defaultPageSize)));
}

function _tw_normalizeCookie(cookie) {
  return _tw_str(cookie).trim();
}

function _tw_normalizeURL(url) {
  return _tw_str(url).trim();
}

function _tw_cookieValue(cookie, name) {
  const target = `${_tw_str(name)}=`;
  const parts = _tw_normalizeCookie(cookie).split(/;\s*/);
  for (const part of parts) {
    if (part.startsWith(target)) return part.slice(target.length);
  }
  return "";
}

function _tw_stripAuthPrefix(value) {
  return _tw_str(value).replace(/^(OAuth|Bearer)\s+/i, "").trim();
}

function _tw_parseLogin(input) {
  const source = _tw_str(input).trim();
  if (!source) return "";

  const plain = source.replace(/^@+/, "");
  if (/^[A-Za-z0-9_]{3,25}$/.test(plain)) return plain.toLowerCase();

  const patterns = [
    /twitch\.tv\/([A-Za-z0-9_]{3,25})/i,
    /\/([A-Za-z0-9_]{3,25})(?:\?|#|$)/i
  ];
  for (const re of patterns) {
    const match = source.match(re);
    if (match && match[1]) return _tw_str(match[1]).toLowerCase();
  }
  return "";
}

function _tw_pickRuntimeCookie(payload) {
  const runtimePayload = _tw_runtimePayload(payload);
  let cookie = _tw_normalizeCookie(runtimePayload.cookie || _tw_runtime.cookie);
  const headers =
    runtimePayload.headers && typeof runtimePayload.headers === "object"
      ? runtimePayload.headers
      : null;
  if (!cookie && headers) {
    cookie = _tw_normalizeCookie(headers.Cookie || headers.cookie);
  }
  return cookie;
}

function _tw_pickOAuthToken(payload) {
  const runtimePayload = _tw_runtimePayload(payload);
  const direct = [
    runtimePayload.oauthToken,
    runtimePayload.authToken,
    runtimePayload.accessToken,
    runtimePayload.token
  ];
  for (const item of direct) {
    const token = _tw_stripAuthPrefix(item);
    if (token) return token;
  }
  return _tw_stripAuthPrefix(_tw_cookieValue(_tw_pickRuntimeCookie(runtimePayload), "auth-token"));
}

function _tw_buildCookieHeaders(payload, mode) {
  const cookie = _tw_pickRuntimeCookie(payload);
  const token = _tw_pickOAuthToken(payload);
  const headers = {};

  if (cookie) {
    headers.Cookie = cookie;
    const deviceId = _tw_cookieValue(cookie, "unique_id");
    if (deviceId) headers["Device-ID"] = deviceId;
  }

  if (token && _tw_str(mode) === "gql") {
    headers.Authorization = `OAuth ${token}`;
  }

  return headers;
}

function _tw_buildCookieInject(mode) {
  const inject = [];
  if (_tw_str(mode) === "gql") {
    inject.push({
      cookieName: "auth-token",
      target: "header",
      headerName: "Authorization",
      prefix: "OAuth "
    });
  }
  inject.push({
    cookieName: "unique_id",
    target: "header",
    headerName: "Device-ID"
  });
  return inject;
}

function _tw_pickTokenServerURL() {
  return _tw_tokenServerURL;
}

function _tw_buildRequestOptions(request, payload, options) {
  const req = Object.assign({}, request || {});
  const opts = options && typeof options === "object" ? options : {};
  const mode = _tw_str(opts.mode);
  const method = req.method || "GET";
  const headers = Object.assign(
    opts.skipDefaultUA ? {} : { "User-Agent": _tw_ua },
    req.headers || {}
  );
  const manualHeaders = _tw_buildCookieHeaders(payload, _tw_str(opts.mode));
  const hasManualCookie = !!manualHeaders.Cookie;
  const hasManualAuth = !!manualHeaders.Authorization;
  const canUseManual = hasManualCookie || hasManualAuth;

  if (canUseManual) {
    return {
      usePlatformCookie: false,
      request: {
        url: _tw_str(req.url),
        method: method,
        headers: Object.assign({}, headers, manualHeaders),
        body: req.body || null,
        timeout: req.timeout || 20
      }
    };
  }

  if (mode === "gql" && opts.allowPlatformCookie && opts.preferPlatformCookie) {
    return {
      usePlatformCookie: true,
      cookieInject: _tw_buildCookieInject(opts.mode),
      request: {
        url: _tw_str(req.url),
        method: method,
        headers: headers,
        body: req.body || null,
        timeout: req.timeout || 20
      }
    };
  }

  if (mode === "gql") {
    return {
      usePlatformCookie: false,
      request: {
        url: _tw_str(req.url),
        method: method,
        headers: headers,
        body: req.body || null,
        timeout: req.timeout || 20
      }
    };
  }

  return {
    usePlatformCookie: !!opts.allowPlatformCookie,
    cookieInject: opts.allowPlatformCookie ? _tw_buildCookieInject(opts.mode) : null,
    request: {
      url: _tw_str(req.url),
      method: method,
      headers: headers,
      body: req.body || null,
      timeout: req.timeout || 20
    }
  };
}

async function _tw_httpRequest(request, payload, options) {
  const built = _tw_buildRequestOptions(request, payload, options);
  if (built.usePlatformCookie) {
    const wrapped = {
      platformId: _tw_platformId,
      authMode: "platform_cookie",
      request: built.request
    };
    if (Array.isArray(built.cookieInject) && built.cookieInject.length > 0) {
      wrapped.cookieInject = built.cookieInject;
    }
    return await Host.http.request(wrapped);
  }
  return await Host.http.request(built.request);
}

async function _tw_storageGet(key) {
  try {
    if (globalThis.Host && Host.storage && typeof Host.storage.get === "function") {
      return await Host.storage.get(key);
    }
  } catch (_) {}
  return null;
}

async function _tw_storageSet(key, value) {
  try {
    if (globalThis.Host && Host.storage && typeof Host.storage.set === "function") {
      await Host.storage.set(key, value);
    }
  } catch (_) {}
}

function _tw_hasFreshOfficialAuth(payload) {
  const auth = _tw_runtime.officialAuth;
  const now = Math.floor(Date.now() / 1000);
  const currentURL = _tw_pickTokenServerURL(payload);
  return !!(
    auth &&
    _tw_str(auth.clientId) &&
    _tw_str(auth.accessToken) &&
    _tw_str(auth.tokenServerURL) === _tw_str(currentURL) &&
    _tw_int(auth.expiresAt, 0) > now + 120
  );
}

async function _tw_fetchOfficialAuth(payload) {
  const url = _tw_pickTokenServerURL(payload);
  if (!url) {
    _tw_throw("INVALID_ARGS", "tokenServerURL is required for official twitch api mode", {});
  }

  const headers = {
    Accept: "application/json"
  };

  const response = await _tw_httpRequest(
    {
      url: url,
      method: "GET",
      headers: headers
    },
    {},
    { mode: "", allowPlatformCookie: false, skipDefaultUA: true }
  );
  const data = _tw_parseJSON(response && response.bodyText, null);
  if (!data || typeof data !== "object") {
    _tw_throw("INVALID_RESPONSE", "invalid token server response", {});
  }

  const clientId = _tw_str(data.clientId);
  const accessToken = _tw_stripAuthPrefix(data.accessToken);
  if (!clientId || !accessToken) {
    _tw_throw("INVALID_RESPONSE", "missing clientId or accessToken in token server response", {});
  }

  _tw_runtime.officialAuth = {
    clientId: clientId,
    accessToken: accessToken,
    expiresAt: _tw_int(data.expiresAt, 0),
    tokenServerURL: url
  };
  return _tw_runtime.officialAuth;
}

async function _tw_getOfficialAuth(payload) {
  if (_tw_hasFreshOfficialAuth(payload)) {
    return _tw_runtime.officialAuth;
  }
  return await _tw_fetchOfficialAuth(payload);
}

function _tw_buildHelixURL(path, params) {
  const query = [];
  const source = params && typeof params === "object" ? params : {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (_tw_str(item) !== "") {
          query.push(`${encodeURIComponent(key)}=${encodeURIComponent(_tw_str(item))}`);
        }
      }
      continue;
    }
    if (_tw_str(value) !== "") {
      query.push(`${encodeURIComponent(key)}=${encodeURIComponent(_tw_str(value))}`);
    }
  }
  return `https://api.twitch.tv/helix/${path}${query.length ? `?${query.join("&")}` : ""}`;
}

async function _tw_helix(path, params, payload) {
  const auth = await _tw_getOfficialAuth(payload);
  const response = await _tw_httpRequest(
    {
      url: _tw_buildHelixURL(path, params),
      method: "GET",
      headers: {
        "Client-Id": _tw_str(auth.clientId),
        Authorization: `Bearer ${_tw_str(auth.accessToken)}`,
        Accept: "application/json"
      }
    },
    {},
    { mode: "", allowPlatformCookie: false, skipDefaultUA: true }
  );

  const data = _tw_parseJSON(response && response.bodyText, null);
  if (!data || typeof data !== "object") {
    _tw_throw("INVALID_RESPONSE", "invalid helix response", { path: path });
  }
  if (data.error || _tw_int(data.status, 0) >= 400) {
    _tw_throw("UPSTREAM", _tw_str(data.message) || "twitch helix error", {
      path: path,
      status: _tw_int(data.status, 0)
    });
  }
  return data;
}

async function _tw_loadCategoryCache(limit) {
  const raw = await _tw_storageGet(_tw_categoryCacheKey);
  const payload = typeof raw === "string" ? _tw_parseJSON(raw, null) : raw;
  if (!payload || typeof payload !== "object") {
    return { fresh: false, categories: [] };
  }

  const updatedAt = _tw_int(payload.updatedAt, 0);
  const age = Date.now() - updatedAt;
  const categories = Array.isArray(payload.categories) ? payload.categories.slice(0, limit) : [];
  return {
    fresh: updatedAt > 0 && age >= 0 && age <= _tw_categoryCacheTtlMs,
    categories: categories
  };
}

async function _tw_saveCategoryCache(categories) {
  const payload = {
    updatedAt: Date.now(),
    categories: Array.isArray(categories) ? categories : []
  };
  await _tw_storageSet(_tw_categoryCacheKey, JSON.stringify(payload));
}

function _tw_isAuthErrorMessage(message) {
  return /(auth|oauth|login|logged in|unauthor|forbidden|cookie|required|token)/i.test(
    _tw_str(message)
  );
}

async function _tw_gql(query, variables, payload, options) {
  const gqlOptions = options && typeof options === "object" ? options : {};
  const response = await _tw_httpRequest(
    {
      url: "https://gql.twitch.tv/gql",
      method: "POST",
      headers: {
        "Client-ID": _tw_clientId,
        "Content-Type": "text/plain; charset=UTF-8",
        Accept: "*/*",
        Referer: "https://www.twitch.tv/",
        Origin: "https://www.twitch.tv/"
      },
      body: JSON.stringify({
        query: _tw_str(query),
        variables: variables || {}
      })
    },
    payload,
    {
      mode: "gql",
      allowPlatformCookie: gqlOptions.allowPlatformCookie !== false,
      preferPlatformCookie: !!gqlOptions.preferPlatformCookie
    }
  );

  const data = _tw_parseJSON(response && response.bodyText, null);
  if (!data || typeof data !== "object") {
    _tw_throw("INVALID_RESPONSE", "invalid gql response", {});
  }

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const message = _tw_str(data.errors[0] && data.errors[0].message) || "twitch gql error";
    if (_tw_isAuthErrorMessage(message)) {
      _tw_throw("AUTH_REQUIRED", message, {});
    }
    _tw_throw("UPSTREAM", message, {});
  }

  return data.data || {};
}

function _tw_pickImage(raw, width, height) {
  return _tw_str(raw)
    .replace("{width}", _tw_str(width))
    .replace("{height}", _tw_str(height));
}

function _tw_cacheKey(prefix, pageSize, key) {
  return `${prefix}|${_tw_roomPageSize(pageSize)}|${_tw_str(key)}`;
}

function _tw_hasCachedCursor(store, cacheKey, page) {
  return !!(
    store &&
    store[cacheKey] &&
    Object.prototype.hasOwnProperty.call(store[cacheKey], String(page))
  );
}

function _tw_getCachedCursor(store, cacheKey, page) {
  const bucket = (store && store[cacheKey]) || {};
  return _tw_str(bucket[String(page)]);
}

function _tw_setCachedCursor(store, cacheKey, page, cursor) {
  if (!store[cacheKey]) store[cacheKey] = {};
  const normalized = _tw_str(cursor);
  store[cacheKey][String(page)] = normalized ? normalized : _tw_endCursorSentinel;
}

function _tw_resetCursorStore(store, cacheKey) {
  store[cacheKey] = { "1": "" };
}

async function _tw_resolveCursorForPage(store, cacheKey, currentPage, fetchPage) {
  if (!_tw_hasCachedCursor(store, cacheKey, 1)) {
    _tw_resetCursorStore(store, cacheKey);
  }

  if (_tw_hasCachedCursor(store, cacheKey, currentPage)) {
    const cached = _tw_getCachedCursor(store, cacheKey, currentPage);
    return cached === _tw_endCursorSentinel ? null : cached;
  }

  for (let page = 1; page < currentPage; page += 1) {
    if (_tw_hasCachedCursor(store, cacheKey, page + 1)) continue;
    const cursor = _tw_getCachedCursor(store, cacheKey, page);
    if (cursor === _tw_endCursorSentinel) return null;
    const response = await fetchPage(cursor || null);
    _tw_setCachedCursor(store, cacheKey, page + 1, response && response.nextCursor);
    if (!_tw_hasCachedCursor(store, cacheKey, page + 1)) {
      _tw_setCachedCursor(store, cacheKey, page + 1, "");
    }
    const nextValue = _tw_getCachedCursor(store, cacheKey, page + 1);
    if (nextValue === _tw_endCursorSentinel) return null;
  }

  const resolved = _tw_getCachedCursor(store, cacheKey, currentPage);
  return resolved === _tw_endCursorSentinel ? null : resolved;
}

async function _tw_fetchCursorPage(store, prefix, id, page, pageSize, fetchPage) {
  const currentPage = Math.max(1, _tw_int(page, 1));
  const size = _tw_roomPageSize(pageSize);
  const cacheKey = _tw_cacheKey(prefix, size, id);

  if (currentPage === 1) {
    _tw_resetCursorStore(store, cacheKey);
  }

  const cursor = await _tw_resolveCursorForPage(store, cacheKey, currentPage, fetchPage);
  if (currentPage > 1 && cursor === null) {
    return {
      items: [],
      nextCursor: ""
    };
  }

  const response = await fetchPage(cursor || null);
  _tw_setCachedCursor(store, cacheKey, currentPage + 1, response && response.nextCursor);
  return response;
}

function _tw_gameNodeToCategory(game) {
  const id = _tw_str(game && game.id);
  const title = _tw_str(game && (game.displayName || game.name)).trim();
  if (!id || !title) return null;
  return {
    id: id,
    title: title,
    icon: _tw_pickImage(game && (game.avatarURL || game.boxArtURL), 285, 380),
    biz: _tw_str(game && game.slug)
  };
}

function _tw_helixGameToCategory(game) {
  const id = _tw_str(game && game.id);
  const title = _tw_str(game && game.name).trim();
  if (!id || !title) return null;
  return {
    id: id,
    title: title,
    icon: _tw_pickImage(game && game.box_art_url, 285, 380),
    biz: ""
  };
}

function _tw_streamNodeToRoom(stream, fallbackGame) {
  const item = stream || {};
  const broadcaster = item.broadcaster || {};
  const game = item.game || fallbackGame || {};
  const login = _tw_parseLogin(broadcaster.login);
  return {
    userName: _tw_str(broadcaster.displayName || login),
    roomTitle: _tw_str(item.title),
    roomCover: _tw_pickImage(item.previewImageURL, 640, 360),
    userHeadImg: _tw_pickImage(broadcaster.profileImageURL, 70, 70),
    liveType: _tw_liveType,
    liveState: "1",
    userId: _tw_str(broadcaster.id),
    roomId: login,
    liveWatchedCount: _tw_str(item.viewersCount || 0),
    biz: _tw_str(game.id)
  };
}

function _tw_helixStreamToRoom(stream, userMap) {
  const item = stream || {};
  const userId = _tw_str(item.user_id);
  const user = (userMap && userMap[userId]) || {};
  const login = _tw_parseLogin(item.user_login || user.login);
  return {
    userName: _tw_str(item.user_name || user.display_name || login),
    roomTitle: _tw_str(item.title),
    roomCover: _tw_pickImage(item.thumbnail_url, 640, 360),
    userHeadImg: _tw_str(user.profile_image_url),
    liveType: _tw_liveType,
    liveState: _tw_str(item.type) === "live" ? "1" : "0",
    userId: userId,
    roomId: login,
    liveWatchedCount: _tw_str(item.viewer_count || 0),
    biz: _tw_str(item.game_id)
  };
}

function _tw_helixSearchItemToRoom(item, userMap) {
  const channel = item || {};
  const login = _tw_parseLogin(channel.broadcaster_login || channel.display_name || channel.id);
  const user = (userMap && userMap[login]) || {};
  return {
    userName: _tw_str(channel.display_name || user.display_name || login),
    roomTitle: _tw_str(channel.title),
    roomCover: _tw_pickImage(channel.thumbnail_url, 640, 360),
    userHeadImg: _tw_str(user.profile_image_url),
    liveType: _tw_liveType,
    liveState: channel.is_live ? "1" : "0",
    userId: _tw_str(channel.id || user.id),
    roomId: login,
    liveWatchedCount: "0",
    biz: _tw_str(channel.game_id)
  };
}

function _tw_userToRoomDetail(user) {
  const item = user || {};
  const stream = item.stream || null;
  const broadcastSettings = item.broadcastSettings || {};
  const login = _tw_parseLogin(item.login);
  const game = (stream && stream.game) || broadcastSettings.game || {};
  return {
    userName: _tw_str(item.displayName || login),
    roomTitle: _tw_str((stream && stream.title) || broadcastSettings.title),
    roomCover: _tw_pickImage(stream && stream.previewImageURL, 640, 360),
    userHeadImg: _tw_pickImage(item.profileImageURL, 150, 150),
    liveType: _tw_liveType,
    liveState: stream ? "1" : "0",
    userId: _tw_str(item.id),
    roomId: login,
    liveWatchedCount: _tw_str((stream && stream.viewersCount) || 0),
    biz: _tw_str(game.id)
  };
}

function _tw_searchEdgeToRoom(edge) {
  const node = (edge && edge.node) || {};
  const content = node.content || {};
  if (_tw_str(content.__typename) !== "SearchSuggestionChannel") return null;

  const login = _tw_parseLogin(content.login);
  if (!login) return null;

  const user = content.user || {};
  const stream = user.stream || null;
  const game = (stream && stream.game) || {};
  const title =
    _tw_str(stream && stream.title) ||
    _tw_str(
      stream &&
        stream.broadcaster &&
        stream.broadcaster.broadcastSettings &&
        stream.broadcaster.broadcastSettings.title
    );

  return {
    userName: _tw_str(user.displayName || node.text || login),
    roomTitle: title,
    roomCover: _tw_pickImage(stream && stream.previewImageURL, 640, 360),
    userHeadImg: _tw_pickImage(content.profileImageURL, 50, 50),
    liveType: _tw_liveType,
    liveState: content.isLive ? "1" : "0",
    userId: _tw_str(user.id || content.id),
    roomId: login,
    liveWatchedCount: _tw_str((stream && stream.viewersCount) || 0),
    biz: _tw_str(game.id)
  };
}

function _tw_dedupeRooms(rooms) {
  const result = [];
  const seen = new Set();
  const list = Array.isArray(rooms) ? rooms : [];
  for (const item of list) {
    const room = item || {};
    const key = _tw_str(room.roomId || room.userId);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(room);
  }
  return result;
}

function _tw_roomListCacheKey(id) {
  return _tw_str(id || "all");
}

function _tw_getCachedRoomList(id) {
  const key = _tw_roomListCacheKey(id);
  const list = _tw_runtime.roomListCache[key];
  return Array.isArray(list) ? list.slice() : null;
}

function _tw_setCachedRoomList(id, rooms) {
  const key = _tw_roomListCacheKey(id);
  _tw_runtime.roomListCache[key] = Array.isArray(rooms) ? rooms.slice() : [];
}

function _tw_sliceRooms(rooms, page, pageSize) {
  const list = Array.isArray(rooms) ? rooms : [];
  const currentPage = Math.max(1, _tw_int(page, 1));
  const size = Math.max(1, _tw_int(pageSize, _tw_defaultPageSize));
  const start = (currentPage - 1) * size;
  return list.slice(start, start + size);
}

function _tw_chunkList(source, size) {
  const list = Array.isArray(source) ? source : [];
  const chunkSize = Math.max(1, _tw_int(size, 100));
  const result = [];
  for (let index = 0; index < list.length; index += chunkSize) {
    result.push(list.slice(index, index + chunkSize));
  }
  return result;
}

function _tw_mapUsersById(users) {
  const map = {};
  const list = Array.isArray(users) ? users : [];
  for (const user of list) {
    const item = user || {};
    const id = _tw_str(item.id);
    if (!id) continue;
    map[id] = item;
  }
  return map;
}

function _tw_mapUsersByLogin(users) {
  const map = {};
  const list = Array.isArray(users) ? users : [];
  for (const user of list) {
    const item = user || {};
    const login = _tw_parseLogin(item.login);
    if (!login) continue;
    map[login] = item;
  }
  return map;
}

async function _tw_fetchUsersByIds(ids, payload) {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map(function (item) {
          return _tw_str(item).trim();
        })
        .filter(Boolean)
    )
  );
  if (uniqueIds.length === 0) return [];

  const result = [];
  for (const chunk of _tw_chunkList(uniqueIds, 100)) {
    const data = await _tw_helix("users", { id: chunk }, payload);
    result.push.apply(result, Array.isArray(data.data) ? data.data : []);
  }
  return result;
}

async function _tw_fetchUsersByLogins(logins, payload) {
  const uniqueLogins = Array.from(
    new Set(
      (Array.isArray(logins) ? logins : [])
        .map(function (item) {
          return _tw_parseLogin(item);
        })
        .filter(Boolean)
    )
  );
  if (uniqueLogins.length === 0) return [];

  const result = [];
  for (const chunk of _tw_chunkList(uniqueLogins, 100)) {
    const data = await _tw_helix("users", { login: chunk }, payload);
    result.push.apply(result, Array.isArray(data.data) ? data.data : []);
  }
  return result;
}

async function _tw_fetchStreamsByUserIds(ids, payload) {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map(function (item) {
          return _tw_str(item).trim();
        })
        .filter(Boolean)
    )
  );
  if (uniqueIds.length === 0) return [];

  const result = [];
  for (const chunk of _tw_chunkList(uniqueIds, 100)) {
    const data = await _tw_helix("streams", { user_id: chunk, first: chunk.length }, payload);
    result.push.apply(result, Array.isArray(data.data) ? data.data : []);
  }
  return result;
}

async function _tw_fetchHelixCategories(limit, payload) {
  const batchSize = Math.max(1, Math.min(100, _tw_int(limit, 100)));
  const response = await _tw_helix("games/top", { first: batchSize }, payload);
  const items = Array.isArray(response.data) ? response.data : [];
  return items
    .map(function (item) {
      return _tw_helixGameToCategory(item);
    })
    .filter(Boolean);
}

async function _tw_fetchHelixStreamsPage(categoryId, page, pageSize, payload) {
  const listId = _tw_str(categoryId || "all");
  return await _tw_fetchCursorPage(
    _tw_runtime.roomCursorCache,
    "helix-streams",
    listId,
    page,
    pageSize,
    async function (cursor) {
      const params = {
        first: _tw_roomPageSize(pageSize)
      };
      if (listId !== "all") {
        params.game_id = listId;
      }
      if (cursor) {
        params.after = cursor;
      }

      const response = await _tw_helix("streams", params, payload);
      const streams = Array.isArray(response.data) ? response.data : [];
      const users = await _tw_fetchUsersByIds(
        streams.map(function (item) {
          return item && item.user_id;
        }),
        payload
      );
      const userMap = _tw_mapUsersById(users);

      return {
        items: streams
          .map(function (item) {
            return _tw_helixStreamToRoom(item, userMap);
          })
          .filter(Boolean),
        nextCursor: _tw_str(response && response.pagination && response.pagination.cursor)
      };
    }
  );
}

async function _tw_fetchHelixSearchPage(keyword, page, pageSize, payload) {
  return await _tw_fetchCursorPage(
    _tw_runtime.roomCursorCache,
    "helix-search",
    keyword,
    page,
    pageSize,
    async function (cursor) {
      const params = {
        query: keyword,
        first: _tw_roomPageSize(pageSize),
        live_only: false
      };
      if (cursor) {
        params.after = cursor;
      }

      const response = await _tw_helix("search/channels", params, payload);
      const channels = Array.isArray(response.data) ? response.data : [];
      const users = await _tw_fetchUsersByLogins(
        channels.map(function (item) {
          return item && item.broadcaster_login;
        }),
        payload
      );
      const userMap = _tw_mapUsersByLogin(users);

      return {
        items: channels
          .map(function (item) {
            return _tw_helixSearchItemToRoom(item, userMap);
          })
          .filter(Boolean),
        nextCursor: _tw_str(response && response.pagination && response.pagination.cursor)
      };
    }
  );
}

async function _tw_fetchHelixUserProfile(identity, payload) {
  const source = _tw_str(identity).trim();
  if (!source) {
    _tw_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
  }

  let usersResponse = null;
  if (/^\d+$/.test(source)) {
    usersResponse = await _tw_helix("users", { id: source }, payload);
  } else {
    const login = _tw_parseLogin(source);
    if (!login) {
      _tw_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    }
    usersResponse = await _tw_helix("users", { login: login }, payload);
  }

  const user = Array.isArray(usersResponse.data) ? usersResponse.data[0] : null;
  if (!user) {
    _tw_throw("NOT_FOUND", "channel not found", { roomId: source });
  }

  const streamResponse = await _tw_helix("streams", { user_id: _tw_str(user.id), first: 1 }, payload);
  const stream = Array.isArray(streamResponse.data) ? streamResponse.data[0] : null;

  return {
    user: user,
    stream: stream
  };
}

function _tw_helixUserProfileToRoomDetail(profile) {
  const user = (profile && profile.user) || {};
  const stream = (profile && profile.stream) || null;
  const login = _tw_parseLogin(user.login);

  return {
    userName: _tw_str(user.display_name || login),
    roomTitle: _tw_str((stream && stream.title) || ""),
    roomCover: _tw_pickImage(stream && stream.thumbnail_url, 640, 360),
    userHeadImg: _tw_str(user.profile_image_url),
    liveType: _tw_liveType,
    liveState: stream ? "1" : "0",
    userId: _tw_str(user.id),
    roomId: login,
    liveWatchedCount: _tw_str((stream && stream.viewer_count) || 0),
    biz: _tw_str((stream && stream.game_id) || "")
  };
}

async function _tw_fetchTopGames(limit, payload) {
  const batchSize = Math.max(1, Math.min(100, _tw_int(limit, 100)));
  const data = await _tw_gql(
    _tw_queryTopGames,
    {
      first: batchSize,
      after: null
    },
    payload
  );
  const games = data && data.games ? data.games : {};
  const edges = Array.isArray(games.edges) ? games.edges : [];
  return edges
    .map(function (edge) {
      return _tw_gameNodeToCategory(edge && edge.node);
    })
    .filter(Boolean);
}

async function _tw_fetchAllStreamsPage(page, pageSize, payload) {
  let rooms = _tw_getCachedRoomList("all");
  if (!rooms || Math.max(1, _tw_int(page, 1)) === 1) {
    const data = await _tw_gql(
      _tw_queryRootStreams,
      {
        first: _tw_roomPrefetchLimit,
        after: null
      },
      payload
    );
    const streams = data && data.streams ? data.streams : {};
    const edges = Array.isArray(streams.edges) ? streams.edges : [];
    rooms = edges
      .map(function (edge) {
        return _tw_streamNodeToRoom(edge && edge.node, null);
      })
      .filter(Boolean);
    _tw_setCachedRoomList("all", rooms);
  }

  return {
    items: _tw_sliceRooms(rooms, page, pageSize)
  };
}

async function _tw_fetchCategoryStreamsPage(categoryId, page, pageSize, payload) {
  const listId = _tw_str(categoryId);
  let rooms = _tw_getCachedRoomList(listId);
  if (!rooms || Math.max(1, _tw_int(page, 1)) === 1) {
    const data = await _tw_gql(
      _tw_queryGameStreams,
      {
        id: listId,
        first: _tw_roomPrefetchLimit,
        after: null
      },
      payload
    );
    const game = data && data.game ? data.game : null;
    if (!game) {
      _tw_setCachedRoomList(listId, []);
      return { items: [] };
    }
    const streams = game.streams || {};
    const edges = Array.isArray(streams.edges) ? streams.edges : [];
    rooms = edges
      .map(function (edge) {
        return _tw_streamNodeToRoom(edge && edge.node, game);
      })
      .filter(Boolean);
    _tw_setCachedRoomList(listId, rooms);
  }

  return {
    items: _tw_sliceRooms(rooms, page, pageSize)
  };
}

async function _tw_fetchUserProfile(identity, payload) {
  const source = _tw_str(identity).trim();
  if (!source) {
    _tw_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
  }

  let data = null;
  if (/^\d+$/.test(source)) {
    data = await _tw_gql(
      _tw_queryUserById,
      {
        id: source
      },
      payload
    );
  } else {
    const parsedLogin = _tw_parseLogin(source);
    if (!parsedLogin) {
      _tw_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    }
    data = await _tw_gql(
      _tw_queryUserByLogin,
      {
        login: parsedLogin
      },
      payload
    );
  }

  const user = data && data.user ? data.user : null;
  if (!user) {
    _tw_throw("NOT_FOUND", "channel not found", { roomId: source });
  }
  return user;
}

function _tw_buildM3U8URL(login, signature, token) {
  const base = `https://usher.ttvnw.net/api/v2/channel/hls/${encodeURIComponent(_tw_str(login).toLowerCase())}.m3u8`;
  const query = [
    "platform=web",
    `p=${Math.floor(Math.random() * 999999)}`,
    "allow_source=true",
    "allow_audio_only=true",
    "playlist_include_framerate=true",
    "supported_codecs=av1,h265,h264",
    `sig=${encodeURIComponent(_tw_str(signature))}`,
    `token=${encodeURIComponent(_tw_str(token))}`
  ].join("&");
  return `${base}?${query}`;
}

function _tw_parseM3U8Attributes(line) {
  const attrs = {};
  const source = _tw_str(line);
  const start = source.indexOf(":");
  const payload = start >= 0 ? source.slice(start + 1) : source;
  const re = /([A-Z0-9-]+)=((?:"[^"]*")|[^,]*)/g;
  let match = re.exec(payload);
  while (match) {
    let value = _tw_str(match[2]);
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    }
    attrs[_tw_str(match[1])] = value;
    match = re.exec(payload);
  }
  return attrs;
}

function _tw_parseM3U8Variants(text, roomId) {
  const lines = _tw_str(text)
    .split(/\r?\n/)
    .map(function (line) {
      return _tw_str(line).trim();
    })
    .filter(function (line) {
      return !!line;
    });

  const variants = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const attrs = _tw_parseM3U8Attributes(line);
    const url = _tw_str(lines[i + 1]);
    if (!url || url.startsWith("#")) continue;
    variants.push({
      roomId: roomId,
      title: _tw_str(attrs.NAME || attrs.RESOLUTION || attrs.VIDEO || `Quality ${variants.length + 1}`),
      qn: _tw_int(attrs.BANDWIDTH, 0),
      url: url,
      liveCodeType: "m3u8",
      liveType: _tw_liveType,
      userAgent: _tw_playbackUserAgent,
      headers: _tw_playbackHeaders
    });
  }

  variants.sort(function (a, b) {
    return _tw_int(b.qn, 0) - _tw_int(a.qn, 0);
  });
  return variants;
}

async function _tw_getPlaybackForLogin(login, payload) {
  const attempts = Math.max(1, _tw_int(payload && payload.playbackMaxAttempts, _tw_playbackMaxAttempts));
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const playerType = attempt === 2 ? "site" : "embed";
      const data = await _tw_gql(
        _tw_queryPlaybackToken,
        {
          login: _tw_str(login),
          playerType: playerType
        },
        payload,
        { preferPlatformCookie: true }
      );
      const tokenObj = data && data.streamPlaybackAccessToken ? data.streamPlaybackAccessToken : null;
      const token = _tw_str(tokenObj && tokenObj.value);
      const signature = _tw_str(tokenObj && tokenObj.signature);
      if (!token || !signature) {
        _tw_throw("INVALID_RESPONSE", "missing playback token", {
          login: login,
          attempt: attempt,
          playerType: playerType
        });
      }

      const masterURL = _tw_buildM3U8URL(login, signature, token);
      const response = await _tw_httpRequest(
        {
          url: masterURL,
          method: "GET",
          headers: _tw_playbackHeaders
        },
        payload,
        { mode: "gql", allowPlatformCookie: true }
      );

      const qualitys = _tw_parseM3U8Variants(response && response.bodyText, _tw_str(login));
      if (qualitys.length === 0) {
        qualitys.push({
          roomId: _tw_str(login),
          title: "Source",
          qn: 1,
          url: masterURL,
          liveCodeType: "m3u8",
          liveType: _tw_liveType,
          userAgent: _tw_playbackUserAgent,
          headers: _tw_playbackHeaders
        });
      }

      return [
        {
          cdn: "usher",
          qualitys: qualitys
        }
      ];
    } catch (error) {
      lastError = error;
    }
  }

  _tw_throw("UPSTREAM", "failed to fetch twitch playback after retries", {
    login: _tw_str(login),
    attempts: attempts,
    message: _tw_str(lastError && lastError.message)
  });
}

const __tw_sharedGlobalKey = "__lp_plugin_twitch_1_0_33_shared";

function _tw_danmakuDriver() {
  const driver = globalThis.__twDanmakuDriver;
  if (!driver) {
    _tw_throw("UNSUPPORTED", "twitch danmaku driver is unavailable", {});
  }
  return driver;
}

globalThis[__tw_sharedGlobalKey] = {
  throwError: _tw_throw,
  parseLogin: _tw_parseLogin
};

globalThis.LiveParsePlugin = {
  apiVersion: 1,

  async setCookie(payload) {
    const runtimePayload = _tw_runtimePayload(payload);
    _tw_runtime.cookie =
      typeof payload === "string" ? _tw_normalizeCookie(payload) : _tw_pickRuntimeCookie(runtimePayload);
    _tw_runtime.roomCursorCache = {};
    _tw_runtime.roomListCache = {};
    _tw_runtime.officialAuth = null;
    return { ok: true };
  },

  async clearCookie() {
    _tw_runtime.cookie = "";
    _tw_runtime.roomCursorCache = {};
    _tw_runtime.roomListCache = {};
    _tw_runtime.officialAuth = null;
    return { ok: true };
  },

  async getCategories(payload) {
    const runtimePayload = _tw_runtimePayload(payload);
    const cached = await _tw_loadCategoryCache(120);
    let categories = [];

    if (cached.fresh && cached.categories.length > 0) {
      categories = cached.categories;
    } else {
      try {
        categories = await _tw_fetchHelixCategories(100, runtimePayload);
        await _tw_saveCategoryCache(categories);
      } catch (error) {
        if (cached.categories.length > 0) {
          categories = cached.categories;
        } else {
          throw error;
        }
      }
    }

    return [
      {
        id: "root",
        title: "Twitch",
        icon: _tw_str(categories[0] && categories[0].icon),
        biz: "",
        subList: [
          {
            id: "all",
            parentId: "root",
            title: "全部直播",
            icon: "",
            biz: ""
          }
        ].concat(
          categories.map(function (item) {
            return {
              id: _tw_str(item.id),
              parentId: "root",
              title: _tw_str(item.title),
              icon: _tw_str(item.icon),
              biz: _tw_str(item.biz)
            };
          })
        )
      }
    ];
  },

  async getRooms(payload) {
    const runtimePayload = _tw_runtimePayload(payload);
    const categoryId = _tw_str(runtimePayload.id) === "root" ? "all" : _tw_str(runtimePayload.id) || "all";
    const page = Math.max(1, _tw_int(runtimePayload.page, 1));
    const pageSize = _tw_roomPageSize(runtimePayload.pageSize);

    const pageData = await _tw_fetchHelixStreamsPage(categoryId, page, pageSize, runtimePayload);

    return _tw_dedupeRooms(pageData && pageData.items);
  },

  async getPlayback(payload) {
    const runtimePayload = _tw_runtimePayload(payload);
    const roomId = _tw_parseLogin(runtimePayload.roomId || runtimePayload.userId);
    if (!roomId) {
      _tw_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    }
    return await _tw_getPlaybackForLogin(roomId, runtimePayload);
  },

  async search(payload) {
    const runtimePayload = _tw_runtimePayload(payload);
    const keyword = _tw_str(runtimePayload.keyword).trim();
    if (!keyword) {
      _tw_throw("INVALID_ARGS", "keyword is required", { field: "keyword" });
    }

    const page = Math.max(1, _tw_int(runtimePayload.page, 1));
    const pageSize = _tw_roomPageSize(runtimePayload.pageSize);
    const pageData = await _tw_fetchHelixSearchPage(keyword, page, pageSize, runtimePayload);
    const rooms = _tw_dedupeRooms(pageData && pageData.items);

    rooms.sort(function (a, b) {
      const liveDiff = _tw_int(b.liveState, 0) - _tw_int(a.liveState, 0);
      if (liveDiff !== 0) return liveDiff;
      return _tw_int(b.liveWatchedCount, 0) - _tw_int(a.liveWatchedCount, 0);
    });
    return rooms;
  },

  async getRoomDetail(payload) {
    const runtimePayload = _tw_runtimePayload(payload);
    const identity = _tw_parseLogin(runtimePayload.roomId) || _tw_str(runtimePayload.userId);
    const profile = await _tw_fetchHelixUserProfile(identity, runtimePayload);
    return _tw_helixUserProfileToRoomDetail(profile);
  },

  async getLiveState(payload) {
    const runtimePayload = _tw_runtimePayload(payload);
    const identity = _tw_parseLogin(runtimePayload.roomId) || _tw_str(runtimePayload.userId);
    const profile = await _tw_fetchHelixUserProfile(identity, runtimePayload);
    return {
      liveState: profile && profile.stream ? "1" : "0"
    };
  },

  async resolveShare(payload) {
    const runtimePayload = _tw_runtimePayload(payload);
    const shareCode = _tw_str(runtimePayload.shareCode).trim();
    if (!shareCode) {
      _tw_throw("INVALID_ARGS", "shareCode is required", { field: "shareCode" });
    }

    const login = _tw_parseLogin(shareCode);
    if (!login) {
      _tw_throw("PARSE", "cannot parse twitch share url", { shareCode: shareCode });
    }
    const profile = await _tw_fetchHelixUserProfile(login, runtimePayload);
    return _tw_helixUserProfileToRoomDetail(profile);
  },

  async getDanmaku(payload) {
    const runtimePayload = _tw_runtimePayload(payload);
    const login = _tw_parseLogin(runtimePayload.roomId || runtimePayload.userId);
    if (!login) {
      return { args: {}, headers: null };
    }
    return await _tw_danmakuDriver().getDanmakuPlan(login);
  },

  async createDanmakuSession(payload) {
    return await _tw_danmakuDriver().createDanmakuSession(payload || {});
  },

  async onDanmakuOpen(payload) {
    return await _tw_danmakuDriver().onDanmakuOpen(payload || {});
  },

  async onDanmakuFrame(payload) {
    return await _tw_danmakuDriver().onDanmakuFrame(payload || {});
  },

  async onDanmakuTick(payload) {
    return await _tw_danmakuDriver().onDanmakuTick(payload || {});
  },

  async destroyDanmakuSession(payload) {
    return await _tw_danmakuDriver().destroyDanmakuSession(payload || {});
  }
};
