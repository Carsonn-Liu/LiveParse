# 弹幕解析器插件化迁移方案（面向 AngelLive + LiveParse）

更新时间：2026-04-06

## 背景

当前 LiveParse 插件已经承担了平台房间列表、播放地址、直播状态、分享解析等 8 大核心方法中的多数业务解析能力，
但弹幕链路仍处于“插件返回连接参数，宿主完成协议处理”的状态。

现状大致如下：

- 插件 `getDanmaku` 只返回 `args + headers`
- AngelLive 宿主负责：
  - WebSocket / HTTP 轮询连接
  - 握手包发送
  - 心跳包发送
  - 二进制 / 文本 frame 解码
  - 平台级游标、去重、ack、状态维护
- 各平台弹幕协议实现仍大量散落在 AngelLive 宿主中

这导致几个问题：

- 平台协议逻辑与宿主绑定过深，后续热更新能力有限
- 新增或修复弹幕协议时，需要同步改 AngelLive 主工程并重新发版
- 插件化边界不一致：播放解析已经主要在插件，弹幕协议却还在宿主
- 文档和实现存在耦合：当前插件文档仍要求“如支持实时弹幕协议，按需扩展宿主 `WebSocketConnection` / `HTTPPollingDanmakuConnection`”

因此，本次迁移目标不是把网络库搬进插件，而是把“协议层”搬进插件：

- 宿主保留 transport 能力
- 插件接管 protocol 能力

## 核心结论

建议采用以下边界：

- 宿主保留：
  - WebSocket / HTTP 请求库
  - 建连、断连、重连
  - 定时器调度
  - 文本 / 二进制帧收发
  - UI 消息分发与错误上报
- 插件负责：
  - 握手包生成
  - 心跳包生成
  - frame 解码
  - ack 包生成
  - 轮询游标推进
  - 去重与增量状态管理
  - 协议特有状态机

换句话说：

- transport 留在宿主
- protocol 下沉到插件

这是风险最低、最符合现有代码演进方向的方案。

## 目标与非目标

### 目标

- 统一弹幕能力边界：宿主做连接，插件做协议
- 让弹幕协议可以随插件一起演进、打包、热更新
- 保持旧插件兼容，迁移期间不影响现有平台可用性
- 为 WebSocket 和 HTTP 轮询两类弹幕平台都提供统一迁移框架

### 非目标（本轮）

- 不把 WebSocket / HTTP 网络库迁移到 JS 运行时
- 不在第一阶段删除全部旧 Swift parser
- 不在第一阶段追求所有平台同时完成迁移
- 不在第一阶段调整 UI 层弹幕展示模型

## 当前架构问题拆解

### 1. 插件 `getDanmaku` 能力过窄

当前插件返回结构仅包含：

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

这个结构只能描述“如何连接”，不能描述：

- 连接建立后先发什么握手包
- 心跳周期是多少
- 收到 frame 如何解包
- 是否需要 ack
- HTTP 轮询时下一次请求要带什么 cursor

### 2. 宿主平台特判过多

当前 AngelLive 宿主中存在大量按 `liveType` 分支的行为：

- WebSocket URL 特判
- parser 选择特判
- SockJS 特判
- YY URL 特判
- HTTP 轮询平台分支
- 各平台 parser 内部状态机逻辑

这会导致宿主长期背负平台协议细节。

### 3. 迁移基础其实已经存在

虽然现在完整的插件化弹幕协议还没形成，但以下能力已经具备：

- 插件支持 `preloadScripts`
- 插件运行时支持 `Host.runtime.loadBuiltinScript(...)`
- 多个平台 parser 已经是“Swift 外壳 + JavaScriptCore 内嵌 JS codec”模式

这说明迁移方向是成立的，缺的是统一协议桥接，而不是从零开始。

## 目标架构

## 设计原则

- 插件返回“连接计划 + 协议驱动信息”，而不是只返回裸参数
- 宿主只负责 transport，不再直接理解平台弹幕协议
- 插件内部允许按 `connectionId` 维护独立 session 状态
- 宿主必须兼容旧插件，支持新旧双栈并存
- 优先迁移已有 JS codec 成熟的平台，避免第一波啃最复杂协议

