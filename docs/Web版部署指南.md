# 光影集 PhotoMuse · Web 版部署指南

`photomuse-web/` 是光影集的**网站独立版**：原生 HTML + CSS + JS 纯静态站，nginx 直接托管，**无构建步骤**。数据与业务全部复用小程序同一套云开发环境，通过 CloudBase Web SDK 匿名登录后调用 `photomuseOpenApi` 云函数（API Key 鉴权），照片经云存储直传。

```
浏览器 ──HTTPS──► nginx（纯静态托管 photomuse-web/）
   │
   ├── CloudBase Web SDK（匿名登录）
   │      ├── callFunction → photomuseOpenApi（apiKey 信封：catalog / createOrder /
   │      │     registerPhoto / submitOrder / getOrder / selectCells / queryOrder / paymentQR /
   │      │     businessConfig / samples / merchandise / analyzePhoto / selectMerch）
   │      └── uploadFile → 云存储 ai-studio/{orderId}/web-customer/、customer-retake/、
   │      │     ai-studio/analysis/web-{ts}.{ext}（AI 主题推荐分析用图，不登记订单）
   │      └── getTempFileURL → 收款码 / 预览图 / 样张 / 成片临时链接
```

**站点页面**

| 文件 | 作用 |
|------|------|
| `index.html` | 在线下单：套餐 → 多主题选择（样张横滑 + 阶梯价格条 + AI 帮我选主题）→ 联系方式 → 上传照片 → 授权确认 → 提交 |
| `order.html` | 订单详情（需下单浏览器本地凭证 webToken）：状态轮询、收款码、分主题选片、成片、周边好物、补拍补传 |
| `query.html` | 免登录查询：订单号 + 手机号 + 查询密码 三元组查询，同样支持分主题选片与周边清单展示 |
| `showcase.html` | 周边场景模拟：7 品类切换、6 款纯 CSS 实物场景（挂墙/摆台/挂历/钱包照/亚克力挂件/相册）、照片切换条、已选清单与提交（selectMerch） |
| `js/config.js` | 站点配置（环境 ID 与 API Key），部署时修改 |
| `js/api.js` | SDK 初始化 / 匿名登录 / callFunction / 上传 / 临时链接 / toast / loading |
| `js/order-view.js` | 订单视图渲染，order.html 与 query.html 复用（含分主题选片与周边好物区块） |
| `css/style.css` | 全站样式（CSS 变量令牌） |
| `nginx.conf` | nginx server 块示例 |

---

## 一、上传静态目录到服务器

把 `photomuse-web/` 目录下的**全部内容**（不要带 `photomuse-web` 这层目录本身也行，保持与 nginx `root` 一致即可）上传到服务器 `/var/www/photomuse-web`：

```bash
# 方式 A：scp
scp -r photomuse-web/* user@your-server:/var/www/photomuse-web/

# 方式 B：rsync（推荐，增量同步）
rsync -av --delete photomuse-web/ user@your-server:/var/www/photomuse-web/
```

上传前先完成本地配置修改（见下）：

- 编辑 `js/config.js`：
  - `ENV_ID`：腾讯云开发环境 ID（默认已填 `cloud1-9gv5zn35c8ca8869-00c771e2`，如有变更请替换）；
  - `OPEN_API_KEY`：填入开放接口 Key（见第五节）。**为空或仍为占位文案时，站点顶部会出现「站点未配置 API Key，请联系管理员」横幅并禁用提交按钮。**

## 二、nginx 配置与重载

仓库已提供 `photomuse-web/nginx.conf` 示例（80 端口、`server_name photomuse.example.com`、`root /var/www/photomuse-web`、`index index.html`、`try_files $uri $uri/ /index.html`、静态资源 `expires 7d`、gzip、`client_max_body_size 12m`）。

```bash
# 1. 复制配置（二选一）
sudo cp photomuse-web/nginx.conf /etc/nginx/conf.d/photomuse.conf
# 或 Debian/Ubuntu 站点风格：
sudo cp photomuse-web/nginx.conf /etc/nginx/sites-available/photomuse
sudo ln -s /etc/nginx/sites-available/photomuse /etc/nginx/sites-enabled/

# 2. 修改 server_name 为你的真实域名
sudo vi /etc/nginx/conf.d/photomuse.conf

# 3. 检查语法并重载
sudo nginx -t && sudo nginx -s reload
```

