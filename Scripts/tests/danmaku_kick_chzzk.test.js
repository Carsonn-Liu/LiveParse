import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHost(overrides = {}) {
  const base = {
    http: {
      async request() {
        throw new Error("unexpected http request");
      }
    },
    makeError(code, message, context) {
      const error = new Error(message);
      error.code = code;
      error.context = context || {};
      return error;
    },
    raise() {}
  };
  return Object.assign(base, overrides);
}

function loadScripts(files, hostOverrides = {}) {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    Host: createHost(hostOverrides)
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const file of files) {
    const source = fs.readFileSync(path.resolve(file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }
  return context;
}

test("kick getDanmaku returns plugin_js_v1 websocket plan", async () => {
  const context = loadScripts(
    [
      "Resources/lp_plugin_kick_1.0.22_danmaku.js",
      "Resources/lp_plugin_kick_1.0.22_index.js"
    ],
    {
      http: {
        async request({ request }) {
          const url = String(request && request.url);
          if (url === "https://kick.com/api/v2/channels/tester/chatroom") {
            return {
              status: 200,
              bodyText: JSON.stringify({ id: 12345 })
            };
          }
          throw new Error(`unexpected url: ${url}`);
        }
      }
    }
  );

  const plan = await context.LiveParsePlugin.getDanmaku({ roomId: "tester" });
  assert.equal(plan.runtime.driver, "plugin_js_v1");
  assert.equal(plan.transport.kind, "websocket");
  assert.equal(plan.transport.frameType, "text");
  assert.equal(plan.args.chatroomId, "12345");
});

test("kick danmaku driver subscribes and parses chat messages", async () => {
  const context = loadScripts(
    [
      "Resources/lp_plugin_kick_1.0.22_danmaku.js",
      "Resources/lp_plugin_kick_1.0.22_index.js"
    ],
    {
      http: {
        async request({ request }) {
          const url = String(request && request.url);
          if (url === "https://kick.com/api/v2/channels/tester/chatroom") {
            return {
              status: 200,
              bodyText: JSON.stringify({ id: 12345 })
            };
          }
          throw new Error(`unexpected url: ${url}`);
        }
      }
    }
  );

  const plan = await context.LiveParsePlugin.getDanmaku({ roomId: "tester" });
  await context.LiveParsePlugin.createDanmakuSession({
    connectionId: "kick-1",
    args: plan.args,
    transport: plan.transport
  });

  const connected = await context.LiveParsePlugin.onDanmakuFrame({
    connectionId: "kick-1",
    frameType: "text",
    text: JSON.stringify({
      event: "pusher:connection_established",
      data: JSON.stringify({
        socket_id: "123.456",
        activity_timeout: 30
      })
    })
  });
  assert.equal(connected.writes.length, 1);
  assert.match(String(connected.writes[0].text), /chatrooms\.12345\.v2/);

  const messageFrame = await context.LiveParsePlugin.onDanmakuFrame({
    connectionId: "kick-1",
    frameType: "text",
    text: JSON.stringify({
      event: "App\\Events\\ChatMessageEvent",
      data: JSON.stringify({
        content: "hello from kick",
        sender: {
          username: "tester",
          identity: {
            color: "#12ab34"
          }
        }
      })
    })
  });
  assert.deepEqual(toPlain(messageFrame.messages), [
    {
      nickname: "tester",
      text: "hello from kick",
      color: 0x12ab34
    }
  ]);
});

test("chzzk getDanmaku returns plugin_js_v1 websocket plan", async () => {
  const roomId = "909501f048b44cf0d5c1d28aaaaaaaa";
  const context = loadScripts(
    [
      "Resources/lp_plugin_chzzk_1.0.3_danmaku.js",
      "Resources/lp_plugin_chzzk_1.0.3_index.js"
    ],
    {
      http: {
        async request({ request }) {
          const url = String(request && request.url);
          if (url.includes(`/service/v3/channels/${roomId}/live-detail`) || url.includes(`/service/v1/channels/${roomId}/live-detail`)) {
            return {
              status: 200,
              bodyText: JSON.stringify({
                code: 200,
                content: {
                  status: "OPEN",
                  chatChannelId: "N29nlK"
                }
              })
            };
          }
          if (url === "https://comm-api.game.naver.com/nng_main/v1/chats/access-token?channelId=N29nlK&chatType=STREAMING") {
            return {
              status: 200,
              bodyText: JSON.stringify({
                code: 200,
                content: {
                  accessToken: "chat-access-token",
                  extraToken: "extra-token"
                }
              })
            };
          }
          throw new Error(`unexpected url: ${url}`);
        }
      }
    }
  );

  const plan = await context.LiveParsePlugin.getDanmaku({ roomId });
  assert.equal(plan.runtime.driver, "plugin_js_v1");
  assert.equal(plan.transport.kind, "websocket");
  assert.equal(plan.args.chatChannelId, "N29nlK");
  assert.equal(plan.args.accessToken, "chat-access-token");
});

test("chzzk danmaku driver handshakes and parses chat messages", async () => {
  const roomId = "909501f048b44cf0d5c1d28aaaaaaaa";
  const context = loadScripts(
    [
      "Resources/lp_plugin_chzzk_1.0.3_danmaku.js",
      "Resources/lp_plugin_chzzk_1.0.3_index.js"
    ],
    {
      http: {
        async request({ request }) {
          const url = String(request && request.url);
          if (url.includes(`/service/v3/channels/${roomId}/live-detail`) || url.includes(`/service/v1/channels/${roomId}/live-detail`)) {
            return {
              status: 200,
              bodyText: JSON.stringify({
                code: 200,
                content: {
                  status: "OPEN",
                  chatChannelId: "N29nlK"
                }
              })
            };
          }
          if (url === "https://comm-api.game.naver.com/nng_main/v1/chats/access-token?channelId=N29nlK&chatType=STREAMING") {
            return {
              status: 200,
              bodyText: JSON.stringify({
                code: 200,
                content: {
                  accessToken: "chat-access-token",
                  extraToken: "extra-token"
                }
              })
            };
          }
          throw new Error(`unexpected url: ${url}`);
        }
      }
    }
  );

  const plan = await context.LiveParsePlugin.getDanmaku({ roomId });
  await context.LiveParsePlugin.createDanmakuSession({
    connectionId: "cz-1",
    args: plan.args,
    transport: plan.transport
  });

  const opened = await context.LiveParsePlugin.onDanmakuOpen({
    connectionId: "cz-1"
  });
  assert.equal(opened.writes.length, 1);
  assert.match(String(opened.writes[0].text), /"cmd":100/);

  const connected = await context.LiveParsePlugin.onDanmakuFrame({
    connectionId: "cz-1",
    frameType: "text",
    text: JSON.stringify({
      cmd: 10100,
      retCode: 0,
      bdy: {
        sid: "session-id"
      }
    })
  });
  assert.equal(connected.writes.length, 1);
  assert.match(String(connected.writes[0].text), /"cmd":5101/);

  const messageFrame = await context.LiveParsePlugin.onDanmakuFrame({
    connectionId: "cz-1",
    frameType: "text",
    text: JSON.stringify({
      cmd: 93101,
      bdy: [
        {
          message: "hello from chzzk",
          profile: {
            nickname: "streamer",
            title: {
              color: "#445566"
            }
          }
        }
      ]
    })
  });
  assert.deepEqual(toPlain(messageFrame.messages), [
    {
      nickname: "streamer",
      text: "hello from chzzk",
      color: 0x445566
    }
  ]);
});