## 宿主职责

宿主负责以下内容：

- 打开 WebSocket 连接
- 发起 HTTP 轮询请求
- 维护连接生命周期（connect / disconnect / reconnect）
- 调度定时器（heartbeat / poll interval）
- 在收到网络 frame 后回调插件协议驱动
- 将插件解码后的消息发给现有 UI / ViewModel
- 记录日志、错误、重试信息

## 插件职责

插件负责以下内容：

- 根据房间上下文创建弹幕 session
- 在连接打开时返回首批写包（握手 / 登录 / 入组）
- 在定时器触发时返回心跳包或下一次轮询请求信息
- 在收到 frame 时完成解码、ack 计算、游标推进、消息提取
- 输出标准化消息数组：`text / nickname / color`
- 管理协议状态（cursor、sessionKey、去重集合、订阅组等）

## 建议的新协议形态

### 第一层：保留现有 `getDanmaku`

保留当前方法名，扩展返回结构，而不是直接 breaking change。

建议结构：

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

兼容策略：

- 若插件只返回 `args + headers`，宿主按旧逻辑处理
- 若插件返回 `transport + runtime`，宿主优先走新协议驱动

### 第二层：新增可选 danmaku runtime 方法

建议新增以下插件方法：

```js
async function createDanmakuSession(payload) {}
async function onDanmakuOpen(payload) {}
async function onDanmakuFrame(payload) {}
async function onDanmakuTick(payload) {}
async function destroyDanmakuSession(payload) {}
```

### 方法职责建议

#### `createDanmakuSession(payload)`

输入：

- `connectionId`
- `roomId`
- `userId`
- `args`
- `transport`

输出：

- 是否创建成功
- 初始心跳配置
- 初始轮询配置
- 可选首批协议状态

#### `onDanmakuOpen(payload)`

在 WebSocket 连接成功后调用。

输出：

- `writes`: 需要立即发送的包列表
- `timer`: 心跳周期更新

#### `onDanmakuFrame(payload)`

输入：

- `connectionId`
- `frameType`: `text | binary | http_response`
- `text` 或 `bytesBase64`

输出：

- `messages`: 标准消息数组
- `writes`: ack / follow-up 包
- `timer`: 心跳或轮询间隔调整
- `poll`: 下一次 HTTP 轮询信息（如有）

#### `onDanmakuTick(payload)`

用于：

- 心跳包生成
- 下一次轮询 body / query / headers 生成

#### `destroyDanmakuSession(payload)`

用于：

- 清理插件内部 session 状态
- 释放去重缓存 / 游标 / token 等运行时数据

## 宿主接口级设计建议

为避免第一阶段只停留在概念层，建议 AngelLive 宿主先落四个最小抽象：

- `DanmakuSessionPlan`
  - 由 `getDanmaku` 解码得到
  - 包含：`args`、`headers`、`transport`、`runtime`
- `DanmakuSessionDriver`
  - 统一协议层接口
  - 对宿主暴露：`start()`、`handleOpen()`、`handleFrame(...)`、`handleTick()`、`stop()`
- `PluginJSDanmakuDriver`
  - 调用插件的 `createDanmakuSession / onDanmakuOpen / onDanmakuFrame / onDanmakuTick / destroyDanmakuSession`
- `LegacySwiftDanmakuDriver`
  - 包装当前宿主里的 `BilibiliSocketDataParser / DouyuSocketDataParser / ...`

建议宿主内部数据流如下：

1. `RoomInfoViewModel` 获取 `DanmakuSessionPlan`
2. 由 `DanmakuSessionPlan` 决定使用 `PluginJSDanmakuDriver` 还是 `LegacySwiftDanmakuDriver`
3. transport 层只负责：
   - connect
   - send text/binary
   - receive text/binary/http response
   - timer tick
4. driver 返回统一动作：
   - `writes`
   - `messages`
   - `timerUpdate`
   - `pollUpdate`
5. ViewModel 继续复用现有 UI 展示逻辑

建议第一阶段先不要把 `WebSocketConnection` 一次性改成完全无平台信息，
而是先让它从“自己决定 parser”改成“接受外部 driver 回调”，逐步削减平台分支。

