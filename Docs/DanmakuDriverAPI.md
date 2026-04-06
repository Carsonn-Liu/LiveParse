# Danmaku Driver API 草案（Host <-> Plugin）

更新时间：2026-04-06

## 目标

本文档定义 AngelLive 宿主与 LiveParse 插件之间的弹幕协议驱动接口，目标是：

- 宿主保留 transport 能力
- 插件接管 protocol 能力
- 在 `apiVersion = 1` 前提下支持渐进迁移
- 为 AngelLive 第一阶段宿主骨架提供可直接落代码的字段规范

本文档是 `/Users/pangchong/Desktop/Git_Mini/LiveParse/Docs/DanmakuParserMigrationPlan.md` 的配套接口草案。

## 设计原则

- 兼容旧插件：旧插件仍可只返回 `args + headers`
- 新插件通过 `runtime.driver` 声明支持新弹幕驱动
- 宿主与插件之间的 frame 交互先走稳定 JSON 边界
- 每条连接必须具备唯一 `connectionId`
- 插件内部 session 状态必须按 `connectionId` 隔离

## 能力探测

### 旧协议

旧插件 `getDanmaku(payload)` 返回：

```json
{
  "args": {
    "roomId": "12345",
    "ws_url": "wss://..."
  },
  "headers": {
    "User-Agent": "..."
  }
}
```

宿主行为：

- 走 `LegacySwiftDanmakuDriver`

### 新协议

新插件 `getDanmaku(payload)` 返回：

```json
{
  "args": {
    "roomId": "12345",
    "token": "..."
  },
  "headers": {
    "User-Agent": "..."
  },
  "transport": {
    "kind": "websocket",
    "url": "wss://example.com/socket",
    "frameType": "binary"
  },
  "runtime": {
    "driver": "plugin_js_v1"
  }
}
```

宿主行为：

- 若 `runtime.driver == "plugin_js_v1"`，优先走 `PluginJSDanmakuDriver`
- 若新方法缺失、初始化失败或运行时 fallback 命中，则回退 `LegacySwiftDanmakuDriver`

## `getDanmaku` 新返回模型

```ts
interface PluginDanmakuPlan {
  args: Record<string, string>
  headers?: Record<string, string> | null
  transport?: DanmakuTransportPlan
  runtime?: DanmakuRuntimePlan
}
```

### `DanmakuTransportPlan`

```ts
interface DanmakuTransportPlan {
  kind: "websocket" | "http_polling"
  url?: string
  frameType?: "text" | "binary"
  subprotocols?: string[]
  polling?: DanmakuPollingPlan
}
```

字段说明：

- `kind`
  - 必填
  - `websocket`：宿主建立 WebSocket
  - `http_polling`：宿主建立 HTTP 轮询
- `url`
  - `websocket` 推荐必填
  - `http_polling` 可选，若存在则作为默认轮询入口
- `frameType`
  - 仅 `websocket` 有意义
  - 默认：`text`
- `subprotocols`
  - 可选，例如某些平台需要 `chat`
- `polling`
  - 仅 `http_polling` 有意义

### `DanmakuPollingPlan`

```ts
interface DanmakuPollingPlan {
  method?: "GET" | "POST"
  intervalMs?: number
  sendOnConnect?: boolean
}
```

字段说明：

- `method`
  - 默认 `POST`
- `intervalMs`
  - 默认 `3000`
- `sendOnConnect`
  - 默认 `true`
  - 表示宿主建立 polling session 后是否立即触发首轮请求

### `DanmakuRuntimePlan`

```ts
interface DanmakuRuntimePlan {
  driver: "plugin_js_v1"
  protocolId?: string
  protocolVersion?: string
}
```

字段说明：

- `driver`
  - 当前唯一合法值：`plugin_js_v1`
- `protocolId`
  - 可选，便于日志和调试，如 `bilibili_ws`
- `protocolVersion`
  - 可选，便于后续协议调优时追踪

## 插件新增方法

## 1. `createDanmakuSession(payload)`

用途：

- 初始化插件侧 session
- 生成首个协议状态
- 返回初始调度建议

### 输入

```ts
interface CreateDanmakuSessionPayload {
  connectionId: string
  roomId: string
  userId?: string | null
  args: Record<string, string>
  headers?: Record<string, string> | null
  transport: DanmakuTransportPlan
  context?: Record<string, string>
}
```

### 输出

```ts
interface CreateDanmakuSessionResult {
  ok: boolean
  timer?: DanmakuTimerPlan
  poll?: DanmakuPollRequest | null
}
```

字段说明：

- `ok`
  - 必填
- `timer`
  - 可选，初始化心跳或定时回调配置
- `poll`
  - 仅 `http_polling` 常见
  - 表示创建完成后首个 polling 请求

