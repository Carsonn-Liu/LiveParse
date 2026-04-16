// ============================================================
// AES-128-CBC 纯 JS 实现（用于生成 kwfv1 / kwscode cookie）
// ============================================================

const _ks_aes_sbox = [
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
];

const _ks_aes_rcon = [0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];

function _ks_aes_keyExpansion(key) {
  const w = new Array(44);
  for (let i = 0; i < 4; i++) {
    w[i] = (key[4*i] << 24) | (key[4*i+1] << 16) | (key[4*i+2] << 8) | key[4*i+3];
  }
  for (let i = 4; i < 44; i++) {
    let temp = w[i - 1];
    if (i % 4 === 0) {
      temp = ((temp << 8) | (temp >>> 24)) >>> 0;
      temp = (_ks_aes_sbox[(temp >>> 24) & 0xff] << 24) |
             (_ks_aes_sbox[(temp >>> 16) & 0xff] << 16) |
             (_ks_aes_sbox[(temp >>> 8) & 0xff] << 8) |
             _ks_aes_sbox[temp & 0xff];
      temp = (temp ^ (_ks_aes_rcon[i/4 - 1] << 24)) >>> 0;
    }
    w[i] = (w[i - 4] ^ temp) >>> 0;
  }
  return w;
}

function _ks_aes_subBytes(state) {
  for (let i = 0; i < 16; i++) state[i] = _ks_aes_sbox[state[i]];
}

function _ks_aes_shiftRows(state) {
  let t;
  t = state[1]; state[1] = state[5]; state[5] = state[9]; state[9] = state[13]; state[13] = t;
  t = state[2]; state[2] = state[10]; state[10] = t; t = state[6]; state[6] = state[14]; state[14] = t;
  t = state[15]; state[15] = state[11]; state[11] = state[7]; state[7] = state[3]; state[3] = t;
}

function _ks_aes_xtime(a) {
  return ((a << 1) ^ (((a >>> 7) & 1) * 0x1b)) & 0xff;
}

function _ks_aes_mixColumns(state) {
  for (let c = 0; c < 4; c++) {
    const i = c * 4;
    const a0 = state[i], a1 = state[i+1], a2 = state[i+2], a3 = state[i+3];
    const x = a0 ^ a1 ^ a2 ^ a3;
    state[i]   = a0 ^ _ks_aes_xtime(a0 ^ a1) ^ x;
    state[i+1] = a1 ^ _ks_aes_xtime(a1 ^ a2) ^ x;
    state[i+2] = a2 ^ _ks_aes_xtime(a2 ^ a3) ^ x;
    state[i+3] = a3 ^ _ks_aes_xtime(a3 ^ a0) ^ x;
  }
}

function _ks_aes_addRoundKey(state, w, round) {
  for (let c = 0; c < 4; c++) {
    const wc = w[round * 4 + c];
    state[c*4]   ^= (wc >>> 24) & 0xff;
    state[c*4+1] ^= (wc >>> 16) & 0xff;
    state[c*4+2] ^= (wc >>> 8) & 0xff;
    state[c*4+3] ^= wc & 0xff;
  }
}

function _ks_aes_encryptBlock(block, w) {
  const state = new Array(16);
  for (let c = 0; c < 4; c++) {
    state[c*4]   = block[c*4];
    state[c*4+1] = block[c*4+1];
    state[c*4+2] = block[c*4+2];
    state[c*4+3] = block[c*4+3];
  }
  _ks_aes_addRoundKey(state, w, 0);
  for (let r = 1; r < 10; r++) {
    _ks_aes_subBytes(state);
    _ks_aes_shiftRows(state);
    _ks_aes_mixColumns(state);
    _ks_aes_addRoundKey(state, w, r);
  }
  _ks_aes_subBytes(state);
  _ks_aes_shiftRows(state);
  _ks_aes_addRoundKey(state, w, 10);
  return state;
}