## Session 状态管理建议

由于插件 runtime 不是“每条连接一个 JSContext”，而是“每个插件一个缓存 runtime”，
因此插件内部的弹幕协议状态不能直接放到全局单例变量里裸跑。

建议统一采用：

- `connectionId -> sessionState` 映射

例如：

```js
const danmakuSessions = new Map();
```

每次调用：

- `createDanmakuSession` 创建 session
- `onDanmakuFrame` 读取并更新 session
- `destroyDanmakuSession` 删除 session

这样可以保证：

- 同平台多个房间同时打开时互不干扰
- 重连时状态更清晰
- 后续调试日志更容易定位

## 二进制桥接与依赖方案

这是方案里最需要先验证的部分，不能只靠设计推断。

### 二进制桥接首版建议

第一版建议采用“可靠优先”的桥接格式：

- 文本 frame：直接传字符串
- 二进制 frame：先传 `base64`
- 插件返回写包时：
  - 文本包：`text`
  - 二进制包：`bytesBase64`

原因：

- JavaScriptCore 的 JSON 边界最稳
- 容易调试和记录日志
- 可以先快速验证架构，不必第一阶段就引入复杂 native buffer bridge

### 性能基准必须前置

第一阶段必须增加一个 `bilibili` benchmark，至少测这三项：

- 单帧从 Swift 收到 binary frame 到 JS 解码出 message 的耗时
- 高频弹幕下的 CPU 占用
- 单位时间消息吞吐（例如 100 / 500 / 1000 条消息样本）

建议至少比较两组实现：

1. 现有宿主 parser 路径
2. `base64 -> JS codec -> JSON result` 新路径

若结果表明：

- 延迟可接受
- CPU 无明显恶化

则第二阶段继续按该方案推进。

若结果不理想，再考虑第二版桥接：

- `[UInt8]`
- `ArrayBuffer` 风格桥接 helper
- Host.native binary helper

### protobuf / zlib 依赖建议

不同平台的协议复杂度不同，建议分层处理：

- `bilibili`
  - 可继续沿用当前“JS codec + 宿主提供 zlib inflate helper”的思路
- `douyin`
  - 若现有 JS codec 已足够，则优先迁现有逻辑
  - 若需要完整 protobuf 能力，再评估引入精简版 protobuf 解析脚本
- `douyu` / `huya` / `twitch`
  - 优先沿用已有轻量自定义解析逻辑，不要第一阶段引入大体积通用库

结论是：

- 第一阶段不建议直接把完整 `protobuf.js` 作为所有平台通用依赖一起引入
- 更合理的是“按平台最小依赖”迁移
- 对确实需要宿主辅助的能力，优先补充 Host helper，而不是把所有事情都塞进第三方 JS 大库

## 三次迁移计划

## 第一次迁移：先搭宿主骨架，保留旧 Swift parser fallback

### 目标

建立新的弹幕驱动框架，但不强制任何平台立即切换。

### 本阶段任务

- 在 AngelLive 新增统一 danmaku driver 抽象
- 新增 `PluginJSDanmakuDriver`
- 新增 `LegacySwiftDanmakuDriver`
- `WebSocketConnection` / `HTTPPollingDanmakuConnection` 改造成 transport-only
- `LiveParseJSPlatformManager.getDanmukuArgs(...)` 扩展返回模型
- 宿主支持：
  - 新协议插件走 plugin JS danmaku driver
  - 旧插件继续走现有 Swift parser
- 更新 LiveParse 文档，明确新的 danmaku 插件协议
- 增加 `bilibili` 性能 benchmark（bridge 延迟 / CPU / 吞吐）
- 明确宿主需要补的 helper（例如 zlib / binary decode bridge）

### 本阶段不做

- 不删除现有 Swift parser 文件
- 不一次性迁所有平台
- 不调整弹幕 UI 展示逻辑

### 预期产物

- AngelLive：danmaku runtime driver 基础设施
- LiveParse：弹幕插件协议文档
- 至少一个样板插件可跑通 lifecycle（可先用 mock）

### 验收标准

