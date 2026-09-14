# 浅焦映像

> 面向普通人的专业影楼制作工作台 —— 上传一张照片，生成证件照、职业形象照与多主题 AI 写真。
>
> 🌐 **线上站点：[www.czpsm.art/PM](https://www.czpsm.art/PM/)**（小程序与网站同款功能、同一套后端）

浅焦映像把实体影楼的能力搬到线上：用户无需服装、道具、外景与天气配合，选主题、上传照片、扫码付款，由 **AI 生成 + 人工审核交付** 的混合流水线（human-in-the-loop）产出影楼级成片。

## 功能

- **证件照体验版（¥3.9 / 1 张）**：白底 / 蓝底 / 灰底等标准证件照
- **简历形象照（¥29.9 / 3 张）**：白衬衫职业形象照，适用于简历、职业平台、工牌
- **AI 写真套图（¥69.9 起 / 阶梯计价）**：**11 个主题**可多选（每加一主题 +¥39.9，最多 3 主题，后台可改价）
  - 主题库：古风 / 运动 / 休闲 / 旅拍 / 亲子 / 职业形象 / 港风复古 / 新中式 / 法式油画 / 胶片电影 / **地标旅拍**
  - **地标旅拍**是 AI 影楼的独有优势：海岛、雪山、沙漠、瀑布等实体影楼差旅成本上万的场景，这里零差旅成本即可实现；客户还能在下单时用「场景描述」直接点名任意具体地标
  - 流程：看主题样张 → 上传照片 → **AI 视觉分析推荐主题** → 三阶段出图（参考图锚点 → 3×5 网格 → 分主题选片）→ 高清成片
- **动态影廊**：AI 图生视频样张（让照片动起来），默认静态海报 + hover/点按播放，见 `docs/compose/spec/motion-gallery-hover-lazy.md`
- **周边衍生品（实体影楼闭环）**：挂墙主视觉 / 水晶摆台 / 定制挂历 13 月 / 钱包照套装 / 亚克力挂件 / 精装相册，系统计价；**场景模拟页**纯 CSS 实景预览（六款场景）；确认后**一键导出 300DPI 印刷制作稿**（按品类毫米尺寸重采样 + 3mm 出血 + sRGB 制作单）；制作状态流转
- **收款码支付**：管理端上传微信收款码，用户端订单页扫码支付，管理员人工确认到账
- **订单全流程**：选套餐 → 上传照片（限 3 张、≤10MB）→ 授权确认 → 提交审核 → 管理员审核 / 要求重拍 / AI 出图 / 交付
- **免登录查询**：凭 订单号 + 手机号 + 查询密码（SHA-256 哈希存储）随时查询订单；写真选片支持免登录提交
- **政务级证件照引擎（可选自部署）**：接入 HivisionIDPhotos（Apache-2.0），2 核 CPU 约 0.2 秒/张，自动抠图→换底→按国标规格出照→六寸排版；内置一寸~六寸 300DPI 规格
- **管理后台**：订单筛选、照片缩略、审核、AI 一键出图、标记收款、完结交付、样张库维护、收款码配置

## 架构

**订单与数据全部由自有服务器承载（独立后端），不依赖云函数**——摆脱平台套餐限制（自定义安全域名、任务查询等），业务逻辑与存储完全可控。

```
小程序 ──┐
         ├── https://www.czpsm.art/PM/api/ ──► nginx ──► photomuse-server (127.0.0.1:8900, systemd)
网站/第三方 ┘                                          ├─ SQLite        订单 / 样张 / 周边 / 配置 / 审计
                                                       ├─ uploads/      照片与成片（nginx 直出，fileID 即 URL）
                                                       └─ AI 节点       OpenAI 兼容生图 / 视觉分析（带瞬态重试）
```

### 后端 `photomuse-server/`（Express + node:sqlite）

| 文件 | 职责 |
|---|---|
| `server.js` | 路由与业务：`/api/open`（action 分发器）、`/api/upload`、`/api/wx/*`（小程序兼容层）、`/api/admin/*`（管理端） |
| `lib/db.js` | SQLite 表结构与初始化（`PM_DATA_DIR` 可指定数据目录） |
| `lib/catalog.js` | 套餐 / 主题 / 风格 / 周边 目录定义（改主题改这里） |
| `lib/ai.js` | 三阶段影楼提示词 + 生图与视觉分析调用（密钥走环境变量） |

- 鉴权：客户订单用 `webToken`（网站）/ `openid`（小程序）；查询用三元组；管理端口令换 HMAC token
- 小程序兼容层响应形状与旧云函数版逐字段对齐，前端迁移零业务改动
- 加固：IP 滑动窗口限流（`PM_RATE_MAX`，默认 120/分钟）+ 安全响应头

### 前端 `photomuse-web/`（原生 HTML + CSS + JS，无构建）

| 页面 | 说明 |
|---|---|
| `index.html` | 下单：套餐 / 主题多选 / 样张 / AI 推荐 / 传图 / 授权提交 |
| `order.html` | 订单详情：扫码支付 / 网格选片 / 成片查看 / 周边选择 |
| `query.html` | 免登录查询（三元组） |
| `showcase.html` | 周边场景模拟（六款纯 CSS 实景） |
| `admin.html` | 管理后台 |

- 视觉：**暗房影楼**主题（暗场底 + 香槟金 + 相纸白卡 + 衬线大字），三端自适应（手机 / 平板 / 桌面）
- 动效层：`js/motion.js`（进场 / 视差 / Ken Burns）、`js/motion-gallery.js`（动态影廊）
- 设计要求见 `docs/前端设计要求-暗房影楼版.md`

### 小程序 `pages/aiStudio/`

`index`（下单）/ `detail`（订单详情）/ `admin` / `adminLogin` / `showcase`；接口封装在 `utils/photomuse-api.js`（与 `wx.cloud` 同签名，直连独立后端）；主题等配置在 `utils/ai-studio-config.js`。

### 云函数 `cloudfunctions/`（30 个，**历史保留，当前未使用**）

独立后端上线前的实现，保留用于回滚与参考；对应集合与数据仍在云环境中，但已不再被前端调用。

## 快速开始

### 1. 后端（服务器）

```bash
cd photomuse-server
npm install --omit=dev

# 环境变量（写入 systemd 或启动脚本）
export PM_ADMIN_PASSWORD='你的管理口令'
export PM_AI_KEY='生图节点 Key'
export PM_UPLOAD_ROOT='/var/www/pm/uploads'
export PM_DATA_DIR='./lib/data'          # SQLite 位置（可选）
export PM_PUBLIC_ORIGIN='https://www.czpsm.art'
export PM_RATE_MAX=120                   # 每分钟每 IP 限流（可选）

node server.js                            # 默认 127.0.0.1:8900
```

systemd 常驻（生产用法，**务必 enable 开机自启**）：

```ini
[Service]
WorkingDirectory=/home/ubuntu/photomuse-server
Environment=PM_ADMIN_PASSWORD=xxx
Environment=PM_AI_KEY=xxx
Environment=PM_UPLOAD_ROOT=/var/www/pm/uploads
Environment=PM_PUBLIC_ORIGIN=https://www.czpsm.art
ExecStart=/usr/local/bin/node server.js
Restart=always
User=ubuntu
```

nginx 反向代理（在站点配置内）：

```nginx
location /PM/api/  { proxy_pass http://127.0.0.1:8900/api/; proxy_http_version 1.1;
                     client_max_body_size 15M; proxy_read_timeout 180s; }
location /PM/uploads/ { alias /var/www/pm/uploads/; }
location /PM/      { alias /var/www/pm/; index index.html; }
```

### 2. 网站

`photomuse-web/` 直接 scp/rsync 到 nginx 站点目录即可（纯静态，无构建）。静态资源改动后**记得递增 HTML 里的 `?v=` 版本号**，否则浏览器缓存会出现新旧混用。

### 3. 小程序

微信开发者工具打开本目录，填入自己的 `appid`（`project.config.json`）。

## 测试

```bash
npm test              # 小程序与云函数侧四层（49 用例）
npm run test:server   # 独立后端（38 用例，node:test）
```

- `npm test`：断言校验 → 契约交叉核对 → 视觉完整性 → 集成用例（内存 mock 真实执行云函数逻辑）
- `npm run test:server`：spawn 隔离实例 + 临时数据目录，覆盖鉴权 / 计价 / 上传凭证 / 三元组 / 越权 / 管理流转 / 样张 / 收款码 / 审计
- 真实外部 API 端到端预演：`node tests/integration/real-api-e2e.js`（消耗真实生图配额）

> 注意：静态完整性检查会校验 HTML 用到的 class 必须在 CSS 中有定义，改页面结构时容易踩到。

## 环境变量

| 变量 | 用途 |
|---|---|
| `PM_ADMIN_PASSWORD` | 管理后台口令（必填，未配置则服务拒绝启动） |
| `PM_AI_KEY` / `PM_GEN_API` / `PM_CHAT_API` | 生图与视觉分析（OpenAI 兼容节点）；未配置时 AI 功能返回 `CONFIG_MISSING` |
| `PM_UPLOAD_ROOT` | 照片与成片落盘目录 |
| `PM_PUBLIC_ORIGIN` | 对外域名（用于拼 fileID） |
| `PM_DATA_DIR` | SQLite 数据目录（默认 `lib/data`） |
| `PM_RATE_MAX` | 每 IP 每分钟请求上限 |
| `WX_APPID` / `WX_APPSECRET` | 小程序登录升级为 code2session（未配置时使用设备 ID 匿名身份） |

密钥一律环境变量注入，**不入库、不进 git**；仓库内 `.deploy-secrets.example.json` 仅为格式示例。

## 安全设计

- 查询密码仅存 SHA-256 哈希，接口返回前统一剥离；手机号脱敏
- 订单所有权三通道：`webToken`（网站）/ `openid`（小程序）/ 三元组（免登录查询），越权访问拒绝
- 上传鉴权：订单凭证校验；无凭证上传仅允许 `analysis/` 前缀（AI 分析用图）
- 管理端口令换 HMAC token（8 小时有效），关键操作全部落审计日志
- AI 密钥只存服务器环境变量，前端与接口响应均不含密钥
- IP 限流 + 安全响应头（nosniff / 禁 iframe 嵌套）

## Roadmap

- [x] 收款码扫码支付（后台配置 + 人工确认到账）
- [x] AI 写真套图：多主题阶梯计价 + 样张库 + AI 视觉推荐 + 分主题网格选片
- [x] 周边衍生品闭环：品类计价 + 场景模拟 + 300DPI 印刷制作稿 + 制作状态流转
- [x] 网站独立版 + 暗房影楼视觉 + 三端自适应
- [x] 独立后端（脱离云函数）：订单 / 数据 / 文件 / AI 全自管
- [x] 主题库扩至 11 个（含地标旅拍）
- [x] 动态影廊：AI 图生视频样张
- [ ] 小程序接入 code2session（替换设备 ID 匿名身份）
- [ ] 真 CMYK 转换（需 ICC 引擎，当前 sRGB 全流程 + 打样流程）
- [ ] 微信支付接入
- [ ] 云函数与云数据库正式退役清理

## 文档

`docs/` 下：部署指南、Web 版部署指南、上线检查清单、开放接口接入指南、前端设计要求（暗房影楼版）、前端视觉重构设计汇报、系统指令（多角度专业摄影作品集生成器）、写真技能吸收评估、竞品调研与借鉴。

## License

MIT
