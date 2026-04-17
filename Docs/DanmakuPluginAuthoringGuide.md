# 弹幕插件制作指南（plugin_js_v1）

本文专门讲「弹幕获取 + 协议解析」怎么做，面向已经知道 LiveParse 基本插件结构的贡献者。

- 通用插件规范看：`Docs/PluginAuthoringGuide.md`
- Host 与插件的字段契约看：`Docs/DanmakuDriverAPI.md`
- 本文重点是：如何把 `getDanmaku`、建连、握手、收包、心跳、解析消息这条链路真正落到 JS 插件里

## 1. 先理解现在的边界

弹幕插件化之后，职责已经和旧方案不同：

- 宿主只负责 transport：建 WebSocket、发 HTTP 轮询、收原始 frame、调度 timer
- 插件负责 protocol：拼握手包、维护 session、解析 frame、产出弹幕消息、决定下一次写包或轮询
- 进入新链路的开关是 `getDanmaku` 返回 `runtime.driver = "plugin_js_v1"`

所以现在做新平台弹幕时，不再需要去补宿主侧平台解析逻辑；正确做法是把协议实现放进插件。

## 2. 推荐文件组织

一个支持弹幕插件驱动的平台，建议至少有这 3 类文件：

```text
Resources/lp_plugin_<pluginId>_<version>_manifest.json
Resources/lp_plugin_<pluginId>_<version>_index.js
Resources/lp_plugin_<pluginId>_<version>_danmaku.js
```

如果弹幕还依赖额外库，再放进 `preloadScripts`，例如：

```json
{
  "entry": "lp_plugin_bilibili_1.0.10_index.js",
  "preloadScripts": [
    "fflate_0.8.2_umd.js",
    "lp_plugin_bilibili_1.0.10_danmaku.js"
  ]
}
```

推荐分工：

- `index.js`
  - 负责 8 大主能力
  - 暴露共享 helper 给弹幕脚本复用
  - 在 `getDanmaku` 里调用弹幕 driver 的 plan 生成逻辑
- `*_danmaku.js`
  - 只管弹幕协议
  - 实现 `getDanmakuPlan` 和 5 个生命周期方法
- `manifest.json`
  - 声明 `preloadScripts`
  - 在 `capabilities.danmaku` 中标记 `driver/transport/protocolId/protocolVersion`

## 3. 先把 `getDanmaku` 做对

### 3.1 `getDanmaku` 的职责

`getDanmaku(payload)` 不再只是“给宿主一个 ws 地址”。

它现在要返回 4 类信息：

- `args`：后续 driver 要用的房间参数、token、cursor 等
- `headers`：建连或轮询必须带上的请求头
- `transport`：宿主如何建立连接
- `runtime`：声明协议解析交给插件

最小示例：

```js
async function getDanmaku(payload) {
  const roomId = String((payload && payload.roomId) || "");
  if (!roomId) throw new Error("roomId is required");

  return {
    args: {
      roomId: roomId,
      token: "example-token"
    },
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://example.com/"
    },
    transport: {
      kind: "websocket",
      url: "wss://example.com/ws",
      frameType: "binary"
    },
    runtime: {
      driver: "plugin_js_v1",
      protocolId: "example_ws",
      protocolVersion: "1"
    }
  };
}
```

### 3.2 推荐做法：`index.js` 转给独立 driver

```js
async function getDanmaku(payload) {
  return await globalThis.__exampleDanmakuDriver.getDanmakuPlan(
    payload && payload.roomId,
    payload && payload.headers,
    payload && payload.authMode
  );
}
```

这样 `index.js` 继续保留平台主逻辑，弹幕协议独立演进，后续升级不会把文件揉成一团。

### 3.3 `args` 怎么设计

建议把 `args` 当作“连接建立后，driver 必须能拿到的最小稳定上下文”：

- WebSocket 平台常见字段：`roomId`、`uid`、`token`、`buvid`
- 轮询平台常见字段：`continuation`、`cursor`、`apiKey`
- 尽量保持扁平、字符串化，避免把临时对象直接塞进去

经验规则：

- 能从 `payload` 直接拿到的字段不用重复塞很多份
- 连接后每个 frame 都可能要用的字段，应放在 `args`
- 真正参与建连的 headers，要显式放在 `headers`，不要只埋在 `args`

## 4. 生命周期怎么落地

当 `runtime.driver = "plugin_js_v1"` 时，宿主会按下面顺序调用插件：

1. `createDanmakuSession(payload)`
2. `onDanmakuOpen(payload)`（仅 WebSocket）
3. `onDanmakuFrame(payload)`（每收到一帧都调）
4. `onDanmakuTick(payload)`（心跳 / 轮询调度）
5. `destroyDanmakuSession(payload)`

### 4.1 `createDanmakuSession`

职责：

- 校验关键参数
- 以 `connectionId` 为 key 保存 session 状态
- 返回首个 timer 或 polling 计划

推荐骨架：