- 旧插件行为不变
- 新协议驱动能跑通完整生命周期
- 宿主在 transport 层不再新增平台特判

## 第二次迁移：迁 WebSocket 类平台

### 目标

优先迁移已有 JS codec 或协议逻辑容易 JS 化的平台。

### 建议平台顺序

- `bilibili`
- `douyu`
- `huya`
- `douyin`
- `soop`
- `twitch`

### 原因

- 这些平台当前已经存在较成熟的 JS codec 或 JS 友好的协议逻辑
- 迁入插件后收益高、风险相对可控
- 可快速验证通用 driver 设计是否合理
- `soop` 协议较轻，适合作为第二批补位平台
- `twitch` 当前走 IRC WebSocket，协议边界清晰，也适合纳入 WebSocket 批次

### 本阶段任务

- 将平台 parser 逻辑搬入各自插件
- 能拆成独立脚本的部分放入 `preloadScripts`
- 宿主在连接建立后调用插件生成握手包
- 宿主收到 frame 后调用插件进行解码与 ack 计算
- 验证断线重连后 session 是否仍正确恢复

### 预期产物

- 4 个 WebSocket 平台的插件化协议驱动
- `soop` / `twitch` 一并迁入后，该阶段可覆盖主要 WebSocket 平台
- 宿主侧不再直接走这 4 个平台的主 parser 路径
- 对应平台的旧 Swift parser 进入观察期，暂不立刻删除

### 验收标准

- 握手正常
- 心跳正常
- 消息解码正常
- ack 正常
- 重连后消息恢复正常
- UI 展示与迁移前保持一致

## 第三次迁移：迁轮询 / 特殊协议 / 重状态机平台

### 目标

完成剩余复杂平台迁移，并收尾旧宿主特化实现。

### 建议平台顺序

- `ks`
- `youtube`
- `cc`
- `yy`
- `kick`

### 原因

- `ks` / `youtube` 重点在 HTTP 轮询状态管理，而不是单纯 frame 解码
- `cc` 涉及 SockJS 特化，需进一步抽象 transport 和 protocol 边界
- `yy` 是最重的状态机，适合作为最后一波处理
- `kick` 当前为 `http_polling` 占位实现，是否继续支持弹幕需在本阶段明确结论

### 本阶段任务

- 将 KS / YouTube 当前宿主里的 cursor、去重、轮询节奏迁入插件 session
- 将 CC SockJS 协议处理迁入插件驱动
- 将 YY 登录 / 路由 / 入组 / 消息状态机逐步迁入插件
- 完成旧宿主 parser 的缩减与清理评估

### 预期产物

- 所有主力平台弹幕协议下沉到插件
- 宿主只保留统一 transport 与 UI 分发
- 旧宿主 parser 可以进入删除或只保留少量 fallback 的阶段

### 验收标准

- HTTP polling 平台完全由插件控制协议层
- CC / YY 协议链路稳定
- 宿主侧平台特判显著减少

## 平台难度评估

### 低风险 / 适合先迁

- `bilibili`
- `douyu`

### 中风险 / 第二批

- `huya`
- `douyin`
- `soop`
- `twitch`

### 中高风险

- `ks`
- `youtube`
- `cc`
- `kick`

### 高风险 / 最后处理

- `yy`

## 建议目录与组织方式

## LiveParse 插件侧

建议每个平台插件按以下方式组织：

- `lp_plugin_<id>_<version>_index.js`
- `lp_plugin_<id>_<version>_manifest.json`
- 若协议较复杂，可拆：
  - `danmaku_codec.js`
  - `danmaku_state.js`
  - `proto_helper.js`

并通过 `preloadScripts` 声明。

### 示例

```json
{
  "pluginId": "huya",
  "version": "1.0.2",
  "apiVersion": 1,
  "entry": "lp_plugin_huya_1.0.2_index.js",
  "preloadScripts": [
    "huya.js",
    "danmaku_codec.js"
  ]
}
```

## AngelLive 宿主侧

建议新增统一抽象，例如：

- `DanmakuSessionPlan`
- `DanmakuSessionDriver`
- `PluginJSDanmakuDriver`
- `LegacySwiftDanmakuDriver`

