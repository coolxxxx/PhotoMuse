# 光影集 PhotoMuse

> 不用出门的影楼 —— 上传一张照片，生成证件照、职业形象照与多主题 AI 写真。

光影集是一个基于**微信小程序 + 腾讯云开发（CloudBase）**的在线影楼：用户无需服装、道具、外景与天气配合，选择主题上传照片后，由 AI + 人工混合流水线（human-in-the-loop）产出专业成片。

## 功能

- **证件照体验版（¥3.9 / 1 张）**：白底 / 蓝底 / 灰底标准证件照
- **简历形象照（¥29.9 / 3 张）**：白衬衫职业形象照，适用于简历、领英、工牌
- **AI 写真套图（¥69.9 起 / 阶梯计价）**：古风 / 运动 / 休闲 / 旅拍 / 亲子五大主题**可多选**（每加一主题 +¥39.9，最多 3 主题，后台可改价）；下单前看**主题样张**，上传照片后 **AI 视觉分析推荐**适配主题（需配置视觉模型如 GLM-4V）；三阶段出图（参考图 → 每主题 3×5 网格 → 分主题选片）→ 高清成片
- **周边衍生品（实体影楼闭环）**：挂墙主视觉 / 水晶摆台 / 定制挂历 13 月 / 钱包照套装 / 亚克力挂件 / 精装相册，系统计价；**场景模拟页**纯 CSS 实景预览（挂墙/摆桌/挂历/钱包/挂件/相册六款场景）；确认后**一键导出 300DPI 印刷制作稿**（按品类毫米尺寸重采样+3mm 出血+sRGB 制作单，提示打样保色彩一致）；制作状态流转（待制作→制作中→发货/完结）
- **收款码支付**：管理端上传微信收款码，用户端订单页扫码支付，管理员人工确认到账标记已支付
- **订单全流程**：选套餐 → 上传照片（限 3 张、≤10MB）→ 授权确认 → 提交审核 → 管理员审核 / 要求重拍 / 交付成片
- **免登录查询**：凭 订单号 + 手机号 + 查询密码（SHA-256 哈希存储）随时查询订单；写真选片支持免登录提交
- **开放接口**：`photomuseOpenApi` 网关（API Key 鉴权）对外提供目录 / 订单查询 / 收款码 / 运行配置 + 网站下单四组 action（createOrder / registerPhoto / getOrder / selectCells，webToken 所有权），网站与其他小程序均可接入，见 `docs/开放接口接入指南.md`
- **AI 生图接口（后台可配置）**：写真线接任意 OpenAI 兼容生图 API（智谱 CogView / OpenAI gpt-image / xAI Grok / Nano Banana 经兼容网关），订单卡一键"生成参考图 / 生成网格 / 生成分镜图"，提示词内置《多角度专业摄影作品集生成器》三阶段指令；apiKey 只存库不出网关
- **证件照全自动引擎（自部署 HivisionIDPhotos，Apache-2.0）**：一台 2 核 CPU 服务器即可跑（0.2 秒/张），管理端一键"AI 证件照"自动完成抠图→换底→按国标规格出照→六寸排版照；内置一寸~六寸 300DPI 规格与白/蓝/红/灰/深蓝标准底色
- **网站独立版**：`photomuse-web/` 纯静态 H5（原生 HTML+JS，无构建），nginx 直接托管，功能与小程序对齐（下单/传图/收款码/网格选片/交付查看/三元组查询），部署见 `docs/Web版部署指南.md`
- **管理后台**：OPENID 白名单 + 管理口令双因子登录，支持审核、重拍、标记支付、上传预览网格、AI 出图、派单（`ai_studio_jobs`）、交付、收款设置、模型设置、运行时配置，全链路审计日志
- **客服**：可配置 OpenAI 兼容接口的智能客服（含本地兜底回复）

## 架构

