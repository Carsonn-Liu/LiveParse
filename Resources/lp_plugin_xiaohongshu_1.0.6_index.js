const _xhs_liveType = "11";
const _xhs_platformId = "xiaohongshu";
const _xhs_ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const _xhs_webUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const _xhs_appUA = "ios/7.830 (ios 17.0; ; iPhone 15 (A2846/A3089/A3090/A3092))";
const _xhs_playbackUserAgent = "libmpv";
const _xhs_runtime = {
  cookie: "",
  liveListCursors: {}
};

async function _xhs_request(request, authMode) {
  return await Host.http.request({
    platformId: _xhs_platformId,
    authMode: authMode || "none",
    request: request || {}
  });
}

async function _xhs_requestWithCookie(request) {
  return await _xhs_request(request, "platform_cookie");
}

async function _xhs_requestSigned(request, injectRequestUserId) {
  return await Host.http.request({
    platformId: _xhs_platformId,
    authMode: "platform_cookie",
    signing: {
      profile: "xhs_live_web",
      injectRequestUserId: !!injectRequestUserId
    },
    request: request || {}
  });
}

function _xhs_throw(code, message, context) {
  if (globalThis.Host && typeof Host.raise === "function") {
    Host.raise(code, message, context || {});
  }
  if (globalThis.Host && typeof Host.makeError === "function") {
    throw Host.makeError(code || "UNKNOWN", message || "", context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _xhs_str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function _xhs_trim(value) {
  return _xhs_str(value).trim();
}

function _xhs_normalizeCookie(cookie) {
  return _xhs_trim(cookie);
}

function _xhs_pickFirst(values) {
  for (const value of values || []) {
    const text = _xhs_trim(value);
    if (text) return text;
  }
  return "";
}

function _xhs_parseJSON(text, fallback) {
  try {
    return JSON.parse(_xhs_str(text) || "{}");
  } catch (e) {
    return fallback === undefined ? null : fallback;
  }
}

function _xhs_responseJSON(resp) {
  if (!resp) return null;
  if (resp.bodyJSON && typeof resp.bodyJSON === "object") return resp.bodyJSON;
  return _xhs_parseJSON(resp.bodyText, null);
}

function _xhs_query(params) {
  const parts = [];
  for (const key of Object.keys(params || {})) {
    const value = params[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(_xhs_str(item))}`);
      }
      continue;
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(_xhs_str(value))}`);
  }
  return parts.join("&");
}

function _xhs_appendQuery(url, params) {
  const query = _xhs_query(params);
  if (!query) return url;
  return `${url}${url.indexOf("?") >= 0 ? "&" : "?"}${query}`;
}

function _xhs_tryDecode(text) {
  try {
    return decodeURIComponent(_xhs_str(text));
  } catch (e) {
    return _xhs_str(text);
  }
}

function _xhs_decodeHTMLEntities(text) {
  return _xhs_str(text)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/");
}

function _xhs_stripTags(html) {
  return _xhs_decodeHTMLEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _xhs_pickAttr(html, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*([\"'])([\\s\\S]*?)\\1`, "i");
  const match = _xhs_str(html).match(pattern);
  return match && match[2] ? _xhs_decodeHTMLEntities(match[2]) : "";
}

function _xhs_absoluteURL(url) {
  const value = _xhs_trim(_xhs_decodeHTMLEntities(url));
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^\/\//.test(value)) return `https:${value}`;
  if (/^\//.test(value)) return `https://www.xiaohongshu.com${value}`;
  return value;
}

function _xhs_extractURL(text) {
  const match = _xhs_str(text).match(/https?:\/\/[^\s"'<>，。；！？、【】《》]+/);
  if (!match) return "";
  return match[0].replace(/[),，。】]+$/g, "");
}

function _xhs_extractParam(url, name) {
  const source = _xhs_str(url);
  const pattern = new RegExp(`[?&#]${name}=([^&#]+)`);
  const match = source.match(pattern);
  return match && match[1] ? _xhs_tryDecode(match[1]) : "";
}

function _xhs_extractUserId(url) {
  return _xhs_pickFirst([
    _xhs_extractParam(url, "host_id"),
    _xhs_extractParam(url, "user_id"),
    _xhs_firstMatch(url, /\/user\/profile\/([^/?#]+)/)
  ]);
}

function _xhs_extractRoomIdFromURL(url) {
  return _xhs_pickFirst([
    _xhs_extractParam(url, "room_id"),
    _xhs_firstMatch(url, /\/livestream\/([^/?#]+)/),
    _xhs_firstMatch(url, /\/livestream\/[^/?#]+\/([^/?#]+)/)
  ]);
}

function _xhs_firstMatch(text, re) {
  const match = _xhs_str(text).match(re);
  return match && match[1] ? _xhs_str(match[1]) : "";
}

function _xhs_headers(referer) {
  const headers = {
    "User-Agent": _xhs_ua,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
    "Referer": _xhs_trim(referer) || "https://www.xiaohongshu.com/explore"
  };
  const runtimeCookie = _xhs_normalizeCookie(_xhs_runtime.cookie);
  if (runtimeCookie) headers.Cookie = runtimeCookie;
  return headers;
}

function _xhs_webHeaders(referer, accept) {
  const headers = {
    "User-Agent": _xhs_webUA,
    "Accept": accept || "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
    "Origin": "https://www.xiaohongshu.com",
    "Referer": _xhs_trim(referer) || "https://www.xiaohongshu.com/livelist?channel_id=0&channel_type=web_live_list"
  };
  const runtimeCookie = _xhs_normalizeCookie(_xhs_runtime.cookie);
  if (runtimeCookie) headers.Cookie = runtimeCookie;
  return headers;
}

function _xhs_appHeaders(referer) {
  const headers = {
    "User-Agent": _xhs_appUA,
    "xy-common-params": "platform=iOS&sid=session.1722166379345546829388",
    "Referer": _xhs_trim(referer) || "https://app.xhs.cn/"
  };
  const runtimeCookie = _xhs_normalizeCookie(_xhs_runtime.cookie);
  if (runtimeCookie) headers.Cookie = runtimeCookie;
  return headers;
}

async function _xhs_fetchText(url, referer) {
  const resp = await _xhs_requestWithCookie({
    url,
    method: "GET",
    headers: _xhs_headers(referer),
    timeout: 20
  });
  return { url: _xhs_str(resp && resp.url ? resp.url : url), bodyText: _xhs_str(resp && resp.bodyText) };
}

async function _xhs_fetchWebText(url, referer) {
  const resp = await _xhs_requestWithCookie({
    url,
    method: "GET",
    headers: _xhs_webHeaders(referer),
    timeout: 20
  });
  return { url: _xhs_str(resp && resp.url ? resp.url : url), bodyText: _xhs_str(resp && resp.bodyText) };
}

async function _xhs_fetchTextApp(url, referer) {
  const resp = await _xhs_requestWithCookie({
    url,
    method: "GET",
    headers: _xhs_appHeaders(referer),
    timeout: 20
  });
  return { url: _xhs_str(resp && resp.url ? resp.url : url), bodyText: _xhs_str(resp && resp.bodyText) };
}

async function _xhs_resolveURL(input) {
  let url = _xhs_extractURL(input) || _xhs_trim(input);
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  if (/^https?:\/\/xhslink\.com\//i.test(url)) {
    const resp = await _xhs_requestWithCookie({
      url,
      method: "GET",
      headers: _xhs_appHeaders("https://app.xhs.cn/"),
      timeout: 20
    });
    return _xhs_str(resp && resp.url ? resp.url : url);
  }
  return url;
}

function _xhs_extractBalancedObject(source, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < source.length; i += 1) {
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
      if (depth === 0) return source.slice(startIndex, i + 1);
    }
  }
  return "";
}

function _xhs_parseInitialState(html) {
  const source = _xhs_decodeHTMLEntities(html).replace(/<\\\/script>/gi, "</script>");
  const markers = [
    "window.__INITIAL_STATE__=",
    "window.__INITIAL_STATE__ =",
    "__INITIAL_STATE__="
  ];
  for (const marker of markers) {
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) continue;
    const objectStart = source.indexOf("{", markerIndex + marker.length);
    if (objectStart < 0) continue;
    const raw = _xhs_extractBalancedObject(source, objectStart);
    if (!raw) continue;
    try {
      return JSON.parse(raw.replace(/:\s*undefined/g, ":null"));
    } catch (e) {
      try {
        return JSON.parse(raw.replace(/\bundefined\b/g, "null"));
      } catch (e2) {
        continue;
      }
    }
  }
  return null;
}

function _xhs_deepFindObjects(root, predicate, limit) {
  const out = [];
  const seen = new Set();
  const max = Number(limit) > 0 ? Number(limit) : 20;
  const walk = function (value) {
    if (out.length >= max || value === null || value === undefined) return;
    if (typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    if (predicate(value)) out.push(value);
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    for (const key of Object.keys(value)) {
      walk(value[key]);
    }
  };
  walk(root);
  return out;
}

function _xhs_pickLiveStream(initialState) {
  if (!initialState) return null;
  if (initialState.liveStream && typeof initialState.liveStream === "object") {
    return initialState.liveStream;
  }
  const candidates = _xhs_deepFindObjects(initialState, function (item) {
    return !!(item && typeof item === "object" && (item.liveStatus || item.roomData || item.roomInfo || item.deeplink));
  }, 10);
  for (const item of candidates) {
    if (item.roomData || item.roomInfo || item.deeplink) return item;
  }
  return candidates.length > 0 ? candidates[0] : null;
}

function _xhs_isLiveStreamActive(stream) {
  const status = _xhs_trim(stream && (stream.liveStatus || stream.status || stream.live_status)).toLowerCase();
  if (status === "success" || status === "living" || status === "live" || status === "1") return true;
  const roomInfo = _xhs_pickRoomInfo(stream);
  const title = _xhs_trim(roomInfo && (roomInfo.roomTitle || roomInfo.title));
  return !!(title && !title.includes("回放") && _xhs_extractFLVURL(roomInfo));
}

function _xhs_pickRoomInfo(stream) {
  const roomData = stream && stream.roomData && typeof stream.roomData === "object" ? stream.roomData : {};
  return (roomData.roomInfo && typeof roomData.roomInfo === "object" ? roomData.roomInfo : null)
    || (stream && stream.roomInfo && typeof stream.roomInfo === "object" ? stream.roomInfo : null)
    || stream
    || {};
}

function _xhs_extractFLVURL(roomInfo) {
  const deeplink = _xhs_tryDecode(roomInfo && roomInfo.deeplink);
  return _xhs_pickFirst([
    roomInfo && roomInfo.flvUrl,
    roomInfo && roomInfo.flv_url,
    _xhs_extractParam(deeplink, "flvUrl"),
    _xhs_extractParam(deeplink, "flv_url")
  ]);
}

function _xhs_normalizePlayURL(url) {
  const decoded = _xhs_tryDecode(url);
  if (!decoded) return "";
  if (/^https?:\/\/[^/]+\/live\/[^/?#]+\.flv/i.test(decoded)) {
    const roomId = _xhs_firstMatch(decoded, /\/live\/([^/?#]+)\.flv/i);
    if (roomId) return `http://live-source-play.xhscdn.com/live/${roomId}.flv`;
  }
  return decoded;
}

function _xhs_pickRoomId(modelURL, roomInfo, flvURL) {
  const deeplink = _xhs_tryDecode(roomInfo && roomInfo.deeplink);
  return _xhs_pickFirst([
    roomInfo && roomInfo.roomId,
    roomInfo && roomInfo.room_id,
    roomInfo && roomInfo.id,
    _xhs_extractParam(deeplink, "room_id"),
    _xhs_extractRoomIdFromURL(modelURL),
    _xhs_firstMatch(flvURL, /\/live\/([^/?#]+)\.(?:flv|m3u8)/i)
  ]);
}

function _xhs_pickUserId(modelURL, roomInfo) {
  const deeplink = _xhs_tryDecode(roomInfo && roomInfo.deeplink);
  return _xhs_pickFirst([
    roomInfo && roomInfo.hostId,
    roomInfo && roomInfo.host_id,
    roomInfo && roomInfo.userId,
    roomInfo && roomInfo.user_id,
    _xhs_extractParam(deeplink, "host_id"),
    _xhs_extractParam(deeplink, "hostId"),
    _xhs_extractUserId(modelURL)
  ]);
}

function _xhs_pickUserName(roomInfo) {
  const deeplink = _xhs_tryDecode(roomInfo && roomInfo.deeplink);
  return _xhs_pickFirst([
    roomInfo && roomInfo.hostNickname,
    roomInfo && roomInfo.host_nickname,
    roomInfo && roomInfo.nickName,
    roomInfo && roomInfo.nickname,
    roomInfo && roomInfo.userName,
    _xhs_extractParam(deeplink, "host_nickname")
  ]);
}

function _xhs_pickImage(roomInfo, keys) {
  for (const key of keys || []) {
    const value = roomInfo && roomInfo[key];
    if (typeof value === "string" && value) return value;
    if (value && typeof value === "object") {
      const nested = _xhs_pickFirst([value.url, value.urlDefault, value.url_default, value.link]);
      if (nested) return nested;
    }
  }
  return "";
}

function _xhs_toRoomModel(url, stream) {
  const roomInfo = _xhs_pickRoomInfo(stream);
  const flvURL = _xhs_normalizePlayURL(_xhs_extractFLVURL(roomInfo));
  const title = _xhs_pickFirst([
    roomInfo.roomTitle,
    roomInfo.title,
    roomInfo.name
  ]);
  const userName = _xhs_pickUserName(roomInfo);
  const userId = _xhs_pickUserId(url, roomInfo);
  const liveRoomId = _xhs_pickRoomId(url, roomInfo, flvURL);
  const roomId = userId || liveRoomId;
  const cover = _xhs_pickImage(roomInfo, ["cover", "coverUrl", "cover_url", "image", "imageUrl", "shareImg"]);
  const avatar = _xhs_pickImage(roomInfo, ["avatar", "avatarUrl", "avatar_url", "hostAvatar", "host_avatar", "userAvatar"]);
  const liveState = _xhs_isLiveStreamActive(stream) ? "1" : "0";

  return {
    userName,
    roomTitle: title || (userName ? `${userName}的直播间` : "小红书直播间"),
    roomCover: cover || avatar,
    userHeadImg: avatar || cover,
    liveType: _xhs_liveType,
    liveState,
    userId,
    roomId,
    liveWatchedCount: _xhs_pickFirst([
      roomInfo.viewerCount,
      roomInfo.viewer_count,
      roomInfo.onlineCount,
      roomInfo.online_count,
      roomInfo.watchCount,
      roomInfo.watch_count
    ]),
    _xhsPlayURL: flvURL
  };
}

function _xhs_parsePullConfig(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  return _xhs_parseJSON(value, {}) || {};
}

function _xhs_collectMediaURLs(root) {
  const urls = [];
  const seen = {};
  const walk = function (value) {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      const text = _xhs_tryDecode(value);
      if (!/^https?:\/\//i.test(text)) return;
      if (!/\.(?:flv|m3u8)(?:$|[?#])/i.test(text)) return;
      if (seen[text]) return;
      seen[text] = true;
      urls.push(text);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      walk(value[key]);
    }
  };
  walk(root);
  return urls;
}

// 小红书 status → 宿主 liveState 映射
// 小红书: 2=直播中, 4=回放, 其他=未开播
// 宿主:   0=关播, 1=直播中, 2=录播/轮播, 3=未知
function _xhs_mapLiveState(xhsStatus) {
  var s = String(xhsStatus != null ? xhsStatus : "3").trim();
  switch (s) {
    case "2": return "1";  // 直播中
    case "4": return "2";  // 回放 → 录播
    case "0":
    case "1":
    case "3": return "0";  // 未开播/关播
    default:  return "0";
  }
}

function _xhs_modelFromCurrentRoomInfo(obj) {
  const data = obj && typeof obj === "object" && obj.data && typeof obj.data === "object" ? obj.data : {};
  const hostInfo = data.host_info && typeof data.host_info === "object" ? data.host_info : {};
  const roomInfo = data.room_info && typeof data.room_info === "object" ? data.room_info : {};
  const roomId = _xhs_pickFirst([roomInfo.room_id, roomInfo.roomId, roomInfo.id]);
  const userId = _xhs_pickFirst([
    hostInfo.user_id,
    hostInfo.userId,
    hostInfo.id,
    roomInfo.host_id,
    roomInfo.hostId,
    roomInfo.user_id,
    roomInfo.userId
  ]);
  const userName = _xhs_pickFirst([
    hostInfo.nick_name,
    hostInfo.nickname,
    hostInfo.nickName,
    hostInfo.name
  ]);
  const title = _xhs_pickFirst([
    roomInfo.room_title,
    roomInfo.roomTitle,
    roomInfo.title
  ]);
  const avatar = _xhs_pickFirst([
    _xhs_pickImage(hostInfo, ["avatar", "avatarUrl", "avatar_url", "image", "imageUrl"]),
    _xhs_pickImage(roomInfo, ["hostAvatar", "host_avatar", "userAvatar"])
  ]);
  const cover = _xhs_pickFirst([
    _xhs_pickImage(roomInfo, ["room_cover", "cover", "coverUrl", "cover_url", "image", "imageUrl", "shareImg"]),
    avatar
  ]);
  const rawStatus = _xhs_pickFirst([roomInfo.status, data.status]) || "3";
  const liveState = _xhs_mapLiveState(rawStatus);
  const pullConfig = _xhs_parsePullConfig(roomInfo.pull_config);
  const streams = Array.isArray(pullConfig.streams) ? pullConfig.streams : [];
  const roomURL = roomId ? _xhs_makeLiveRoomURL(roomId) : "";

  return {
    userName,
    roomTitle: title || (userName ? `${userName}的直播间` : "小红书直播间"),
    roomCover: cover || avatar,
    userHeadImg: avatar || cover,
    liveType: _xhs_liveType,
    liveState: liveState,
    status: String(rawStatus),
    userId,
    roomId,
    roomUrl: roomURL,
    webUrl: roomURL,
    liveWatchedCount: _xhs_pickFirst([
      roomInfo.display_viewer_count,
      roomInfo.displayViewerCount,
      roomInfo.display_member_count,
      roomInfo.viewer_count,
      roomInfo.viewerCount
    ]),
    _xhsPlaybackStreams: streams
  };
}

function _xhs_playbackFromCurrentRoomInfo(obj) {
  const model = _xhs_modelFromCurrentRoomInfo(obj);
  const streams = Array.isArray(model._xhsPlaybackStreams) ? model._xhsPlaybackStreams : [];
  const qualitys = [];
  const seen = {};

  for (let i = 0; i < streams.length; i += 1) {
    const stream = streams[i];
    const label = _xhs_pickFirst([
      stream && stream.quality_type_name,
      stream && stream.qualityTypeName,
      stream && stream.title,
      stream && stream.name,
      stream && stream.label,
      stream && stream.quality_name,
      stream && stream.qualityName,
      stream && stream.stream_name
    ]) || `流${i + 1}`;
    // 收集 master_url + backup_urls
    const allUrls = [];
    if (stream && stream.master_url) allUrls.push(stream.master_url);
    if (stream && Array.isArray(stream.backup_urls)) {
      for (const bu of stream.backup_urls) { if (bu) allUrls.push(bu); }
    }
    // 补充深度搜索兜底
    if (allUrls.length < 1) {
      var collected = _xhs_collectMediaURLs(stream);
      for (var ci = 0; ci < collected.length; ci++) allUrls.push(collected[ci]);
    }
    for (const url of allUrls) {
      const liveCodeType = /\.m3u8(?:$|[?#])/i.test(url) ? "m3u8" : "flv";
      const normalizedURL = liveCodeType === "flv" ? _xhs_normalizePlayURL(url) : _xhs_tryDecode(url);
      const dedupeKey = `${label}:${liveCodeType}:${normalizedURL}`;
      if (!normalizedURL || seen[dedupeKey]) continue;
      seen[dedupeKey] = true;
      qualitys.push({
        roomId: String(model.roomId || ""),
        title: `${label}_${liveCodeType === "flv" ? "FLV" : "HLS"}`,
        qn: liveCodeType === "flv" ? 10000 - i : 8000 - i,
        url: normalizedURL,
        liveCodeType,
        liveType: _xhs_liveType,
        userAgent: _xhs_playbackUserAgent,
        headers: {
          "Referer": "https://www.xiaohongshu.com/"
        }
      });
    }
  }

  if (qualitys.length < 1) {
    _xhs_throw("INVALID_RESPONSE", "xiaohongshu playback url not found", { roomId: model.roomId || "" });
  }
  return [{ cdn: "线路1", qualitys }];
}

function _xhs_resolveCategoryId(id) {
  const raw = _xhs_trim(id);
  if (!raw || raw === "xiaohongshu_live" || raw === "root") return "0";
  return raw;
}

function _xhs_livelistPageURL(categoryId) {
  return _xhs_appendQuery("https://www.xiaohongshu.com/livelist", {
    channel_id: _xhs_resolveCategoryId(categoryId),
    channel_type: "web_live_list"
  });
}

function _xhs_liveFeedURL(categoryId, cursorScore, pageSize) {
  var params = {
    source: 13,
    category: _xhs_resolveCategoryId(categoryId),
    pre_source: "",
    extra_info: JSON.stringify({ image_formats: ["jpg", "webp", "avif"] }),
    size: Number(pageSize) > 0 ? Number(pageSize) : 27
  };
  var cs = _xhs_trim(cursorScore);
  if (cs && cs !== "0") {
    params.cursorScore = cs;
  }
  return _xhs_appendQuery("https://live-room.xiaohongshu.com/api/sns/red/live/web/feed/v1/squarefeed", params);
}

function _xhs_unwrap(value) {
  let current = value;
  for (let i = 0; i < 4; i += 1) {
    if (!current || typeof current !== "object") return current;
    if (current._rawValue !== undefined) {
      current = current._rawValue;
      continue;
    }
    if (current.value !== undefined && Object.keys(current).length <= 2) {
      current = current.value;
      continue;
    }
    return current;
  }
  return current;
}

function _xhs_valueAt(root, path) {
  let value = root;
  for (const key of path || []) {
    value = _xhs_unwrap(value);
    if (!value || typeof value !== "object") return null;
    value = value[key];
  }
  return _xhs_unwrap(value);
}

function _xhs_isLiveListItem(item) {
  const value = _xhs_unwrap(item);
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const live = _xhs_unwrap(value.live) || value;
  const roomInfo = _xhs_unwrap(live.t_room_info || live.tRoomInfo || live.roomInfo || live.room || value.t_room_info || value.tRoomInfo || value.roomInfo || value.room);
  const hostInfo = _xhs_unwrap(live.t_live_host_info || live.tLiveHostInfo || live.hostInfo || value.t_live_host_info || value.tLiveHostInfo || value.hostInfo || value.user);
  const hasLiveShape = !!(value.live || value.t_room_info || value.tRoomInfo || value.roomInfo || value.room || live.t_room_info || live.tRoomInfo || live.roomInfo || live.room);
  if (!hasLiveShape) return false;
  const hasRoomInfo = !!(roomInfo && typeof roomInfo === "object" && _xhs_pickFirst([
    roomInfo.room_id_str,
    roomInfo.roomIdStr,
    roomInfo.room_id,
    roomInfo.roomId,
    roomInfo.id,
    roomInfo.name,
    roomInfo.roomTitle,
    roomInfo.title
  ]));
  const hasHostInfo = !!(hostInfo && typeof hostInfo === "object" && _xhs_pickFirst([
    hostInfo.user_id,
    hostInfo.userId,
    hostInfo.nickname,
    hostInfo.nickName
  ]));
  return hasRoomInfo || hasHostInfo;
}

function _xhs_collectLiveListItems(root) {
  const out = [];
  const seen = {};
  const pushItem = function (item) {
    const value = _xhs_unwrap(item);
    if (!_xhs_isLiveListItem(value)) return;
    const key = _xhs_pickFirst([
      value && value.id,
      value && value.noteId,
      value && value.live && value.live.t_room_info && value.live.t_room_info.room_id_str,
      value && value.live && value.live.t_room_info && value.live.t_room_info.room_id,
      value && value.live && value.live.tRoomInfo && value.live.tRoomInfo.roomIdStr,
      value && value.live && value.live.tRoomInfo && value.live.tRoomInfo.roomId,
      value && value.t_room_info && value.t_room_info.room_id_str,
      value && value.tRoomInfo && value.tRoomInfo.roomIdStr,
      value && value.tRoomInfo && value.tRoomInfo.roomId
    ]) || `idx_${out.length}`;
    if (seen[key]) return;
    seen[key] = true;
    out.push(value);
  };
  const pushArray = function (arr) {
    const value = _xhs_unwrap(arr);
    if (!Array.isArray(value)) return;
    for (const item of value) pushItem(item);
  };

  pushArray(root);
  const paths = [
    ["data", "feeds"],
    ["data", "liveList"],
    ["feeds"],
    ["items"],
    ["list"],
    ["liveList"],
    ["liveList", "feeds"],
    ["liveList", "items"],
    ["liveList", "liveList"],
    ["liveList", "liveList", "data"],
    ["liveList", "liveList", "value"],
    ["liveList", "liveList", "_rawValue"]
  ];
  for (const path of paths) pushArray(_xhs_valueAt(root, path));

  const arrays = _xhs_deepFindObjects(root, function (item) {
    const value = _xhs_unwrap(item);
    return Array.isArray(value) && value.some(_xhs_isLiveListItem);
  }, 12);
  for (const arr of arrays) pushArray(arr);
  return out;
}

function _xhs_pickLiveItemRoomInfo(item) {
  const value = _xhs_unwrap(item) || {};
  const live = _xhs_unwrap(value.live) || value;
  return _xhs_unwrap(live.t_room_info || live.tRoomInfo || live.roomInfo || live.room || value.t_room_info || value.tRoomInfo || value.roomInfo || value.room || live) || {};
}

function _xhs_pickLiveItemHostInfo(item) {
  const value = _xhs_unwrap(item) || {};
  const live = _xhs_unwrap(value.live) || value;
  return _xhs_unwrap(live.t_live_host_info || live.tLiveHostInfo || live.hostInfo || value.t_live_host_info || value.tLiveHostInfo || value.hostInfo || value.user || live.user) || {};
}

function _xhs_toLiveListRoomModel(item) {
  const value = _xhs_unwrap(item) || {};
  const roomInfo = _xhs_pickLiveItemRoomInfo(value);
  const hostInfo = _xhs_pickLiveItemHostInfo(value);
  const liveRoomId = _xhs_pickFirst([
    roomInfo.room_id_str,
    roomInfo.roomIdStr,
    roomInfo.room_id,
    roomInfo.roomId,
    roomInfo.id,
    value.room_id_str,
    value.roomIdStr,
    value.roomId,
    value.liveId
  ]);
  const userId = _xhs_pickFirst([
    hostInfo.user_id,
    hostInfo.userId,
    hostInfo.id,
    roomInfo.host_id,
    roomInfo.hostId,
    roomInfo.userId
  ]);
  const userName = _xhs_pickFirst([
    hostInfo.nickname,
    hostInfo.nickName,
    hostInfo.nick_name,
    hostInfo.name,
    roomInfo.host_nickname,
    roomInfo.hostNickname
  ]);
  const title = _xhs_pickFirst([
    roomInfo.name,
    roomInfo.roomTitle,
    roomInfo.room_title,
    roomInfo.title,
    value.title
  ]);
  if (!liveRoomId && !userId && !title) return null;

  const cover = _xhs_pickFirst([
    _xhs_pickImage(roomInfo, ["cover", "roomCover", "coverUrl", "cover_url", "image", "imageUrl", "shareImg"]),
    roomInfo.cover_info && roomInfo.cover_info.cover_image,
    _xhs_pickImage(value, ["cover", "image", "imageUrl"])
  ]);
  const avatar = _xhs_pickFirst([
    _xhs_pickImage(hostInfo, ["avatar", "avatarUrl", "avatar_url", "image", "imageb", "imageB", "headImg"]),
    _xhs_pickImage(roomInfo, ["hostAvatar", "host_avatar", "userAvatar"])
  ]);
  const roomURL = liveRoomId ? _xhs_makeLiveRoomURL(liveRoomId) : (userId ? _xhs_makeProfileURL(userId) : "");

  return {
    userName,
    roomTitle: title || (userName ? `${userName}的直播间` : "小红书直播间"),
    roomCover: cover || avatar,
    userHeadImg: avatar || cover,
    liveType: _xhs_liveType,
    liveState: "1",
    userId,
    roomId: liveRoomId || userId,
    roomUrl: roomURL,
    webUrl: roomURL,
    liveWatchedCount: _xhs_pickFirst([
      roomInfo.display_count,
      roomInfo.displayMemberCount,
      roomInfo.member_count,
      roomInfo.uv,
      roomInfo.viewerCount,
      roomInfo.viewer_count,
      roomInfo.onlineCount,
      roomInfo.online_count,
      roomInfo.watchCount,
      roomInfo.watch_count
    ])
  };
}

function _xhs_modelsFromLiveList(root) {
  const models = [];
  const seen = {};
  const items = _xhs_collectLiveListItems(root);
  for (const item of items) {
    const model = _xhs_toLiveListRoomModel(item);
    if (!model) continue;
    const key = _xhs_pickFirst([model.roomId, model.userId, model.roomTitle]);
    if (!key || seen[key]) continue;
    seen[key] = true;
    models.push(model);
  }
  return models;
}

function _xhs_htmlField(block, className) {
  const pattern = new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]{0,800}?)<\\/[^>]+>`, "i");
  const match = _xhs_str(block).match(pattern);
  return match && match[1] ? _xhs_stripTags(match[1]) : "";
}

function _xhs_modelsFromRenderedHTML(html) {
  const source = _xhs_str(html);
  const models = [];
  const seen = {};
  const linkRe = /<a\b[^>]*href\s*=\s*(["'])([^"']*\/livestream\/[^"']*)\1[^>]*>/gi;
  let match;
  while ((match = linkRe.exec(source)) !== null) {
    const href = _xhs_absoluteURL(match[2]);
    const roomId = _xhs_extractRoomIdFromURL(href);
    if (!roomId || seen[roomId]) continue;
    const start = Math.max(0, match.index - 1200);
    const end = Math.min(source.length, match.index + 6000);
    const block = source.slice(start, end);
    const imgTags = block.match(/<img\b[^>]*>/gi) || [];
    const cover = imgTags.length > 0 ? _xhs_absoluteURL(_xhs_pickFirst([
      _xhs_pickAttr(imgTags[0], "src"),
      _xhs_pickAttr(imgTags[0], "data-src")
    ])) : "";
    const avatar = imgTags.length > 1 ? _xhs_absoluteURL(_xhs_pickFirst([
      _xhs_pickAttr(imgTags[1], "src"),
      _xhs_pickAttr(imgTags[1], "data-src")
    ])) : cover;
    const linkTitle = _xhs_pickFirst([
      _xhs_pickAttr(match[0], "title"),
      _xhs_pickAttr(match[0], "aria-label")
    ]);
    const title = _xhs_pickFirst([
      _xhs_htmlField(block, "title"),
      linkTitle,
      imgTags.length > 0 ? _xhs_pickAttr(imgTags[0], "alt") : ""
    ]);
    const userName = _xhs_pickFirst([
      _xhs_htmlField(block, "name"),
      _xhs_htmlField(block, "author"),
      imgTags.length > 1 ? _xhs_pickAttr(imgTags[1], "alt") : ""
    ]);
    seen[roomId] = true;
    models.push({
      userName,
      roomTitle: title || (userName ? `${userName}的直播间` : "小红书直播间"),
      roomCover: cover || avatar,
      userHeadImg: avatar || cover,
      liveType: _xhs_liveType,
      liveState: "1",
      userId: "",
      roomId,
      roomUrl: href,
      webUrl: href,
      liveWatchedCount: _xhs_htmlField(block, "fans")
    });
  }
  return models;
}

function _xhs_cursorFromResponse(obj, items) {
  return _xhs_pickFirst([
    obj && obj.data && obj.data.cursorScore,
    obj && obj.data && obj.data.cursor_score,
    obj && obj.cursorScore,
    obj && obj.cursor_score,
    items && items.length && items[items.length - 1] && items[items.length - 1].cursor_score,
    items && items.length && items[items.length - 1] && items[items.length - 1].cursorScore,
    items && items.length && items[items.length - 1] && items[items.length - 1].score
  ]);
}

async function _xhs_fetchLiveListFromAPI(payload) {
  const categoryId = _xhs_resolveCategoryId(payload && (payload.id || payload.categoryId || payload.parentId));
  const page = Number(payload && payload.page) > 0 ? Number(payload.page) : 1;
  const pageSize = Number(payload && payload.pageSize) > 0 ? Number(payload.pageSize) : 27;
  const cursorMap = _xhs_runtime.liveListCursors[categoryId] || {};
  const cursorScore = page <= 1 ? "0" : _xhs_pickFirst([
    payload && payload.cursorScore,
    payload && payload.cursor,
    cursorMap[page]
  ]) || "0";
  const referer = _xhs_livelistPageURL(categoryId);
  const url = _xhs_liveFeedURL(categoryId, cursorScore, pageSize);
  const resp = await _xhs_requestSigned({
    url,
    method: "GET",
    headers: _xhs_webHeaders(referer, "application/json, text/plain, */*"),
    timeout: 20
  }, false);
  const obj = _xhs_responseJSON(resp);
  if (!obj) _xhs_throw("INVALID_RESPONSE", "xiaohongshu live list response invalid", { url });
  const items = _xhs_collectLiveListItems(obj);
  const nextCursor = _xhs_cursorFromResponse(obj, items);
  if (nextCursor) {
    _xhs_runtime.liveListCursors[categoryId] = Object.assign({}, cursorMap, { [page + 1]: nextCursor });
  }
  return _xhs_modelsFromLiveList(obj);
}

async function _xhs_fetchLiveListFromPage(categoryId) {
  const url = _xhs_livelistPageURL(categoryId);
  const fetched = await _xhs_fetchWebText(url, "https://www.xiaohongshu.com/");
  const state = _xhs_parseInitialState(fetched.bodyText);
  const stateModels = state ? _xhs_modelsFromLiveList(state) : [];
  if (stateModels.length > 0) return stateModels;
  return _xhs_modelsFromRenderedHTML(fetched.bodyText);
}

async function _xhs_getRooms(payload) {
  const categoryId = _xhs_resolveCategoryId(payload && (payload.id || payload.categoryId || payload.parentId));
  try {
    return await _xhs_fetchLiveListFromAPI(Object.assign({}, payload || {}, { categoryId }));
  } catch (e) {
    try {
      return await _xhs_fetchLiveListFromPage(categoryId);
    } catch (e2) {
      return [];
    }
  }
}

async function _xhs_fetchRoomBundle(rawInput) {
  const resolvedURL = await _xhs_resolveURL(rawInput);
  if (!resolvedURL) _xhs_throw("INVALID_ARGS", "url is required", { field: "url" });

  let fetched = await _xhs_fetchTextApp(resolvedURL, "https://app.xhs.cn/");
  let state = _xhs_parseInitialState(fetched.bodyText);
  if (!state) {
    fetched = await _xhs_fetchText(resolvedURL, resolvedURL);
    state = _xhs_parseInitialState(fetched.bodyText);
  }

  return {
    url: fetched.url || resolvedURL,
    html: fetched.bodyText,
    initialState: state,
    stream: _xhs_pickLiveStream(state)
  };
}

function _xhs_roomIdFromInitialState(state, pageURL) {
  const stream = _xhs_pickLiveStream(state);
  if (stream) {
    const roomInfo = _xhs_pickRoomInfo(stream);
    const flvURL = _xhs_normalizePlayURL(_xhs_extractFLVURL(roomInfo));
    const roomId = _xhs_pickRoomId(pageURL, roomInfo, flvURL);
    if (roomId) return roomId;
  }
  const models = _xhs_modelsFromLiveList(state);
  if (models.length > 0) return _xhs_trim(models[0].roomId);
  return "";
}

function _xhs_extractRoomIdFromHTML(html) {
  const source = _xhs_decodeHTMLEntities(html);
  return _xhs_pickFirst([
    _xhs_firstMatch(source, /["']room_id["']\s*:\s*["']?(\d{6,})/i),
    _xhs_firstMatch(source, /["']roomId["']\s*:\s*["']?(\d{6,})/i),
    _xhs_firstMatch(source, /\/livestream\/(\d{6,})/i)
  ]);
}

async function _xhs_resolveRoomIdFromPage(url) {
  if (!url) return "";
  const bundle = await _xhs_fetchRoomBundle(url);
  return _xhs_pickFirst([
    _xhs_roomIdFromInitialState(bundle.initialState, bundle.url || url),
    _xhs_extractRoomIdFromHTML(bundle.html),
    _xhs_extractRoomIdFromURL(bundle.url || "")
  ]);
}

function _xhs_makeProfileURL(userId) {
  return `https://www.xiaohongshu.com/user/profile/${encodeURIComponent(_xhs_trim(userId))}`;
}

function _xhs_makeLiveRoomURL(roomId) {
  return `https://www.xiaohongshu.com/livestream/${encodeURIComponent(_xhs_trim(roomId))}?source=web_live_list`;
}

async function _xhs_resolveRoomIdFromInput(input) {
  const raw = _xhs_trim(input);
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return raw;

  const resolvedURL = await _xhs_resolveURL(raw);
  const directRoomId = _xhs_pickFirst([
    _xhs_extractParam(resolvedURL, "room_id"),
    _xhs_extractRoomIdFromURL(resolvedURL)
  ]);
  if (directRoomId) return directRoomId;
  return await _xhs_resolveRoomIdFromPage(resolvedURL);
}

function _xhs_roomPayload(input) {
  if (input && typeof input === "object" && !Array.isArray(input)) return input;
  const raw = _xhs_trim(input);
  if (!raw) return {};
  if (/^\d+$/.test(raw)) return { roomId: raw };
  return { url: raw, shareCode: raw };
}

function _xhs_hasRoomInput(payload) {
  const roomPayload = _xhs_roomPayload(payload);
  return !!_xhs_pickFirst([
    roomPayload && roomPayload.roomId,
    roomPayload && roomPayload.url,
    roomPayload && roomPayload.shareCode,
    roomPayload && roomPayload.roomUrl,
    roomPayload && roomPayload.webUrl,
    roomPayload && roomPayload.userId
  ]);
}

async function _xhs_resolveRoomId(input) {
  const payload = _xhs_roomPayload(input);
  const directRoomId = _xhs_trim(payload && payload.roomId);
  if (/^\d+$/.test(directRoomId)) return directRoomId;

  const candidates = [
    directRoomId,
    payload && payload.url,
    payload && payload.roomUrl,
    payload && payload.webUrl,
    payload && payload.shareCode,
    payload && payload.userId ? _xhs_makeProfileURL(payload.userId) : ""
  ];
  for (const candidate of candidates) {
    const roomId = await _xhs_resolveRoomIdFromInput(candidate);
    if (roomId) return roomId;
  }
  return "";
}

async function _xhs_getCurrentRoomInfo(roomId) {
  const normalizedRoomId = _xhs_trim(roomId);
  if (!normalizedRoomId) _xhs_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
  const url = _xhs_appendQuery(
    "https://live-room.xiaohongshu.com/api/sns/red/live/web/v1/room/current_room_info",
    {
      room_id: normalizedRoomId,
      source: "web_live",
      client_type: 1
    }
  );
  const resp = await _xhs_requestSigned({
    url,
    method: "GET",
    headers: _xhs_webHeaders("https://www.xiaohongshu.com/", "application/json, text/plain, */*"),
    timeout: 20
  }, true);
  return _xhs_responseJSON(resp);
}

async function _xhs_getRoomDetail(input) {
  const roomId = await _xhs_resolveRoomId(input);
  if (!roomId) _xhs_throw("NOT_FOUND", "xiaohongshu roomId not found", { input: _xhs_trim(typeof input === "string" ? input : JSON.stringify(input || {})) });
  const obj = await _xhs_getCurrentRoomInfo(roomId);
  const model = _xhs_modelFromCurrentRoomInfo(obj);
  if (!model.roomId) _xhs_throw("INVALID_RESPONSE", "xiaohongshu current_room_info missing roomId", { roomId });
  delete model._xhsPlaybackStreams;
  return model;
}

async function _xhs_getPlayback(input) {
  const roomId = await _xhs_resolveRoomId(input);
  if (!roomId) _xhs_throw("NOT_FOUND", "xiaohongshu roomId not found", { input: _xhs_trim(typeof input === "string" ? input : JSON.stringify(input || {})) });
  const obj = await _xhs_getCurrentRoomInfo(roomId);
  const model = _xhs_modelFromCurrentRoomInfo(obj);
  if (model.liveState !== "1") {
    _xhs_throw("NOT_LIVE", "xiaohongshu room is not live", { roomId: model.roomId || roomId, status: model.status || model.liveState });
  }
  return _xhs_playbackFromCurrentRoomInfo(obj);
}

globalThis.LiveParsePlugin = {
  apiVersion: 1,

  async setCookie(payload) {
    const cookie = typeof payload === "string"
      ? payload
      : _xhs_pickFirst([
        payload && payload.cookie,
        payload && payload.Cookie,
        payload && payload.headers && payload.headers.Cookie,
        payload && payload.headers && payload.headers.cookie
      ]);
    _xhs_runtime.cookie = _xhs_normalizeCookie(cookie);
    return { ok: true };
  },

  async clearCookie() {
    _xhs_runtime.cookie = "";
    return { ok: true };
  },

  async getCategories() {
    const url = "https://live-room.xiaohongshu.com/api/sns/red/live/web/feed/category";
    const resp = await _xhs_requestSigned({
      url,
      method: "GET",
      headers: _xhs_webHeaders("https://www.xiaohongshu.com/", "application/json, text/plain, */*"),
      timeout: 20
    }, false);
    const obj = _xhs_responseJSON(resp);
    const categories = (obj && obj.data && Array.isArray(obj.data.categories)) ? obj.data.categories : [];
    const subList = categories.map(function (cat) {
      return {
        id: String(cat.id != null ? cat.id : "0"),
        parentId: "xiaohongshu_live",
        title: _xhs_str(cat.desc || cat.name || "未知"),
        icon: "",
        biz: ""
      };
    });
    if (subList.length < 1) {
      subList.push({ id: "0", parentId: "xiaohongshu_live", title: "推荐", icon: "", biz: "" });
    }
    return [
      {
        id: "xiaohongshu_live",
        title: "小红书直播",
        icon: "",
        biz: "",
        subList: subList
      }
    ];
  },

  async getRooms(payload) {
    return await _xhs_getRooms(payload || {});
  },

  async getPlayback(payload) {
    const input = _xhs_roomPayload(payload || {});
    if (!_xhs_hasRoomInput(input)) _xhs_throw("INVALID_ARGS", "roomId/userId/url is required", { field: "roomId" });
    return await _xhs_getPlayback(input);
  },

  async search() {
    return [];
  },

  async getRoomDetail(payload) {
    const input = _xhs_roomPayload(payload || {});
    if (!_xhs_hasRoomInput(input)) _xhs_throw("INVALID_ARGS", "roomId/userId/url is required", { field: "roomId" });
    return await _xhs_getRoomDetail(input);
  },

  async getLiveState(payload) {
    const input = _xhs_roomPayload(payload || {});
    if (!_xhs_hasRoomInput(input)) _xhs_throw("INVALID_ARGS", "roomId/userId/url is required", { field: "roomId" });
    const roomId = await _xhs_resolveRoomId(input);
    if (!roomId) _xhs_throw("NOT_FOUND", "xiaohongshu roomId not found", { input: JSON.stringify(input || {}) });
    const obj = await _xhs_getCurrentRoomInfo(roomId);
    const info = _xhs_modelFromCurrentRoomInfo(obj);
    return {
      liveState: String(info && info.liveState ? info.liveState : "0"),
      status: String(info && info.status ? info.status : "3")
    };
  },

  async resolveShare(payload) {
    const shareCode = _xhs_pickFirst([payload && payload.shareCode, payload && payload.url, payload]);
    if (!shareCode) _xhs_throw("INVALID_ARGS", "shareCode is required", { field: "shareCode" });
    return await _xhs_getRoomDetail({ shareCode });
  },

  async getDanmaku() {
    return { args: {}, headers: null };
  }
};
