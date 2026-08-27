// ===== 版本三：即影即有 Polaroid =====
// 奶油米底 + 陶土暖橙 + 拍立得白边 + 手写字体

const IMG_POLAROID = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgucgduai_ve_miaoda';
const IMG_V3_ID = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgn34a4go_ve_miaoda';
const IMG_V3_RED = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgt4kjsag_ve_miaoda';
const IMG_V3_PORTRAIT = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgl2lxgfq_ve_miaoda';

const PolaroidStyles = {
  bg: '#F7F0E6',
  cream: '#FDF6EC',
  paper: '#FFFBF3',
  border: '#E8D9C4',
  terracotta: '#D97657',
  terracottaLight: '#E89A7E',
  terracottaSoft: '#F5DDD0',
  ink: '#3A2E25',
  inkSec: '#7A6B5A',
  inkDim: '#B5A895',
  warmYellow: '#F2C98A',
  handwrite: "'Caveat', 'Noto Serif SC', cursive",
  serif: "'Lora', 'Noto Serif SC', serif",
  body: "'Inter', 'Noto Sans SC', sans-serif",
};

// 拍立得照片组件
function PolaroidPhoto({ src, caption, rotate = 0, width = 120, shadow = true }) {
  const s = PolaroidStyles;
  return (
    <div style={{
      width,
      background: s.paper,
      padding: '10px 10px 36px',
      borderRadius: 2,
      boxShadow: shadow ? '0 8px 24px rgba(58,46,37,0.15)' : 'none',
      transform: `rotate(${rotate}deg)`,
      position: 'relative',
    }}>
      <div style={{
        width: '100%',
        aspectRatio: '1/1',
        background: s.bg,
        overflow: 'hidden',
      }}>
        {src && <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      {caption && (
        <div style={{
          position: 'absolute',
          bottom: 8, left: 0, right: 0,
          textAlign: 'center',
          fontFamily: s.handwrite,
          fontSize: 14,
          color: s.inkSec,
        }}>{caption}</div>
      )}
    </div>
  );
}

function PolaroidIndexScreen() {
  const s = PolaroidStyles;
  const safeTop = 'var(--ios-safe-top, 54px)';
  const safeBottom = 'var(--ios-safe-bottom, 34px)';

  return (
    <div className="screen-root" style={{ background: s.bg }}>
      <div className="scroll-area" style={{ paddingTop: `calc(${safeTop} + 8px)` }}>

        {/* 顶栏 */}
        <div style={{
          padding: '0 20px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            width: 34, height: 34,
            borderRadius: '50%',
            background: s.paper,
            border: `1px solid ${s.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: s.ink,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{
            fontFamily: s.handwrite,
            fontSize: 22,
            color: s.terracotta,
          }}>
            PhotoMuse
          </div>
          <div style={{
            width: 34, height: 34,
            borderRadius: '50%',
            background: s.paper,
            border: `1px solid ${s.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.inkSec} strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
            </svg>
          </div>
        </div>

        {/* Hero 区 — 散落的拍立得 */}
        <div style={{
          padding: '12px 20px 24px',
          textAlign: 'center',
          position: 'relative',
          minHeight: 240,
        }}>
          {/* 散落的拍立得照片 */}
          <div style={{ position: 'relative', height: 200, marginBottom: 10 }}>
            <div style={{ position: 'absolute', left: '15%', top: 10, zIndex: 1 }}>
              <PolaroidPhoto src={IMG_POLAROID} caption="阳光下的你" rotate={-8} width={110} />
            </div>
            <div style={{ position: 'absolute', right: '12%', top: 0, zIndex: 2 }}>
              <PolaroidPhoto src={IMG_V3_ID} caption="证件照" rotate={6} width={110} />
            </div>
            <div style={{ position: 'absolute', left: '32%', top: 70, zIndex: 3 }}>
              <PolaroidPhoto src={IMG_V3_RED} caption="红底也好看" rotate={-2} width={100} />
            </div>
          </div>

          <h1 style={{
            fontFamily: s.serif,
            fontSize: 26,
            fontWeight: 600,
            color: s.ink,
            lineHeight: 1.3,
            marginTop: 4,
          }}>
            每一张照片<br />都值得认真对待
          </h1>
          <p style={{
            fontFamily: s.handwrite,
            fontSize: 16,
            color: s.terracotta,
            marginTop: 8,
          }}>
            ~ AI 帮你一秒出片 ~
          </p>
        </div>

        {/* 胶带分隔 */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 20px',
          marginBottom: 8,
        }}>
          <div style={{ flex: 1, height: 1, background: s.border }} />
          <div style={{
            width: 50, height: 14,
            background: s.warmYellow,
            opacity: 0.6,
            margin: '0 12px',
            transform: 'rotate(-2deg)',
          }} />
          <div style={{ flex: 1, height: 1, background: s.border }} />
        </div>

        {/* 套餐选择 — 贴纸风格 */}
        <div style={{ padding: '12px 20px 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: s.handwrite,
              fontSize: 18,
              color: s.terracotta,
            }}>选个套餐</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Pick your package</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { name: '证件照体验版', price: '¥3.9', desc: '一张出片 · 简单快速', selected: true },
              { name: '简历形象照', price: '¥29.9', desc: '三张精修 · 半人工', selected: false },
            ].map((p, i) => (
              <div key={i} style={{
                padding: '18px 18px 18px 20px',
                background: s.paper,
                border: `2px solid ${p.selected ? s.terracotta : s.border}`,
                borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'relative',
                boxShadow: p.selected ? '0 4px 16px rgba(217,118,87,0.2)' : '0 2px 8px rgba(58,46,37,0.06)',
              }}>
                {p.selected && (
                  <div style={{
                    position: 'absolute',
                    top: -10, left: 16,
                    fontFamily: s.handwrite,
                    fontSize: 13,
                    color: '#fff',
                    background: s.terracotta,
                    padding: '2px 12px',
                    borderRadius: 4,
                    transform: 'rotate(-2deg)',
                  }}>
                    我选这个 ✦
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: s.ink, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: s.inkSec }}>{p.desc}</div>
                </div>
                <div style={{
                  fontFamily: s.handwrite,
                  fontSize: 26,
                  color: s.terracotta,
                  fontWeight: 600,
                }}>{p.price}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 风格选择 */}
        <div style={{ padding: '8px 20px 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 14,
          }}>
            <div style={{ fontFamily: s.handwrite, fontSize: 18, color: s.terracotta }}>喜欢什么风格</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Choose style</div>
          </div>

          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {[
              { name: '蓝底正装', img: IMG_V3_ID },
              { name: '红底经典', img: IMG_V3_RED },
              { name: '白底简约', img: IMG_V3_PORTRAIT },
            ].map((style, i) => (
              <div key={i} style={{ flexShrink: 0, textAlign: 'center' }}>
                <div style={{
                  width: 68, padding: '6px 6px 22px',
                  background: s.paper,
                  borderRadius: 4,
                  border: i === 0 ? `2px solid ${s.terracotta}` : `1px solid ${s.border}`,
                  boxShadow: '0 4px 10px rgba(58,46,37,0.1)',
                  position: 'relative',
                  transform: i === 1 ? 'rotate(2deg)' : i === 2 ? 'rotate(-3deg)' : 'rotate(0deg)',
                }}>
                  <div style={{ width: '100%', aspectRatio: '3/4', overflow: 'hidden' }}>
                    <img src={style.img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: 4, left: 0, right: 0,
                    fontFamily: s.handwrite,
                    fontSize: 12,
                    color: s.inkSec,
                  }}>{style.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 上传区 — 大拍立得空框 */}
        <div style={{ padding: '8px 20px 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 14,
          }}>
            <div style={{ fontFamily: s.handwrite, fontSize: 18, color: s.terracotta }}>上传你的照片</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Drop your pic</div>
          </div>

          <div style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            {/* 已上传的拍立得 */}
            <div style={{ position: 'relative' }}>
              <PolaroidPhoto src={IMG_V3_PORTRAIT} caption="本人照片 ✿" rotate={-4} width={90} />
              <div style={{
                position: 'absolute', top: -6, right: -6,
                width: 22, height: 22,
                borderRadius: '50%',
                background: s.terracotta,
                color: '#fff',
                fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(217,118,87,0.4)',
              }}>×</div>
            </div>

            {/* 再加一个拍立得空位 */}
            <div style={{
              width: 90,
              background: s.paper,
              padding: '8px 8px 28px',
              borderRadius: 2,
              border: `2px dashed ${s.border}`,
              boxShadow: '0 4px 10px rgba(58,46,37,0.06)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <div style={{
                width: '100%', aspectRatio: '1/1',
                background: s.cream,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px dashed ${s.border}`,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={s.terracottaLight} strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <div style={{
                fontFamily: s.handwrite,
                fontSize: 12,
                color: s.inkDim,
                marginTop: 6,
              }}>再加一张</div>
            </div>
          </div>
        </div>

        {/* 授权提示 */}
        <div style={{ padding: '4px 20px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: 14,
            background: s.terracottaSoft,
            borderRadius: 12,
            opacity: 0.7,
          }}>
            <div style={{
              width: 20, height: 20,
              borderRadius: '50%',
              border: `2px solid ${s.terracotta}`,
              flexShrink: 0,
              marginTop: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: s.terracotta,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div style={{ fontSize: 11, color: s.ink, lineHeight: 1.6 }}>
              我确认是本人照片、已成年，并同意 AI 制作条款
            </div>
          </div>
        </div>

        {/* 提交按钮 */}
        <div style={{ padding: '4px 20px 24px' }}>
          <div style={{
            height: 56,
            borderRadius: 28,
            background: `linear-gradient(135deg, ${s.terracotta}, ${s.terracottaLight})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10,
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(217,118,87,0.4)',
            letterSpacing: 1,
          }}>
            <span>✨ 开始制作 ✨</span>
          </div>
          <div style={{
            textAlign: 'center',
            fontFamily: s.handwrite,
            fontSize: 13,
            color: s.inkDim,
            marginTop: 10,
          }}>
            平均 30 秒出片哦 ♡
          </div>
        </div>

        <div style={{ height: safeBottom }} />
      </div>
    </div>
  );
}

function PolaroidDetailScreen() {
  const s = PolaroidStyles;
  const safeTop = 'var(--ios-safe-top, 54px)';
  const safeBottom = 'var(--ios-safe-bottom, 34px)';

  return (
    <div className="screen-root" style={{ background: s.bg }}>
      <div className="scroll-area" style={{ paddingTop: `calc(${safeTop} + 8px)` }}>

        {/* 顶栏 */}
        <div style={{
          padding: '0 20px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            width: 34, height: 34,
            borderRadius: '50%',
            background: s.paper,
            border: `1px solid ${s.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: s.ink,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: s.ink }}>订单详情</div>
          <div style={{
            padding: '6px 14px',
            borderRadius: 999,
            background: s.warmYellow,
            fontFamily: s.handwrite,
            fontSize: 13,
            color: s.ink,
          }}>
            制作中...
          </div>
        </div>

        {/* 状态卡 — 便签风格 */}
        <div style={{ padding: '8px 20px 20px' }}>
          <div style={{
            background: s.paper,
            borderRadius: 16,
            padding: 20,
            border: `1px solid ${s.border}`,
            boxShadow: '0 8px 24px rgba(58,46,37,0.08)',
            position: 'relative',
          }}>
            {/* 胶带装饰 */}
            <div style={{
              position: 'absolute',
              top: -12, left: '50%',
              transform: 'translateX(-50%) rotate(-3deg)',
              width: 80, height: 20,
              background: s.warmYellow,
              opacity: 0.7,
            }} />

            <div style={{
              fontSize: 11,
              color: s.inkDim,
              fontFamily: s.serif,
              marginBottom: 8,
              letterSpacing: 0.5,
            }}>
              AIStudio-12345
            </div>
            <h2 style={{
              fontFamily: s.handwrite,
              fontSize: 28,
              color: s.terracotta,
              marginBottom: 6,
            }}>
              正在努力出片中...
            </h2>
            <p style={{ fontSize: 12, color: s.inkSec, lineHeight: 1.6 }}>
              你的照片正在魔法厨房中烹饪，大概还需要 2 分钟 ♨︎
            </p>

            {/* 进度条 */}
            <div style={{ marginTop: 16 }}>
              <div style={{
                height: 10,
                background: s.cream,
                borderRadius: 5,
                overflow: 'hidden',
                border: `1px solid ${s.border}`,
              }}>
                <div style={{
                  width: '65%',
                  height: '100%',
                  background: `linear-gradient(90deg, ${s.terracotta}, ${s.terracottaLight})`,
                  borderRadius: 5,
                }} />
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 8,
                fontSize: 10, color: s.inkDim,
                fontFamily: s.handwrite,
                fontSize: 13,
              }}>
                <span>65% 完成</span>
                <span>加油鸭 💪</span>
              </div>
            </div>
          </div>
        </div>

        {/* 订单信息 — 卡片堆叠 */}
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 14,
          }}>
            <div style={{ fontFamily: s.handwrite, fontSize: 18, color: s.terracotta }}>订单详情</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Details</div>
          </div>

          <div style={{
            background: s.paper,
            borderRadius: 14,
            border: `1px solid ${s.border}`,
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(58,46,37,0.05)',
          }}>
            {[
              { label: '套餐', value: '证件照体验版' },
              { label: '风格', value: '蓝底正装' },
              { label: '参考照片', value: '1 张 🌄' },
              { label: '交付数量', value: '1 张 📸' },
              { label: '价格', value: '¥3.9' },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                borderBottom: i < 4 ? `1px dashed ${s.border}` : 'none',
              }}>
                <span style={{ fontSize: 13, color: s.inkSec }}>{row.label}</span>
                <span style={{ fontSize: 13, color: s.ink, fontWeight: i === 4 ? 600 : 400 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 交付区 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 14,
          }}>
            <div style={{ fontFamily: s.handwrite, fontSize: 18, color: s.terracotta }}>成品预览</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Results</div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '32px 20px',
            background: s.cream,
            borderRadius: 14,
            border: `1px solid ${s.border}`,
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ fontSize: 32 }}>⏳</div>
            <div style={{ fontFamily: s.handwrite, fontSize: 16, color: s.ink }}>
              正在显影中...
            </div>
            <div style={{ fontSize: 11, color: s.inkDim }}>
              照片一好会马上通知你哒
            </div>
          </div>
        </div>

        <div style={{ height: safeBottom }} />
      </div>
    </div>
  );
}

function PolaroidAdminScreen() {
  const s = PolaroidStyles;
  const safeTop = 'var(--ios-safe-top, 54px)';
  const safeBottom = 'var(--ios-safe-bottom, 34px)';

  return (
    <div className="screen-root" style={{ background: s.bg }}>
      <div className="scroll-area" style={{ paddingTop: `calc(${safeTop} + 8px)` }}>
        {/* 顶栏 */}
        <div style={{
          padding: '0 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            width: 34, height: 34,
            borderRadius: '50%',
            background: s.paper,
            border: `1px solid ${s.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: s.ink }}>订单管理</div>
            <div style={{ fontFamily: s.handwrite, fontSize: 13, color: s.terracotta, marginTop: 1 }}>~ Admin ~</div>
          </div>
          <div style={{ fontSize: 13, color: s.terracotta, fontFamily: s.handwrite }}>退出</div>
        </div>

        {/* 状态筛选 */}
        <div style={{
          padding: '0 20px 16px',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {[
            { label: '待审核', count: 3 },
            { label: '队列中', count: 5 },
            { label: '生成中', count: 2 },
            { label: '已交付', count: null },
            { label: '补拍中', count: null },
          ].map((t, i) => (
            <div key={i} style={{
              flexShrink: 0,
              padding: '8px 16px',
              fontSize: 13,
              borderRadius: 999,
              background: i === 0 ? s.terracotta : s.paper,
              border: `1px solid ${i === 0 ? s.terracotta : s.border}`,
              color: i === 0 ? '#fff' : s.inkSec,
              fontWeight: i === 0 ? 500 : 400,
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: i === 0 ? '0 4px 12px rgba(217,118,87,0.25)' : 'none',
            }}>
              {t.label}
              {t.count && (
                <span style={{
                  fontSize: 11,
                  background: i === 0 ? 'rgba(255,255,255,0.3)' : s.terracottaSoft,
                  color: i === 0 ? '#fff' : s.terracotta,
                  padding: '1px 7px',
                  borderRadius: 999,
                }}>{t.count}</span>
              )}
            </div>
          ))}
        </div>

        {/* 订单卡片 — 贴纸风格 */}
        <div style={{ padding: '4px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3].map((order, idx) => (
            <div key={order} style={{
              background: s.paper,
              borderRadius: 14,
              padding: 16,
              border: `1px solid ${s.border}`,
              boxShadow: '0 4px 12px rgba(58,46,37,0.06)',
              position: 'relative',
            }}>
              {idx === 1 && (
                <div style={{
                  position: 'absolute',
                  top: -10, right: 20,
                  fontFamily: s.handwrite,
                  fontSize: 12,
                  color: '#fff',
                  background: s.terracotta,
                  padding: '2px 10px',
                  borderRadius: 4,
                  transform: 'rotate(3deg)',
                }}>
                  加急 ★
                </div>
              )}

              {/* 订单头 */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 12,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: s.ink, marginBottom: 2 }}>
                    证件照体验版 · 蓝底
                  </div>
                  <div style={{
                    fontFamily: s.serif,
                    fontSize: 10, color: s.inkDim,
                    letterSpacing: 0.3,
                  }}>
                    AIStudio-{10000 + order}
                  </div>
                </div>
                <div style={{
                  fontFamily: s.handwrite,
                  fontSize: 13,
                  color: s.terracotta,
                  background: s.terracottaSoft,
                  padding: '4px 10px',
                  borderRadius: 999,
                }}>待审核</div>
              </div>

              {/* 参考图小拍立得 */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 50,
                  background: s.cream,
                  padding: '4px 4px 18px',
                  borderRadius: 2,
                  border: `1px solid ${s.border}`,
                  position: 'relative',
                  transform: 'rotate(-2deg)',
                }}>
                  <div style={{ width: '100%', aspectRatio: '3/4', overflow: 'hidden' }}>
                    <img src={IMG_V3_PORTRAIT} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                  <div style={{ fontSize: 11, color: s.inkSec }}>照片审核：待检查</div>
                  <div style={{ fontSize: 11, color: s.inkSec }}>参考照片：1 张</div>
                  <div style={{ fontFamily: s.handwrite, fontSize: 14, color: s.terracotta }}>¥3.9</div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: '✓ 通过', color: '#5D9C59', bg: '#E8F5E9' },
                  { label: '↻ 重拍', color: '#F57C00', bg: '#FFF3E0' },
                  { label: '✕ 拒单', color: '#C62828', bg: '#FFEBEE' },
                  { label: '📦 交付', color: s.terracotta, bg: s.terracottaSoft },
                ].map((btn, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 10,
                    background: btn.bg,
                    color: btn.color,
                    fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 500,
                  }}>{btn.label}</div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: safeBottom, marginTop: 20 }} />
      </div>
    </div>
  );
}

Object.assign(window, {
  PolaroidIndexScreen,
  PolaroidDetailScreen,
  PolaroidAdminScreen,
  PolaroidStyles,
});
