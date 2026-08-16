// ===== 版本二：编辑室 Editorial =====
// 极致留白 + 衬线大标题 + 发丝线分割 + 时尚杂志封面质感

const IMG_MAGAZINE = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgr33tukq_ve_miaoda';
const IMG_V2_PORTRAIT = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgl2lxgfq_ve_miaoda';
const IMG_V2_BLUE = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgn34a4go_ve_miaoda';
const IMG_V2_CINEMATIC = '/spark/app/app_17c85bu20nu/runtime/api/v1/storage/object/bucket_aadkqg427v4ju_static/static%2Faadkqgucgdubi_ve_miaoda';

const EditorialStyles = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  border: '#E8E6E1',
  borderHair: '#D8D6D0',
  ink: '#1A1A1A',
  inkSec: '#5A5A55',
  inkDim: '#9A9A92',
  inkFaint: '#C8C6C0',
  accent: '#1A1A1A',
  accentSoft: '#F2F1EE',
  serif: "'Playfair Display', 'Noto Serif SC', serif",
  body: "'Inter', 'Noto Sans SC', sans-serif",
  display: "'DM Serif Display', 'Noto Serif SC', serif",
};

function EditorialIndexScreen() {
  const s = EditorialStyles;
  const safeTop = 'var(--ios-safe-top, 54px)';
  const safeBottom = 'var(--ios-safe-bottom, 34px)';

  return (
    <div className="screen-root" style={{ background: s.bg }}>
      <div className="scroll-area" style={{ paddingTop: `calc(${safeTop} + 4px)` }}>

        {/* 顶栏 */}
        <div style={{
          padding: '0 24px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <div style={{
            fontFamily: s.serif,
            fontSize: 15,
            fontStyle: 'italic',
            fontWeight: 600,
            color: s.ink,
            letterSpacing: 0.5,
          }}>
            PhotoMuse
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4l3 2" />
          </svg>
        </div>

        {/* Hero 大标题区 */}
        <div style={{ padding: '4px 24px 32px', textAlign: 'center' }}>
          <div style={{
            fontFamily: s.body,
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: s.inkSec,
            marginBottom: 18,
          }}>
            Issue No.01 — Portrait Studio
          </div>
          <h1 style={{
            fontFamily: s.display,
            fontSize: 48,
            fontWeight: 400,
            color: s.ink,
            lineHeight: 1,
            letterSpacing: -1,
            marginBottom: 4,
          }}>
            光影
          </h1>
          <h1 style={{
            fontFamily: s.display,
            fontSize: 48,
            fontWeight: 400,
            fontStyle: 'italic',
            color: s.ink,
            lineHeight: 1,
            letterSpacing: -1,
          }}>
            集
          </h1>
          <div style={{
            width: 40, height: 1,
            background: s.ink,
            margin: '20px auto',
          }} />
          <p style={{
            fontSize: 12,
            color: s.inkSec,
            lineHeight: 1.8,
            maxWidth: 240,
            margin: '0 auto',
          }}>
            为每一张肖像注入杂志封面的质感。<br />
            AI 专业人像修图，三秒出片。
          </p>
        </div>

        {/* 发丝线分隔 */}
        <div style={{
          margin: '0 24px',
          height: 1,
          background: s.borderHair,
        }} />

        {/* 套餐选择 */}
        <div style={{ padding: '28px 24px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            <div style={{
              fontFamily: s.serif,
              fontSize: 18,
              fontWeight: 600,
              color: s.ink,
              fontStyle: 'italic',
            }}>选择套餐</div>
            <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>02 / Packages</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { name: '证件照体验版', price: '¥3.9', desc: '单张出片 · 自动精修', selected: true },
              { name: '简历形象照', price: '¥29.9', desc: '三张交付 · 人工质检', selected: false },
            ].map((p, i) => (
              <div key={i} style={{
                padding: '20px 0',
                borderTop: i === 0 ? `1px solid ${s.border}` : 'none',
                borderBottom: `1px solid ${s.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 4,
                  }}>
                    {p.selected && (
                      <div style={{
                        width: 6, height: 6,
                        borderRadius: '50%',
                        background: s.ink,
                      }} />
                    )}
                    <span style={{
                      fontSize: 15,
                      fontWeight: p.selected ? 600 : 400,
                      color: s.ink,
                      fontFamily: p.selected ? s.body : s.body,
                    }}>{p.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: s.inkDim, marginLeft: p.selected ? 16 : 0 }}>{p.desc}</div>
                </div>
                <div style={{
                  fontFamily: s.display,
                  fontSize: 22,
                  fontStyle: 'italic',
                  color: s.ink,
                }}>{p.price}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 风格预览 — 杂志封面式 */}
        <div style={{ padding: '8px 24px 28px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 18,
          }}>
            <div style={{
              fontFamily: s.serif,
              fontSize: 18,
              fontWeight: 600,
              fontStyle: 'italic',
              color: s.ink,
            }}>风格画廊</div>
            <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>03 / Gallery</div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{
              aspectRatio: '1/1',
              width: '100%',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <img src={IMG_MAGAZINE} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {/* 杂志叠层文字 */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                padding: 20,
                color: '#fff',
                mixBlendMode: 'difference',
              }}>
                <div style={{
                  fontFamily: s.display,
                  fontSize: 36,
                  fontStyle: 'italic',
                  lineHeight: 0.9,
                }}>
                  VOGUE
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, opacity: 0.8 }}>STYLE</div>
                  <div style={{ fontFamily: s.serif, fontSize: 16, fontWeight: 600 }}>Blue · Formal</div>
                </div>
              </div>
            </div>

            {/* 风格圆点指示器 */}
            <div style={{
              display: 'flex', justifyContent: 'center',
              gap: 8, marginTop: 14,
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: i === 0 ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === 0 ? s.ink : s.inkFaint,
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* 上传区 — 极简卡片 */}
        <div style={{ padding: '8px 24px 28px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: s.serif,
              fontSize: 18,
              fontWeight: 600,
              fontStyle: 'italic',
              color: s.ink,
            }}>上传肖像</div>
            <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>04 / Upload</div>
          </div>

          <div style={{
            border: `1px solid ${s.borderHair}`,
            borderRadius: 2,
            padding: 24,
            background: s.surface,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 60, height: 75,
              borderRadius: 2,
              overflow: 'hidden',
              border: `1px solid ${s.border}`,
            }}>
              <img src={IMG_V2_CINEMATIC} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: s.ink, marginBottom: 3 }}>已上传 1 张</div>
              <div style={{ fontSize: 11, color: s.inkDim }}>建议上传清晰正脸照</div>
            </div>
            <div style={{
              width: 40, height: 40,
              border: `1px solid ${s.ink}`,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
          </div>
        </div>

        {/* 提交按钮 — 极简黑底白字 */}
        <div style={{ padding: '0 24px 28px' }}>
          <div style={{
            height: 56,
            background: s.ink,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: 2,
            borderRadius: 2,
            textTransform: 'uppercase',
          }}>
            <span>开始制作</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </div>
        </div>

        {/* 底部小文字 */}
        <div style={{
          textAlign: 'center',
          paddingBottom: 20,
          fontFamily: s.serif,
          fontStyle: 'italic',
          fontSize: 11,
          color: s.inkDim,
        }}>
          — Since 2024 · PhotoMuse Studio —
        </div>

        <div style={{ height: safeBottom }} />
      </div>
    </div>
  );
}

function EditorialDetailScreen() {
  const s = EditorialStyles;
  const safeTop = 'var(--ios-safe-top, 54px)';
  const safeBottom = 'var(--ios-safe-bottom, 34px)';

  return (
    <div className="screen-root" style={{ background: s.bg }}>
      <div className="scroll-area" style={{ paddingTop: `calc(${safeTop} + 4px)` }}>

        {/* 顶栏 */}
        <div style={{
          padding: '0 24px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <div style={{ fontSize: 13, fontWeight: 500, color: s.ink, letterSpacing: 1 }}>
            Order Detail
          </div>
          <div style={{ width: 18 }} />
        </div>

        {/* 状态大标题 */}
        <div style={{ padding: '8px 24px 24px' }}>
          <div style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: s.inkDim,
            marginBottom: 12,
          }}>
            订单号 · AIStudio-12345
          </div>
          <h2 style={{
            fontFamily: s.display,
            fontSize: 40,
            fontWeight: 400,
            lineHeight: 1.1,
            color: s.ink,
            marginBottom: 4,
          }}>
            In
          </h2>
          <h2 style={{
            fontFamily: s.display,
            fontSize: 40,
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.1,
            color: s.ink,
          }}>
            Progress
          </h2>

          {/* 进度文字 */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 20,
            paddingBottom: 12,
            borderBottom: `1px solid ${s.borderHair}`,
          }}>
            <span style={{ fontSize: 11, color: s.inkSec }}>制作进度</span>
            <span style={{ fontFamily: s.serif, fontSize: 16, fontStyle: 'italic', color: s.ink }}>65%</span>
          </div>

          {/* 进度条 */}
          <div style={{ marginTop: 14, position: 'relative' }}>
            <div style={{ height: 2, background: s.border }}>
              <div style={{ width: '65%', height: '100%', background: s.ink }} />
            </div>
          </div>

          {/* 步骤节点 */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 16,
          }}>
            {[
              { label: '上传', done: true },
              { label: '审核', done: true },
              { label: '生成', done: false, current: true },
              { label: '交付', done: false },
            ].map((step, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: step.done ? s.ink : step.current ? s.ink : s.inkFaint,
                  margin: '0 auto 6px',
                  border: step.current ? `2px solid ${s.ink}` : 'none',
                  boxSizing: 'content-box',
                  width: step.current ? 8 : 8,
                  height: step.current ? 8 : 8,
                }} />
                <div style={{
                  fontSize: 10,
                  color: step.done || step.current ? s.ink : s.inkDim,
                  fontWeight: step.current ? 500 : 400,
                }}>{step.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 发丝线分隔 */}
        <div style={{ margin: '4px 24px', height: 1, background: s.borderHair }} />

        {/* 订单信息 */}
        <div style={{ padding: '24px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            <div style={{
              fontFamily: s.serif,
              fontSize: 18,
              fontWeight: 600,
              fontStyle: 'italic',
              color: s.ink,
            }}>订单明细</div>
            <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>Details</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { label: '套餐', value: '证件照体验版' },
              { label: '风格', value: '蓝底正装' },
              { label: '参考照片', value: '1 张' },
              { label: '交付数量', value: '1 张' },
              { label: '价格', value: '¥3.9' },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 0',
                borderBottom: i < 4 ? `1px solid ${s.border}` : 'none',
              }}>
                <span style={{ fontSize: 12, color: s.inkSec }}>{row.label}</span>
                <span style={{ fontSize: 13, color: s.ink, fontWeight: i === 4 ? 600 : 400 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 交付预览区 */}
        <div style={{ padding: '8px 24px 28px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: s.serif,
              fontSize: 18,
              fontWeight: 600,
              fontStyle: 'italic',
              color: s.ink,
            }}>交付作品</div>
            <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>Delivered</div>
          </div>

          <div style={{
            aspectRatio: '3/4',
            maxHeight: 300,
            background: s.accentSoft,
            border: `1px solid ${s.border}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 44, height: 44,
              border: `1px solid ${s.inkFaint}`,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={s.inkDim} strokeWidth="1">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4l3 2" />
              </svg>
            </div>
            <div style={{ fontSize: 12, color: s.inkSec, fontStyle: 'italic' }}>正在制作中</div>
            <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1 }}>EST. 2 MINUTES</div>
          </div>
        </div>

        <div style={{ height: safeBottom }} />
      </div>
    </div>
  );
}

function EditorialAdminScreen() {
  const s = EditorialStyles;
  const safeTop = 'var(--ios-safe-top, 54px)';
  const safeBottom = 'var(--ios-safe-bottom, 34px)';

  return (
    <div className="screen-root" style={{ background: s.bg }}>
      <div className="scroll-area" style={{ paddingTop: `calc(${safeTop} + 4px)` }}>
        {/* 顶栏 */}
        <div style={{
          padding: '0 24px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: s.ink, letterSpacing: 1 }}>Admin Console</div>
            <div style={{ fontSize: 9, color: s.inkDim, letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>PhotoMuse Ops</div>
          </div>
          <div style={{ fontSize: 12, color: s.inkSec }}>退出</div>
        </div>

        {/* 发丝线 */}
        <div style={{ margin: '0 24px', height: 1, background: s.borderHair }} />

        {/* 状态筛选 */}
        <div style={{
          padding: '16px 24px',
          display: 'flex',
          gap: 20,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          borderBottom: `1px solid ${s.border}`,
        }}>
          {['待审核', '队列中', '生成中', '已交付', '补拍中'].map((t, i) => (
            <div key={i} style={{
              flexShrink: 0,
              position: 'relative',
              paddingBottom: 12,
              fontSize: 12,
              color: i === 0 ? s.ink : s.inkDim,
              fontWeight: i === 0 ? 600 : 400,
            }}>
              {t}
              {i === 0 && (
                <div style={{
                  position: 'absolute', bottom: -1, left: 0, right: 0,
                  height: 1, background: s.ink,
                }} />
              )}
            </div>
          ))}
        </div>

        {/* 订单列表 */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[1, 2, 3].map((order, idx) => (
            <div key={order} style={{
              padding: '20px 0',
              borderBottom: idx < 2 ? `1px solid ${s.border}` : 'none',
            }}>
              {/* 订单头 */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 14,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, marginBottom: 4 }}>
                    AIStudio-{10000 + order}
                  </div>
                  <div style={{
                    fontFamily: s.serif,
                    fontSize: 16,
                    fontStyle: 'italic',
                    fontWeight: 600,
                    color: s.ink,
                  }}>
                    证件照体验版
                  </div>
                  <div style={{ fontSize: 11, color: s.inkSec, marginTop: 2 }}>蓝底正装 · ¥3.9</div>
                </div>
                <div style={{
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: s.ink,
                  padding: '4px 10px',
                  border: `1px solid ${s.ink}`,
                }}>
                  Pending
                </div>
              </div>

              {/* 缩略图 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div style={{
                  width: 56, height: 70,
                  overflow: 'hidden',
                  border: `1px solid ${s.border}`,
                }}>
                  <img src={IMG_V2_PORTRAIT} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 11, color: s.inkSec }}>照片审核：待检查</div>
                  <div style={{ fontSize: 11, color: s.inkSec }}>参考照片：1 张</div>
                </div>
              </div>

              {/* 操作 — 文字按钮式 */}
              <div style={{
                display: 'flex',
                gap: 0,
                borderTop: `1px solid ${s.border}`,
                paddingTop: 14,
              }}>
                {[
                  { label: '通过', color: '#2E7D32' },
                  { label: '重拍', color: '#F57C00' },
                  { label: '拒单', color: '#C62828' },
                  { label: '交付', color: s.ink },
                ].map((btn, i) => (
                  <div key={i} style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 500,
                    color: btn.color,
                    letterSpacing: 0.5,
                    borderRight: i < 3 ? `1px solid ${s.border}` : 'none',
                  }}>
                    {btn.label}
                  </div>
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
  EditorialIndexScreen,
  EditorialDetailScreen,
  EditorialAdminScreen,
  EditorialStyles,
});
