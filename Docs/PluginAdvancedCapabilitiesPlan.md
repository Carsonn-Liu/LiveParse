# 插件高级能力规划：登录凭证、签名、通用工具

更新时间：2026-04-18

本文不是“已经全部落地的能力说明”，而是 LiveParse 插件体系接下来要补齐的 3 类高级能力规划文档。

目标是提前统一边界，避免后续每个平台各写一套：

1. 登录凭证管理
2. 加密/签名参数生成
3. 通用工具能力沉淀

相关现状文档：

- 通用插件规范：`Docs/PluginAuthoringGuide.md`
- 弹幕插件制作：`Docs/DanmakuPluginAuthoringGuide.md`
- 现有 Cookie/Session 改造方向：`Docs/CookieSessionMigrationPlan.md`

---

## 0. 当前现状摘要

### 已部分存在的能力

- 插件可通过 `authMode: "platform_cookie"` 使用宿主注入的登录态 Cookie
- 插件可通过 `cookieInject` 把 Cookie 中某个字段注入到 header/query/body
- 小红书已存在宿主签名能力样例：`Host.http.request({ signing: { profile: "xhs_live_web" } })`
- 个别插件已有 `setCookie` / `clearCookie` 入口，在运行时维护自己的 cookie 副本
- 各插件里已经散落着 base64、gzip、utf8、md5、query 拼装等 helper

### 当前缺口

- 没有统一的“插件登录管理”模型
- 没有标准化的“凭证是否过期/失效”检查接口
- 签名能力还停留在平台特例，没有形成可扩展文档
- 通用工具没有沉淀到插件总仓库的共享层，重复代码较多

---

## 1. 能力一：插件登录凭证管理

## 1.1 目标

当某个平台必须依赖 token / cookie / session 才能拿到数据时，需要统一支持：

- 客户端按 `liveType` / `pluginId` 保存该平台凭证
- 插件能够接收、清理、消费凭证
- 插件能够主动判断凭证是否过期
- 上层能统一识别“未登录 / 已过期 / 需要重新登录 / 风控拦截”

## 1.2 边界原则

### 宿主负责

- 登录 UI / WebView / OAuth / 扫码等交互
- 安全存储（Keychain / 安全沙盒）
- 按 `liveType` / `pluginId` 管理凭证
- 在请求阶段注入受保护的 cookie / token
- 根据插件返回的错误态触发统一登录引导

### 插件负责

- 描述自己需要什么凭证
- 在业务请求中正确消费这些凭证
- 提供轻量的凭证校验能力
- 将过期、失效、权限不足转换成统一错误码

结论：

- 插件不负责“获取登录态”
- 插件负责“理解该登录态是否还能继续用”

## 1.3 推荐能力模型

建议后续统一为 4 个插件入口：

```js
async setCredential(payload) {}
async clearCredential() {}
async getCredentialStatus(payload) {}
async validateCredential(payload) {}
```

建议语义：

- `setCredential(payload)`
  - 宿主写入或同步凭证后调用
  - 插件只做归一化、缓存必要字段、准备运行时状态
- `clearCredential()`
  - 登出或凭证失效时调用
- `getCredentialStatus(payload)`
  - 返回插件当前理解的凭证状态，适合管理页展示
- `validateCredential(payload)`
  - 主动发起轻量校验请求，确认凭证是否还可用

### 推荐返回结构

```json
{
  "state": "valid",
  "expireAt": 0,
  "userId": "12345",
  "userName": "示例用户",
  "message": ""
}
```

其中 `state` 建议统一为：

- `missing`
- `valid`
- `expired`
- `invalid`
- `risk_control`
- `unknown`

## 1.4 推荐错误码

业务接口里如果发现登录态异常，推荐统一抛这些错误：

- `AUTH_REQUIRED`
- `CREDENTIAL_EXPIRED`
- `CREDENTIAL_INVALID`
- `RISK_CONTROL_BLOCKED`

不要让每个平台自己抛一套含义接近但名字不同的错误。

## 1.5 推荐 manifest 补充字段

后续建议允许 manifest 描述登录态需求，例如：

```json
{
  "auth": {
    "required": true,
    "credentialKinds": ["cookie", "token"],
    "requiredFor": ["getRooms", "getPlayback", "getDanmaku"],
    "supportsStatusCheck": true,
    "supportsValidation": true
  }
}
```

作用：