function _ks_aes_cbcEncrypt(plaintext, keyStr) {
  const keyBytes = [];
  for (let i = 0; i < keyStr.length && keyBytes.length < 16; i++) {
    keyBytes.push(keyStr.charCodeAt(i) & 0xff);
  }
  while (keyBytes.length < 16) keyBytes.push(0);
  const iv = keyBytes.slice();
  const w = _ks_aes_keyExpansion(keyBytes);

  const ptBytes = [];
  for (let i = 0; i < plaintext.length; i++) {
    const code = plaintext.charCodeAt(i);
    if (code < 0x80) {
      ptBytes.push(code);
    } else if (code < 0x800) {
      ptBytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      ptBytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  const padLen = 16 - (ptBytes.length % 16);
  for (let i = 0; i < padLen; i++) ptBytes.push(padLen);

  const out = [];
  let prev = iv;
  for (let offset = 0; offset < ptBytes.length; offset += 16) {
    const block = [];
    for (let i = 0; i < 16; i++) block.push(ptBytes[offset + i] ^ prev[i]);
    prev = _ks_aes_encryptBlock(block, w);
    for (let i = 0; i < 16; i++) out.push(prev[i]);
  }

  const b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let b64 = "";
  for (let i = 0; i < out.length; i += 3) {
    const a = out[i], b = out[i+1] || 0, c = out[i+2] || 0;
    b64 += b64chars[(a >> 2) & 0x3f];
    b64 += b64chars[((a & 3) << 4) | ((b >> 4) & 0x0f)];
    b64 += (i+1 < out.length) ? b64chars[((b & 0x0f) << 2) | ((c >> 6) & 0x03)] : "=";
    b64 += (i+2 < out.length) ? b64chars[c & 0x3f] : "=";
  }
  return b64;
}

// ============================================================
// Cookie 生成
// ============================================================

const __lp_ks_FP_KEY = "K8wm5PvY9nX7qJc2";
const __lp_ks_SIGN_KEY = "H4tL6rNd3vB9xM5k";
const __lp_ks_PRODUCT = "KUAISHOU_VISION";
const __lp_ks_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const __lp_ks_HEX = "0123456789abcdef";

function _ks_randomStr(len) {
  let s = "";
  for (let i = 0; i < len; i++) s += __lp_ks_CHARSET[Math.floor(Math.random() * __lp_ks_CHARSET.length)];
  return s;
}

function _ks_randomHex(len) {
  let s = "";
  for (let i = 0; i < len; i++) s += __lp_ks_HEX[Math.floor(Math.random() * 16)];
  return s;
}

let _ks_cachedDid = "";
function _ks_getDid() {
  if (!_ks_cachedDid) _ks_cachedDid = "web_" + _ks_randomHex(32);
  return _ks_cachedDid;
}

function _ks_generateKwfv1(pageUrl, did) {
  const ts = (typeof Host !== "undefined" && Host.time && Host.time.nowMillis) ? Host.time.nowMillis() : Date.now();
  const raw = `${encodeURI(pageUrl)}|${did}|${__lp_ks_PRODUCT}|${ts}|${_ks_randomStr(8)}`;
  const b64 = _ks_aes_cbcEncrypt(raw, __lp_ks_FP_KEY);
  return "K" + b64.slice(0, 4) + "W" + b64.slice(4, -2) + "F" + b64.slice(-2);
}

function _ks_generateKwscode(pageUrl, did) {
  const ts = (typeof Host !== "undefined" && Host.time && Host.time.nowMillis) ? Host.time.nowMillis() : Date.now();
  const secToken = _ks_randomStr(64);
  const raw = `${encodeURI(pageUrl)}|${did}|${__lp_ks_PRODUCT}|${ts}|${secToken.slice(0, 8)}`;
  const b64 = _ks_aes_cbcEncrypt(raw, __lp_ks_SIGN_KEY);
  const kwscode = "K" + b64.slice(0, 4) + "W" + b64.slice(4, -2) + "S" + b64.slice(-2);
  return { kwscode, kwssectoken: secToken };
}

function _ks_buildCookieHeader(roomId) {
  const did = _ks_getDid();
  const ts = (typeof Host !== "undefined" && Host.time && Host.time.nowMillis) ? Host.time.nowMillis() : Date.now();
  const pageUrl = `https://live.kuaishou.com/u/${encodeURIComponent(String(roomId))}`;
  const kwfv1 = _ks_generateKwfv1(pageUrl, did);
  const { kwscode, kwssectoken } = _ks_generateKwscode(pageUrl, did);
  return [
    `did=${did}`,
    `didv=${ts}`,
    `kwfv1=${kwfv1}`,
    `kwscode=${kwscode}`,
    `kwssectoken=${kwssectoken}`,
    "kpf=PC_WEB",
    "kpn=KUAISHOU_VISION",
    "clientid=3"
  ].join("; ");
}

// ============================================================
// 插件主体（基于 v1.0.4，去掉 authMode 依赖）
// ============================================================

const __lp_ks_categoryURL = "https://live.kuaishou.com/live_api/category/data";
const __lp_ks_gameListURL = "https://live.kuaishou.com/live_api/gameboard/list";
const __lp_ks_nonGameListURL = "https://live.kuaishou.com/live_api/non-gameboard/list";
const __lp_ks_searchOverviewURL = "https://live.kuaishou.com/live_api/search/overview";
const __lp_ks_searchAuthorURL = "https://live.kuaishou.com/live_api/search/author";
const __lp_ks_searchLiveStreamURL = "https://live.kuaishou.com/live_api/search/liveStream";
const __lp_ks_ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const __lp_ks_playbackUserAgent = "libmpv";
const __lp_ks_playbackHeaders = { "User-Agent": __lp_ks_playbackUserAgent };
const __lp_ks_platformId = "ks";

async function _ks_platformRequest(request, authMode) {
  return await Host.http.request({
    platformId: __lp_ks_platformId,
    authMode: authMode || "none",
    request: request || {}
  });
}
function _ks_throw(code, message, context) {
  if (globalThis.Host && typeof Host.raise === "function") {
    Host.raise(code, message, context || {});
  }
  if (globalThis.Host && typeof Host.makeError === "function") {
    throw Host.makeError(code || "UNKNOWN", message || "", context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _ks_firstMatch(text, re) {
  const m = String(text || "").match(re);
  if (!m || !m[1]) return "";
  return String(m[1]);
}

function _ks_extractInitialStateText(html) {
  const source = String(html || "");
  const markers = ["window.__INITIAL_STATE__=", "__INITIAL_STATE__="];

  for (const marker of markers) {
    const idx = source.indexOf(marker);
    if (idx === -1) continue;

    const jsonStart = idx + marker.length;
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = jsonStart; i < source.length; i += 1) {
      const ch = source[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return source.substring(jsonStart, i + 1);
        }
      }
    }
  }

  return "";
}

function _ks_parseInitialState(html) {
  const raw = _ks_extractInitialStateText(html);
  if (!raw) return null;

  try {
    return JSON.parse(raw.replace(/:\s*undefined/g, ":null"));
  } catch (e) {
    return null;
  }
}

function _ks_extractLiveStreamIdFallback(html) {
  return _ks_firstMatch(String(html || ""), /"id"\s*:\s*"([A-Za-z0-9_-]+)".*?"type"\s*:\s*"live"/s);
}

function _ks_extractShortLink(text) {
  const m = String(text || "").match(/https:\/\/v\.kuaishou\.com\/[A-Za-z0-9]+/);
  return m ? String(m[0]) : "";
}

function _ks_extractUserId(text) {
  return _ks_firstMatch(text, /\/u\/([A-Za-z0-9_-]+)/);
}

function _ks_extractLiveId(text) {
  return _ks_firstMatch(text, /\/live\/([A-Za-z0-9_-]+)/);
}

function _ks_isValidRoomId(roomId) {
  return /^[A-Za-z0-9_-]{3,}$/.test(String(roomId || ""));
}

function _ks_toRoomModel(item) {
  const author = item && item.author ? item.author : {};
  const isLiving = !!(item && item.living);
  const id = String((author && author.id) || (item && item.id) || "");
  return {
    userName: String((author && author.name) || ""),
    roomTitle: String((item && item.caption) || `${String((author && author.name) || "")}的直播间`),
    roomCover: String((item && item.poster) || ""),
    userHeadImg: String((author && author.avatar) || ""),
    liveType: "5",
    liveState: isLiving ? "1" : "0",
    userId: id,
    roomId: id,
    liveWatchedCount: String((item && item.watchingCount) || "")
  };
}

function _ks_qualityLabel(rep) {
  const qualityType = String(rep && rep.qualityType ? rep.qualityType : "").toUpperCase();
  const map = {
    SUPER: "蓝光4M",
    HIGH: "超清",
    STANDARD: "高清",
    LOW: "流畅"
  };
  const named = String(rep && (rep.name || rep.shortName) ? (rep.name || rep.shortName) : "").trim();
  return named || map[qualityType] || "默认";
}

function _ks_qualityRank(rep) {
  const bitrate = Number(rep && rep.bitrate ? rep.bitrate : 0);
  if (bitrate > 0) return bitrate;

  const qualityType = String(rep && rep.qualityType ? rep.qualityType : "").toUpperCase();
  const rankMap = {
    SUPER: 4000,
    HIGH: 2000,
    STANDARD: 1000,
    LOW: 500
  };
  return Number(rankMap[qualityType] || 0);
}

function _ks_makeQualityDetails(playUrl, roomId, codecName) {
  const adaptationSet = playUrl && playUrl.adaptationSet;
  const representation = adaptationSet && adaptationSet.representation;
  if (!Array.isArray(representation)) return [];

  return representation.map(function (rep) {
    const codecLabel = String(codecName || "").trim().toUpperCase();
    const baseTitle = _ks_qualityLabel(rep);
    return {
      roomId: String(roomId),
      title: codecLabel ? `${baseTitle}_${codecLabel}` : baseTitle,
      qn: _ks_qualityRank(rep),
      url: String(rep && rep.url ? rep.url : ""),
      liveCodeType: "flv",
      liveType: "5",
      userAgent: __lp_ks_playbackUserAgent,
      headers: __lp_ks_playbackHeaders
    };
  }).filter(function (item) { return !!item.url; });
}

function _ks_sortQualityDetails(details) {
  return (details || []).sort(function (left, right) {
    const rankDelta = Number((right && right.qn) || 0) - Number((left && left.qn) || 0);
    if (rankDelta !== 0) return rankDelta;

    return String((left && left.title) || "").localeCompare(String((right && right.title) || ""));
  });
}

function _ks_pickCurrentPlayItem(liveData) {
  const playList = liveData && liveData.liveroom && liveData.liveroom.playList;
  return Array.isArray(playList) && playList.length > 0 ? playList[0] : null;
}

function _ks_searchToRoomModel(item) {
  const source = item && typeof item === "object" ? item : {};
  const author = source.author && typeof source.author === "object" ? source.author : {};
  const roomId = String(source.id || source.liveStreamId || source.roomId || "");
  const userId = String(author.id || source.userId || source.ownerId || roomId);
  const roomCover = String(source.poster || source.coverUrl || source.cover || "");
  const userHeadImg = String(author.avatar || author.headerUrl || source.userHeadImg || "");
  const roomTitle = String(source.caption || source.title || `${String(author.name || "")}的直播间`);
  const stateFromItem = source.isLiving !== undefined ? !!source.isLiving : (source.living !== undefined ? !!source.living : true);
  const liveState = stateFromItem ? "1" : "0";
  if (!roomId || !userId) return null;
  return {
    userName: String(author.name || source.userName || ""),
    roomTitle,
    roomCover,
    userHeadImg,
    liveType: "5",
    liveState,
    userId,
    roomId,
    liveWatchedCount: String(source.watchingCount || source.displayWatchingCount || "")
  };
}

function _ks_pickHeaders(referer) {
  const out = {
    "User-Agent": __lp_ks_ua,
    "Accept": "application/json, text/plain, */*",
    "Referer": String(referer || "https://live.kuaishou.com/")
  };
  return out;
}

function _ks_toQueryString(params) {
  const parts = [];
  const source = params && typeof params === "object" ? params : {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    parts.push(`${encodeURIComponent(String(key))}=${encodeURIComponent(String(value))}`);
  }
  return parts.join("&");
}

async function _ks_getSearchData(url, params, referer) {
  const qs = _ks_toQueryString(params);
  const reqURL = qs ? `${url}?${qs}` : url;
  const resp = await _ks_platformRequest({
    url: reqURL,
    method: "GET",
    headers: _ks_pickHeaders(referer),
    timeout: 20
  });
  const obj = JSON.parse(resp.bodyText || "{}");
  const data = obj && obj.data ? obj.data : {};
  const resultCode = Number(data && data.result !== undefined ? data.result : 0);
  if (resultCode !== 1) {
    _ks_throw("UPSTREAM", `kuaishou search api failed: result=${resultCode}`, { url: reqURL, result: String(resultCode) });
  }
  return data;
}

async function _ks_fetchLiveRoomHTML(roomId) {
  const url = `https://live.kuaishou.com/u/${encodeURIComponent(String(roomId))}`;
  const cookie = _ks_buildCookieHeader(roomId);
  const resp = await _ks_platformRequest({
    url,
    method: "GET",
    headers: {
      "User-Agent": __lp_ks_ua,
      "Referer": "https://live.kuaishou.com/",
      "Cookie": cookie
    },
    timeout: 20
  }, "platform_cookie");

  return String(resp.bodyText || "");
}

async function _ks_getLiveRoomBundle(roomId) {
  const html = await _ks_fetchLiveRoomHTML(roomId);
  const liveData = _ks_parseInitialState(html);
  if (!liveData) {
    _ks_throw("PARSE", "__INITIAL_STATE__ not found");
  }

  return { html, liveData };
}

async function _ks_getLiveRoom(roomId) {
  const bundle = await _ks_getLiveRoomBundle(roomId);
  return bundle.liveData;
}

async function _ks_getCategorySubList(id) {
  let page = 1;
  let hasMore = true;
  const categoryList = [];

  while (hasMore) {
    const qs = [
      `type=${encodeURIComponent(String(id))}`,
      `page=${encodeURIComponent(String(page))}`,
      "pageSize=20"
    ].join("&");

    const resp = await _ks_platformRequest({
      url: `${__lp_ks_categoryURL}?${qs}`,
      method: "GET",
      timeout: 20
    });
    const obj = JSON.parse(resp.bodyText || "{}");
    const data = obj && obj.data;
    if (!data) break;

    const list = data.list || [];
    for (const item of list) {
      categoryList.push({
        id: String(item.id || ""),
        parentId: "",
        title: String(item.name || ""),
        icon: String(item.poster || ""),
        biz: ""
      });
    }

    hasMore = !!data.hasMore;
    page += 1;
  }

  return categoryList;
}

async function _ks_getRooms(id, page) {
  const isNonGame = String(id || "").length >= 7;
  const url = isNonGame ? __lp_ks_nonGameListURL : __lp_ks_gameListURL;
  const qs = [
    "filterType=0",
    `page=${encodeURIComponent(String(page))}`,
    "pageSize=20",
    `gameId=${encodeURIComponent(String(id))}`
  ].join("&");

  const resp = await _ks_platformRequest({
    url: `${url}?${qs}`,
    method: "GET",
    timeout: 20
  });
  const obj = JSON.parse(resp.bodyText || "{}");
  const list = obj && obj.data && obj.data.list ? obj.data.list : [];
  return list.map(_ks_toRoomModel);
}

async function _ks_search(keyword, page) {
  const keywordText = String(keyword || "").trim();
  if (!keywordText) return [];
  const pageNo = Number(page) > 0 ? Number(page) : 1;
  const searchReferer = `https://live.kuaishou.com/search/${encodeURIComponent(keywordText)}`;

  await _ks_getSearchData(
    __lp_ks_searchOverviewURL,
    { keyword: keywordText, ussid: "" },
    searchReferer
  );

  const authorData = await _ks_getSearchData(
    __lp_ks_searchAuthorURL,
    {
      key: keywordText,
      keyword: keywordText,
      page: pageNo,
      ussid: "",
      lssid: "",
      count: 15
    },
    searchReferer
  );

  const ussid = String(authorData.ussid || "");
  const liveData = await _ks_getSearchData(
    __lp_ks_searchLiveStreamURL,
    {
      keyword: keywordText,
      page: pageNo,
      ussid
    },
    searchReferer
  );

  const out = [];
  const seenRoomIds = new Set();
  const pushModel = (model) => {
    const roomId = String(model && model.roomId ? model.roomId : "");
    if (!roomId || seenRoomIds.has(roomId)) return;
    seenRoomIds.add(roomId);
    out.push(model);
  };

  const liveList = Array.isArray(liveData.list) ? liveData.list : [];
  for (const item of liveList) {
    const model = _ks_searchToRoomModel(item);
    if (model) pushModel(model);
  }

  return out;
}

async function _ks_getRoomDetail(roomId) {
  const liveData = await _ks_getLiveRoom(roomId);
  const current = _ks_pickCurrentPlayItem(liveData);
  if (!current) {
    _ks_throw("NOT_FOUND", `room not found: ${roomId}`, { roomId: String(roomId) });
  }

  const author = current.author || {};
  const playUrls = current.liveStream && current.liveStream.playUrls;
  const h264List = playUrls && playUrls.h264 && playUrls.h264.adaptationSet && playUrls.h264.adaptationSet.representation;
  const hevcList = playUrls && playUrls.hevc && playUrls.hevc.adaptationSet && playUrls.hevc.adaptationSet.representation;
  const hasH264 = Array.isArray(h264List) && h264List.length > 0;
  const hasHevc = Array.isArray(hevcList) && hevcList.length > 0;
  const hasStream = hasH264 || hasHevc;
  const liveState = ((current.isLiving === undefined ? hasStream : !!current.isLiving) ? "1" : "0");

  const roomTitle = String((author && author.description) || (current.gameInfo && current.gameInfo.name) || (author && author.name) || "");
  const resolvedId = String((author && author.id) || roomId);

  return {
    userName: String((author && author.name) || ""),
    roomTitle,
    roomCover: String((current.liveStream && current.liveStream.poster) || (author && author.avatar) || ""),
    userHeadImg: String((author && author.avatar) || ""),
    liveType: "5",
    liveState,
    userId: resolvedId,
    roomId: resolvedId,
    liveWatchedCount: String((current.gameInfo && current.gameInfo.watchingCount) || "")
  };
}

async function _ks_getPlayback(roomId) {
  const liveData = await _ks_getLiveRoom(roomId);
  const current = _ks_pickCurrentPlayItem(liveData);
  if (!current) {
    _ks_throw("BLOCKED", "room not live or verification needed", { roomId: String(roomId) });
  }

  const playUrls = current.liveStream && current.liveStream.playUrls;
  if (!playUrls) {
    _ks_throw("INVALID_RESPONSE", "playUrls is empty", { roomId: String(roomId) });
  }

  let qualityDetails = [];
  if (playUrls.h264) {
    qualityDetails = qualityDetails.concat(_ks_makeQualityDetails(playUrls.h264, roomId, "H264"));
  }
  if (playUrls.hevc) {
    qualityDetails = qualityDetails.concat(_ks_makeQualityDetails(playUrls.hevc, roomId, "HEVC"));
  }
  qualityDetails = _ks_sortQualityDetails(qualityDetails);

  if (qualityDetails.length === 0) {
    const hlsUrl = String(current.liveStream && current.liveStream.hlsPlayUrl ? current.liveStream.hlsPlayUrl : "");
    if (hlsUrl) {
      qualityDetails.push({
        roomId: String(roomId),
        title: "默认_HLS",
        qn: 0,
        url: hlsUrl,
        liveCodeType: "m3u8",
        liveType: "5",
        userAgent: __lp_ks_playbackUserAgent,
        headers: __lp_ks_playbackHeaders
      });
    }
  }

  if (qualityDetails.length === 0) {
    _ks_throw("INVALID_RESPONSE", "empty quality details", { roomId: String(roomId) });
  }
  return [{ cdn: "线路1", qualitys: qualityDetails }];
}

async function _ks_resolveShare(shareCode) {
  const trimmed = String(shareCode || "").trim();
  if (!trimmed) _ks_throw("INVALID_ARGS", "shareCode is empty", { field: "shareCode" });

  const shortUrl = _ks_extractShortLink(trimmed);
  if (shortUrl) {
    const resp = await _ks_platformRequest({
      url: shortUrl,
      method: "GET",
      timeout: 20
    });
    const finalUrl = String(resp.url || shortUrl);

    const liveId = _ks_extractLiveId(finalUrl);
    if (liveId) return await _ks_getRoomDetail(liveId);

    const userId = _ks_extractUserId(finalUrl);
    if (userId) return await _ks_getRoomDetail(userId);

    _ks_throw("NOT_FOUND", "cannot resolve room id from short link", { finalUrl: String(finalUrl) });
  }

  if (trimmed.includes("live.kuaishou.com")) {
    const userId = _ks_extractUserId(trimmed);
    if (userId) return await _ks_getRoomDetail(userId);

    const liveId = _ks_extractLiveId(trimmed);
    if (liveId) return await _ks_getRoomDetail(liveId);
  }

  if (_ks_isValidRoomId(trimmed)) {
    return await _ks_getRoomDetail(trimmed);
  }

  _ks_throw("NOT_FOUND", "cannot resolve room id from shareCode", { shareCode: String(shareCode || "") });
}

const __lp_ks_sharedGlobalKey = "__lp_plugin_ks_1_0_8_shared";

function _ks_danmakuDriver() {
  const driver = globalThis.__ksDanmakuDriver;
  if (!driver) {
    _ks_throw("UNSUPPORTED", "ks danmaku driver is unavailable", {});
  }
  return driver;
}

globalThis[__lp_ks_sharedGlobalKey] = {
  throwError: _ks_throw,
  getLiveRoomBundle: _ks_getLiveRoomBundle,
  pickCurrentPlayItem: _ks_pickCurrentPlayItem,
  extractLiveStreamIdFallback: _ks_extractLiveStreamIdFallback,
  userAgent: __lp_ks_ua
};

globalThis.LiveParsePlugin = {
  apiVersion: 1,

  async getCategories() {
    const categories = [
      ["1", "热门"],
      ["2", "网游"],
      ["3", "单机"],
      ["4", "手游"],
      ["5", "棋牌"],
      ["6", "娱乐"],
      ["7", "综合"],
      ["8", "文化"]
    ];

    const result = [];
    for (const item of categories) {
      const id = item[0];
      const title = item[1];
      const subList = await _ks_getCategorySubList(id);
      result.push({ id, title, icon: "", biz: "", subList });
    }
    return result;
  },

  async getRooms(payload) {
    const id = String(payload && payload.id ? payload.id : "");
    const page = payload && payload.page ? Number(payload.page) : 1;
    if (!id) _ks_throw("INVALID_ARGS", "id is required", { field: "id" });
    return await _ks_getRooms(id, page);
  },

  async getPlayback(payload) {
    const roomId = String(payload && payload.roomId ? payload.roomId : "");
    if (!roomId) _ks_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    return await _ks_getPlayback(roomId);
  },

  async search(payload) {
    const keyword = String(payload && payload.keyword ? payload.keyword : "");
    const page = payload && payload.page ? Number(payload.page) : 1;
    return await _ks_search(keyword, page);
  },

  async getRoomDetail(payload) {
    const roomId = String(payload && payload.roomId ? payload.roomId : "");
    if (!roomId) _ks_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    return await _ks_getRoomDetail(roomId);
  },

  async getLiveState(payload) {
    const roomId = String(payload && payload.roomId ? payload.roomId : "");
    const userId = String(payload && payload.userId ? payload.userId : "");
    if (!roomId) _ks_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    const info = await this.getRoomDetail({ roomId, userId });
    return { liveState: String(info && info.liveState ? info.liveState : "3") };
  },

  async resolveShare(payload) {
    const shareCode = String(payload && payload.shareCode ? payload.shareCode : "");
    if (!shareCode) _ks_throw("INVALID_ARGS", "shareCode is required", { field: "shareCode" });
    return await _ks_resolveShare(shareCode);
  },

  async getDanmaku(payload) {
    const roomId = String(payload && payload.roomId ? payload.roomId : "");
    if (!roomId) _ks_throw("INVALID_ARGS", "roomId is required", { field: "roomId" });
    return await _ks_danmakuDriver().getDanmakuPlan(roomId);
  },

  async createDanmakuSession(payload) {
    return await _ks_danmakuDriver().createDanmakuSession(payload);
  },

  async onDanmakuOpen(payload) {
    return await _ks_danmakuDriver().onDanmakuOpen(payload);
  },

  async onDanmakuFrame(payload) {
    return await _ks_danmakuDriver().onDanmakuFrame(payload);
  },

  async onDanmakuTick(payload) {
    return await _ks_danmakuDriver().onDanmakuTick(payload);
  },

  async destroyDanmakuSession(payload) {
    return await _ks_danmakuDriver().destroyDanmakuSession(payload);
  }
};