由宿主在 RoomInfoViewModel 层统一发起，不再直接感知平台 parser 类型。

## 兼容策略

迁移过程中必须保证：

- 旧插件仍可用
- 新插件逐平台切换
- 运行时按能力判断，而不是按平台硬切换

建议判断顺序：

1. 插件是否声明新 danmaku runtime 能力
2. 若支持，走 `PluginJSDanmakuDriver`
3. 若不支持，走旧 `LegacySwiftDanmakuDriver`

这样可以做到：

- 单平台灰度迁移
- 单版本回滚
- 降低一次性大改风险

## 运行时 fallback 机制

除了插件版本回滚外，宿主还应提供运行时 fallback 开关，避免某个平台 danmaku 新驱动出问题时必须等发版。

建议至少支持两层回退：

- 全局开关
  - 例如：`preferLegacyDanmakuDriver = true`
- 平台级开关
  - 例如：`legacyDanmakuDriverPlatforms = ["bilibili", "yy"]`

触发时机建议如下：

- 插件未声明新 runtime 能力：直接 fallback
- 插件 runtime 初始化失败：自动 fallback
- 插件连续 N 次连接失败或 frame 解析失败：本次会话自动 fallback
- 开发/灰度期间可通过调试设置强制切换 driver

这样可以做到：

- 不依赖紧急更新插件才可回退
- 宿主能在运行时快速止损
- 单平台可灰度验证，不影响全局

## 主要风险与对策

### 风险 1：运行时状态串房间

原因：同一个插件 runtime 可能复用。

对策：

- 强制使用 `connectionId` 维持 session map
- 所有状态操作都带 `connectionId`

### 风险 2：桥接开销过大

原因：高频 frame 在 Swift / JS 间来回传输。

对策：

- 第一版先采用简单可靠的桥接格式（文本 / base64 / `[UInt8]`）
- 对高频平台做观察，必要时再引入更高效的二进制桥接 helper
- 第一阶段必须以 `bilibili` 做 benchmark，不能只靠体感判断

### 风险 3：轮询平台迁移不完整

原因：只迁了解码，没迁 cursor / dedupe / interval。

对策：

- 把轮询平台作为独立阶段处理
- 把“状态推进”纳入插件 session 能力，而不是继续留在宿主

### 风险 4：协议切换导致旧插件失效

原因：直接修改 `getDanmaku` 返回模型或强推新方法。

对策：

- 保持 `apiVersion = 1`
- 先做可选扩展，不做第一阶段 breaking change
- 宿主保留 fallback

### 风险 5：YY 这类复杂状态机首波迁移失败

对策：

- 不把 YY 作为第一批样板
- 前两波先验证架构，再迁 YY

## 建议验证清单

### 第一阶段最小验证

- 旧插件链路不回归
- 新插件 runtime 能收到 `onDanmakuOpen / onDanmakuFrame / onDanmakuTick`
- 宿主能正确发送插件返回的 `writes`
- 宿主能展示插件返回的标准消息数组

### 第二阶段平台验证

- 进入房间后能成功连上弹幕
- 首包握手成功
- 心跳正常
- 收到实时弹幕
- 断线后可恢复
- 用户看不到明显行为倒退

### 第三阶段复杂平台验证

- KS / YouTube 轮询能稳定推进 cursor
- 去重逻辑正常
- 轮询频率可动态调整
- CC SockJS 行为正常
- YY 登录、路由、入组、消息链路全部可用

## 推荐执行顺序

1. 先完成宿主 driver 骨架与文档
2. 用 `bilibili` 做第一个样板
3. 再迁 `douyu` / `huya` / `douyin`
4. 稳定后再迁 `ks` / `youtube` / `cc`
5. 最后处理 `yy`

## 最终目标

迁移完成后，目标状态应为：

- AngelLive 宿主只关心“怎么连、怎么发、怎么收、怎么重连”
- LiveParse 插件关心“怎么握手、怎么心跳、怎么解码、怎么推进状态”
- 弹幕协议修复和演进尽量通过插件完成，而不是每次都改主工程发版

这将使弹幕链路与当前播放解析链路的插件化方向保持一致，也能显著降低后续多平台协议维护成本。