- 管理页能静态显示“此平台需要登录”
- 宿主知道哪些能力在未登录时应该禁止或先引导登录
- 后续做自动巡检时，能批量判断哪些插件缺少凭证状态接口

## 1.6 推荐实现方式

### 第一阶段：兼容当前模式

先兼容现有 `setCookie` / `clearCookie`：

- 已落地平台先不强制重写
- 宿主可同时支持：
  - 老接口：`setCookie` / `clearCookie`
  - 新接口：`setCredential` / `clearCredential`

### 第二阶段：统一为 credential

把原来零散的 cookie/token 参数统一收敛到：

```json
{
  "pluginId": "xiaohongshu",
  "liveType": "11",
  "credential": {
    "cookie": "...",
    "token": "...",
    "extra": {
      "deviceId": "...",
      "csrf": "..."
    }
  },
  "source": "host_login"
}
```

## 1.7 推荐校验策略

插件必须具备“低成本校验凭证”的能力，至少满足以下之一：

- 调一个轻量 `/me` / `/profile` / `/session` 接口
- 检查 token 自身过期时间
- 对 cookie 中的关键字段做本地规则判断
- 收到明确 401/403/业务 code 后立刻转换成统一状态

不建议：

- 每次校验都调用高成本业务接口
- 只在主流程失败后才被动发现凭证已过期

## 1.8 当前仓库里的参考基线

- `Docs/CookieSessionMigrationPlan.md`
- `Resources/lp_plugin_xiaohongshu_1.0.20_index.js`
  - 已有 `setCookie` / `clearCookie`
  - 已通过 `/user/me` 判断登录态是否有效
- `Resources/lp_plugin_twitch_1.0.33_index.js`
  - 已有 cookie + token 混合消费模型
  - 适合做 `credentialKinds = ["cookie", "token"]` 的样板

---

## 2. 能力二：加密/签名参数生成

## 2.1 目标

某些平台在请求前必须生成签名、a_bogus、wbi、sid、trace id 等参数。  
这类能力要有统一边界，不能每个平台都把“敏感算法实现放宿主 / 放插件 / 放脚本”混着写。

## 2.2 设计原则

### 优先放宿主的场景

- 算法依赖宿主私有环境
- 需要稳定复用的官方实现
- 纯 JS 在性能、兼容性或安全上明显不稳
- 需要和请求注入流程强绑定

### 可以放插件的场景

- 算法完全公开
- 只是普通参数拼接、md5、base64、gzip、protobuf 处理
- 不依赖宿主私有状态
- 纯 JS 已足够稳定

一句话：

- 敏感/平台专有/需要统一升级的签名能力放宿主 profile
- 通用/可公开实现的参数生成能力放插件仓库

## 2.3 推荐宿主接口

当前小红书已经是一个基线：

```js
await Host.http.request({
  platformId: "xiaohongshu",
  authMode: "platform_cookie",
  signing: {
    profile: "xhs_live_web",
    injectRequestUserId: false
  },
  request: {
    url: "...",
    method: "GET"
  }
});
```

后续建议把 `signing` 文档化成统一模型：

```json
{
  "profile": "xhs_live_web",
  "mode": "request",
  "options": {
    "injectRequestUserId": false
  }
}
```

### 字段建议

- `profile`
  - 签名模板名，宿主内部注册
- `mode`
  - 可选，默认 `request`
  - 预留给 query/body/header 不同签名场景
- `options`
  - profile 专属参数

## 2.4 推荐 manifest 补充字段

如果插件强依赖签名 profile，建议显式声明：

```json
{
  "requires": {
    "signingProfiles": ["xhs_live_web"]
  }
}
```

这样：

- 宿主可在加载阶段就知道缺不缺依赖
- 文档和实现不会脱节
- 后续做回归检查时可静态发现问题

## 2.5 错误码建议

当签名能力缺失或失败时，建议统一抛：

- `SIGNING_PROFILE_MISSING`
- `SIGNING_FAILED`
- `SIGNING_UNSUPPORTED`

不要把签名失败混进普通网络错误里。

## 2.6 当前仓库里的参考基线

- `Resources/lp_plugin_xiaohongshu_1.0.20_index.js`
  - `signing.profile = "xhs_live_web"`
  - `/user/me`、`/celestial/lt`、`/join_comment_info` 都依赖签名
- `Resources/lp_plugin_bilibili_1.0.10_index.js`
  - 适合继续保留“公开算法在插件里算”的路线
