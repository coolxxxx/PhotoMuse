// ===== 版本二：编辑室 Editorial =====
// 极致留白 + 衬线大标题 + 发丝线分割 + 时尚杂志封面质感 — 完全可交互

const ED = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  surface2: '#F5F3EF',
  border: '#E8E6E1',
  borderHair: '#D8D6D0',
  ink: '#1A1A1A',
  inkSec: '#5A5A55',
  inkDim: '#9A9A92',
  inkFaint: '#C8C6C0',
  accent: '#1A1A1A',
  accentSoft: '#F2F1EE',
  serif: "'Playfair Display', 'Noto Serif SC', serif",
  display: "'DM Serif Display', 'Noto Serif SC', serif",
  body: "'Inter', 'Noto Sans SC', sans-serif",
  green: '#2E6B3F',
  red: '#B23A3A',
  orange: '#C66A2E',
};

// ===== 主页 =====
function EditorialIndex(props) {
  const { orderData, setOrderData, navigate, showToast, setCurrentOrder } = props;
  const s = ED;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [styleIndex, setStyleIndex] = useState(0);

  const products = [
    { id: 'id_photo_9_9', name: '证件照体验版', price: '¥3.9', desc: '单张出片 · 自动精修' },
    { id: 'resume_photo_29_9', name: '简历形象照', price: '¥29.9', desc: '三张交付 · 人工质检' },
  ];

  const styles = [
    { id: 'ID-01', name: '蓝底正装', subtitle: 'Blue · Formal', img: IMG.idBlue },
    { id: 'ID-02', name: '红底经典', subtitle: 'Red · Classic', img: IMG.idRed },
    { id: 'ID-03', name: '白底简约', subtitle: 'White · Minimal', img: IMG.magazine },
  ];

  const selectProduct = (id) => {
    setOrderData(prev => ({ ...prev, productId: id }));
  };

  const selectStyle = (id, index) => {
    setOrderData(prev => ({ ...prev, styleId: id }));
    setStyleIndex(index);
  };

  const toggleAuth = (field) => {
    setOrderData(prev => ({
      ...prev,
      authorization: { ...prev.authorization, [field]: !prev.authorization[field] },
    }));
  };

  const addPhoto = () => {
    if (orderData.photos.length >= 3) { showToast('最多上传 3 张照片', 'error'); return; }
    const photos = [IMG.portrait, IMG.cinematic, IMG.magazine];
    setOrderData(prev => ({
      ...prev,
      photos: [...prev.photos, { id: Date.now(), url: photos[prev.photos.length % 3], size: 1024000 }],
    }));
    showToast('照片已添加', 'success');
  };

  const removePhoto = (id) => {
    setOrderData(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== id) }));
  };

  const handleSubmit = () => {
    if (orderData.photos.length === 0) { showToast('请至少上传 1 张正脸照片', 'error'); return; }
    if (!orderData.contactPhone || orderData.contactPhone.length < 11) { showToast('请填写正确的手机号', 'error'); return; }
    if (!orderData.queryPassword || orderData.queryPassword.length < 6) { showToast('查询密码至少 6 位', 'error'); return; }
    if (!orderData.authorization.isSelfOrAuthorized || !orderData.authorization.isAdult || !orderData.authorization.agreesProduction) {
      showToast('请确认全部授权项', 'error'); return;
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
      showToast('订单创建成功', 'success');
      setTimeout(() => navigate('detail'), 500);
    }, 1200);
  };

  return (
    <div className="screen-root" style={{ background: s.bg, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: s.ink }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>

        {/* 顶栏 */}
        <div style={{
          padding: '56px 28px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1" style={{ cursor: 'pointer' }}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <div style={{
            fontFamily: s.serif,
            fontSize: 16,
            fontStyle: 'italic',
            fontWeight: 600,
            color: s.ink,
            letterSpacing: 0.5,
          }}>PhotoMuse</div>
          <div
            onClick={() => navigate('adminLogin')}
            style={{ cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1">
              <circle cx="12" cy="8" r="4" />
              <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
            </svg>
          </div>
        </div>

        {/* Hero */}
        <div style={{ padding: '8px 28px 36px', textAlign: 'center' }}>
          <div style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: s.inkSec,
            marginBottom: 22,
          }}>Issue No.01 — Portrait Studio</div>
          <h1 style={{
            fontFamily: s.display,
            fontSize: 56,
            fontWeight: 400,
            color: s.ink,
            lineHeight: 0.95,
            letterSpacing: -1,
            marginBottom: 2,
          }}>光影</h1>
          <h1 style={{
            fontFamily: s.display,
            fontSize: 56,
            fontWeight: 400,
            fontStyle: 'italic',
            color: s.ink,
            lineHeight: 0.95,
            letterSpacing: -1,
          }}>集</h1>
          <div style={{
            width: 40, height: 1,
            background: s.ink,
            margin: '24px auto',
          }} />
          <p style={{
            fontSize: 13,
            color: s.inkSec,
            lineHeight: 1.8,
            maxWidth: 260,
            margin: '0 auto',
          }}>
            为每一张肖像注入杂志封面的质感。<br />
            AI 专业人像修图，三秒出片。
          </p>
        </div>

        {/* 发丝线分隔 */}
        <div style={{ margin: '0 28px', height: 1, background: s.borderHair }} />

        {/* 套餐选择 */}
        <div style={{ padding: '32px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
            <div style={{ fontFamily: s.serif, fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: s.ink }}>选择套餐</div>
            <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>02 / Packages</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {products.map((p, i) => (
              <div
                key={p.id}
                onClick={() => selectProduct(p.id)}
                style={{
                  padding: '22px 0',
                  borderTop: i === 0 ? `1px solid ${s.border}` : 'none',
                  borderBottom: `1px solid ${s.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    {orderData.productId === p.id && (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.ink }} />
                    )}
                    <span style={{
                      fontSize: 16,
                      fontWeight: orderData.productId === p.id ? 600 : 400,
                      color: s.ink,
                    }}>{p.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: s.inkDim, marginLeft: orderData.productId === p.id ? 18 : 0 }}>{p.desc}</div>
                </div>
                <div style={{
                  fontFamily: s.display,
                  fontSize: 24,
                  fontStyle: 'italic',
                  color: s.ink,
                }}>{p.price}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 风格画廊 */}
        <div style={{ padding: '8px 0 28px' }}>
          <div style={{ padding: '0 28px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontFamily: s.serif, fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: s.ink }}>风格画廊</div>
            <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>03 / Gallery</div>
          </div>

          {/* 大图展示 */}
          <div style={{ position: 'relative', margin: '0 28px 16px' }}>
            <div style={{
              aspectRatio: '4/5',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <img
                src={styles[styleIndex].img}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.5s ease' }}
                key={styleIndex}
              />
              {/* 杂志叠层 */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                padding: 24,
                color: '#fff',
                mixBlendMode: 'difference',
              }}>
                <div style={{ fontFamily: s.display, fontSize: 42, fontStyle: 'italic', lineHeight: 0.9 }}>VOGUE</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, opacity: 0.8 }}>STYLE No.{styleIndex + 1}</div>
                  <div style={{ fontFamily: s.serif, fontSize: 18, fontWeight: 600, marginTop: 2 }}>{styles[styleIndex].name}</div>
                </div>
              </div>
            </div>

            {/* 指示器 */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              {styles.map((_, i) => (
                <div key={i} style={{
                  width: styleIndex === i ? 24 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: styleIndex === i ? s.ink : s.inkFaint,
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }} onClick={() => selectStyle(styles[i].id, i)} />
              ))}
            </div>
          </div>

          {/* 风格选项卡 */}
          <div style={{
            padding: '0 28px',
            display: 'flex',
            gap: 0,
            borderBottom: `1px solid ${s.border}`,
          }}>
            {styles.map((st, i) => (
              <div
                key={st.id}
                onClick={() => selectStyle(st.id, i)}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  textAlign: 'center',
                  fontSize: 12,
                  color: styleIndex === i ? s.ink : s.inkDim,
                  fontWeight: styleIndex === i ? 600 : 400,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s',
                }}
              >
                {st.name}
                {styleIndex === i && (
                  <div style={{
                    position: 'absolute', bottom: -1, left: 0, right: 0,
                    height: 1.5, background: s.ink,
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 上传区 */}
        <div style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontFamily: s.serif, fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: s.ink }}>上传肖像</div>
            <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>{orderData.photos.length}/3 Photos</div>
          </div>

          <div style={{
            border: `1px solid ${s.borderHair}`,
            padding: 20,
            background: s.surface,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {orderData.photos.map(photo => (
                  <div key={photo.id} style={{
                    width: 64, height: 80,
                    overflow: 'hidden',
                    position: 'relative',
                    border: `1px solid ${s.ink}`,
                    animation: 'fadeInUp 0.3s ease',
                  }}>
                    <img src={photo.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div
                      onClick={() => removePhoto(photo.id)}
                      style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 20, height: 20, borderRadius: '50%',
                        background: s.ink,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
              {orderData.photos.length < 3 && (
                <div
                  onClick={addPhoto}
                  style={{
                    width: 44, height: 44,
                    border: `1px solid ${s.ink}`,
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: s.ink, marginBottom: 3 }}>
                  {orderData.photos.length > 0 ? `已上传 ${orderData.photos.length} 张` : '尚未上传'}
                </div>
                <div style={{ fontSize: 11, color: s.inkDim }}>建议上传清晰正脸照</div>
              </div>
            </div>
          </div>
        </div>

        {/* 表单 */}
        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ fontFamily: s.serif, fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: s.ink, marginBottom: 20 }}>联系信息</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <input
              type="tel"
              placeholder="手机号码"
              value={orderData.contactPhone}
              onChange={(e) => setOrderData(prev => ({ ...prev, contactPhone: e.target.value }))}
              style={{
                height: 52,
                padding: '0 0',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${s.border}`,
                fontSize: 14,
                color: s.ink,
                outline: 'none',
                fontFamily: s.body,
              }}
            />
            <input
              type="password"
              placeholder="查询密码（至少 6 位）"
              value={orderData.queryPassword}
              onChange={(e) => setOrderData(prev => ({ ...prev, queryPassword: e.target.value }))}
              style={{
                height: 52,
                padding: '0 0',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${s.border}`,
                fontSize: 14,
                color: s.ink,
                outline: 'none',
                fontFamily: s.body,
              }}
            />
            <textarea
              placeholder="补充要求（可选）"
              value={orderData.customerNote}
              onChange={(e) => setOrderData(prev => ({ ...prev, customerNote: e.target.value }))}
              style={{
                minHeight: 60,
                padding: '16px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${s.border}`,
                fontSize: 14,
                color: s.ink,
                outline: 'none',
                resize: 'none',
                fontFamily: s.body,
                lineHeight: 1.5,
              }}
            />
          </div>
        </div>

        {/* 授权确认 */}
        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ fontFamily: s.serif, fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: s.ink, marginBottom: 20 }}>授权声明</div>
          <div style={{
            border: `1px solid ${s.border}`,
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
                  padding: '18px 0',
                  borderBottom: i < 2 ? `1px solid ${s.border}` : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 22, height: 22,
                  border: `1px solid ${orderData.authorization[item.field] ? s.ink : s.inkFaint}`,
                  background: orderData.authorization[item.field] ? s.ink : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 14,
                  flexShrink: 0,
                  transition: 'all 0.2s',
                }}>
                  {orderData.authorization[item.field] && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 13, color: s.ink }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 提交按钮 */}
        <div style={{ padding: '0 28px 32px' }}>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              width: '100%',
              height: 58,
              background: isSubmitting ? s.inkSec : s.ink,
              border: 'none',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: 3,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 12,
              textTransform: 'uppercase',
              transition: 'all 0.2s ease',
            }}
          >
            {isSubmitting ? (
              <>
                <div style={{
                  width: 16, height: 16,
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin-slow 0.8s linear infinite',
                }} />
                PROCESSING
              </>
            ) : (
              <>
                <span>开始制作</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* 查询入口 */}
        <div style={{ padding: '0 28px 28px' }}>
          <div
            onClick={() => navigate('detail')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 0',
              borderTop: `1px solid ${s.border}`,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 13, color: s.inkSec }}>查询已有订单</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.inkDim} strokeWidth="1">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>

        {/* 底部装饰 */}
        <div style={{
          textAlign: 'center',
          paddingBottom: 24,
          fontFamily: s.serif,
          fontStyle: 'italic',
          fontSize: 11,
          color: s.inkDim,
          letterSpacing: 0.5,
        }}>
          — Since 2024 · PhotoMuse Studio —
        </div>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ===== 详情页 =====
function EditorialDetail(props) {
  const { currentOrder, goBack, showToast, setCurrentOrder, navigate } = props;
  const s = ED;
  const [progress, setProgress] = useState(65);
  const [retakePhotos, setRetakePhotos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

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

  useEffect(() => {
    if (order.order_status === 'queued' || order.order_status === 'generating') {
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            setCurrentOrder(prev => prev ? { ...prev, order_status: 'delivered', delivery_file_count: 1 } : null);
            return 100;
          }
          return prev + 2;
        });
      }, 300);
      return () => clearInterval(timer);
    }
  }, [order.order_status]);

  const needRetake = order.photo_check === 'need_retake';

  const handleAddRetake = () => {
    if (retakePhotos.length >= 3) { showToast('最多上传 3 张', 'error'); return; }
    const photos = [IMG.portrait, IMG.magazine, IMG.cinematic];
    setRetakePhotos(prev => [...prev, { id: Date.now(), url: photos[prev.length % 3] }]);
  };

  const handleSubmitRetake = () => {
    if (retakePhotos.length === 0) { showToast('请上传补拍照片', 'error'); return; }
    setIsUploading(true);
    showToast('正在提交补拍...', 'info');
    setTimeout(() => {
      setCurrentOrder(prev => prev ? {
        ...prev, photo_check: 'unchecked', order_status: 'photo_review',
        reference_photo_count: prev.reference_photo_count + retakePhotos.length,
      } : null);
      setRetakePhotos([]);
      setIsUploading(false);
      showToast('补拍已提交', 'success');
    }, 1200);
  };

  return (
    <div className="screen-root" style={{ background: s.bg, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: s.ink }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>

        {/* 顶栏 */}
        <div style={{
          padding: '56px 28px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div onClick={goBack} style={{ cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: s.ink, letterSpacing: 1 }}>ORDER DETAIL</div>
          <div style={{ width: 18 }} />
        </div>

        {/* 状态大标题 */}
        <div style={{ padding: '12px 28px 28px' }}>
          <div style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            color: s.inkDim,
            marginBottom: 14,
          }}>
            {order.orderId}
          </div>
          <h2 style={{
            fontFamily: s.display,
            fontSize: 44,
            fontWeight: 400,
            lineHeight: 1,
            color: s.ink,
            marginBottom: 2,
          }}>In</h2>
          <h2 style={{
            fontFamily: s.display,
            fontSize: 44,
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1,
            color: s.ink,
          }}>Progress</h2>

          {/* 进度 */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 28,
            paddingBottom: 12,
            borderBottom: `1px solid ${s.borderHair}`,
          }}>
            <span style={{ fontSize: 11, color: s.inkSec }}>制作进度</span>
            <span style={{ fontFamily: s.serif, fontSize: 18, fontStyle: 'italic', color: s.ink }}>
              {order.order_status === 'delivered' ? '100%' : `${progress}%`}
            </span>
          </div>
          <div style={{ height: 2, background: s.border, marginTop: 0 }}>
            <div style={{
              width: order.order_status === 'delivered' ? '100%' : `${progress}%`,
              height: '100%',
              background: s.ink,
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* 步骤节点 */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 20,
          }}>
            {[
              { label: '上传', done: true },
              { label: '审核', done: order.order_status !== 'photo_review' && order.order_status !== 'waiting_photos' },
              { label: '生成', done: order.order_status === 'delivered', current: order.order_status === 'queued' || order.order_status === 'generating' },
              { label: '交付', done: order.order_status === 'delivered' },
            ].map((step, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: step.done ? s.ink : step.current ? s.ink : s.inkFaint,
                  margin: '0 auto 8px',
                  boxShadow: step.current ? `0 0 0 3px ${s.accentSoft}` : 'none',
                }} />
                <div style={{
                  fontSize: 10,
                  color: step.done || step.current ? s.ink : s.inkDim,
                  fontWeight: step.current ? 600 : 400,
                  letterSpacing: 0.5,
                }}>{step.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 发丝线分隔 */}
        <div style={{ margin: '0 28px', height: 1, background: s.borderHair }} />

        {/* 补拍区 */}
        {needRetake && (
          <div style={{ padding: '28px' }}>
            <div style={{
              padding: '18px',
              border: `1px solid ${s.orange}`,
              marginBottom: 0,
            }}>
              <div style={{
                fontFamily: s.serif,
                fontSize: 16,
                fontStyle: 'italic',
                fontWeight: 600,
                color: s.orange,
                marginBottom: 8,
              }}>需要补拍</div>
              <div style={{ fontSize: 12, color: s.inkSec, lineHeight: 1.7 }}>
                {order.reviewNote || '照片不符合制作要求，请重新上传清晰正脸照。'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16, marginBottom: 16 }}>
              {retakePhotos.map(p => (
                <div key={p.id} style={{
                  width: 70, height: 88,
                  overflow: 'hidden',
                  position: 'relative',
                  border: `1px solid ${s.ink}`,
                }}>
                  <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div
                    onClick={() => setRetakePhotos(prev => prev.filter(x => x.id !== p.id))}
                    style={{
                      position: 'absolute', top: -4, right: -4,
                      width: 18, height: 18, borderRadius: '50%',
                      background: s.ink,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </div>
                </div>
              ))}
              {retakePhotos.length < 3 && (
                <div
                  onClick={handleAddRetake}
                  style={{
                    width: 70, height: 88,
                    border: `1px dashed ${s.inkFaint}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 4,
                    cursor: 'pointer',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={s.inkDim} strokeWidth="1">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span style={{ fontSize: 9, color: s.inkDim }}>添加</span>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmitRetake}
              disabled={isUploading}
              style={{
                width: '100%',
                height: 50,
                background: isUploading ? s.inkSec : s.ink,
                border: 'none',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: 2,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {isUploading ? 'SUBMITTING...' : '提交补拍'}
            </button>
          </div>
        )}

        {/* 订单明细 */}
        <div style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
            <div style={{ fontFamily: s.serif, fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: s.ink }}>订单明细</div>
            <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>Details</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { label: '套餐', value: order.productName },
              { label: '风格', value: order.styleName },
              { label: '参考照片', value: `${order.reference_photo_count} 张` },
              { label: '交付数量', value: `${order.delivery_file_count} 张` },
              { label: '照片审核', value:
                order.photo_check === 'unchecked' ? '未审核' :
                order.photo_check === 'passed' ? '已通过' :
                order.photo_check === 'need_retake' ? '需补拍' : '已拒绝'
              },
              { label: '价格', value: order.price },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 0',
                borderBottom: i < 5 ? `1px solid ${s.border}` : 'none',
              }}>
                <span style={{ fontSize: 13, color: s.inkSec }}>{row.label}</span>
                <span style={{
                  fontSize: 14,
                  color: s.ink,
                  fontWeight: i === 5 ? 600 : 400,
                  fontFamily: i === 5 ? s.serif : s.body,
                  fontStyle: i === 5 ? 'italic' : 'normal',
                }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 参考图 */}
        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ fontFamily: s.serif, fontSize: 18, fontWeight: 600, fontStyle: 'italic', color: s.ink, marginBottom: 16 }}>参考照片</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {order.photos?.map(p => (
              <div key={p.id} style={{
                width: 72, height: 90,
                overflow: 'hidden',
                border: `1px solid ${s.border}`,
              }}>
                <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>

        {/* 交付作品 */}
        <div style={{ padding: '0 28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontFamily: s.serif, fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: s.ink }}>交付作品</div>
            <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>Delivered</div>
          </div>

          {order.order_status === 'delivered' ? (
            <div style={{
              aspectRatio: '3/4',
              maxHeight: 360,
              overflow: 'hidden',
              position: 'relative',
              animation: 'fadeInUp 0.6s ease',
            }}>
              <img src={IMG.idBlue} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '20px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                color: '#fff',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              }}>
                <div>
                  <div style={{ fontFamily: s.display, fontSize: 22, fontStyle: 'italic' }}>Final</div>
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>点击查看大图</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
                  <path d="M7 17L17 7M17 7H8M17 7v9" />
                </svg>
              </div>
            </div>
          ) : (
            <div style={{
              aspectRatio: '4/5',
              background: s.accentSoft,
              border: `1px solid ${s.border}`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 14,
            }}>
              <div style={{
                width: 48, height: 48,
                border: `1px solid ${s.inkFaint}`,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s.inkDim} strokeWidth="1">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4l3 2" />
                </svg>
              </div>
              <div style={{ fontSize: 13, color: s.inkSec, fontStyle: 'italic', fontFamily: s.serif }}>
                {order.order_status === 'delivered' ? '已交付' : '正在制作中'}
              </div>
              <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 2, textTransform: 'uppercase' }}>
                EST. 2 MIN
              </div>
            </div>
          )}
        </div>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ===== 管理登录 =====
function EditorialAdminLogin(props) {
  const { navigate, setIsAdmin, showToast, goBack } = props;
  const s = ED;
  const [password, setPassword] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!password.trim()) { setError('请输入管理口令'); return; }
    setIsChecking(true);
    setError('');
    setTimeout(() => {
      setIsChecking(false);
      setIsAdmin(true);
      showToast('登录成功', 'success');
      setTimeout(() => navigate('admin'), 400);
    }, 800);
  };

  return (
    <div className="screen-root" style={{ background: s.bg, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: s.ink }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        <div style={{
          padding: '56px 28px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div onClick={goBack} style={{ cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: s.ink, letterSpacing: 1 }}>ADMIN</div>
          <div style={{ width: 18 }} />
        </div>

        <div style={{ padding: '50px 28px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{
              fontFamily: s.display,
              fontSize: 12,
              fontStyle: 'italic',
              color: s.inkDim,
              letterSpacing: 2,
              marginBottom: 18,
            }}>PhotoMuse</div>
            <h1 style={{
              fontFamily: s.display,
              fontSize: 36,
              fontWeight: 400,
              color: s.ink,
              marginBottom: 6,
            }}>Admin</h1>
            <h1 style={{
              fontFamily: s.display,
              fontSize: 36,
              fontWeight: 400,
              fontStyle: 'italic',
              color: s.ink,
            }}>Console</h1>
            <div style={{
              width: 32, height: 1,
              background: s.ink,
              margin: '20px auto',
            }} />
            <p style={{ fontSize: 13, color: s.inkSec, lineHeight: 1.7 }}>
              请输入管理口令进入运营控制台
            </p>
          </div>

          {/* 权限 */}
          <div style={{
            padding: '20px 0',
            borderTop: `1px solid ${s.border}`,
            borderBottom: `1px solid ${s.border}`,
            marginBottom: 28,
          }}>
            <div style={{ fontSize: 11, color: s.inkDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>可管理内容</div>
            {[
              '审核订单与照片质量',
              '派发补拍与拒绝订单',
              '上传交付成品图',
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center',
                padding: '8px 0',
                fontSize: 13,
                color: s.inkSec,
              }}>
                <div style={{ width: 4, height: 4, background: s.ink, marginRight: 12, borderRadius: '50%' }} />
                {item}
              </div>
            ))}
          </div>

          {/* 密码输入 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>PASSWORD</div>
            <input
              type="password"
              placeholder="请输入管理口令"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%',
                height: 48,
                padding: '8px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${error ? s.red : s.border}`,
                fontSize: 15,
                color: s.ink,
                outline: 'none',
                fontFamily: s.body,
                letterSpacing: 1,
              }}
            />
            {error && <div style={{ marginTop: 8, fontSize: 12, color: s.red }}>{error}</div>}
          </div>

          <button
            onClick={handleLogin}
            disabled={isChecking}
            style={{
              width: '100%',
              height: 54,
              background: isChecking ? s.inkSec : s.ink,
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: 3,
              cursor: isChecking ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10,
              textTransform: 'uppercase',
            }}
          >
            {isChecking ? (
              <>
                <div style={{
                  width: 14, height: 14,
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin-slow 0.8s linear infinite',
                }} />
                VERIFYING
              </>
            ) : 'ENTER CONSOLE'}
          </button>

          <div style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 10,
            color: s.inkDim,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            Demo Mode — Any Password Works
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 管理后台 =====
function EditorialAdmin(props) {
  const { adminTab, setAdminTab, goBack, showToast, setIsAdmin, setCurrentOrder, navigate } = props;
  const s = ED;
  const [orders, setOrders] = useState([
    { id: 1, orderId: 'AIStudio-201', product: '证件照体验版', style: '蓝底正装', status: 'photo_review', photoCheck: 'unchecked', photos: [IMG.cinematic], price: '¥3.9' },
    { id: 2, orderId: 'AIStudio-202', product: '简历形象照', style: '白底简约', status: 'photo_review', photoCheck: 'unchecked', photos: [IMG.magazine], price: '¥29.9' },
    { id: 3, orderId: 'AIStudio-203', product: '证件照体验版', style: '红底经典', status: 'photo_review', photoCheck: 'unchecked', photos: [IMG.idRed], price: '¥3.9' },
  ]);
  const [actionId, setActionId] = useState(null);

  const statusOptions = [
    { value: 'photo_review', label: '待审核' },
    { value: 'queued', label: '队列中' },
    { value: 'generating', label: '生成中' },
    { value: 'delivered', label: '已交付' },
    { value: 'waiting_photos', label: '补拍中' },
  ];

  const handleReview = (id, action) => {
    setActionId(id);
    const labels = { pass: '通过审核', need_retake: '要求补拍', reject: '拒绝订单' };
    showToast(labels[action] + '...', 'info');
    setTimeout(() => {
      setOrders(prev => prev.filter(o => o.id !== id));
      showToast('操作成功', 'success');
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
    <div className="screen-root" style={{ background: s.bg, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: s.ink }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>

        {/* 顶栏 */}
        <div style={{
          padding: '56px 28px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div onClick={handleLogout} style={{ cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: s.ink, letterSpacing: 1 }}>Admin Console</div>
            <div style={{ fontSize: 9, color: s.inkDim, letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 }}>PhotoMuse Ops</div>
          </div>
          <div onClick={handleLogout} style={{ fontSize: 12, color: s.red, cursor: 'pointer', fontWeight: 500 }}>
            退出
          </div>
        </div>

        {/* 统计 */}
        <div style={{ padding: '8px 28px 20px' }}>
          <div style={{
            display: 'flex', gap: 0,
            border: `1px solid ${s.border}`,
          }}>
            {[
              { label: '待审核', value: 3 },
              { label: '生成中', value: 5, border: true },
              { label: '已交付', value: 12, border: true },
            ].map((stat, i) => (
              <div key={i} style={{
                flex: 1,
                padding: '18px 0',
                textAlign: 'center',
                borderLeft: i > 0 ? `1px solid ${s.border}` : 'none',
              }}>
                <div style={{
                  fontFamily: s.display,
                  fontSize: 28,
                  fontStyle: 'italic',
                  color: s.ink,
                  marginBottom: 4,
                }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 1, textTransform: 'uppercase' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 状态筛选 */}
        <div style={{
          padding: '0 28px 0',
          display: 'flex',
          gap: 0,
          borderBottom: `1px solid ${s.border}`,
        }}>
          {statusOptions.map(tab => (
            <div
              key={tab.value}
              onClick={() => setAdminTab(tab.value)}
              style={{
                flexShrink: 0,
                padding: '14px 16px 14px 0',
                marginRight: 16,
                fontSize: 12,
                color: adminTab === tab.value ? s.ink : s.inkDim,
                fontWeight: adminTab === tab.value ? 600 : 400,
                cursor: 'pointer',
                position: 'relative',
                letterSpacing: 0.3,
              }}
            >
              {tab.label}
              {tab.value === 'photo_review' && (
                <span style={{ marginLeft: 6, fontSize: 10, color: s.ink }}>3</span>
              )}
              {adminTab === tab.value && (
                <div style={{
                  position: 'absolute', bottom: -1, left: 0, right: 16,
                  height: 1.5, background: s.ink,
                }} />
              )}
            </div>
          ))}
        </div>

        {/* 订单列表 */}
        <div style={{ padding: '0 28px' }}>
          {orders.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: s.serif, fontSize: 18, fontStyle: 'italic', color: s.ink, marginBottom: 6 }}>No Orders</div>
              <div style={{ fontSize: 12, color: s.inkDim }}>该状态下暂无订单</div>
            </div>
          ) : (
            orders.map((order, idx) => (
              <div
                key={order.id}
                onClick={() => openOrder(order)}
                style={{
                  padding: '22px 0',
                  borderBottom: idx < orders.length - 1 ? `1px solid ${s.border}` : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: s.inkDim, letterSpacing: 0.5, marginBottom: 4 }}>
                      {order.orderId}
                    </div>
                    <div style={{
                      fontFamily: s.serif,
                      fontSize: 18,
                      fontStyle: 'italic',
                      fontWeight: 600,
                      color: s.ink,
                      marginBottom: 2,
                    }}>{order.product}</div>
                    <div style={{ fontSize: 12, color: s.inkSec }}>{order.style} · {order.price}</div>
                  </div>
                  <div style={{
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: s.ink,
                    padding: '5px 10px',
                    border: `1px solid ${s.ink}`,
                  }}>PENDING</div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                  {order.photos.map((url, i) => (
                    <div key={i} style={{
                      width: 60, height: 76, overflow: 'hidden',
                      border: `1px solid ${s.border}`,
                    }}>
                      <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                    <div style={{ fontSize: 12, color: s.inkSec }}>照片审核：待检查</div>
                    <div style={{ fontSize: 12, color: s.inkSec }}>参考照片：{order.photos.length} 张</div>
                  </div>
                </div>

                {/* 文字操作 */}
                <div style={{
                  display: 'flex',
                  paddingTop: 16,
                  borderTop: `1px solid ${s.border}`,
                  gap: 0,
                }}>
                  {[
                    { label: '通过', color: s.green, action: 'pass' },
                    { label: '重拍', color: s.orange, action: 'need_retake' },
                    { label: '拒单', color: s.red, action: 'reject' },
                    { label: '交付', color: s.ink, action: 'deliver' },
                  ].map((btn, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (btn.action === 'deliver') { showToast('选择交付图片...', 'info'); return; }
                        handleReview(order.id, btn.action);
                      }}
                      disabled={actionId === order.id}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        borderRight: i < 3 ? `1px solid ${s.border}` : 'none',
                        color: btn.color,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: actionId === order.id ? 'not-allowed' : 'pointer',
                        padding: '4px 0',
                        letterSpacing: 0.5,
                      }}
                    >
                      {actionId === order.id ? '...' : btn.label}
                    </button>
                  ))}
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
  EditorialIndex,
  EditorialDetail,
  EditorialAdmin,
  EditorialAdminLogin,
});
