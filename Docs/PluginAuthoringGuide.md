# LiveParse 平台插件封装指南

本文面向贡献者：当你要为 LiveParse 新增一个平台插件时，按这里的规范落地即可。

> 当前仓库为纯 JS 插件模式：平台解析逻辑在 JS。若接入新弹幕驱动，宿主只保留 transport，协议解析也放在插件里。
>
> 如果你现在要写“弹幕获取 + 协议解析”这条链路，优先继续看：`Docs/DanmakuPluginAuthoringGuide.md`
>
> 如果你在做“登录凭证 / signing / 通用工具沉淀”这类高级能力规划，继续看：`Docs/PluginAdvancedCapabilitiesPlan.md`

## 1. 先确定插件标识与版本

- `pluginId`：全局唯一，建议小写英文（如 `twitch`）。
- `version`：语义化版本，格式 `MAJOR.MINOR.PATCH`（如 `1.0.0`）。
- `liveTypes`：字符串数组，建议使用未占用的数字字符串（如 `["9"]`）。

文件命名必须和版本一致：

- `lp_plugin_<pluginId>_<version>_manifest.json`
- `lp_plugin_<pluginId>_<version>_index.js`

例如：

- `lp_plugin_twitch_1.0.0_manifest.json`
- `lp_plugin_twitch_1.0.0_index.js`

## 2. 创建 manifest.json（必须）

放在 `Resources/`，示例：

```json
{
  "pluginId": "twitch",
  "version": "1.0.0",
  "apiVersion": 1,
  "displayName": "Twitch",
  "platformDescription": "全球游戏直播平台",
  "liveTypes": ["9"],
  "entry": "lp_plugin_twitch_1.0.0_index.js",
  "preloadScripts": [],
  "capabilities": {},
  "changelog": [
    "初始版本"
  ]
}
```

字段说明：

- `apiVersion` 当前固定为 `1`（宿主要求）。
- `displayName` 必须写最终用户可见名称，不要再附带 `JS PoC` 等开发态后缀。
- `platformDescription` 用于客户端平台页 / 平台列表静态描述，发布脚本会原样写入远端 `plugins.json`。
- `entry` 必须指向同版本入口 JS 文件名。
- `preloadScripts` 可选；如果依赖签名库/加密库，在这里声明。
- `capabilities` 可选；建议显式声明 8 大能力的可用性，便于宿主 UI 做静态提示。
- 如弹幕走插件驱动，可在 `capabilities.danmaku` 里补充 `driver`、`transport`、`protocolId`、`protocolVersion`，发布脚本会原样写入远端索引。
- `changelog` 可选；用于远端插件索引展示更新日志。

## 3. JS 插件必须实现的 8 个核心方法

入口脚本需定义 `globalThis.LiveParsePlugin`，并实现以下方法：

- `getCategories(payload)`
- `getRooms(payload)`
- `getPlayback(payload)`
- `search(payload)`
- `getRoomDetail(payload)`
- `getLiveState(payload)`
- `resolveShare(payload)`
- `getDanmaku(payload)`

推荐骨架：

```js
function lpThrow(code, message, context) {
  if (globalThis.Host && typeof Host.raise === "function") {
    Host.raise(code, message, context || {});
  }
  throw new Error(String(message || "unknown error"));
}

globalThis.LiveParsePlugin = {
  apiVersion: 1,

  async getCategories(payload) { return []; },
  async getRooms(payload) { return []; },
  async getPlayback(payload) { return []; },
  async search(payload) { return []; },
  async getRoomDetail(payload) { return {}; },
  async getLiveState(payload) { return { liveState: "3" }; },
  async resolveShare(payload) { return {}; },
  async getDanmaku(payload) { return { args: {}, headers: null }; }
};
```

如平台要把弹幕协议解析也做成插件能力，`getDanmaku` 之外还可实现以下可选方法：

- `createDanmakuSession(payload)`
- `onDanmakuOpen(payload)`
- `onDanmakuFrame(payload)`
- `onDanmakuTick(payload)`
- `destroyDanmakuSession(payload)`

只有当 `getDanmaku` 返回 `runtime.driver = "plugin_js_v1"` 时，宿主才会进入这套驱动生命周期。

## 4. 返回结构契约（重点）

### 4.1 getCategories

返回 `LiveMainListModel[]`：

```json
[
  {
    "id": "100",
    "title": "游戏",
    "icon": "",
    "biz": "",
    "subList": [
      {
        "id": "101",
        "parentId": "100",
        "title": "MOBA",
        "icon": "",
        "biz": ""
      }
    ]
  }
]
```

### 4.2 getRooms / search / getRoomDetail / resolveShare

返回 `LiveModel` 或 `LiveModel[]`，字段统一：