## 2. `onDanmakuOpen(payload)`

用途：

- WebSocket 建连成功后由宿主触发
- 插件返回首批需要发送的握手 / 登录 / 入组包

### 输入

```ts
interface OnDanmakuOpenPayload {
  connectionId: string
}
```

### 输出

```ts
interface OnDanmakuOpenResult {
  writes?: DanmakuWriteAction[]
  timer?: DanmakuTimerPlan
}
```

## 3. `onDanmakuFrame(payload)`

用途：

- 插件处理网络 frame
- 返回消息、ack、后续写包、调度更新

### 输入

```ts
interface OnDanmakuFramePayload {
  connectionId: string
  frameType: "text" | "binary" | "http_response"
  text?: string
  bytesBase64?: string
  statusCode?: number
  responseHeaders?: Record<string, string>
}
```

约束：

- `text` 与 `bytesBase64` 二选一
- `http_response` 时：
  - 文本 body 放 `text`
  - 二进制 body 放 `bytesBase64`

### 输出

```ts
interface OnDanmakuFrameResult {
  messages?: DanmakuMessage[]
  writes?: DanmakuWriteAction[]
  timer?: DanmakuTimerPlan
  poll?: DanmakuPollRequest | null
}
```

## 4. `onDanmakuTick(payload)`

用途：

- 宿主定时器触发时，向插件索取心跳包或下一轮 polling 请求

### 输入

```ts
interface OnDanmakuTickPayload {
  connectionId: string
  reason: "heartbeat" | "polling"
}
```

### 输出

```ts
interface OnDanmakuTickResult {
  writes?: DanmakuWriteAction[]
  timer?: DanmakuTimerPlan
  poll?: DanmakuPollRequest | null
}
```

## 5. `destroyDanmakuSession(payload)`

用途：

- 清理插件侧 session

### 输入

```ts
interface DestroyDanmakuSessionPayload {
  connectionId: string
  reason?: "disconnect" | "fallback" | "deinit" | "error"
}
```

### 输出

```ts
interface DestroyDanmakuSessionResult {
  ok: boolean
}
```

## 通用模型

## `DanmakuMessage`

```ts
interface DanmakuMessage {
  text: string
  nickname: string
  color?: number
}
```

字段说明：

- `text`
  - 必填
- `nickname`
  - 必填；若平台无昵称也建议返回空字符串而不是缺失
- `color`
  - 可选；默认宿主可按白色处理

## `DanmakuWriteAction`

```ts
interface DanmakuWriteAction {
  kind: "text" | "binary"
  text?: string
  bytesBase64?: string
}
```

约束：

- `kind == "text"` 时必须提供 `text`
- `kind == "binary"` 时必须提供 `bytesBase64`

## `DanmakuTimerPlan`

```ts
interface DanmakuTimerPlan {
  mode: "off" | "heartbeat" | "polling"
  intervalMs?: number
}
```

字段说明：

- `mode == "off"`
  - 宿主关闭当前 driver timer
- `mode == "heartbeat"`
  - 宿主按该频率触发 `onDanmakuTick(reason: "heartbeat")`
- `mode == "polling"`
  - 宿主按该频率触发 `onDanmakuTick(reason: "polling")`

## `DanmakuPollRequest`

```ts
interface DanmakuPollRequest {
  url?: string
  method?: "GET" | "POST"
  headers?: Record<string, string>
  query?: Record<string, string>
  bodyText?: string
  bodyBase64?: string
}
```

字段说明：

- `url`
  - 可选；若为空则使用 `transport.url`
- `headers`
  - 本次轮询专属 headers
- `query`
  - 仅适用于 GET 或需要 query 追加的场景
- `bodyText`
  - 文本 body
- `bodyBase64`
  - 二进制 body

约束：

- `bodyText` 与 `bodyBase64` 二选一

## 宿主行为约束

## 建连阶段

### WebSocket

1. 调用 `getDanmaku`
2. 若命中新协议：
   - 生成 `connectionId`
   - 调用 `createDanmakuSession`
   - 按 `transport.url` 建立 WebSocket
   - 建连成功后调用 `onDanmakuOpen`
   - 将返回的 `writes` 发出
3. 若未命中新协议：
   - 走 `LegacySwiftDanmakuDriver`

### HTTP polling

1. 调用 `getDanmaku`
2. 若命中新协议：
   - 生成 `connectionId`
   - 调用 `createDanmakuSession`
   - 若 `poll` 存在且 `sendOnConnect != false`，立即发起首轮请求
   - 后续按 `timer` 或 `polling.intervalMs` 调度
3. 若未命中新协议：
   - 走旧轮询路径

## 收包阶段

