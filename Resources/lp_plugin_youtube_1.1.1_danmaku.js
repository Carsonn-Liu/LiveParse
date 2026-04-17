(function () {
const __yt_danmakuSessions = {};
const __yt_sharedGlobalKey = "__lp_plugin_youtube_1_1_1_shared";
const __yt_pollingIntervalMs = 2500;
const __yt_liveChatEndpoint = "https://www.youtube.com/youtubei/v1/live_chat/get_live_chat";

function _yt_shared() {
  const shared = globalThis[__yt_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"youtube shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _yt_throw(code, message, context) {
  const shared = globalThis[__yt_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _yt_str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function _yt_safeJsonParse(text) {
  try {
    return JSON.parse(_yt_str(text));
  } catch (_) {
    return null;
  }
}

function _yt_sharedTextFromRuns(value) {
  const shared = _yt_shared();
  return typeof shared.textFromRuns === "function" ? shared.textFromRuns(value) : "";
}

function _yt_sharedCollectByKey(root, key) {
  const shared = _yt_shared();
  return typeof shared.collectByKey === "function" ? shared.collectByKey(root, key) : [];
}

function _yt_extractMessageText(renderer) {
  if (!renderer || typeof renderer !== "object") return "";
  const candidateKeys = [
    "message",
    "headerSubtext",
    "subtext",
    "primaryText",
    "bodyText",
    "purchaseMessage",
    "text"
  ];
  for (const key of candidateKeys) {
    const text = _yt_sharedTextFromRuns(renderer[key]);
    if (text) return text;
  }
  return "";
}

function _yt_extractAuthorName(renderer) {
  if (!renderer || typeof renderer !== "object") return "";
  const candidateKeys = ["authorName", "headerPrimaryText", "authorBadges"];
  for (const key of candidateKeys) {
    const text = _yt_sharedTextFromRuns(renderer[key]);
    if (text) return text;
  }
  const author = renderer.authorExternalChannelId || renderer.id;
  return _yt_str(author);
}

function _yt_extractColor(renderer) {
  const keys = [
    "bodyBackgroundColor",
    "headerBackgroundColor",
    "bodyTextColor",
    "authorNameTextColor"
  ];
  for (const key of keys) {
    const num = Number(renderer && renderer[key]);
    if (Number.isFinite(num) && num >= 0) return num >>> 0;
  }
  return 16777215;
}

function _yt_pushMessage(out, seen, nickname, text, color) {
  const finalText = _yt_str(text).trim();
  if (!finalText) return;
  const finalNickname = _yt_str(nickname);
  const dedupeKey = `${finalNickname}::${finalText}`;
  if (seen[dedupeKey]) return;
  seen[dedupeKey] = true;
  out.push({
    text: finalText,
    nickname: finalNickname,
    color: Number.isFinite(Number(color)) ? (Number(color) >>> 0) : 16777215
  });
}

function _yt_collectMessages(response) {
  const out = [];
  const seen = {};
  const rendererKeys = [
    "liveChatTextMessageRenderer",
    "liveChatPaidMessageRenderer",
    "liveChatMembershipItemRenderer",
    "liveChatSponsorshipsGiftPurchaseAnnouncementRenderer",
    "liveChatSponsorshipsGiftRedemptionAnnouncementRenderer",
    "liveChatPlaceholderItemRenderer"
  ];

  for (const rendererKey of rendererKeys) {
    const renderers = _yt_sharedCollectByKey(response, rendererKey);
    for (const renderer of renderers) {
      const text = _yt_extractMessageText(renderer);
      if (!text) continue;
      const nickname = _yt_extractAuthorName(renderer);
      _yt_pushMessage(out, seen, nickname, text, _yt_extractColor(renderer));
    }
  }

  return out;
}

function _yt_extractContinuation(response) {
  const shared = _yt_shared();
  if (typeof shared.extractLiveChatContinuation === "function") {
    return _yt_str(shared.extractLiveChatContinuation(null, response, ""));
  }
  return "";
}

function _yt_buildPollURL(apiKey) {
  return __yt_liveChatEndpoint + "?prettyPrint=false&key=" + encodeURIComponent(_yt_str(apiKey));
}

function _yt_buildPollHeaders(session) {
  const base = session && session.headers && typeof session.headers === "object" ? session.headers : {};
  const headers = {
    "Content-Type": _yt_str(base["Content-Type"] || base["content-type"] || "application/json"),
    Origin: _yt_str(base.Origin || base.origin || "https://www.youtube.com"),
    Referer: _yt_str(base.Referer || base.referer || "https://www.youtube.com/"),
    "User-Agent": _yt_str(base["User-Agent"] || base["user-agent"] || _yt_shared().userAgent || "")
  };
  if (_yt_str(session.visitorData)) {
    headers["X-Goog-Visitor-Id"] = _yt_str(session.visitorData);
  }
  return headers;
}

function _yt_buildPollBody(session) {
  return {
    context: {
      client: {
        clientName: _yt_str(session.clientName || _yt_shared().webClientName || "WEB"),
        clientVersion: _yt_str(session.clientVersion || _yt_shared().webClientVersionFallback || ""),
        hl: _yt_str(session.hl || "en"),
        gl: _yt_str(session.gl || "US"),
        utcOffsetMinutes: 0,
        browserName: "Chrome",
        browserVersion: "145.0.0.0",
        osName: "Macintosh",
        osVersion: "10_15_7",
        clientScreen: "WATCH"
      }
    },
    continuation: _yt_str(session.continuation)
  };
}

function _yt_makePoll(session) {
  return {
    url: _yt_buildPollURL(session.apiKey),
    method: "POST",
    headers: _yt_buildPollHeaders(session),
    bodyText: JSON.stringify(_yt_buildPollBody(session))
  };
}

function _yt_session(connectionId) {
  const key = _yt_str(connectionId);
  const session = __yt_danmakuSessions[key];
  if (!session) {
    _yt_throw("INVALID_STATE", "danmaku session not found", { connectionId: key });
  }
  return session;
}

const __ytDanmakuDriver = {
  async getDanmakuPlan(roomId) {
    const shared = _yt_shared();
    const resolved = await shared.resolveVideoId(roomId);
    const watch = await shared.fetchWatchByVideoId(resolved.videoId);
    const playerResponse = shared.extractWatchPlayerResponse(watch.text);
    let initialData = null;
    try {
      initialData = shared.extractInitialData(watch.text);
    } catch (_) {
      initialData = null;
    }

    const continuation = _yt_str(shared.extractLiveChatContinuation(playerResponse, initialData, watch.text));
    if (!continuation) {
      _yt_throw("NOT_FOUND", "youtube live chat continuation not found", {
        roomId: _yt_str(roomId),
        videoId: _yt_str(resolved.videoId)
      });
    }

    const apiKey = _yt_str(shared.extractInnertubeApiKey(watch.text) || "");
    const clientVersion = _yt_str(shared.extractInnertubeClientVersion(watch.text) || shared.webClientVersionFallback || "");
    const visitorData = _yt_str(shared.extractVisitorData(watch.text));
    const videoId = _yt_str(resolved.videoId);

    return {
      args: {
        _danmu_type: "http_polling",
        _polling_url: __yt_liveChatEndpoint,
        _polling_method: "POST",
        _polling_interval: String(__yt_pollingIntervalMs),
        continuation: continuation,
        apiKey: apiKey,
        clientName: _yt_str(shared.webClientName || "WEB"),
        clientVersion: clientVersion,
        visitorData: visitorData,
        hl: "en",
        gl: "US",
        videoId: videoId
      },
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.youtube.com",
        Referer: "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId),
        "User-Agent": _yt_str(shared.userAgent)
      },
      transport: {
        kind: "http_polling",
        url: __yt_liveChatEndpoint,
        polling: {
          method: "POST",
          intervalMs: __yt_pollingIntervalMs,
          sendOnConnect: true
        }
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "youtube_live_chat_json",
        protocolVersion: "1"
      }
    };
  },

  async createDanmakuSession(payload) {
    const connectionId = _yt_str(payload && payload.connectionId);
    if (!connectionId) {
      _yt_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    }
    const args = payload && payload.args ? payload.args : {};
    const continuation = _yt_str(args.continuation);
    const apiKey = _yt_str(args.apiKey);
    if (!continuation) {
      _yt_throw("INVALID_ARGS", "continuation is required", { field: "continuation" });
    }
    if (!apiKey) {
      _yt_throw("INVALID_ARGS", "apiKey is required", { field: "apiKey" });
    }

    __yt_danmakuSessions[connectionId] = {
      connectionId: connectionId,
      continuation: continuation,
      apiKey: apiKey,
      clientName: _yt_str(args.clientName || _yt_shared().webClientName || "WEB"),
      clientVersion: _yt_str(args.clientVersion || _yt_shared().webClientVersionFallback || ""),
      visitorData: _yt_str(args.visitorData),
      hl: _yt_str(args.hl || "en"),
      gl: _yt_str(args.gl || "US"),
      videoId: _yt_str(args.videoId),
      headers: payload && payload.headers ? payload.headers : null
    };

    const session = __yt_danmakuSessions[connectionId];
    return {
      ok: true,
      poll: _yt_makePoll(session),
      timer: {
        mode: "polling",
        intervalMs: __yt_pollingIntervalMs
      }
    };
  },

  async onDanmakuOpen() {
    return {
      timer: {
        mode: "polling",
        intervalMs: __yt_pollingIntervalMs
      }
    };
  },

  async onDanmakuFrame(payload) {
    const session = _yt_session(payload && payload.connectionId);
    const text = _yt_str(payload && payload.text);
    const response = _yt_safeJsonParse(text) || {};
    const nextContinuation = _yt_extractContinuation(response);
    if (nextContinuation) {
      session.continuation = nextContinuation;
    }

    return {
      messages: _yt_collectMessages(response),
      poll: _yt_makePoll(session),
      timer: {
        mode: "polling",
        intervalMs: __yt_pollingIntervalMs
      }
    };
  },

  async onDanmakuTick(payload) {
    const session = _yt_session(payload && payload.connectionId);
    return {
      poll: _yt_makePoll(session),
      timer: {
        mode: "polling",
        intervalMs: __yt_pollingIntervalMs
      }
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _yt_str(payload && payload.connectionId);
    if (connectionId) {
      delete __yt_danmakuSessions[connectionId];
    }
    return {
      ok: true
    };
  }
};

globalThis.__ytDanmakuDriver = __ytDanmakuDriver;
})();