```js
const __sessions = {};

async function createDanmakuSession(payload) {
  const connectionId = String((payload && payload.connectionId) || "");
  const args = (payload && payload.args) || {};
  if (!connectionId) throw new Error("connectionId is required");
  if (!args.roomId) throw new Error("roomId is required");

  __sessions[connectionId] = {
    roomId: String(args.roomId),
    token: String(args.token || ""),
    cursor: String(args.cursor || "")
  };

  return {
    ok: true,
    timer: {
      mode: "off"
    }
  };
}
```

关键要求：

- 绝不能把多个房间共用一份裸全局状态
- 所有运行态数据都必须按 `connectionId` 隔离

### 4.2 `onDanmakuOpen`

仅 WebSocket 场景会调。

职责：

- 返回首批写包，例如登录包 / 入组包 / 订阅包
- 启动心跳 timer

示例：

```js
async function onDanmakuOpen(payload) {
  const session = __sessions[String(payload.connectionId)];
  return {
    writes: [
      {
        kind: "binary",
        bytesBase64: buildAuthPacketBase64(session)
      }
    ],
    timer: {
      mode: "heartbeat",
      intervalMs: 30000
    }
  };
}
```

### 4.3 `onDanmakuFrame`

职责：

- 解析宿主送进来的原始 frame
- 产出标准消息 `messages`
- 如协议需要，返回 ack、回包、下一轮 poll

标准消息结构：

```json
{
  "nickname": "主播粉丝",
  "text": "这条弹幕",
  "color": 16777215
}
```

注意：

- `frameType` 可能是 `text`、`binary`、`http_response`
- 二进制 frame 从 `bytesBase64` 取数据
- 轮询协议通常会在这里更新 cursor / continuation

示例：

```js
async function onDanmakuFrame(payload) {
  const session = __sessions[String(payload.connectionId)];
  const messages = [];

  if (payload.frameType === "text") {
    const obj = JSON.parse(String(payload.text || "{}"));
    session.cursor = String(obj.nextCursor || session.cursor || "");
    messages.push({
      nickname: String(obj.user || ""),
      text: String(obj.message || ""),
      color: 0xFFFFFF
    });
  }

  return {
    messages: messages,
    writes: []
  };
}
```

### 4.4 `onDanmakuTick`

职责：

- 生成心跳包
- 或者给 polling 平台返回下一轮请求

WebSocket 心跳示例：

```js
async function onDanmakuTick(payload) {
  return {
    writes: [
      {
        kind: "text",
        text: "PING"
      }
    ],
    timer: {
      mode: "heartbeat",
      intervalMs: 30000
    }
  };
}
```

HTTP polling 示例：

```js
async function onDanmakuTick(payload) {
  const session = __sessions[String(payload.connectionId)];
  return {
    poll: {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      bodyText: JSON.stringify({
        cursor: session.cursor
      })
    },
    timer: {
      mode: "polling",
      intervalMs: 2500
    }
  };
}
```

### 4.5 `destroyDanmakuSession`

职责很简单：删掉 session，释放状态。

```js
async function destroyDanmakuSession(payload) {
  const connectionId = String((payload && payload.connectionId) || "");
  if (connectionId) delete __sessions[connectionId];
  return { ok: true };
}
```

## 5. WebSocket 平台的实现套路

适合：Bilibili、Douyu、Huya、Twitch、SOOP 这类长连接平台。

常见步骤：

1. `getDanmaku` 阶段拿房间号、token、host、headers
2. `createDanmakuSession` 保存 `roomId/token/uid/...`
3. `onDanmakuOpen` 发登录或入组包
4. `onDanmakuFrame` 解析文本帧或二进制包
5. `onDanmakuTick` 发心跳

当前仓库可直接参考：

- `Resources/lp_plugin_bilibili_1.0.10_danmaku.js`
  - WebSocket binary
  - 含 zlib 解压、握手包拼装、消息提取
- `Resources/lp_plugin_douyu_1.0.4_danmaku.js`
  - WebSocket binary
  - 自定义 STT 文本协议解析
- `Resources/lp_plugin_twitch_1.0.33_danmaku.js`
  - WebSocket text
  - IRC 风格握手与 `PING/PONG`

适合照抄的结构：

- `_session(connectionId)`：统一取 session，缺失就抛错
- `_bytesToBase64/_base64ToBytes`：二进制桥接
- `_binaryWrite/_textWrite`：统一产出 `writes`
- `_parseMessages`：把协议解码和 message 归一化放一起

## 6. HTTP 轮询平台的实现套路

适合：YouTube、KS 这类服务端本身不是长连接，或者宿主当前只走 polling 更稳的平台。

常见步骤：

1. `getDanmaku` 返回 `transport.kind = "http_polling"`
2. `createDanmakuSession` 保存 continuation / cursor / headers
3. 首轮请求可通过 `transport.polling.sendOnConnect = true` 直接触发
4. 每次 `onDanmakuFrame` 解析响应，并更新 continuation / cursor
5. `onDanmakuTick` 返回下一轮 `poll`

当前仓库可直接参考：

- `Resources/lp_plugin_youtube_1.1.1_danmaku.js`
  - JSON 轮询
  - continuation 推进
- `Resources/lp_plugin_ks_1.0.8_danmaku.js`
  - 轮询 + protobuf/base64 解码

轮询平台最容易漏的点：