- `Resources/lp_plugin_douyin_1.0.12_index.js`
  - 说明部分平台会同时出现“匿名 cookie + 平台参数签名”的组合场景

---

## 3. 能力三：通用工具能力沉淀

## 3.1 目标

以后通用工具不应该继续散落在每个平台插件里重复拷贝。  
插件总仓库需要提供一层共享工具，供各平台复用。

典型能力包括：

- base64 encode / decode
- md5
- gzip / zlib inflate
- utf8 encode / decode
- query 拼接
- 安全 JSON parse
- 二进制包读写
- 时间、随机串、uuid

## 3.2 原则：哪些必须留在插件仓库，哪些继续放宿主

### 应优先沉淀到插件仓库的

- 与平台无关的纯 JS helper
- 各平台重复实现超过 2 次的工具
- 不涉及敏感状态的算法工具
- 可以通过 preloadScripts 直接复用的运行时脚本

### 仍应留在宿主的

- 安全存储
- 会话注入
- 受保护签名 profile
- 原生网络栈适配
- 明显需要原生性能的能力

## 3.3 推荐目录

建议后续新增一层共享脚本目录，例如：

```text
Resources/plugin_runtime/base64.js
Resources/plugin_runtime/utf8.js
Resources/plugin_runtime/hash.js
Resources/plugin_runtime/compression.js
Resources/plugin_runtime/net.js
Resources/plugin_runtime/json.js
Resources/plugin_runtime/random.js
```

平台插件通过 `preloadScripts` 引入：

```json
{
  "preloadScripts": [
    "plugin_runtime/base64.js",
    "plugin_runtime/compression.js",
    "lp_plugin_example_1.0.0_danmaku.js"
  ]
}
```

## 3.4 推荐第一批共享工具

### A. 文本与编码

- `base64EncodeUTF8(text)`
- `base64DecodeToUTF8(base64)`
- `utf8Encode(text)`
- `utf8Decode(bytes)`

### B. 压缩与解压

- `inflateZlib(bytes)`
- `gunzip(bytes)`
- `tryHostInflate(...) + fflate fallback`

### C. 哈希与签名基础

- `md5(text)`
- `hex(bytes)`
- `query(params)`
- `appendQuery(url, params)`

### D. 运行时辅助

- `safeJsonParse(text, fallback)`
- `uuidv4()`
- `nowMillis()`
- `assertField(value, fieldName)`

## 3.5 推荐落地规则

- 平台专属 helper 仍放自己的 `index.js` / `*_danmaku.js`
- 共享 helper 只放通用逻辑，不放平台业务语义
- 一旦某段 helper 被第 3 个平台复制，就应该考虑上收共享层

## 3.6 当前仓库里的重复热点

当前已经明显重复的能力包括：

- `_base64ToBytes`
  - `bilibili` / `douyu` / `huya` / `soop`
- gzip / zlib inflate fallback
  - `douyin` / `bilibili`
- UTF-8 与 base64 双向转换
  - `xiaohongshu` / 多个弹幕插件
- cookie/query/header 拼装
  - `twitch` / `douyin` / `xiaohongshu`

这些都适合进入共享层。

---

## 4. 推荐推进顺序

## P1 登录凭证管理

优先级最高，因为它决定平台登录管理能不能稳定扩展。

建议先做：

1. `setCredential / clearCredential`
2. `getCredentialStatus / validateCredential`
3. 统一错误码
4. manifest 的 `auth` 描述

## P2 通用工具共享层

因为这一步成本低、收益立刻可见，且能减少后续协议插件重复代码。

建议先抽：

1. base64 / utf8
2. gzip / zlib
3. safeJsonParse / query
4. uuid / random / time

## P3 签名能力文档化

签名能力已经有小红书样例，但要补成正式规范：

1. `signing` 结构说明
2. `profile` 注册与命名规则
3. 错误码
4. manifest 依赖声明

---

## 5. 最终希望达到的状态

当后续有人新增一个“需要登录 + 需要签名 + 有复杂弹幕”的平台时，应该只需要回答这几个问题：

1. 这个平台需要什么 credential？
2. credential 由宿主怎么保存、插件怎么校验？
3. 是否依赖宿主 signing profile？
4. 能否直接复用共享 base64/gzip/utf8/helper？
5. 平台专属逻辑只剩哪些？

如果这 5 个问题都能由仓库文档直接回答，插件体系才算真正进入可维护状态。