**HTTPS（强烈推荐）**：CloudBase Web SDK 在生产环境要求 HTTPS 站点，用 certbot 自动补齐：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d photomuse.example.com
```

certbot 会自动生成 443 server 块并把 80 跳转到 HTTPS，证书自动续期。

## 三、控制台开启 Web 安全域名

CloudBase Web SDK 会校验请求来源域名，**未添加安全域名的站点所有 SDK 请求都会被拒绝（典型表现：请求返回 401 / `INVALID_ORIGIN` / CORS 跨域报错）**。

1. 打开 [云开发控制台](https://tcb.cloud.tencent.com/)，选择环境 `cloud1-9gv5zn35c8ca8869-00c771e2`；
2. 进入「环境 → **安全配置**（Web 安全域名）」；
3. 添加你的站点域名，如 `photomuse.example.com`（不带 `https://` 前缀，按控制台提示格式填写）；
4. 保存后即时生效，无需重新部署。

本地调试可临时把 `localhost` / `127.0.0.1` 加入（用完建议移除）。

## 四、云存储规则：允许匿名读写 `ai-studio/` 前缀

Web 端上传照片（匿名登录身份）与读取收款码 / 预览图 / 成片，都需要云存储权限放行 `ai-studio/` 前缀：

1. 控制台 →「**存储**」→「权限设置」→ 切换为「自定义安全规则」；
2. 添加目录规则，允许 `ai-studio` 目录读 + 写（具体语法以控制台规则编辑器为准）：

```json
{
  "rules": {
    "ai-studio": {
      "read": true,
      "write": true
    }
  }
}
```

3. **收紧建议**：Web 端已做匿名登录，可将写权限限制为登录用户，读保持公开（成片通过临时链接分发）：

```json
{
  "rules": {
    "ai-studio": {
      "read": true,
      "write": "auth.uid != null"
    }
  }
}
```

> 说明：小程序端原本即依赖 `ai-studio/` 前缀读写，以上规则同时兼容小程序与 Web；若你改动了路径前缀，请同步检查 `js/api.js` / `js/order-view.js` 中的 `cloudPath`。

## 五、配置 OPEN_API_KEY（环境变量）

Web 端所有请求走 `photomuseOpenApi` 云函数的 API Key 信封鉴权：

1. 生成一个独立的 Key（一个接入方一个 key，便于吊销与审计）：

   ```bash
   openssl rand -hex 16
   # 例：pm_open_3f9a1c2b4d5e6f70
   ```

2. 云开发控制台 →「云函数」→ `photomuseOpenApi` →「函数配置」→「环境变量」，编辑：

   - 键：`AI_STUDIO_OPEN_API_KEYS`
   - 值：逗号分隔的 Key 白名单，把新 key 追加进去（已有 key 保持不变），例如
     `pm_open_a1b2c3d4e5,pm_open_3f9a1c2b4d5e6f70`

3. 把同一个 key 填入站点 `js/config.js` 的 `OPEN_API_KEY`，重新上传该文件即可。

**未配置该环境变量时，所有开放接口调用一律返回 FORBIDDEN。**

## 六、启用 Web SDK 匿名登录

CloudBase Web SDK `callFunction` / `uploadFile` 需要登录态，站点使用匿名登录：

1. 云开发控制台 →「**身份验证**」（认证）→「登录方式」；
2. 开启「**匿名登录**」开关；
3. 保存即生效。站点首次访问时会自动 `signInAnonymously()`（幂等，已登录则跳过），无需用户操作。

## 七、部署自检清单

- [ ] 打开 `https://photomuse.example.com`，无「未配置 API Key」横幅，首页能加载出 3 个套餐卡与 5 个写真主题；
- [ ] 写真套餐：主题可多选（默认最多 3 个，超限 toast 拦截），价格条实时显示「基础价 + 加价明细 + 合计 + 成片张数」；
- [ ] 主题卡下方样张横滑可浏览（需商家已在管理端上传样张），点击样张新标签页打开大图；无样张主题显示「样张制作中」；
- [ ] 「AI 帮我选主题」：选一张正脸照 → 出现评分面板（summary + 评分条 + top2 推荐徽章）→「采用推荐」一键勾选；未配置视觉模型时展示 CONFIG_MISSING 的 message 提示；
- [ ] 选套餐、填手机号 / 查询密码、勾选 3 项授权、上传 1 张 jpg，提交后自动跳转订单页（写真订单以 `themes` 数组提交，金额与服务端阶梯计价一致）；
- [ ] 订单页能看到订单号与状态徽章；未支付时展示收款码图与备注说明（需商家后台已配置收款码）；
- [ ] 换浏览器 / 无痕窗口打开 `query.html`，用「订单号 + 手机号 + 查询密码」能查到同一订单；
- [ ] 商家上传各主题网格预览后，订单页按主题分卡展示「预览图 + 15 宫格 + 已选徽章」，`selectCells` 携带 themeId（webToken 或三元组鉴权），每主题超限 toast 拦截；旧单主题订单仍渲染单主题视图；
- [ ] 选片完成（cell_selected）后订单页出现「周边好物」商品网格，点「去搭配」进入 `showcase.html` 场景模拟（7 品类 + 6 款纯 CSS 场景 + 照片切换条 + 清单合计）；
- [ ] 提交周边选择后订单状态变为「周边待制作」，展示已选清单 + merch_total + 制作/发货进度（含 trackingNo）；徽章映射含 merch_pending / in_production / completed；
- [ ] 交付后成片九宫格可显示，点击能在新标签页打开原图临时链接；
- [ ] 故意上传 >10MB 文件、第 4 张照片、非图片文件，前端均有明确提示且不发起上传。

