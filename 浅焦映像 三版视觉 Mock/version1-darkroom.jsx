// ===== 版本一：暗房工作室 Darkroom =====
// 深黑基底 + 琥珀红光 + 胶片齿孔 + 等宽字体

const IMG_ID_BLUE = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgn34a4go_ve_miaoda';
const IMG_ID_RED = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgt4kjsag_ve_miaoda';
const IMG_PORTRAIT = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgl2lxgfq_ve_miaoda';
const IMG_CINEMATIC = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgucgdubi_ve_miaoda';

const DarkroomStyles = {
  bg: '#0A0A0A',
  surface: '#141414',
  surface2: '#1A1A1A',
  border: '#2A2A2A',
  amber: '#E8692E',
  amberDim: 'rgba(232, 105, 46, 0.15)',
  amberLight: '#F2A65A',
  text: '#E8E8E8',
  textSec: '#888888',
  textDim: '#555555',
  mono: "'JetBrains Mono', 'SF Mono', monospace",
  sans: "'Inter', 'Noto Sans SC', sans-serif",
};

// 胶片齿孔装饰
function FilmSprocket({ color = 'rgba(232,105,46,0.3)', count = 20, vertical = false }) {
  const holes = [];
  for (let i = 0; i < count; i++) {
    holes.push(
      <div key={i} style={{
        width: vertical ? 6 : 8,
        height: vertical ? 8 : 6,
        borderRadius: 1.5,
        background: color,
        flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      display: 'flex',
      flexDirection: vertical ? 'column' : 'row',
      gap: vertical ? 6 : 8,
      alignItems: 'center',
      justifyContent: 'center',
    }}>{holes}</div>
  );
}

// 暗房红光光晕
function DarkroomGlow() {
  return (
    <div style={{
      position: 'absolute',
      top: -80,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 320,
      height: 180,
      background: 'radial-gradient(ellipse at center top, rgba(232,105,46,0.18) 0%, rgba(232,105,46,0.06) 40%, transparent 70%)',
      pointerEvents: 'none',
      zIndex: 0,
    }} />
  );
}

function DarkroomIndexScreen() {
  const s = DarkroomStyles;
  const safeTop = 'var(--ios-safe-top, 54px)';
  const safeBottom = 'var(--ios-safe-bottom, 34px)';

  return (
    <div className="screen-root" style={{ background: s.bg }}>
      <DarkroomGlow />
      <div className="scroll-area" style={{ paddingTop: `calc(${safeTop} + 8px)`, position: 'relative', zIndex: 1 }}>

        {/* 顶栏 */}
        <div style={{
          padding: '0 20px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: 8,
            background: s.surface2,
            border: `1px solid ${s.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.textSec} strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ fontFamily: s.mono, fontSize: 11, letterSpacing: 2, color: s.amber, textTransform: 'uppercase' }}>
            PhotoMuse
          </div>
          <div style={{ width: 32, height: 32 }} />
        </div>

        {/* Hero 区 */}
        <div style={{ padding: '12px 24px 28px', position: 'relative' }}>
          <div style={{
            fontFamily: s.mono,
            fontSize: 10,
            letterSpacing: 3,
            color: s.amber,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            // AI Darkroom Studio
          </div>
          <h1 style={{
            fontFamily: s.sans,
            fontSize: 28,
            fontWeight: 600,
            color: s.text,
            lineHeight: 1.25,
            letterSpacing: -0.5,
            marginBottom: 10,
          }}>
            浅焦映像
          </h1>
          <p style={{
            fontSize: 13,
            color: s.textSec,
            lineHeight: 1.6,
            maxWidth: 260,
          }}>
            用 AI 冲印你的专业证件照。上传一张正脸照，在数字暗房中完成每一次曝光。
          </p>
          {/* 胶片齿孔装饰条 */}
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <FilmSprocket count={12} color="rgba(232,105,46,0.25)" />
            <div style={{ fontFamily: s.mono, fontSize: 9, color: s.textDim, letterSpacing: 1 }}>FRAME 01</div>
          </div>
        </div>

        {/* 套餐选择 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: s.text }}>选择套餐</div>
            <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>02 / PACKAGE</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: '证件照体验版', price: '¥3.9', desc: '1张出图 · 自动出片', selected: true },
              { name: '简历形象照', price: '¥29.9', desc: '3张出图 · 精修半人工', selected: false },
            ].map((p, i) => (
              <div key={i} style={{
                padding: '16px 18px',
                background: p.selected ? s.surface2 : s.surface,
                border: `1px solid ${p.selected ? s.amber : s.border}`,
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'relative',
              }}>
                {p.selected && (
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                    background: s.amber,
                    borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
                  }} />
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: s.text, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: s.textSec }}>{p.desc}</div>
                </div>
                <div style={{
                  fontFamily: s.mono,
                  fontSize: 18, fontWeight: 600,
                  color: p.selected ? s.amber : s.textSec,
                }}>{p.price}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 效果预览 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: s.text }}>效果预览</div>
            <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>03 / PREVIEW</div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 16, padding: '20px 16px',
            background: s.surface,
            border: `1px solid ${s.border}`,
            borderRadius: 14,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 72, height: 96,
                borderRadius: 6,
                background: s.surface2,
                overflow: 'hidden',
                border: `1px solid ${s.border}`,
              }}>
                <img src={IMG_PORTRAIT} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(30%) brightness(0.8)' }} />
              </div>
              <div style={{ fontFamily: s.mono, fontSize: 9, color: s.textDim, marginTop: 6 }}>ORIGINAL</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: s.amber }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 72, height: 96,
                borderRadius: 6,
                overflow: 'hidden',
                border: `2px solid ${s.amber}`,
                boxShadow: '0 0 20px rgba(232,105,46,0.25)',
              }}>
                <img src={IMG_ID_BLUE} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ fontFamily: s.mono, fontSize: 9, color: s.amber, marginTop: 6 }}>DEVELOPED</div>
            </div>
          </div>
        </div>

        {/* 风格选择 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: s.text }}>选择风格</div>
            <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>04 / STYLE</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {['蓝底正装', '红底经典', '白底简约'].map((t, i) => (
              <div key={i} style={{
                padding: '8px 16px',
                fontSize: 12,
                borderRadius: 999,
                background: i === 0 ? s.amberDim : s.surface,
                border: `1px solid ${i === 0 ? s.amber : s.border}`,
                color: i === 0 ? s.amber : s.textSec,
                fontWeight: i === 0 ? 500 : 400,
              }}>{t}</div>
            ))}
          </div>
        </div>

        {/* 上传区 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: s.text }}>上传正脸照</div>
            <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>05 / UPLOAD</div>
          </div>
          <div style={{
            border: `1px dashed ${s.border}`,
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            gap: 12,
          }}>
            {[1].map(i => (
              <div key={i} style={{
                width: 72, height: 90,
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
                border: `1px solid ${s.amber}`,
              }}>
                <img src={IMG_CINEMATIC} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 18, height: 18, borderRadius: '50%',
                  background: s.amber,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </div>
              </div>
            ))}
            <div style={{
              width: 72, height: 90,
              borderRadius: 8,
              background: s.surface2,
              border: `1px dashed ${s.border}`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={s.textDim} strokeWidth="1.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span style={{ fontSize: 10, color: s.textDim }}>添加</span>
            </div>
          </div>
        </div>

        {/* 提交按钮 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{
            height: 52,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${s.amber}, ${s.amberLight})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 0.5,
            boxShadow: '0 8px 24px rgba(232,105,46,0.35)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            开始冲印
          </div>
        </div>

        {/* 底部胶片齿孔 */}
        <div style={{ padding: '0 0 20px', display: 'flex', justifyContent: 'center' }}>
          <FilmSprocket count={18} color="rgba(255,255,255,0.08)" />
        </div>

        <div style={{ height: safeBottom }} />
      </div>
    </div>
  );
}

function DarkroomDetailScreen() {
  const s = DarkroomStyles;
  const safeTop = 'var(--ios-safe-top, 54px)';
  const safeBottom = 'var(--ios-safe-bottom, 34px)';

  return (
    <div className="screen-root" style={{ background: s.bg }}>
      <DarkroomGlow />
      <div className="scroll-area" style={{ paddingTop: `calc(${safeTop} + 8px)`, position: 'relative', zIndex: 1 }}>

        {/* 顶栏 */}
        <div style={{
          padding: '0 20px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: 8,
            background: s.surface2,
            border: `1px solid ${s.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.textSec} strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: s.text }}>订单详情</div>
          <div style={{
            fontFamily: s.mono, fontSize: 9, color: s.amber,
            padding: '4px 8px',
            background: s.amberDim,
            borderRadius: 4,
          }}>
            冲印中
          </div>
        </div>

        {/* 状态卡 */}
        <div style={{ padding: '8px 20px 20px' }}>
          <div style={{
            padding: '20px',
            background: s.surface,
            border: `1px solid ${s.border}`,
            borderRadius: 16,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: 120, height: 120,
              background: 'radial-gradient(circle at top right, rgba(232,105,46,0.15), transparent 70%)',
            }} />
            <div style={{
              fontFamily: s.mono, fontSize: 10,
              color: s.amber, letterSpacing: 2,
              marginBottom: 10,
            }}>
              ORDER · AIStudio-12345
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: s.text, marginBottom: 6 }}>
              正在冲印
            </div>
            <div style={{ fontSize: 12, color: s.textSec, lineHeight: 1.6 }}>
              你的照片已进入数字暗房，预计还需 2 分钟完成曝光与显影。
            </div>

            {/* 进度条 */}
            <div style={{ marginTop: 18 }}>
              <div style={{
                height: 4,
                background: s.surface2,
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: '65%',
                  height: '100%',
                  background: `linear-gradient(90deg, ${s.amber}, ${s.amberLight})`,
                  borderRadius: 2,
                }} />
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 8,
                fontFamily: s.mono, fontSize: 9, color: s.textDim,
              }}>
                <span>65%</span>
                <span>DEVELOPING...</span>
              </div>
            </div>
          </div>
        </div>

        {/* 订单信息 */}
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: s.text, marginBottom: 14 }}>
            订单信息
          </div>
          <div style={{
            background: s.surface,
            border: `1px solid ${s.border}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {[
              { label: '套餐', value: '证件照体验版' },
              { label: '风格', value: '蓝底正装' },
              { label: '参考照片', value: '1 张' },
              { label: '交付数量', value: '1 张' },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                borderBottom: i < 3 ? `1px solid ${s.border}` : 'none',
              }}>
                <span style={{ fontSize: 13, color: s.textSec }}>{row.label}</span>
                <span style={{ fontSize: 13, color: s.text, fontFamily: s.mono }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 交付图预览区 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: s.text }}>交付图</div>
            <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>0 / 1</div>
          </div>
          <div style={{
            aspectRatio: '3/4',
            maxHeight: 280,
            background: s.surface,
            border: `1px solid ${s.border}`,
            borderRadius: 12,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 48, height: 48,
              borderRadius: '50%',
              background: s.surface2,
              border: `2px dashed ${s.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={s.textDim} strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <div style={{ fontSize: 12, color: s.textSec }}>冲印中，即将交付</div>
            <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>EST. 2 MIN</div>
          </div>
        </div>

        <div style={{ height: safeBottom }} />
      </div>
    </div>
  );
}

function DarkroomAdminScreen() {
  const s = DarkroomStyles;
  const safeTop = 'var(--ios-safe-top, 54px)';
  const safeBottom = 'var(--ios-safe-bottom, 34px)';

  return (
    <div className="screen-root" style={{ background: s.bg }}>
      <div className="scroll-area" style={{ paddingTop: safeTop, position: 'relative' }}>
        {/* 顶栏 */}
        <div style={{
          padding: '12px 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: 8,
            background: s.surface2,
            border: `1px solid ${s.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.textSec} strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: s.text }}>订单管理</div>
            <div style={{ fontFamily: s.mono, fontSize: 9, color: s.amber, marginTop: 2 }}>OPS CONSOLE</div>
          </div>
          <div style={{ fontSize: 12, color: '#E65100' }}>退出</div>
        </div>

        {/* 状态 Tabs */}
        <div style={{
          padding: '0 20px 16px',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {['待审核', '队列中', '生成中', '已交付', '补拍中', '已取消'].map((t, i) => (
            <div key={i} style={{
              flexShrink: 0,
              padding: '6px 14px',
              fontSize: 12,
              borderRadius: 999,
              background: i === 0 ? s.amber : s.surface,
              border: `1px solid ${i === 0 ? s.amber : s.border}`,
              color: i === 0 ? '#fff' : s.textSec,
              fontWeight: i === 0 ? 500 : 400,
            }}>{t}
              {i === 0 && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.8 }}>3</span>}
            </div>
          ))}
        </div>

        {/* 订单卡片 */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3].map(order => (
            <div key={order} style={{
              background: s.surface,
              border: `1px solid ${s.border}`,
              borderRadius: 14,
              padding: 16,
            }}>
              {/* 订单头部 */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: 12,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: s.text, marginBottom: 3 }}>
                    证件照体验版 · 蓝底
                  </div>
                  <div style={{
                    fontFamily: s.mono, fontSize: 10, color: s.textDim,
                  }}>
                    AIStudio-{10000 + order}
                  </div>
                </div>
                <div style={{
                  fontFamily: s.mono,
                  fontSize: 10, padding: '4px 8px',
                  background: s.amberDim,
                  color: s.amber,
                  borderRadius: 4,
                }}>待审核</div>
              </div>

              {/* 参考图 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div style={{
                  width: 54, height: 68,
                  borderRadius: 6, overflow: 'hidden',
                  border: `1px solid ${s.border}`,
                }}>
                  <img src={IMG_CINEMATIC} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: s.textSec, marginBottom: 4 }}>照片审核：待检查</div>
                  <div style={{ fontSize: 11, color: s.textSec }}>参考照片：1 张</div>
                  <div style={{ fontSize: 11, color: s.textSec, marginTop: 4 }}>
                    <span style={{ fontFamily: s.mono, color: s.textDim }}>价格 ¥3.9</span>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: '通过', color: '#2E7D32' },
                  { label: '重拍', color: '#F57C00' },
                  { label: '拒单', color: '#C62828' },
                ].map((btn, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: 34,
                    borderRadius: 8,
                    background: 'transparent',
                    border: `1px solid ${btn.color}55`,
                    color: btn.color,
                    fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 500,
                  }}>{btn.label}</div>
                ))}
                <div style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 8,
                  background: s.amber,
                  color: '#fff',
                  fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 500,
                }}>交付</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: safeBottom, marginTop: 24 }} />
      </div>
    </div>
  );
}

Object.assign(window, {
  DarkroomIndexScreen,
  DarkroomDetailScreen,
  DarkroomAdminScreen,
  DarkroomStyles,
});
