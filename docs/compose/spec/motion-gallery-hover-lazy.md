---
feature: motion-gallery-hover-lazy
status: delivered
updated: 2026-09-14
branch: main  # worktree add 被会话沙箱阻止，直接在 main 最小范围改动
commits: 7f708cd..uncommitted
---

# 动态影廊：默认静态 + 后台预载 + 悬停/点按播放

## Report

**What was built** — 重写 `photomuse-web/js/motion-gallery.js`：默认只渲染静态样张海报；条目与视口相交后进入限流队列（`PRELOAD_MAX=1`）后台 `preload=auto` 缓冲，**不** `play()`；桌面 `pointerenter/leave` 即播即停并回退首帧，触屏点按切换；全局最多 1 路在播（含 intent 竞态清理）；失败回退海报；`prefers-reduced-motion` 完全跳过预载/播放。CSS 将宽高比移到 `.motion-item`（修复审查发现的双 absolute 高度塌缩），并增加 hover/playing 徽章反馈。全站相关页面 cache-bust 至 `motion-gallery.js?v=3` + `style.css?v=7`。

**Verification** — `node --check photomuse-web/js/motion-gallery.js` PASS；`npm run test:static` PASS（契约+视觉完整性）；本地 mock `/PM` 静态服务 + Playwright：几何 `h=219` 非 0；默认 `imgOp=1/vidOp=0/paused`；`preload-ready` 后台就绪；hover 播放互斥；leave 回海报。

**Journey log** —
1. 根因是 12 条视频（约 42MB）进视口后无并发上限地 auto+play，解码拖垮滚动。
2. 独立审查指出：video/img 双 absolute 会让父级高度塌缩——宽高比必须挂在容器上。
3. 预载阈值 `top < 0.92*vh` 会把首屏底部条目挡在队列外，改为与视口相交即入队。
4. 预载采用 `preload=auto` + 并发 1（而非 metadata）：满足「后台载入、hover 即播」的用户目标；hover 时可越过队列优先加载。
5. `git worktree add` 被会话沙箱拦截，改动落在 main 工作区且未提交。

## [S1] Problem

`photomuse-web` 动态影廊（`#motion-gallery`）读取 `/PM/vid/manifest.json` 渲染 12 条 AI 图生视频样张（合计约 42MB）。旧实现 `js/motion-gallery.js` 在条目进入视口后：

1. 为每条 `video` 挂 source、`preload=auto` 并 `play()` 循环静音；
2. 不限制并发，也不在离开视口时暂停（注释写了「离开暂停」但代码未实现）。

结果：页面滚动被多路视频解码拖卡，画廊体感「动不起来」；弱网下带宽被视频吃光，首屏样张图加载变慢。

## [S2] Design

### 目标行为

1. **默认只显示静态海报图**（`/PM/img/{poster}`），网格布局不变（手机 2 列 / 桌面 4 列）。
2. **视频后台限流预载**：条目与视口相交后入队，同一时刻最多 1 条 `preload=auto` 缓冲（不 `play()`）；影廊整体离开视口则停止推进队列。hover/点按的用户意图可越过队列立即加载该条。
3. **桌面 hover 播放**：`(hover: hover) and (pointer: fine)` 设备上 `pointerenter` 播放，`pointerleave` 暂停并 `currentTime=0`；全局最多 1 路在播。
4. **触屏点按切换**：无 hover 能力时 click 切换播放/停止；已有在播项先停旧再播新。
5. **静态图始终在底层**；仅 `.playing` 时视频淡入、海报淡出（预载 ready 不抢显）。失败/停止海报淡回。`prefers-reduced-motion: reduce` 不预载、不播放。
6. **页面滚动流畅**：标签页隐藏或条目离开视口时停播。

### 实现契约

- 改动文件：
  - `photomuse-web/js/motion-gallery.js` — 重写加载/播放状态机
  - `photomuse-web/css/style.css` — 容器 `aspect-ratio`、hover/playing 态、reduced-motion
  - `photomuse-web/{index,order,query,showcase,admin}.html` — cache-bust `js?v=3` / `css?v=7`
- 数据源不变：`VID_BASE=/PM/vid/`、`IMG_BASE=/PM/img/`、`manifest.json` 字段 `{file,poster,caption}`。
- DOM 结构保持：`.motion-item > video + img + .motion-badge + .motion-caption`，`#motion-grid`。
- 预载策略：`PRELOAD_MAX=1` + `preload='auto'`；就绪 `loadeddata`；错误 → `.video-failed`。
- 播放策略：`activeItem`/`activeVideo` 单例；`playing-intent` 在切换时清理，防止 canplay 竞态双播。
- 无视频/manifest 失败：隐藏 `#motion-gallery`。

### 错误与边界

- `play()` Promise reject → 回到静态图。
- 快速 hover 多卡片 → 最后一次 `pointerenter` 为准。
- 触屏用 click，避免合成 mouse 误触发 hover 播放。
- 容器 `aspect-ratio: 490/856` 保证双 absolute 子元素不塌缩高度。

## [S3] Out of Scope

- 不重转/压缩已部署 mp4、不改 CDN/分片协议。
- 不改成横向 marquee 胶片条（用户已选保持网格）。
- 不改小程序端、不改样张主题目录。
- 不新增仓库内浏览器 E2E；本次以本地 Playwright 一次性验证为准。

## Tasks

- [x] T1: 重写 `motion-gallery.js` 状态机 — acceptance: 默认仅海报；进视口后限流预载且不 play；桌面 hover 播/离停；触屏点按切换；全局最多 1 路在播；失败回退静态图 (covers: S2)
- [x] T2: 补充 CSS 交互态与容器宽高比 — acceptance: playing/hover 时 LIVE 徽章可见；`.motion-item` 高度非 0；reduced-motion 无强制动画 (covers: S2)
- [x] T3: 版本号 bump 与校验 — acceptance: 相关 HTML 引用 `motion-gallery.js?v=3` 与 `style.css?v=7`；`node --check` 通过；`npm run test:static` 通过 (covers: S2)
