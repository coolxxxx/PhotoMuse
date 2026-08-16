// ===== 版本一：暗房工作室 Darkroom =====
// 深黑基底 + 琥珀红光 + 胶片齿孔 + 等宽字体 — 完全可交互

const DR = {
  bg: '#0A0A0A',
  surface: '#141414',
  surface2: '#1A1A1A',
  surface3: '#222222',
  border: '#2A2A2A',
  amber: '#E8692E',
  amberDim: 'rgba(232, 105, 46, 0.15)',
  amberSoft: 'rgba(232, 105, 46, 0.08)',
  amberLight: '#F2A65A',
  text: '#E8E8E8',
  textSec: '#888888',
  textDim: '#555555',
  mono: "'JetBrains Mono', 'SF Mono', monospace",
  sans: "'Inter', 'Noto Sans SC', sans-serif",
  green: '#4CAF50',
  red: '#E53935',
  orange: '#FF9800',
};

// 胶片齿孔装饰
function FilmSprocket({ color = 'rgba(232,105,46,0.3)', count = 20, vertical = false, style }) {
  const holes = [];
  for (let i = 0; i < count; i++) {
    holes.push(<div key={i} style={{
      width: vertical ? 6 : 8,
      height: vertical ? 8 : 6,
      borderRadius: 1.5,
      background: color,
      flexShrink: 0,
    }} />);
  }
  return (
    <div style={{
      display: 'flex',
      flexDirection: vertical ? 'column' : 'row',
      gap: vertical ? 6 : 8,
      alignItems: 'center',
      justifyContent: 'center',
      ...style,
    }}>{holes}</div>
  );
}

// 暗房红光光晕背景
function DarkroomGlow() {
  return (
    <div style={{
      position: 'absolute',
      top: -100,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 400,
      height: 240,
      background: 'radial-gradient(ellipse at center top, rgba(232,105,46,0.2) 0%, rgba(232,105,46,0.06) 45%, transparent 75%)',
      pointerEvents: 'none',
      zIndex: 0,
    }} />
  );
}

