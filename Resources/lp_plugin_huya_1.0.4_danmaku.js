(function () {
const __huya_danmakuSessions = {};
const __huya_sharedGlobalKey = "__lp_plugin_huya_1_0_4_shared";
const __huya_connectionUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1 Edg/91.0.4472.69";

function _huya_shared() {
  const shared = globalThis[__huya_sharedGlobalKey];
  if (!shared) {
    throw new Error("LP_PLUGIN_ERROR:{\"code\":\"UNSUPPORTED\",\"message\":\"huya shared helpers are unavailable\",\"context\":{}}");
  }
  return shared;
}

function _huya_throw(code, message, context) {
  const shared = globalThis[__huya_sharedGlobalKey];
  if (shared && typeof shared.throwError === "function") {
    return shared.throwError(code, message, context || {});
  }
  throw new Error(`LP_PLUGIN_ERROR:${JSON.stringify({ code: String(code || "UNKNOWN"), message: String(message || ""), context: context || {} })}`);
}

function _huya_str(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function _huya_bytesToBase64(bytes) {
  if (typeof btoa !== "function") _huya_throw("UNSUPPORTED", "btoa is unavailable", {});
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] & 0xff);
  }
  return btoa(binary);
}

function _huya_base64ToBytes(value) {
  if (typeof atob !== "function") _huya_throw("UNSUPPORTED", "atob is unavailable", {});
  const raw = atob(_huya_str(value));
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    out.push(raw.charCodeAt(i) & 0xff);
  }
  return out;
}

function _huya_binaryWrite(bytes) {
  return {
    kind: "binary",
    bytesBase64: _huya_bytesToBase64(bytes)
  };
}

function _huya_asByteArray(bufferLike) {
  return Array.from(new Uint8Array(bufferLike));
}

function _huya_buildJoinPacket(uid, tid, sid) {
  if (typeof sendRegister !== "function" || !globalThis.HUYA || !globalThis.Taf) {
    _huya_throw("UNSUPPORTED", "huya.js runtime not available", {});
  }

  const userInfo = new HUYA.WSUserInfo();
  userInfo.lUid = Number(uid || 0);
  userInfo.bAnonymous = true;
  userInfo.sGuid = "";
  userInfo.sToken = "";
  userInfo.lTid = Number(tid || 0);
  userInfo.lSid = Number(sid || 0);
  userInfo.lGroupId = 0;
  userInfo.lGroupType = 0;

  return _huya_asByteArray(sendRegister(userInfo));
}

function _huya_buildHeartbeatPacket() {
  const raw = "ABQdAAwsNgBM";
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    out.push(raw.charCodeAt(i) & 0xff);
  }
  return out;
}

function _huya_parseMessages(bytes) {
  const out = [];
  if (!globalThis.HUYA || !globalThis.Taf) {
    return out;
  }

  try {
    const commandInput = new Taf.JceInputStream(new Uint8Array(bytes || []).buffer);
    const command = new HUYA.WebSocketCommand();
    command.readFrom(commandInput);

    if (Number(command.iCmdType) !== HUYA.EWebSocketCommandType.EWSCmdS2C_MsgPushReq) {
      return out;
    }

    const pushInput = new Taf.JceInputStream(command.vData.buffer);
    const pushMessage = new HUYA.WSPushMessage();
    pushMessage.readFrom(pushInput);

    if (Number(pushMessage.iUri) !== 1400) {
      return out;
    }

    const noticeInput = new Taf.JceInputStream(pushMessage.sMsg.buffer);
    const messageNotice = new HUYA.MessageNotice();
    messageNotice.readFrom(noticeInput);

    const nickname = messageNotice.tUserInfo && messageNotice.tUserInfo.sNickName
      ? String(messageNotice.tUserInfo.sNickName)
      : "";
    const text = String(messageNotice.sContent || "");
    const fontColor = messageNotice.tBulletFormat
      ? Number(messageNotice.tBulletFormat.iFontColor)
      : -1;
    const color = (fontColor === 255 || !Number.isFinite(fontColor) || fontColor < 0)
      ? 0xFFFFFF
      : (fontColor >>> 0);

    if (text) {
      out.push({
        nickname: nickname,
        text: text,
        color: color
      });
    }
  } catch (e) {
  }

  return out;
}

function _huya_session(connectionId) {
  const key = _huya_str(connectionId);
  const session = __huya_danmakuSessions[key];
  if (!session) {
    _huya_throw("INVALID_STATE", "danmaku session not found", { connectionId: key });
  }
  return session;
}

globalThis.__huyaDanmakuDriver = {
  async getDanmakuPlan(roomId) {
    const shared = _huya_shared();
    const context = await shared.getDanmakuContext(roomId);
    return {
      args: {
        roomId: _huya_str(context.roomId || roomId),
        lYyid: _huya_str(context.lYyid),
        lChannelId: _huya_str(context.lChannelId),
        lSubChannelId: _huya_str(context.lSubChannelId)
      },
      headers: {
        "User-Agent": __huya_connectionUserAgent
      },
      transport: {
        kind: "websocket",
        url: _huya_str(shared.danmakuWebSocketURL || "wss://cdnws.api.huya.com"),
        frameType: "binary"
      },
      runtime: {
        driver: "plugin_js_v1",
        protocolId: "huya_ws_jce",
        protocolVersion: "1"
      }
    };
  },

  async createDanmakuSession(payload) {
    const connectionId = _huya_str(payload && payload.connectionId ? payload.connectionId : "");
    const args = payload && payload.args ? payload.args : {};
    if (!connectionId) _huya_throw("INVALID_ARGS", "connectionId is required", { field: "connectionId" });
    if (!_huya_str(args.lChannelId) || !_huya_str(args.lSubChannelId)) {
      _huya_throw("INVALID_ARGS", "huya danmaku args are incomplete", {
        lChannelId: _huya_str(args.lChannelId),
        lSubChannelId: _huya_str(args.lSubChannelId)
      });
    }

    __huya_danmakuSessions[connectionId] = {
      connectionId: connectionId,
      lYyid: _huya_str(args.lYyid),
      lChannelId: _huya_str(args.lChannelId),
      lSubChannelId: _huya_str(args.lSubChannelId)
    };

    return {
      ok: true,
      timer: {
        mode: "off"
      }
    };
  },

  async onDanmakuOpen(payload) {
    const session = _huya_session(payload && payload.connectionId);
    return {
      writes: [
        _huya_binaryWrite(_huya_buildJoinPacket(session.lYyid, session.lChannelId, session.lSubChannelId))
      ],
      timer: {
        mode: "heartbeat",
        intervalMs: 60000
      }
    };
  },

  async onDanmakuFrame(payload) {
    const frameType = _huya_str(payload && payload.frameType ? payload.frameType : "");
    if (frameType !== "binary") return { messages: [], writes: [] };
    _huya_session(payload && payload.connectionId);
    return {
      messages: _huya_parseMessages(_huya_base64ToBytes(payload && payload.bytesBase64 ? payload.bytesBase64 : "")),
      writes: []
    };
  },

  async onDanmakuTick(payload) {
    _huya_session(payload && payload.connectionId);
    return {
      writes: [_huya_binaryWrite(_huya_buildHeartbeatPacket())],
      timer: {
        mode: "heartbeat",
        intervalMs: 60000
      }
    };
  },

  async destroyDanmakuSession(payload) {
    const connectionId = _huya_str(payload && payload.connectionId ? payload.connectionId : "");
    if (connectionId) delete __huya_danmakuSessions[connectionId];
    return { ok: true };
  }
};
})();