- 宿主收到 frame 后，不做协议解释
- 仅做 transport 级类型区分：`text / binary / http_response`
- 原样传给插件处理
- 插件返回 `messages` 后，宿主直接分发给 UI 层

## 错误与 fallback

宿主建议按以下顺序处理 fallback：

1. 插件未声明 `runtime.driver`
   - 直接走 legacy
2. 插件缺少 danmaku runtime 方法
   - 直接走 legacy
3. `createDanmakuSession` 失败
   - 直接走 legacy
4. 新驱动运行中连续失败达到阈值
   - 当前会话 fallback 到 legacy
5. 宿主 debug 配置强制 legacy
   - 忽略插件新驱动能力

建议宿主提供：

- 全局开关：`preferLegacyDanmakuDriver`
- 平台白名单：`legacyDanmakuDriverPlatforms`

## 性能与桥接约定

第一阶段先使用稳定实现：

- 文本：字符串直传
- 二进制：`base64`

但在 `bilibili` 样板接入时必须做 benchmark，至少测：

- 单帧延迟
- CPU 占用
- 高频消息吞吐

若 `base64` 路径不可接受，再定义 v2 bridge，而不是直接修改本协议语义。

## 依赖建议

- 不建议在第一阶段为所有平台统一引入完整 `protobuf.js`
- 优先按平台最小依赖迁移：
  - `bilibili`：沿用现有 JS codec + Host zlib helper 思路
  - `douyu` / `huya` / `twitch`：沿用轻量自定义协议解析
  - `douyin`：按实际需要评估 protobuf 辅助脚本规模

## 平台归类建议

### 第二阶段（WebSocket 主批次）

- `bilibili`
- `douyu`
- `huya`
- `douyin`
- `soop`
- `twitch`

### 第三阶段（轮询 / 特殊协议）

- `ks`
- `youtube`
- `cc`
- `yy`
- `kick`

说明：

- `kick` 当前插件 manifest 中 `danmaku` 为 `unavailable`，且实现是 polling 占位路径；第三阶段需先确认是否继续支持弹幕能力

## 示例

## 示例 1：Bilibili WebSocket

`getDanmaku`：

```json
{
  "args": {
    "roomId": "12345",
    "buvid": "abc",
    "token": "token123"
  },
  "headers": null,
  "transport": {
    "kind": "websocket",
    "url": "wss://broadcastlv.chat.bilibili.com/sub",
    "frameType": "binary"
  },
  "runtime": {
    "driver": "plugin_js_v1",
    "protocolId": "bilibili_ws"
  }
}
```

`onDanmakuOpen`：

```json
{
  "writes": [
    {
      "kind": "binary",
      "bytesBase64": "AAECAwQ="
    }
  ],
  "timer": {
    "mode": "heartbeat",
    "intervalMs": 60000
  }
}
```

`onDanmakuFrame`：

```json
{
  "messages": [
    {
      "text": "233333",
      "nickname": "alice",
      "color": 16777215
    }
  ]
}
```

## 示例 2：Kuaishou HTTP polling

`getDanmaku`：

```json
{
  "args": {
    "liveStreamId": "abcd"
  },
  "headers": {
    "User-Agent": "Mozilla/5.0"
  },
  "transport": {
    "kind": "http_polling",
    "url": "https://live.kuaishou.com/live_api/liveroom/comment",
    "polling": {
      "method": "POST",
      "intervalMs": 3000,
      "sendOnConnect": true
    }
  },
  "runtime": {
    "driver": "plugin_js_v1",
    "protocolId": "ks_polling"
  }
}
```

`createDanmakuSession`：

```json
{
  "ok": true,
  "poll": {
    "method": "POST",
    "bodyText": "{\"liveStreamId\":\"abcd\"}"
  },
  "timer": {
    "mode": "polling",
    "intervalMs": 3000
  }
}
```

`onDanmakuFrame`：

```json
{
  "messages": [
    {
      "text": "来了来了",
      "nickname": "bob",
      "color": 16777215
    }
  ],
  "poll": {
    "method": "POST",
    "bodyText": "{\"liveStreamId\":\"abcd\",\"cursor\":\"next\"}"
  }
}
```

## 建议落地顺序

1. 先以本文档为准，在 AngelLive 搭宿主接口骨架
2. 用 `bilibili` 做第一平台样板
3. 跑 benchmark 验证 `base64` bridge 成本
4. 验证 fallback、driver 切换、日志链路
5. 再批量迁第二阶段平台

## 待确认问题

- 宿主是否需要新增 `Host.binary` 或等价 native helper
- `onDanmakuFrame` 的二进制桥接最终是否维持 `base64`
- `douyin` 是否需要引入精简 protobuf helper
- `kick` 是否继续保留弹幕能力路线
- 宿主 debug 设置页面是否暴露 driver 切换开关