// ===== 主页 =====
function DarkroomIndex(props) {
  const { orderData, setOrderData, navigate, showToast, setCurrentOrder } = props;
  const s = DR;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const products = [
    { id: 'id_photo_9_9', name: '证件照体验版', price: '¥3.9', desc: '1张出图 · 自动出片', deliveryCount: 1 },
    { id: 'resume_photo_29_9', name: '简历形象照', price: '¥29.9', desc: '3张出图 · 精修半人工', deliveryCount: 3 },
  ];

  const styles = [
    { id: 'ID-01', name: '蓝底正装' },
    { id: 'ID-02', name: '红底经典' },
    { id: 'ID-03', name: '白底简约' },
  ];

  const backgrounds = ['白底', '蓝底', '红底', '灰底'];

  const selectProduct = (id) => {
    setOrderData(prev => ({
      ...prev,
      productId: id,
      styleId: id === 'resume_photo_29_9' ? 'ID-03' : prev.styleId,
    }));
  };

  const selectStyle = (id) => {
    setOrderData(prev => ({ ...prev, styleId: id }));
  };

  const toggleAuth = (field) => {
    setOrderData(prev => ({
      ...prev,
      authorization: {
        ...prev.authorization,
        [field]: !prev.authorization[field],
      },
    }));
  };

  const addPhoto = () => {
    if (orderData.photos.length >= 3) {
      showToast('最多上传 3 张照片', 'error');
      return;
    }
    // 模拟上传：用预设图片
    const photos = [IMG.portrait, IMG.cinematic, IMG.idBlue];
    const newPhoto = photos[orderData.photos.length % 3];
    setOrderData(prev => ({
      ...prev,
      photos: [...prev.photos, { id: Date.now(), url: newPhoto, size: 1024000 }],
    }));
    showToast('照片已添加', 'success');
  };

  const removePhoto = (id) => {
    setOrderData(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== id),
    }));
  };

  const handleSubmit = () => {
    if (orderData.photos.length === 0) {
      showToast('请至少上传 1 张正脸照片', 'error');
      return;
    }
    if (!orderData.contactPhone || orderData.contactPhone.length < 11) {
      showToast('请填写正确的手机号', 'error');
      return;
    }
    if (!orderData.queryPassword || orderData.queryPassword.length < 6) {
      showToast('查询密码至少 6 位', 'error');
      return;
    }
    if (!orderData.authorization.isSelfOrAuthorized || !orderData.authorization.isAdult || !orderData.authorization.agreesProduction) {
      showToast('请确认全部授权项', 'error');
      return;
    }

    setIsSubmitting(true);
    showToast('正在创建订单...', 'info');
    setTimeout(() => {
      const order = {
        orderId: `AIStudio-${Date.now()}`,
        productName: products.find(p => p.id === orderData.productId)?.name,
        styleName: styles.find(st => st.id === orderData.styleId)?.name,
        price: products.find(p => p.id === orderData.productId)?.price,
        order_status: 'photo_review',
        photo_check: 'unchecked',
        reference_photo_count: orderData.photos.length,
        delivery_file_count: 0,
        createdAt: new Date().toISOString(),
        reviewNote: '',
        photos: orderData.photos,
      };
      setCurrentOrder(order);
      setIsSubmitting(false);
      showToast('订单创建成功！', 'success');
      setTimeout(() => navigate('detail'), 500);
    }, 1200);
  };

  const allAuthChecked = orderData.authorization.isSelfOrAuthorized
    && orderData.authorization.isAdult
    && orderData.authorization.agreesProduction;

  return (
    <div className="screen-root" style={{ background: s.bg, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: s.text }}>
      <DarkroomGlow />
      <div style={{
        flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1,
        paddingBottom: 100,
      }}>

        {/* 顶栏 */}
        <div style={{
          padding: '56px 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: s.surface2, border: `1px solid ${s.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.textSec} strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: s.mono, fontSize: 11, letterSpacing: 2.5, color: s.amber, textTransform: 'uppercase', fontWeight: 600 }}>
              PhotoMuse
            </div>
            <div style={{ fontSize: 9, color: s.textDim, marginTop: 2, letterSpacing: 1 }}>AI DARKROOM STUDIO</div>
          </div>
          <div
            onClick={() => navigate('adminLogin')}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: s.surface2, border: `1px solid ${s.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.textSec} strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
            </svg>
          </div>
        </div>

        {/* Hero */}
        <div style={{ padding: '16px 24px 28px' }}>
          <div style={{
            fontFamily: s.mono, fontSize: 10, letterSpacing: 3,
            color: s.amber, textTransform: 'uppercase', marginBottom: 14,
          }}>
            // AI DARKROOM v1.0
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 700, color: s.text,
            lineHeight: 1.2, letterSpacing: -0.5, marginBottom: 12,
          }}>
            光影集
          </h1>
          <p style={{ fontSize: 13, color: s.textSec, lineHeight: 1.7, maxWidth: 280 }}>
            用 AI 在数字暗房中冲印你的专业证件照。<br />
            上传一张正脸照，等待显影。
          </p>
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <FilmSprocket count={14} color="rgba(232,105,46,0.3)" />
            <div style={{ fontFamily: s.mono, fontSize: 9, color: s.textDim, letterSpacing: 1 }}>FRAME 01</div>
          </div>
        </div>

        {/* 套餐选择 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: s.text }}>选择套餐</div>
            <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>02 / PACKAGE</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {products.map(p => (
              <div
                key={p.id}
                onClick={() => selectProduct(p.id)}
                style={{
                  padding: '18px 20px',
                  background: orderData.productId === p.id ? s.surface2 : s.surface,
                  border: `1px solid ${orderData.productId === p.id ? s.amber : s.border}`,
                  borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.25s ease',
                }}
              >
                {orderData.productId === p.id && (
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                    background: s.amber,
                    borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
                  }} />
                )}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: s.text, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: s.textSec }}>{p.desc}</div>
                </div>
                <div style={{
                  fontFamily: s.mono, fontSize: 20, fontWeight: 600,
                  color: orderData.productId === p.id ? s.amber : s.textSec,
                }}>{p.price}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 效果对比 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: s.text }}>效果预览</div>
            <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>03 / PREVIEW</div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 18, padding: '24px 20px',
            background: s.surface,
            border: `1px solid ${s.border}`,
            borderRadius: 16,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 80, height: 106, borderRadius: 6,
                overflow: 'hidden',
                border: `1px solid ${s.border}`,
                background: s.surface2,
              }}>
                <img src={IMG.cinematic} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(40%) brightness(0.75)' }} />
              </div>
              <div style={{ fontFamily: s.mono, fontSize: 9, color: s.textDim, marginTop: 8 }}>ORIGINAL</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: s.amber }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              <span style={{ fontFamily: s.mono, fontSize: 9, color: s.textDim }}>DEVELOP</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 80, height: 106, borderRadius: 6,
                overflow: 'hidden',
                border: `2px solid ${s.amber}`,
                boxShadow: '0 0 24px rgba(232,105,46,0.3)',
              }}>
                <img src={IMG.idBlue} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ fontFamily: s.mono, fontSize: 9, color: s.amber, marginTop: 8 }}>DEVELOPED</div>
            </div>
          </div>
        </div>

        {/* 风格选择 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: s.text }}>选择风格</div>
            <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>04 / STYLE</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {styles.map(st => (
              <div
                key={st.id}
                onClick={() => selectStyle(st.id)}
                style={{
                  padding: '10px 18px',
                  fontSize: 13,
                  borderRadius: 999,
                  background: orderData.styleId === st.id ? s.amberDim : s.surface,
                  border: `1px solid ${orderData.styleId === st.id ? s.amber : s.border}`,
                  color: orderData.styleId === st.id ? s.amber : s.textSec,
                  fontWeight: orderData.styleId === st.id ? 500 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >{st.name}</div>
            ))}
          </div>
        </div>

        {/* 底色选择 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: s.text, marginBottom: 14 }}>底色选项</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {['#FFFFFF', '#1976D2', '#C62828', '#666666'].map((color, i) => (
              <div
                key={i}
                onClick={() => setOrderData(prev => ({ ...prev, backgroundIndex: i }))}
                style={{
                  width: 44, height: 44,
                  borderRadius: '50%',
                  background: color,
                  border: `3px solid ${orderData.backgroundIndex === i ? s.amber : s.surface2}`,
                  cursor: 'pointer',
                  boxShadow: orderData.backgroundIndex === i ? '0 0 0 2px rgba(232,105,46,0.2)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* 表单 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: s.text, marginBottom: 14 }}>联系信息</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="tel"
              placeholder="手机号"
              value={orderData.contactPhone}
              onChange={(e) => setOrderData(prev => ({ ...prev, contactPhone: e.target.value }))}
              style={{
                height: 48,
                padding: '0 16px',
                background: s.surface,
                border: `1px solid ${s.border}`,
                borderRadius: 12,
                fontSize: 14,
                color: s.text,
                outline: 'none',
                fontFamily: s.sans,
              }}
            />
            <input
              type="password"
              placeholder="查询密码（至少6位）"
              value={orderData.queryPassword}
              onChange={(e) => setOrderData(prev => ({ ...prev, queryPassword: e.target.value }))}
              style={{
                height: 48,
                padding: '0 16px',
                background: s.surface,
                border: `1px solid ${s.border}`,
                borderRadius: 12,
                fontSize: 14,
                color: s.text,
                outline: 'none',
                fontFamily: s.sans,
              }}
            />
            <textarea
              placeholder="补充要求（可选，最多300字）"
              value={orderData.customerNote}
              onChange={(e) => setOrderData(prev => ({ ...prev, customerNote: e.target.value }))}
              style={{
                minHeight: 80,
                padding: '12px 16px',
                background: s.surface,
                border: `1px solid ${s.border}`,
                borderRadius: 12,
                fontSize: 14,
                color: s.text,
                outline: 'none',
                resize: 'none',
                fontFamily: s.sans,
                lineHeight: 1.5,
              }}
            />
          </div>
        </div>

        {/* 上传照片 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: s.text }}>上传正脸照</div>
            <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>
              {orderData.photos.length} / 3
            </div>
          </div>
          <div style={{
            border: `1px solid ${s.border}`,
            borderRadius: 14,
            padding: 16,
            background: s.surface,
          }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {orderData.photos.map(photo => (
                <div key={photo.id} style={{
                  width: 80, height: 100,
                  borderRadius: 8,
                  overflow: 'hidden',
                  position: 'relative',
                  border: `1px solid ${s.amber}`,
                  animation: 'fadeInUp 0.3s ease',
                }}>
                  <img src={photo.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div
                    onClick={() => removePhoto(photo.id)}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </div>
                </div>
              ))}
              {orderData.photos.length < 3 && (
                <div
                  onClick={addPhoto}
                  style={{
                    width: 80, height: 100,
                    borderRadius: 8,
                    background: s.surface2,
                    border: `1px dashed ${s.border}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={s.amber} strokeWidth="1.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span style={{ fontSize: 10, color: s.textDim }}>添加照片</span>
                </div>
              )}
            </div>
            <div style={{
              marginTop: 12,
              fontSize: 11,
              color: s.textSec,
              lineHeight: 1.6,
              padding: '8px 12px',
              background: s.amberSoft,
              borderRadius: 8,
              borderLeft: `2px solid ${s.amber}`,
            }}>
              提示：请上传清晰的正脸照片，光线均匀，无遮挡。最多支持 3 张。
            </div>
          </div>
        </div>

        {/* 授权确认 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: s.text, marginBottom: 14 }}>授权确认</div>
          <div style={{
            background: s.surface,
            border: `1px solid ${s.border}`,
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            {[
              { field: 'isSelfOrAuthorized', label: '确认是本人或已获得授权' },
              { field: 'isAdult', label: '确认已年满 18 周岁' },
              { field: 'agreesProduction', label: '同意 AI 制作与服务条款' },
            ].map((item, i) => (
              <div
                key={item.field}
                onClick={() => toggleAuth(item.field)}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '16px 18px',
                  borderBottom: i < 2 ? `1px solid ${s.border}` : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 22, height: 22,
                  borderRadius: 6,
                  border: `2px solid ${orderData.authorization[item.field] ? s.amber : s.border}`,
                  background: orderData.authorization[item.field] ? s.amber : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 12,
                  flexShrink: 0,
                  transition: 'all 0.2s',
                }}>
                  {orderData.authorization[item.field] && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 13, color: s.text }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 提交按钮 */}
        <div style={{ padding: '0 20px 28px' }}>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              width: '100%',
              height: 56,
              borderRadius: 16,
              background: isSubmitting
                ? s.surface2
                : `linear-gradient(135deg, ${s.amber}, ${s.amberLight})`,
              border: 'none',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10,
              letterSpacing: 1,
              boxShadow: isSubmitting ? 'none' : '0 8px 28px rgba(232,105,46,0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            {isSubmitting ? (
              <>
                <div style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin-slow 0.8s linear infinite',
                }} />
                冲印中...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                开始冲印
              </>
            )}
          </button>
        </div>

        {/* 查询订单 */}
        <div style={{ padding: '0 20px 24px' }}>
          <div
            onClick={() => navigate('detail')}
            style={{
              padding: '14px 18px',
              background: s.surface,
              border: `1px solid ${s.border}`,
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 13, color: s.textSec }}>查询已有订单</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.textDim} strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