```
用户端 pages/aiStudio          云函数（19 个）                数据库（8 个集合）
┌──────────────┐   上传照片    ┌──────────────────┐  写入   ┌─────────────────────┐
│ index 下单传图 ├─────────────►│ createAIStudioOrder│──────►│ ai_studio_orders     │
│ detail 订单详情│  云存储      │ uploadAIStudioPhoto│        │ ai_studio_files      │
│ adminLogin   │              │ submitAIStudioOrder│        │ ai_studio_jobs       │
│ admin 管理后台 │◄─────────────┤ admin* 系列        │        │ ai_studio_audit_logs │
└──────────────┘  交付成片     │ *GridPreview/Cells│        │ ai_studio_routes     │
                               │ *PaymentQR/Paid   │        │ ai_studio_model_settings │
网站/第三方 ──API Key──► photomuseOpenApi            │ ai_studio_prompt_templates │
其他小程序 ──环境共享──► 直调 13 个业务函数           │ ai_studio_payment_config │
                               └──────────────────┘        └─────────────────────┘
```

- **前端**：`pages/aiStudio/`（index / detail / adminLogin / admin），产品、风格与写真主题配置在 `utils/ai-studio-config.js`
- **云函数**：`cloudfunctions/` 下 19 个函数（13 个业务 + 3 个支付 + 2 个写真 + 1 个开放网关），部署配置见 `cloudbaserc.json`
- **云存储**：`ai-studio/{orderId}/customer/`、`customer-retake/`、`grid/`、`delivery/`、`ai-studio/payment/`（收款码）
- **AI 写真工作流**：`docs/` 内置《多角度专业摄影作品集生成器》三阶段指令（参考图锚点 → 3×5 预览网格 → 高清单图），供管理员配合 AI 绘图工具使用
- **前端视觉重构指南**：`docs/前端视觉重构设计汇报.md`（契约基线 / 前端清单 / 横切解耦 / 操作指引）

## 快速开始

1. **部署后端（一键）**：`npm i -g @cloudbase/cli && tcb login`，在 `cloudbaserc.json` 填好管理口令与开放 API Key 后执行 `npm run deploy`——自动部署 31 个云函数（含超时/内存/环境变量配置）并创建 11 个数据库集合。详见 `docs/部署指南.md`
2. **小程序**：微信开发者工具打开本目录，填入你自己的 `appid`（`project.config.json`），真机回归路径见 `docs/上线检查清单.md`
3. **网站独立版**：`photomuse-web/` 改 `js/config.js` 后挂 nginx 或 `tcb hosting deploy`，控制台开匿名登录与安全域名（两步），详见 `docs/Web版部署指南.md`
4. **运行校验**：`npm test`（四层：断言 / 契约核对 / 视觉完整性 / 46 个集成用例）

## 安全设计

- 查询密码仅存 SHA-256 哈希，接口返回前统一剥离（`sanitizeOrder`）
- 管理端 OPENID 白名单 + 口令双验证，所有操作写 `ai_studio_audit_logs`
- 上传照片校验归属（OPENID）、数量（≤3）与大小（≤10MB），下单强制三项授权确认
- 运行时配置接口返回前删除 apiKey/secret 等私有字段
- 开放接口 API Key 白名单 + 每次调用审计，只开放只读/凭据查询能力

## Roadmap

- [x] 收款码扫码支付（后台配置收款码 + 人工确认到账）
- [x] AI 写真套图：多主题阶梯计价 + 样张库 + AI 视觉推荐 + 分主题网格选片
- [x] 周边衍生品闭环：品类计价 + 场景模拟展示 + 300DPI 印刷制作稿 + 制作状态流转
- [x] 开放接口：网站 / 其他小程序接入（API Key 网关 13 个 action + 环境共享）
- [x] AI 生图接口后台配置（OpenAI 兼容）+ 管理端一键出图
- [x] 网站独立版 photomuse-web（nginx 直挂静态站，功能与小程序对齐）
- [ ] 真 CMYK 转换（需 ICC 引擎，当前为 sRGB 全流程 + 打样流程）
- [ ] 微信支付接入
- [ ] 前端视觉重构（按 `docs/前端视觉重构设计汇报.md` 执行）

## License

MIT
