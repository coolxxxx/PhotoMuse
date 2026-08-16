# 光影集 PhotoMuse

> 不用出门的影楼 —— 上传一张照片，生成证件照、职业形象照与多主题 AI 写真。

光影集是一个基于**微信小程序 + 腾讯云开发（CloudBase）**的在线影楼：用户无需服装、道具、外景与天气配合，选择主题上传照片后，由 AI + 人工混合流水线（human-in-the-loop）产出专业成片。

## 功能

- **证件照体验版（¥3.9 / 1 张）**：白底 / 蓝底 / 灰底标准证件照
- **简历形象照（¥29.9 / 3 张）**：白衬衫职业形象照，适用于简历、领英、工牌
- **订单全流程**：选套餐 → 上传照片（限 3 张、≤10MB）→ 授权确认 → 提交审核 → 管理员审核 / 要求重拍 / 交付成片
- **免登录查询**：凭 订单号 + 手机号 + 查询密码（SHA-256 哈希存储）随时查询订单
- **管理后台**：OPENID 白名单 + 管理口令双因子登录，支持审核、重拍、派单（`ai_studio_jobs`）、交付、运行时配置，全链路审计日志
- **客服**：可配置 OpenAI 兼容接口的智能客服（含本地兜底回复）

## 架构

```
用户端 pages/aiStudio          云函数（13 个）                数据库（7 个集合）
┌──────────────┐   上传照片    ┌──────────────────┐  写入   ┌─────────────────────┐
│ index 下单传图 ├─────────────►│ createAIStudioOrder│──────►│ ai_studio_orders     │
│ detail 订单详情│  云存储      │ uploadAIStudioPhoto│        │ ai_studio_files      │
│ adminLogin   │              │ submitAIStudioOrder│        │ ai_studio_jobs       │
│ admin 管理后台 │◄─────────────┤ admin* 系列        │        │ ai_studio_audit_logs │
└──────────────┘  交付成片     │ dispatchAIStudioJob│        │ ai_studio_routes     │
                               │ *RuntimeConfig     │        │ ai_studio_model_settings │
                               │ callAIStudioCustomerService  │ ai_studio_prompt_templates │
                               └──────────────────┘        └─────────────────────┘
```

- **前端**：`pages/aiStudio/`（index / detail / adminLogin / admin），产品与风格配置在 `utils/ai-studio-config.js`
- **云函数**：`cloudfunctions/` 下 13 个 `*AIStudio*` 函数，部署配置见 `cloudbaserc.json`
- **云存储**：`ai-studio/{orderId}/customer/`、`customer-retake/`、`delivery/`
- **AI 写真工作流**：`docs/` 内置《多角度专业摄影作品集生成器》三阶段指令（参考图锚点 → 3×5 预览网格 → 高清单图），供管理员配合 AI 绘图工具使用

## 快速开始

1. **导入项目**：用微信开发者工具打开本目录，填入你自己的 `appid`（`project.config.json`）
2. **开通云开发**：创建环境后，把 `app.js` 与 `cloudbaserc.json` 中的 `env` / `envId` 换成你的环境 ID
3. **建集合**：在云开发控制台创建上文 7 个 `ai_studio_*` 集合
4. **部署云函数**：右键 `cloudfunctions/` 下各函数目录 → 上传并部署（或使用 CloudBase CLI 按 `cloudbaserc.json` 批量部署）
5. **配置管理员**：为 `admin*` 与 `dispatchAIStudioJob` 函数设置环境变量
   - `AI_STUDIO_ADMIN_OPENIDS`：管理员的 OPENID（逗号分隔）
   - `AI_STUDIO_ADMIN_PASSWORD`：管理口令
6. **运行校验**：`npm test`

## 安全设计

- 查询密码仅存 SHA-256 哈希，接口返回前统一剥离（`sanitizeOrder`）
- 管理端 OPENID 白名单 + 口令双验证，所有操作写 `ai_studio_audit_logs`
- 上传照片校验归属（OPENID）、数量（≤3）与大小（≤10MB），下单强制三项授权确认
- 运行时配置接口返回前删除 apiKey/secret 等私有字段

## Roadmap

- [ ] 收款码扫码支付（后台配置收款码 + 人工确认到账）
- [ ] AI 写真套图：古风 / 运动 / 休闲 / 旅拍 / 亲子等主题，3×5 网格选片后交付高清成片
- [ ] 微信支付接入

## License

MIT