// ===== 详情页 =====
function DarkroomDetail(props) {
  const { currentOrder, setCurrentOrder, goBack, navigate, showToast, orderData, setOrderData } = props;
  const s = DR;
  const [progress, setProgress] = useState(currentOrder?.order_status === 'delivered' ? 100 : 65);
  const [retakePhotos, setRetakePhotos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // 如果没有订单数据，展示一个演示订单
  const order = currentOrder || {
    orderId: 'AIStudio-DEMO-001',
    productName: '证件照体验版',
    styleName: '蓝底正装',
    price: '¥3.9',
    order_status: 'photo_review',
    photo_check: 'unchecked',
    reference_photo_count: 1,
    delivery_file_count: 0,
    reviewNote: '',
    photos: [{ id: 1, url: IMG.cinematic }],
    deliveryUrls: [],
    createdAt: new Date().toISOString(),
  };

  // 模拟进度推进
  useEffect(() => {
    if (order.order_status === 'queued' || order.order_status === 'generating') {
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            // 模拟完成
            setCurrentOrder(prev => prev ? { ...prev, order_status: 'delivered', delivery_file_count: 1 } : null);
            return 100;
          }
          return prev + 2;
        });
      }, 300);
      return () => clearInterval(timer);
    }
  }, [order.order_status]);

  const statusMap = {
    waiting_photos: { label: '待上传', color: s.textDim },
    photo_review: { label: '审核中', color: s.orange },
    queued: { label: '排队中', color: s.amber },
    generating: { label: '生成中', color: s.amber },
    qc: { label: '质检中', color: s.amber },
    delivered: { label: '已交付', color: s.green },
    cancelled: { label: '已取消', color: s.red },
  };

  const status = statusMap[order.order_status] || statusMap.waiting_photos;
  const needRetake = order.photo_check === 'need_retake';

  const handleAddRetake = () => {
    if (retakePhotos.length >= 3) {
      showToast('最多上传 3 张', 'error');
      return;
    }
    const photos = [IMG.portrait, IMG.idBlue, IMG.cinematic];
    setRetakePhotos(prev => [...prev, { id: Date.now(), url: photos[prev.length % 3] }]);
  };

  const handleSubmitRetake = () => {
    if (retakePhotos.length === 0) {
      showToast('请上传补拍照片', 'error');
      return;
    }
    setIsUploading(true);
    showToast('正在提交补拍...', 'info');
    setTimeout(() => {
      setCurrentOrder(prev => prev ? {
        ...prev,
        photo_check: 'unchecked',
        order_status: 'photo_review',
        reference_photo_count: prev.reference_photo_count + retakePhotos.length,
      } : null);
      setRetakePhotos([]);
      setIsUploading(false);
      showToast('补拍已提交，等待审核', 'success');
    }, 1200);
  };

  return (
    <div className="screen-root" style={{ background: s.bg, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: s.text }}>
      <DarkroomGlow />
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1, paddingBottom: 100 }}>

        {/* 顶栏 */}
        <div style={{
          padding: '56px 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div
            onClick={goBack}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: s.surface2, border: `1px solid ${s.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.textSec} strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: s.text }}>订单详情</div>
          <div style={{
            fontFamily: s.mono, fontSize: 10, color: status.color,
            padding: '5px 10px',
            background: 'rgba(232,105,46,0.1)',
            borderRadius: 6,
            letterSpacing: 0.5,
          }}>
            {status.label}
          </div>
        </div>

        {/* 状态卡 */}
        <div style={{ padding: '8px 20px 20px' }}>
          <div style={{
            padding: '22px',
            background: s.surface,
            border: `1px solid ${s.border}`,
            borderRadius: 18,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: 150, height: 150,
              background: 'radial-gradient(circle at top right, rgba(232,105,46,0.18), transparent 70%)',
            }} />
            <div style={{
              fontFamily: s.mono, fontSize: 10,
              color: s.amber, letterSpacing: 2,
              marginBottom: 12,
            }}>
              {order.orderId}
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, color: s.text, marginBottom: 8 }}>
              {order.order_status === 'delivered' ? '冲印完成' :
               order.order_status === 'photo_review' ? '等待审核' :
               needRetake ? '需要补拍' :
               '正在冲印'}
            </div>
            <div style={{ fontSize: 13, color: s.textSec, lineHeight: 1.6 }}>
              {order.order_status === 'delivered' ? '你的照片已经冲印完成，快来看看吧！' :
               order.order_status === 'photo_review' ? '工作人员正在审核你的照片，请稍候。' :
               needRetake ? '照片不符合要求，请重新上传清晰正脸照。' :
               '你的照片已进入数字暗房，正在处理中。'}
            </div>

            {/* 进度条（生成中才显示） */}
            {(order.order_status === 'queued' || order.order_status === 'generating' || order.order_status === 'qc') && (
              <div style={{ marginTop: 18 }}>
                <div style={{
                  height: 6,
                  background: s.surface2,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${s.amber}, ${s.amberLight})`,
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginTop: 8,
                  fontFamily: s.mono, fontSize: 9, color: s.textDim,
                }}>
                  <span>{progress}%</span>
                  <span>DEVELOPING...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 补拍上传区 */}
        {needRetake && (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{
              padding: '16px',
              background: 'rgba(255, 152, 0, 0.1)',
              border: `1px solid rgba(255, 152, 0, 0.3)`,
              borderRadius: 12,
              marginBottom: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: s.orange, marginBottom: 4 }}>
                ⚠ 照片审核未通过
              </div>
              <div style={{ fontSize: 12, color: s.textSec, lineHeight: 1.6 }}>
                {order.reviewNote || '照片不符合制作要求，请重新上传清晰正脸照。'}
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: s.text, marginBottom: 14 }}>补拍上传</div>
            <div style={{
              display: 'flex', gap: 12,
              padding: 16,
              background: s.surface,
              border: `1px solid ${s.border}`,
              borderRadius: 14,
            }}>
              {retakePhotos.map(p => (
                <div key={p.id} style={{
                  width: 72, height: 90, borderRadius: 8,
                  overflow: 'hidden', position: 'relative',
                  border: `1px solid ${s.amber}`,
                }}>
                  <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div
                    onClick={() => setRetakePhotos(prev => prev.filter(x => x.id !== p.id))}
                    style={{
                      position: 'absolute', top: 3, right: 3,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </div>
                </div>
              ))}
              {retakePhotos.length < 3 && (
                <div
                  onClick={handleAddRetake}
                  style={{
                    width: 72, height: 90, borderRadius: 8,
                    background: s.surface2,
                    border: `1px dashed ${s.border}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 4,
                    cursor: 'pointer',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={s.textDim} strokeWidth="1.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span style={{ fontSize: 10, color: s.textDim }}>补传</span>
                </div>
              )}
            </div>
            <button
              onClick={handleSubmitRetake}
              disabled={isUploading}
              style={{
                marginTop: 14,
                width: '100%',
                height: 48,
                borderRadius: 12,
                background: isUploading ? s.surface2 : s.amber,
                border: 'none',
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8,
              }}
            >
              {isUploading ? '提交中...' : '提交补拍照片'}
            </button>
          </div>
        )}

        {/* 订单信息 */}
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: s.text, marginBottom: 14 }}>订单信息</div>
          <div style={{
            background: s.surface,
            border: `1px solid ${s.border}`,
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            {[
              { label: '套餐', value: order.productName },
              { label: '风格', value: order.styleName },
              { label: '参考照片', value: `${order.reference_photo_count} 张` },
              { label: '交付数量', value: order.delivery_file_count + ' 张' },
              { label: '照片审核', value:
                order.photo_check === 'unchecked' ? '未审核' :
                order.photo_check === 'passed' ? '已通过' :
                order.photo_check === 'need_retake' ? '需补拍' :
                order.photo_check === 'rejected' ? '已拒绝' : '未知'
              },
              { label: '价格', value: order.price },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '15px 18px',
                borderBottom: i < 5 ? `1px solid ${s.border}` : 'none',
              }}>
                <span style={{ fontSize: 13, color: s.textSec }}>{row.label}</span>
                <span style={{
                  fontSize: 13, color: s.text,
                  fontFamily: i === 5 ? s.mono : s.sans,
                  fontWeight: i === 5 ? 600 : 400,
                }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 参考图 */}
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: s.text, marginBottom: 14 }}>参考照片</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {order.photos?.map(p => (
              <div key={p.id} style={{
                width: 72, height: 90,
                borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${s.border}`,
              }}>
                <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>

        {/* 交付图 */}
        <div style={{ padding: '0 20px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: s.text }}>交付图</div>
            <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>
              {order.delivery_file_count} / {order.productName?.includes('简历') ? 3 : 1}
            </div>
          </div>

          {order.order_status === 'delivered' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}>
              {[IMG.idBlue].map((url, i) => (
                <div key={i} style={{
                  aspectRatio: '3/4',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: `2px solid ${s.amber}`,
                  boxShadow: '0 4px 20px rgba(232,105,46,0.2)',
                  cursor: 'pointer',
                  animation: 'fadeInUp 0.5s ease',
                }}>
                  <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              aspectRatio: '4/3',
              background: s.surface,
              border: `1px solid ${s.border}`,
              borderRadius: 14,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 56, height: 56,
                borderRadius: '50%',
                background: s.surface2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={s.textDim} strokeWidth="1.5">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4l3 2" />
                </svg>
              </div>
              <div style={{ fontSize: 13, color: s.textSec }}>
                {order.order_status === 'delivered' ? '点击查看大图' : '冲印中，敬请期待'}
              </div>
              <div style={{ fontFamily: s.mono, fontSize: 10, color: s.textDim }}>
                EST. {order.order_status === 'photo_review' ? '等待审核' : '2 MIN'}
              </div>
            </div>
          )}
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

// ===== 管理登录页 =====
function DarkroomAdminLogin(props) {
  const { navigate, setIsAdmin, showToast, goBack } = props;
  const s = DR;
  const [password, setPassword] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!password.trim()) {
      setError('请输入管理口令');
      return;
    }
    setIsChecking(true);
    setError('');
    setTimeout(() => {
      // 演示模式：任意密码进入
      setIsChecking(false);
      setIsAdmin(true);
      showToast('登录成功', 'success');
      setTimeout(() => navigate('admin'), 400);
    }, 800);
  };

  return (
    <div className="screen-root" style={{ background: s.bg, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: s.text }}>
      <DarkroomGlow />
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1, paddingBottom: 100 }}>
        <div style={{
          padding: '56px 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div
            onClick={goBack}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: s.surface2, border: `1px solid ${s.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.textSec} strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: s.text }}>管理登录</div>
          <div style={{ width: 36 }} />
        </div>

        <div style={{ padding: '40px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              width: 64, height: 64,
              borderRadius: 16,
              background: s.amberDim,
              border: `1px solid ${s.amber}`,
              margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={s.amber} strokeWidth="1.5">
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <div style={{
              fontFamily: s.mono, fontSize: 11,
              color: s.amber, letterSpacing: 3,
              marginBottom: 12,
            }}>
              AI PHOTO OPS
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: s.text, marginBottom: 8 }}>
              影楼运营后台
            </h2>
            <p style={{ fontSize: 13, color: s.textSec, lineHeight: 1.6 }}>
              请输入管理口令进入运营控制台
            </p>
          </div>

          {/* 权限列表 */}
          <div style={{
            background: s.surface,
            border: `1px solid ${s.border}`,
            borderRadius: 14,
            padding: '18px',
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: s.text, marginBottom: 12 }}>可管理内容</div>
            {[
              '审核订单与照片质量',
              '派发补拍与拒绝订单',
              '上传交付成品图',
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center',
                padding: '8px 0',
                fontSize: 13,
                color: s.textSec,
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: s.amber,
                  marginRight: 10,
                }} />
                {item}
              </div>
            ))}
          </div>

          {/* 密码输入 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: s.textSec, marginBottom: 8 }}>管理口令</div>
            <input
              type="password"
              placeholder="请输入管理口令"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%',
                height: 52,
                padding: '0 16px',
                background: s.surface,
                border: `1px solid ${error ? s.red : s.border}`,
                borderRadius: 12,
                fontSize: 15,
                color: s.text,
                outline: 'none',
                fontFamily: s.mono,
                letterSpacing: 2,
              }}
            />
            {error && (
              <div style={{
                marginTop: 8,
                fontSize: 12,
                color: s.red,
                padding: '8px 12px',
                background: 'rgba(229,57,53,0.1)',
                borderRadius: 8,
              }}>{error}</div>
            )}
          </div>

          <button
            onClick={handleLogin}
            disabled={isChecking}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 14,
              background: isChecking
                ? s.surface2
                : `linear-gradient(135deg, ${s.amber}, ${s.amberLight})`,
              border: 'none',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: isChecking ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10,
              boxShadow: isChecking ? 'none' : '0 8px 24px rgba(232,105,46,0.3)',
            }}
          >
            {isChecking ? (
              <>
                <div style={{
                  width: 16, height: 16,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin-slow 0.8s linear infinite',
                }} />
                验证中...
              </>
            ) : '进入后台'}
          </button>

          <div style={{
            textAlign: 'center',
            marginTop: 16,
            fontSize: 11,
            color: s.textDim,
            fontFamily: s.mono,
          }}>
            演示模式：任意密码均可进入
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 管理后台 =====
function DarkroomAdmin(props) {
  const { adminTab, setAdminTab, goBack, showToast, setIsAdmin, navigate, setCurrentOrder } = props;
  const s = DR;
  const [orders, setOrders] = useState([
    { id: 1, orderId: 'AIStudio-201', product: '证件照体验版', style: '蓝底正装', status: 'photo_review', photoCheck: 'unchecked', photos: [IMG.cinematic], price: '¥3.9' },
    { id: 2, orderId: 'AIStudio-202', product: '简历形象照', style: '白底简约', status: 'photo_review', photoCheck: 'unchecked', photos: [IMG.portrait], price: '¥29.9' },
    { id: 3, orderId: 'AIStudio-203', product: '证件照体验版', style: '红底经典', status: 'photo_review', photoCheck: 'unchecked', photos: [IMG.idRed], price: '¥3.9' },
  ]);
  const [actionId, setActionId] = useState(null);

  const statusOptions = [
    { value: 'photo_review', label: '待审核' },
    { value: 'queued', label: '队列中' },
    { value: 'generating', label: '生成中' },
    { value: 'delivered', label: '已交付' },
    { value: 'waiting_photos', label: '补拍中' },
    { value: 'cancelled', label: '已取消' },
  ];

  const handleReview = (id, action) => {
    setActionId(id);
    const labels = { pass: '通过审核', need_retake: '要求补拍', reject: '拒绝订单' };
    showToast(labels[action] + '...', 'info');
    setTimeout(() => {
      if (action === 'pass') {
        setOrders(prev => prev.filter(o => o.id !== id));
        showToast('订单已通过，进入制作队列', 'success');
      } else {
        setOrders(prev => prev.filter(o => o.id !== id));
        showToast('操作成功', 'success');
      }
      setActionId(null);
    }, 800);
  };

  const handleLogout = () => {
    setIsAdmin(false);
    showToast('已退出登录', 'info');
    setTimeout(() => goBack(), 400);
  };

  const openOrder = (order) => {
    setCurrentOrder({
      orderId: order.orderId,
      productName: order.product,
      styleName: order.style,
      price: order.price,
      order_status: order.status,
      photo_check: order.photoCheck,
      reference_photo_count: order.photos.length,
      delivery_file_count: 0,
      photos: order.photos.map((url, i) => ({ id: i, url })),
      deliveryUrls: [],
    });
    navigate('detail');
  };

  return (
    <div className="screen-root" style={{ background: s.bg, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: s.text }}>
      <DarkroomGlow />
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1, paddingBottom: 100 }}>

        {/* 顶栏 */}
        <div style={{
          padding: '56px 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div
            onClick={handleLogout}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: s.surface2, border: `1px solid ${s.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.textSec} strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: s.text }}>订单管理</div>
            <div style={{ fontFamily: s.mono, fontSize: 9, color: s.amber, marginTop: 2 }}>OPS CONSOLE</div>
          </div>
          <div
            onClick={handleLogout}
            style={{
              fontSize: 13, color: s.red,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >退出</div>
        </div>

        {/* 统计 */}
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{
            display: 'flex', gap: 10,
          }}>
            {[
              { label: '待审核', value: 3, color: s.amber },
              { label: '生成中', value: 5, color: s.green },
              { label: '今日交付', value: 12, color: s.text },
            ].map((stat, i) => (
              <div key={i} style={{
                flex: 1,
                padding: '14px',
                background: s.surface,
                border: `1px solid ${s.border}`,
                borderRadius: 12,
              }}>
                <div style={{
                  fontSize: 22, fontWeight: 700,
                  color: stat.color,
                  fontFamily: s.mono,
                  marginBottom: 4,
                }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: s.textSec }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 状态 Tabs */}
        <div style={{
          padding: '0 20px 16px',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
        }}>
          {statusOptions.map(tab => (
            <div
              key={tab.value}
              onClick={() => setAdminTab(tab.value)}
              style={{
                flexShrink: 0,
                padding: '8px 16px',
                fontSize: 12,
                borderRadius: 999,
                background: adminTab === tab.value ? s.amber : s.surface,
                border: `1px solid ${adminTab === tab.value ? s.amber : s.border}`,
                color: adminTab === tab.value ? '#fff' : s.textSec,
                fontWeight: adminTab === tab.value ? 500 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
              {tab.value === 'photo_review' && (
                <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.85 }}>3</span>
              )}
            </div>
          ))}
        </div>

        {/* 订单列表 */}
        <div style={{ padding: '4px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
            }}>
              <div style={{
                width: 64, height: 64,
                borderRadius: '50%',
                background: s.surface,
                margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={s.textDim} strokeWidth="1.5">
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <div style={{ fontSize: 14, color: s.textSec, marginBottom: 4 }}>暂无订单</div>
              <div style={{ fontSize: 12, color: s.textDim }}>该状态下没有订单</div>
            </div>
          ) : (
            orders.map(order => (
              <div
                key={order.id}
                onClick={() => openOrder(order)}
                style={{
                  background: s.surface,
                  border: `1px solid ${s.border}`,
                  borderRadius: 16,
                  padding: 18,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {/* 订单头 */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 14,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: s.text, marginBottom: 4 }}>
                      {order.product} · {order.style}
                    </div>
                    <div style={{
                      fontFamily: s.mono, fontSize: 10, color: s.textDim,
                    }}>
                      {order.orderId}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: s.mono,
                    fontSize: 10, padding: '4px 10px',
                    background: s.amberDim,
                    color: s.amber,
                    borderRadius: 6,
                  }}>待审核</div>
                </div>

                {/* 参考图 */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  {order.photos.map((url, i) => (
                    <div key={i} style={{
                      width: 60, height: 76,
                      borderRadius: 8, overflow: 'hidden',
                      border: `1px solid ${s.border}`,
                    }}>
                      <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                    <div style={{ fontSize: 12, color: s.textSec }}>照片审核：待检查</div>
                    <div style={{ fontSize: 12, color: s.textSec }}>参考照片：{order.photos.length} 张</div>
                    <div style={{
                      fontFamily: s.mono,
                      fontSize: 14, fontWeight: 600,
                      color: s.amber,
                      marginTop: 4,
                    }}>{order.price}</div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { label: '通过', color: s.green, action: 'pass' },
                    { label: '重拍', color: s.orange, action: 'need_retake' },
                    { label: '拒单', color: s.red, action: 'reject' },
                  ].map((btn, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); handleReview(order.id, btn.action); }}
                      disabled={actionId === order.id}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 10,
                        background: 'transparent',
                        border: `1px solid ${btn.color}66`,
                        color: btn.color,
                        fontSize: 12,
                        cursor: actionId === order.id ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {actionId === order.id ? '...' : btn.label}
                    </button>
                  ))}
                  <button
                    onClick={(e) => { e.stopPropagation(); showToast('选择交付图片...', 'info'); }}
                    style={{
                      flex: 1,
                      height: 38,
                      borderRadius: 10,
                      background: s.amber,
                      border: 'none',
                      color: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 500,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >交付</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ height: 40, marginTop: 20 }} />
      </div>
    </div>
  );
}

Object.assign(window, {
  DarkroomIndex,
  DarkroomDetail,
  DarkroomAdmin,
  DarkroomAdminLogin,
});