- continuation / cursor 必须在 session 中及时更新
- `poll.headers` 和 `getDanmaku.headers` 不一定完全相同，别偷懒直接复用错头
- 首轮请求如果依赖页面上下文，尽量在 `getDanmaku` 阶段就准备好，不要等收包后再补

## 7. 一个完整的接线方式

推荐在 `index.js` 中集中挂载 `LiveParsePlugin`，把弹幕 driver 透传进去：

```js
globalThis.LiveParsePlugin = {
  apiVersion: 1,

  async getDanmaku(payload) {
    return await globalThis.__exampleDanmakuDriver.getDanmakuPlan(
      payload && payload.roomId,
      payload && payload.headers,
      payload && payload.authMode
    );
  },

  async createDanmakuSession(payload) {
    return await globalThis.__exampleDanmakuDriver.createDanmakuSession(payload);
  },

  async onDanmakuOpen(payload) {
    return await globalThis.__exampleDanmakuDriver.onDanmakuOpen(payload);
  },

  async onDanmakuFrame(payload) {
    return await globalThis.__exampleDanmakuDriver.onDanmakuFrame(payload);
  },

  async onDanmakuTick(payload) {
    return await globalThis.__exampleDanmakuDriver.onDanmakuTick(payload);
  },

  async destroyDanmakuSession(payload) {
    return await globalThis.__exampleDanmakuDriver.destroyDanmakuSession(payload);
  }
};
```

这样入口文件只保留统一导出，协议实现可以放在 preload 脚本里独立维护。

## 8. manifest 要怎么写

最少要保证 3 件事：

1. `preloadScripts` 顺序正确
2. `capabilities.danmaku.status = "available"`
3. `capabilities.danmaku.driver = "plugin_js_v1"`

示例：

```json
{
  "preloadScripts": [
    "lp_plugin_example_1.0.0_danmaku.js"
  ],
  "capabilities": {
    "danmaku": {
      "status": "available",
      "driver": "plugin_js_v1",
      "transport": "websocket",
      "protocolId": "example_ws",
      "protocolVersion": "1"
    }
  }
}
```

如果用了额外解码库，库文件必须排在 `*_danmaku.js` 前面。

## 9. 常见坑

### 9.1 把 session 写成单例

错误做法：

- 只用一个全局 `currentRoomId`
- 重进房间或多个连接时互相覆盖

正确做法：

- 一律 `sessions[connectionId]`

### 9.2 把建连关键头藏在 `args`

如果 WebSocket / polling 请求真的依赖 `User-Agent`、`Referer`、`Cookie` 注入结果，就写到 `headers` 或 `poll.headers`。

### 9.3 二进制协议忘了做 base64 桥接

`DanmakuDriverAPI` 约定里，二进制 frame 通过 `bytesBase64` 传输。不要直接假设能拿到 `Uint8Array`。

### 9.4 JSCore 能力比浏览器少

这里不是浏览器，写法要保守：

- 不要默认 `URLSearchParams`、`TextDecoder`、`Buffer` 一定存在
- 需要 UTF-8/base64/zlib 时，优先复用仓库里已经稳定的 helper
- 能走 `Host.crypto` / `Host.runtime` 的能力，优先走宿主能力

### 9.5 只做了消息解析，没做 timer 续命

很多平台首包成功不代表链路完成，常见还需要：

- 定时心跳
- ack 回包
- continuation / cursor 推进
- 定期重发订阅包

如果只在 `onDanmakuFrame` 里 parse，不在 `onDanmakuTick` 里续命，通常几分钟内就会断流。

## 10. 交付前自查

- `manifest`、`index.js`、`*_danmaku.js` 版本号一致
- `getDanmaku` 返回了 `transport + runtime.driver`
- 所有 session 状态按 `connectionId` 隔离
- WebSocket 平台已验证握手、心跳、消息解析至少各走通一次
- Polling 平台已验证 continuation / cursor 会持续推进
- 关键请求头显式返回，不依赖宿主猜测
- `python3 Scripts/build_plugin_release.py --plugins <pluginId>` 可正常打包

## 11. 该先看哪个现成样例

按协议类型选最快：

- 想看 WebSocket binary：`Resources/lp_plugin_bilibili_1.0.10_danmaku.js`
- 想看 WebSocket 文本协议：`Resources/lp_plugin_twitch_1.0.33_danmaku.js`
- 想看轻量自定义包结构：`Resources/lp_plugin_douyu_1.0.4_danmaku.js`
- 想看 HTTP polling：`Resources/lp_plugin_youtube_1.1.1_danmaku.js`
- 想看 polling + protobuf：`Resources/lp_plugin_ks_1.0.8_danmaku.js`

## 12. 建议阅读顺序

如果是第一次做弹幕插件，建议按这个顺序看：

1. `Docs/PluginAuthoringGuide.md`
2. `Docs/DanmakuPluginAuthoringGuide.md`
3. `Docs/DanmakuDriverAPI.md`
4. 对应协议类型的现成 `Resources/lp_plugin_*_danmaku.js`

这样先知道“要做什么”，再知道“字段怎么对齐”，最后再看真实实现。