## 八、常见问题

| 现象 | 原因与处理 |
|------|-----------|
| 浏览器控制台 CORS / 跨域错误，SDK 请求全部失败 | 站点域名未加入云开发「Web 安全域名」（第三节）；或本地用 `file://` 直接打开页面——必须经 http/https 访问（本地可用 `python -m http.server` 或 `npx serve photomuse-web`） |
| 请求返回 401 / `INVALID_ORIGIN` | 同上：安全域名未配置或域名填写不一致（协议 / 端口 / 大小写） |
| 上传照片返回 **413 Request Entity Too Large** | nginx 默认 `client_max_body_size` 只有 1m，按 `nginx.conf` 示例设为 `12m` 后 `nginx -s reload` |
| 提示「CloudBase SDK 未加载」 | `imgcache.qq.com` 的 SDK 脚本加载失败（网络原因），可改用 `https://unpkg.com/@cloudbase/js-sdk@latest/dist/cloudbase.full.js` 等镜像源 |
| 提示「无效的 API Key」(FORBIDDEN) | `js/config.js` 的 `OPEN_API_KEY` 与云函数环境变量 `AI_STUDIO_OPEN_API_KEYS` 不一致，或环境变量未保存 / 云函数未重启 |
| callFunction 报匿名登录相关错误 | 控制台未启用「匿名登录」（第六节） |
| 「AI 帮我选主题」提示视觉分析模型未配置（CONFIG_MISSING） | `analyzeAIStudioPhoto` 需要 `ai_studio_model_settings` 中配置 `photo_analysis` 场景（openai_compatible + 支持视觉的模型）；未配置时页面直接展示后端 message，可先人工选主题 |
| 主题卡一直显示「样张制作中」 | 商家尚未在管理端上传样张（`adminUpsertAIStudioSamples`），或样张 fileID 临时链接换取失败——刷新重试 |
| 多主题选片提交后仍停留在「网格预览待选片」 | 正常设计：全部主题都完成选片订单才进入 cell_selected；每个主题确认后会提示「本主题已选，还有主题待选」 |
| showcase 提交周边返回「周边成片文件不属于该订单」 | 搭配用成片必须取该订单的 delivery / generated 文件；请从订单页「去搭配」重新进入，勿手工拼 URL |
| 换设备打不开 order.html，提示没有访问凭证 | 正常设计：`webToken` 只在下单时返回一次，保存在下单浏览器 localStorage；请用 query.html 三元组查询 |
| 忘记查询密码 | 三元组即订单凭证，无法自助找回，请联系商家核实身份后处理 |
| 订单页不显示收款码 | 商家后台尚未配置收款码（`paymentQR` 返回 `config: null` 时卡片自动隐藏），先在小程序管理端上传收款码 |
| 收款码 / 成片图片显示「图片链接获取失败」 | 云存储权限规则未放行 `ai-studio/` 读取（第四节），或临时链接过期——刷新页面重新获取 |

## 九、安全注意事项（API Key 泄露风险）

`OPEN_API_KEY` 写在前端 `js/config.js` 中，**任何访问者查看源码即可拿到**，等同于把接入密码公开。务必：

1. **使用独立的低权限 Key**：Web 站点专用一个 key，与后端 / 第三方接入方分开，一旦泄露只影响这一条链路，可单独吊销（从 `AI_STUDIO_OPEN_API_KEYS` 白名单中移除并重新部署站点配置）；
2. **定期轮换**：建议每 1-3 个月更换一次 key（生成新 key → 加入白名单 → 更新 `js/config.js` → 观察正常后移除旧 key）；
3. **监控审计**：每次通过鉴权的调用都写入 `ai_studio_audit_logs`（含 `action: 'open_api_call'` 与时间戳），发现异常高频调用及时定位与吊销；
4. **订单数据边界**：订单查询以「订单号 + 手机号 + 查询密码」三元组为权限边界，`webToken` 为下单浏览器本地凭证；前端不得缓存或打印明文查询密码（本站 query 页仅存 sessionStorage，关闭标签页即清除）；
5. 有条件时在网关层为站点来源加 referer / IP 白名单，作为 API Key 之外的第二道防线。