- `userName`
- `roomTitle`
- `roomCover`
- `userHeadImg`
- `liveState`（可选，推荐 `"0"|"1"|"2"|"3"`）
- `userId`
- `roomId`
- `liveWatchedCount`（可选）

### 4.3 getPlayback

返回 `LiveQualityModel[]`：

```json
[
  {
    "cdn": "default",
    "qualitys": [
      {
        "roomId": "12345",
        "title": "原画",
        "qn": 0,
        "url": "https://example.invalid/live.m3u8",
        "liveCodeType": "m3u8",
        "liveType": "9",
        "userAgent": "libmpv",
        "headers": {
          "Referer": "https://example.invalid/"
        }
      }
    ]
  }
]
```

约定：

- `qualitys` 里的清晰度项应按实际画质从高到低排序，默认首项即宿主默认选中的最高画质。
- 播放 `User-Agent` 优先放在 `userAgent` 字段；如上游 HLS 对嵌套 playlist/segment 的请求头极度敏感，也允许在 `headers` 中显式补一份 `User-Agent` 以保持整条播放链路一致。
- 对于会在 master manifest 中声明音轨分组的 HLS 平台，`qualitys[].url` 必须与已验证可播的研究/实测结果保持一致；不要把研究里解析出的真实清晰度 URL 再二次改写成自定义的 `master + fragment` 形式，除非该形式已经被实际播放链路验证通过。

### 4.4 getLiveState

宿主可接受以下几类返回：

- 字符串：`"0" | "1" | "2" | "3"`
- 数字：`0 | 1 | 2 | 3`
- 布尔：`true/false`
- 对象：`{ liveState }` / `{ state }` / `{ status }` / `{ isLive }`

推荐统一返回：

```json
{ "liveState": "1" }
```

### 4.5 getDanmaku

旧插件继续返回：

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

如平台暂无弹幕，可返回：

```json
{ "args": {}, "headers": null }
```

若要把弹幕协议解析也下沉到插件，则返回扩展结构：

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
    "url": "wss://example.invalid/socket",
    "frameType": "binary"
  },
  "runtime": {
    "driver": "plugin_js_v1",
    "protocolId": "example_ws",
    "protocolVersion": "1"
  }
}
```

约定：

- `transport` 只描述宿主如何建连，具体字段见 `Docs/DanmakuDriverAPI.md`
- `runtime.driver = "plugin_js_v1"` 表示协议层交给插件驱动
- 插件运行时会被复用，所有弹幕 session 状态必须按 `connectionId` 隔离
- 若新驱动方法未实现或运行失败，宿主会回退旧链路，因此迁移时不要删除旧平台可用的 transport 参数

### 4.6 可选弹幕驱动方法

当 `getDanmaku` 返回 `runtime.driver = "plugin_js_v1"` 时，建议实现：

```js
globalThis.LiveParsePlugin = {
  async createDanmakuSession(payload) {
    return { ok: true, timer: { mode: "off" } };
  },

  async onDanmakuOpen(payload) {
    return { writes: [], timer: { mode: "off" } };
  },

  async onDanmakuFrame(payload) {
    return { messages: [], writes: [], timer: { mode: "off" } };
  },

  async onDanmakuTick(payload) {
    return { writes: [], timer: { mode: "off" } };
  },

  async destroyDanmakuSession(payload) {
    return { ok: true };
  }
};
```

职责边界：

- `createDanmakuSession`：初始化 `connectionId` 对应的协议状态
- `onDanmakuOpen`：在 WebSocket 建连成功后返回首批握手 / 入组写包
- `onDanmakuFrame`：解码 frame、产出消息、ack 与后续写包
- `onDanmakuTick`：生成心跳或轮询请求
- `destroyDanmakuSession`：释放按 `connectionId` 保存的 session 状态

完整字段定义、轮询模型和 fallback 约束见 `Docs/DanmakuDriverAPI.md`。如果需要从零开始照着做一遍，继续看 `Docs/DanmakuPluginAuthoringGuide.md`。

## 5. Host 能力使用规范

### 5.1 HTTP 请求

插件使用 `Host.http.request`，推荐统一封装：

```js
async function request(request, authMode) {
  return await Host.http.request({
    platformId: "twitch",
    authMode: authMode || "none",
    request: request || {}
  });
}
```

`authMode: "platform_cookie"` 时，宿主会自动注入平台 Cookie（并屏蔽手动 `Cookie`/`Authorization` 头）。

返回结构：

- `status`
- `headers`
- `url`
- `bodyText`
- `bodyBase64`

### 5.1.1 cookieInject — 从 Cookie 提取值注入请求

当需要把 Cookie 中的某个值提取出来作为 header、query 参数或 JSON body 字段发送时，使用 `cookieInject`。**必须配合 `authMode: "platform_cookie"` 使用。**

```js
await Host.http.request({
  platformId: "twitch",
  authMode: "platform_cookie",
  cookieInject: [
    { cookieName: "auth-token", target: "header", headerName: "Authorization", prefix: "OAuth " },
    { cookieName: "unique_id",  target: "query",  queryName: "uid" },
    { cookieName: "sess-key",   target: "body",   bodyPath: "extensions.auth.token" }
  ],
  request: { url: "https://gql.twitch.tv/gql", method: "POST", ... }
});
```

每条规则的字段：

| 字段 | 必填 | 说明 |
|------|------|------|
| `cookieName` | 是 | 要从平台 Cookie 中提取的 cookie 名 |
| `target` | 否 | `"header"`（默认）、`"query"` 或 `"body"` |
| `headerName` | target=header 时必填 | 注入的 HTTP header 名 |
| `queryName` | target=query 时必填 | 注入的 URL query 参数名 |
| `bodyPath` | target=body 时必填 | 注入的 JSON body key path，支持嵌套（`.` 分隔），如 `"data.token"` → `{"data":{"token":"xxx"}}` |
| `prefix` | 否 | 值前缀，如 `"OAuth "`、`"Bearer "` |

规则说明：

- 若 Cookie 中找不到对应 `cookieName` 或值为空，该条规则静默跳过，不影响请求发出。
- `target: "body"` 会解析现有 `request.body` 为 JSON 对象后追加字段，若原 body 非 JSON 则创建新对象。
- 多条规则按数组顺序依次执行，可同时注入 header + query + body。
- `cookieInject` 是通用机制，不含签名逻辑。需要请求签名的平台（如小红书）应使用 `signing` 字段。

### 5.2 错误抛出

统一走 `Host.raise(code, message, context)`，便于 Swift 侧做增强错误映射。

### 5.3 常用工具

- `Host.crypto.md5(input)`
- `Host.crypto.base64Decode(input)`
- `Host.runtime.loadBuiltinScript(name)`（需要加载内置辅助脚本时使用）

## 6. Cookie 与鉴权建议

- 宿主已接管 `setCookie`/`clearCookie` 调用，插件侧不必重复实现存储逻辑。
- 需要平台 Cookie 的请求，使用 `authMode: "platform_cookie"`。
- 需要从 Cookie 中提取值作为 header/query/body 参数时，使用 `cookieInject`（见 5.1.1）。
- 需要请求签名的平台（如小红书），使用 `signing` 字段，与 `cookieInject` 互不干扰。
- 插件内部不要把敏感 token/cookie 写入仓库。

如需继续设计统一的登录凭证管理、凭证过期判断和 signing/profile 边界，参考：`Docs/PluginAdvancedCapabilitiesPlan.md`

## 7. 新增“官方平台”还需要做什么

如果你要把新平台作为官方内置平台，而非仅实验插件，还需要：

1. 在 `Resources/plugin_assets/<pluginId>/` 补齐 7 张图标资源。
2. 仅当该平台需要纳入“官方平台图标完整性校验”时，再把 `pluginId` 加入 `Scripts/build_plugin_release.py` 的 `OFFICIAL_PLUGIN_IDS`。
3. 不需要再修改平台名称映射表；平台展示名与描述统一以 manifest 中的 `displayName` / `platformDescription` 为准。
4. 补充平台测试（至少 `PluginSystemTests` + 该平台测试）。
5. 若支持实时弹幕协议，在插件内实现 `plugin_js_v1` driver（`getDanmaku` + 生命周期方法），不要再新增宿主侧平台解析逻辑；实战步骤见 `Docs/DanmakuPluginAuthoringGuide.md`。

## 8. 发布脚本默认行为

- `Scripts/build_plugin_release.py` 默认会扫描 `Resources/` 下当前仓库的全部插件 manifest。
- `--plugins` 只是可选过滤器；只有显式传入时才按 `pluginId` 子集打包。
- 新增实验平台时，只要 manifest 与入口文件就位，即可被默认打包进远端索引。

## 9. 提交前检查清单

- 文件命名、manifest `version`、`entry` 三者一致。
- 8 个核心方法都可调用，参数缺失时有清晰错误。
- `swift build` 通过。
- 至少执行：
  - `swift test --filter PluginSystemTests`
  - `swift test --filter <YourPlatform>Tests`（如已添加）
- 未提交 Cookie/Token/本地调试敏感信息。

---

如需发布远端可更新插件包，请继续参考：

- `Docs/PluginReleaseUsage.md`
- `Docs/PluginSystem.md`
- `Docs/DanmakuPluginAuthoringGuide.md`
- `Docs/PluginAdvancedCapabilitiesPlan.md`
