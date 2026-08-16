// ===== 版本三：即影即有 Polaroid =====
// 奶油米底 + 陶土暖橙 + 拍立得白边 + 手写字体 — 完全可交互

const PO = {
  bg: '#F7F0E6',
  cream: '#FDF6EC',
  paper: '#FFFBF3',
  paperDark: '#F5EDE0',
  border: '#E8D9C4',
  borderSoft: '#EFE5D4',
  terracotta: '#D97657',
  terracottaLight: '#E89A7E',
  terracottaSoft: '#F5DDD0',
  terracottaDim: 'rgba(217, 118, 87, 0.15)',
  ink: '#3A2E25',
  inkSec: '#7A6B5A',
  inkDim: '#B5A895',
  warmYellow: '#F2C98A',
  green: '#6B9E6B',
  red: '#C95A4A',
  orange: '#E28B5E',
  handwrite: "'Caveat', 'Noto Serif SC', cursive",
  serif: "'Lora', 'Noto Serif SC', serif",
  body: "'Inter', 'Noto Sans SC', sans-serif",
};

// 拍立得照片组件
function PolaroidPhoto({ src, caption, rotate = 0, width = 120, shadow = true, onClick }) {
  const s = PO;
  return (
    <div
      onClick={onClick}
      style={{
        width,
        background: s.paper,
        padding: '10px 10px 38px',
        borderRadius: 2,
        boxShadow: shadow ? '0 10px 28px rgba(58,46,37,0.18)' : 'none',
        transform: `rotate(${rotate}deg)`,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      <div style={{
        width: '100%',
        aspectRatio: '1/1',
        background: s.cream,
        overflow: 'hidden',
      }}>
        {src && <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      {caption && (
        <div style={{
          position: 'absolute',
          bottom: 10, left: 0, right: 0,
          textAlign: 'center',
          fontFamily: s.handwrite,
          fontSize: 15,
          color: s.inkSec,
        }}>{caption}</div>
      )}
    </div>
  );
}

// ===== 主页 =====
function PolaroidIndex(props) {
  const { orderData, setOrderData, navigate, showToast, setCurrentOrder } = props;
  const s = PO;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const products = [
    { id: 'id_photo_9_9', name: '证件照体验版', price: '¥3.9', desc: '一张出片 · 简单快速' },
    { id: 'resume_photo_29_9', name: '简历形象照', price: '¥29.9', desc: '三张精修 · 半人工' },
  ];

  const styles = [
    { id: 'ID-01', name: '蓝底正装', img: IMG.idBlue, rotate: -3 },
    { id: 'ID-02', name: '红底经典', img: IMG.idRed, rotate: 2 },
    { id: 'ID-03', name: '白底简约', img: IMG.polaroid, rotate: -1 },
  ];

  const selectProduct = (id) => {
    setOrderData(prev => ({ ...prev, productId: id }));
  };

  const selectStyle = (id) => {
    setOrderData(prev => ({ ...prev, styleId: id }));
  };

  const toggleAuth = (field) => {
    setOrderData(prev => ({
      ...prev,
      authorization: { ...prev.authorization, [field]: !prev.authorization[field] },
    }));
  };

  const addPhoto = () => {
    if (orderData.photos.length >= 3) { showToast('最多上传 3 张照片啦', 'error'); return; }
    const photos = [IMG.polaroid, IMG.portrait, IMG.cinematic];
    setOrderData(prev => ({
      ...prev,
      photos: [...prev.photos, { id: Date.now(), url: photos[prev.photos.length % 3], size: 1024000 }],
    }));
    showToast('照片添加成功 ♡', 'success');
  };

  const removePhoto = (id) => {
    setOrderData(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== id) }));
  };

  const handleSubmit = () => {
    if (orderData.photos.length === 0) { showToast('先传一张照片吧~', 'error'); return; }
    if (!orderData.contactPhone || orderData.contactPhone.length < 11) { showToast('手机号填对哦', 'error'); return; }
    if (!orderData.queryPassword || orderData.queryPassword.length < 6) { showToast('密码至少 6 位', 'error'); return; }
    if (!orderData.authorization.isSelfOrAuthorized || !orderData.authorization.isAdult || !orderData.authorization.agreesProduction) {
      showToast('授权项要全部勾选哦', 'error'); return;
    }
    setIsSubmitting(true);
    showToast('正在制作中...', 'info');
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
      showToast('订单提交成功 ✨', 'success');
      setTimeout(() => navigate('detail'), 500);
    }, 1500);
  };

  const allAuth = orderData.authorization.isSelfOrAuthorized
    && orderData.authorization.isAdult
    && orderData.authorization.agreesProduction;

  return (
    <div className="screen-root" style={{ background: s.bg, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: s.ink }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>

        {/* 顶栏 */}
        <div style={{
          padding: '56px 20px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            width: 38, height: 38,
            borderRadius: '50%',
            background: s.paper,
            border: `1px solid ${s.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(58,46,37,0.06)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{
            fontFamily: s.handwrite,
            fontSize: 24,
            color: s.terracotta,
          }}>PhotoMuse</div>
          <div
            onClick={() => navigate('adminLogin')}
            style={{
              width: 38, height: 38,
              borderRadius: '50%',
              background: s.paper,
              border: `1px solid ${s.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(58,46,37,0.06)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.inkSec} strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
            </svg>
          </div>
        </div>

        {/* Hero — 散落拍立得 */}
        <div style={{ padding: '8px 20px 24px', textAlign: 'center', position: 'relative' }}>
          <div style={{ position: 'relative', height: 220, marginBottom: 12 }}>
            <div style={{ position: 'absolute', left: '12%', top: 14, zIndex: 1, animation: 'float 4s ease-in-out infinite' }}>
              <PolaroidPhoto src={IMG.polaroid} caption="阳光下的你 ♡" rotate={-10} width={108} />
            </div>
            <div style={{ position: 'absolute', right: '10%', top: 0, zIndex: 2, animation: 'float 4.5s ease-in-out 0.5s infinite' }}>
              <PolaroidPhoto src={IMG.idBlue} caption="证件照" rotate={7} width={108} />
            </div>
            <div style={{ position: 'absolute', left: '30%', top: 75, zIndex: 3, animation: 'float 3.8s ease-in-out 1s infinite' }}>
              <PolaroidPhoto src={IMG.idRed} caption="红底也好看" rotate={-3} width={96} />
            </div>
          </div>

          <h1 style={{
            fontFamily: s.serif,
            fontSize: 28,
            fontWeight: 600,
            color: s.ink,
            lineHeight: 1.3,
            marginBottom: 6,
          }}>每一张照片<br />都值得认真对待</h1>
          <p style={{
            fontFamily: s.handwrite,
            fontSize: 18,
            color: s.terracotta,
            marginTop: 4,
          }}>~ AI 帮你一秒出片 ~</p>
        </div>

        {/* 胶带装饰分隔 */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 20px',
          marginBottom: 12,
        }}>
          <div style={{ flex: 1, height: 1, background: s.border, opacity: 0.6 }} />
          <div style={{
            width: 56, height: 16,
            background: s.warmYellow,
            opacity: 0.65,
            margin: '0 14px',
            transform: 'rotate(-2deg)',
            borderRadius: 1,
          }} />
          <div style={{ flex: 1, height: 1, background: s.border, opacity: 0.6 }} />
        </div>

        {/* 套餐选择 */}
        <div style={{ padding: '16px 20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ fontFamily: s.handwrite, fontSize: 20, color: s.terracotta }}>选个套餐</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Pick your package</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {products.map(p => (
              <div
                key={p.id}
                onClick={() => selectProduct(p.id)}
                style={{
                  padding: '20px 20px 20px 22px',
                  background: s.paper,
                  border: `2px solid ${orderData.productId === p.id ? s.terracotta : s.border}`,
                  borderRadius: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: orderData.productId === p.id
                    ? '0 6px 20px rgba(217,118,87,0.2)'
                    : '0 3px 10px rgba(58,46,37,0.05)',
                  transition: 'all 0.25s ease',
                }}
              >
                {orderData.productId === p.id && (
                  <div style={{
                    position: 'absolute',
                    top: -10, left: 18,
                    fontFamily: s.handwrite,
                    fontSize: 14,
                    color: '#fff',
                    background: s.terracotta,
                    padding: '2px 14px',
                    borderRadius: 4,
                    transform: 'rotate(-2deg)',
                    boxShadow: '0 2px 6px rgba(217,118,87,0.3)',
                  }}>
                    我选这个 ✦
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: s.ink, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: s.inkSec }}>{p.desc}</div>
                </div>
                <div style={{
                  fontFamily: s.handwrite,
                  fontSize: 28,
                  color: s.terracotta,
                  fontWeight: 600,
                }}>{p.price}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 风格选择 */}
        <div style={{ padding: '6px 20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ fontFamily: s.handwrite, fontSize: 20, color: s.terracotta }}>喜欢什么风格</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Choose style</div>
          </div>

          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '4px 4px 12px' }}>
            {styles.map((st, i) => (
              <div
                key={st.id}
                onClick={() => selectStyle(st.id)}
                style={{ flexShrink: 0, cursor: 'pointer', position: 'relative' }}
              >
                <div style={{
                  transition: 'all 0.3s ease',
                  transform: orderData.styleId === st.id ? 'translateY(-4px)' : 'none',
                }}>
                  <PolaroidPhoto
                    src={st.img}
                    caption={st.name}
                    rotate={st.rotate}
                    width={80}
                    shadow={orderData.styleId === st.id}
                  />
                </div>
                {orderData.styleId === st.id && (
                  <div style={{
                    position: 'absolute',
                    top: -8, right: -6,
                    width: 24, height: 24,
                    borderRadius: '50%',
                    background: s.terracotta,
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12,
                    boxShadow: '0 3px 8px rgba(217,118,87,0.4)',
                  }}>✓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 表单 */}
        <div style={{ padding: '6px 20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ fontFamily: s.handwrite, fontSize: 20, color: s.terracotta }}>填下信息</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Your info</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="tel"
              placeholder="手机号"
              value={orderData.contactPhone}
              onChange={(e) => setOrderData(prev => ({ ...prev, contactPhone: e.target.value }))}
              style={{
                height: 50,
                padding: '0 18px',
                background: s.paper,
                border: `1px solid ${s.border}`,
                borderRadius: 14,
                fontSize: 14,
                color: s.ink,
                outline: 'none',
                fontFamily: s.body,
                boxShadow: '0 2px 6px rgba(58,46,37,0.04)',
              }}
            />
            <input
              type="password"
              placeholder="查询密码（至少6位）"
              value={orderData.queryPassword}
              onChange={(e) => setOrderData(prev => ({ ...prev, queryPassword: e.target.value }))}
              style={{
                height: 50,
                padding: '0 18px',
                background: s.paper,
                border: `1px solid ${s.border}`,
                borderRadius: 14,
                fontSize: 14,
                color: s.ink,
                outline: 'none',
                fontFamily: s.body,
                boxShadow: '0 2px 6px rgba(58,46,37,0.04)',
              }}
            />
            <textarea
              placeholder="有什么特别要求不？（可选~）"
              value={orderData.customerNote}
              onChange={(e) => setOrderData(prev => ({ ...prev, customerNote: e.target.value }))}
              style={{
                minHeight: 72,
                padding: '14px 18px',
                background: s.paper,
                border: `1px solid ${s.border}`,
                borderRadius: 14,
                fontSize: 14,
                color: s.ink,
                outline: 'none',
                resize: 'none',
                fontFamily: s.body,
                lineHeight: 1.5,
                boxShadow: '0 2px 6px rgba(58,46,37,0.04)',
              }}
            />
          </div>
        </div>

        {/* 上传照片 */}
        <div style={{ padding: '6px 20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ fontFamily: s.handwrite, fontSize: 20, color: s.terracotta }}>上传你的照片</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Drop your pic</div>
            <div style={{
              marginLeft: 'auto',
              fontFamily: s.handwrite,
              fontSize: 14,
              color: s.terracotta,
            }}>{orderData.photos.length}/3</div>
          </div>

          <div style={{
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
            padding: 18,
            background: s.paper,
            borderRadius: 16,
            border: `1px solid ${s.border}`,
            boxShadow: '0 3px 12px rgba(58,46,37,0.05)',
          }}>
            {orderData.photos.map(photo => (
              <div key={photo.id} style={{ position: 'relative', animation: 'fadeInUp 0.3s ease' }}>
                <PolaroidPhoto
                  src={photo.url}
                  caption="本人照片 ✿"
                  rotate={-4}
                  width={82}
                />
                <div
                  onClick={() => removePhoto(photo.id)}
                  style={{
                    position: 'absolute', top: -8, right: -8,
                    width: 26, height: 26,
                    borderRadius: '50%',
                    background: s.terracotta,
                    color: '#fff',
                    fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 600,
                    boxShadow: '0 3px 8px rgba(217,118,87,0.35)',
                    zIndex: 10,
                  }}>×</div>
              </div>
            ))}

            {orderData.photos.length < 3 && (
              <div
                onClick={addPhoto}
                style={{
                  width: 82,
                  background: s.cream,
                  padding: '8px 8px 30px',
                  borderRadius: 2,
                  border: `2px dashed ${s.border}`,
                  boxShadow: '0 2px 8px rgba(58,46,37,0.04)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  transform: 'rotate(3deg)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{
                  width: '100%', aspectRatio: '1/1',
                  background: s.paper,
                  border: `1px dashed ${s.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={s.terracottaLight} strokeWidth="1.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div style={{
                  fontFamily: s.handwrite,
                  fontSize: 13,
                  color: s.inkDim,
                  marginTop: 8,
                  textAlign: 'center',
                }}>再加一张</div>
              </div>
            )}
          </div>
          <div style={{
            marginTop: 12,
            fontSize: 11,
            color: s.inkSec,
            lineHeight: 1.6,
            padding: '10px 14px',
            background: s.terracottaSoft,
            borderRadius: 10,
            opacity: 0.8,
            borderLeft: `3px solid ${s.terracotta}`,
          }}>
            💡 小贴士：上传清晰正脸照，光线均匀效果更好哦
          </div>
        </div>

        {/* 授权 */}
        <div style={{ padding: '6px 20px 22px' }}>
          <div style={{
            background: s.paper,
            borderRadius: 16,
            border: `1px solid ${s.border}`,
            overflow: 'hidden',
            boxShadow: '0 3px 12px rgba(58,46,37,0.05)',
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
                  borderBottom: i < 2 ? `1px dashed ${s.borderSoft}` : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  border: `2px solid ${orderData.authorization[item.field] ? s.terracotta : s.border}`,
                  background: orderData.authorization[item.field] ? s.terracotta : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 12,
                  flexShrink: 0,
                  transition: 'all 0.2s',
                  boxShadow: orderData.authorization[item.field] ? '0 2px 6px rgba(217,118,87,0.3)' : 'none',
                }}>
                  {orderData.authorization[item.field] && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
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
        <div style={{ padding: '0 20px 26px' }}>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              width: '100%',
              height: 58,
              borderRadius: 30,
              background: isSubmitting
                ? s.terracottaLight
                : `linear-gradient(135deg, ${s.terracotta}, ${s.terracottaLight})`,
              border: 'none',
              color: '#fff',
              fontSize: 17,
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8,
              letterSpacing: 1,
              boxShadow: isSubmitting ? 'none' : '0 10px 28px rgba(217,118,87,0.4)',
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
                制作中...
              </>
            ) : (
              <>
                <span>✨ 开始制作 ✨</span>
              </>
            )}
          </button>
          <div style={{
            textAlign: 'center',
            fontFamily: s.handwrite,
            fontSize: 14,
            color: s.inkDim,
            marginTop: 12,
          }}>
            平均 30 秒出片哦 ♡
          </div>
        </div>

        {/* 查询入口 */}
        <div style={{ padding: '0 20px 22px' }}>
          <div
            onClick={() => navigate('detail')}
            style={{
              padding: '16px 20px',
              background: s.paper,
              borderRadius: 14,
              border: `1px solid ${s.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(58,46,37,0.04)',
            }}
          >
            <span style={{ fontSize: 13, color: s.inkSec }}>查询已有订单</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: s.terracotta }}>
              <span style={{ fontFamily: s.handwrite, fontSize: 14 }}>去看看</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </div>
        </div>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ===== 详情页 =====
function PolaroidDetail(props) {
  const { currentOrder, goBack, showToast, setCurrentOrder, navigate } = props;
  const s = PO;
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
    if (retakePhotos.length >= 3) { showToast('最多 3 张哦', 'error'); return; }
    const photos = [IMG.polaroid, IMG.portrait, IMG.idBlue];
    setRetakePhotos(prev => [...prev, { id: Date.now(), url: photos[prev.length % 3] }]);
  };

  const handleSubmitRetake = () => {
    if (retakePhotos.length === 0) { showToast('先上传补拍照片吧', 'error'); return; }
    setIsUploading(true);
    showToast('正在提交补拍...', 'info');
    setTimeout(() => {
      setCurrentOrder(prev => prev ? {
        ...prev, photo_check: 'unchecked', order_status: 'photo_review',
        reference_photo_count: prev.reference_photo_count + retakePhotos.length,
      } : null);
      setRetakePhotos([]);
      setIsUploading(false);
      showToast('补拍已提交，等待审核 ♡', 'success');
    }, 1200);
  };

  const statusText = {
    waiting_photos: '等你上传照片',
    photo_review: '审核中...',
    queued: '排队制作中',
    generating: '正在生成 ✨',
    qc: '质检中',
    delivered: '制作完成啦！',
    cancelled: '已取消',
  };

  return (
    <div className="screen-root" style={{ background: s.bg, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: s.ink }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>

        {/* 顶栏 */}
        <div style={{
          padding: '56px 20px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div
            onClick={goBack}
            style={{
              width: 38, height: 38,
              borderRadius: '50%',
              background: s.paper,
              border: `1px solid ${s.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(58,46,37,0.06)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, color: s.ink }}>订单详情</div>
          <div style={{
            padding: '6px 14px',
            borderRadius: 999,
            background: s.warmYellow,
            fontFamily: s.handwrite,
            fontSize: 14,
            color: s.ink,
            boxShadow: '0 2px 6px rgba(242,201,138,0.4)',
          }}>
            {statusText[order.order_status] || '进行中'}
          </div>
        </div>

        {/* 状态卡 — 便签 */}
        <div style={{ padding: '8px 20px 20px' }}>
          <div style={{
            background: s.paper,
            borderRadius: 20,
            padding: 22,
            border: `1px solid ${s.border}`,
            boxShadow: '0 10px 30px rgba(58,46,37,0.08)',
            position: 'relative',
          }}>
            {/* 胶带 */}
            <div style={{
              position: 'absolute',
              top: -14, left: '50%',
              transform: 'translateX(-50%) rotate(-2deg)',
              width: 90, height: 22,
              background: s.warmYellow,
              opacity: 0.7,
              borderRadius: 1,
            }} />

            <div style={{
              fontFamily: s.serif,
              fontSize: 11,
              color: s.inkDim,
              letterSpacing: 0.5,
              marginBottom: 10,
            }}>
              {order.orderId}
            </div>
            <h2 style={{
              fontFamily: s.handwrite,
              fontSize: 32,
              color: s.terracotta,
              marginBottom: 8,
            }}>
              {order.order_status === 'delivered' ? '做好啦！🎉' :
               needRetake ? '需要补拍一下' :
               order.order_status === 'photo_review' ? '正在审核中...' :
               '努力出片中...'}
            </h2>
            <p style={{ fontSize: 13, color: s.inkSec, lineHeight: 1.7 }}>
              {order.order_status === 'delivered'
                ? '你的照片已经冲印好啦，快往下滑看看吧！'
                : needRetake
                ? '照片有点小问题，重新传一张清晰的就好~'
                : '照片正在魔法厨房中烹饪，稍等一下下 ♨︎'}
            </p>

            {/* 进度条（生成中） */}
            {(order.order_status === 'queued' || order.order_status === 'generating') && (
              <div style={{ marginTop: 18 }}>
                <div style={{
                  height: 10,
                  background: s.cream,
                  borderRadius: 5,
                  overflow: 'hidden',
                  border: `1px solid ${s.border}`,
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${s.terracotta}, ${s.terracottaLight})`,
                    borderRadius: 5,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginTop: 8,
                  fontFamily: s.handwrite, fontSize: 14, color: s.inkDim,
                }}>
                  <span>{progress}% 完成</span>
                  <span>加油鸭 💪</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 补拍区 */}
        {needRetake && (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{
              padding: '16px',
              background: 'rgba(255, 200, 100, 0.2)',
              border: `1px solid ${s.warmYellow}`,
              borderRadius: 14,
              marginBottom: 14,
            }}>
              <div style={{
                fontFamily: s.handwrite,
                fontSize: 18,
                color: s.orange,
                marginBottom: 4,
              }}>⚠ 照片审核没通过</div>
              <div style={{ fontSize: 12, color: s.inkSec, lineHeight: 1.7 }}>
                {order.reviewNote || '光线有点暗，重新上传一张清晰正脸照就好啦~'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ fontFamily: s.handwrite, fontSize: 18, color: s.terracotta }}>补拍上传</div>
              <div style={{ fontSize: 10, color: s.inkDim }}>→ Retry</div>
            </div>

            <div style={{
              display: 'flex', gap: 14,
              padding: 16,
              background: s.paper,
              borderRadius: 16,
              border: `1px solid ${s.border}`,
            }}>
              {retakePhotos.map(p => (
                <div key={p.id} style={{ position: 'relative' }}>
                  <PolaroidPhoto src={p.url} caption="补拍 ✨" rotate={-3} width={76} />
                  <div
                    onClick={() => setRetakePhotos(prev => prev.filter(x => x.id !== p.id))}
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 22, height: 22, borderRadius: '50%',
                      background: s.terracotta,
                      color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 600,
                      boxShadow: '0 2px 6px rgba(217,118,87,0.35)',
                      fontSize: 12,
                      zIndex: 10,
                    }}
                  >×</div>
                </div>
              ))}
              {retakePhotos.length < 3 && (
                <div
                  onClick={handleAddRetake}
                  style={{
                    width: 76,
                    background: s.cream,
                    padding: '6px 6px 26px',
                    borderRadius: 2,
                    border: `2px dashed ${s.border}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 4,
                    cursor: 'pointer',
                    transform: 'rotate(2deg)',
                  }}
                >
                  <div style={{
                    width: '100%', aspectRatio: '1/1',
                    background: s.paper,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px dashed ${s.border}`,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={s.terracottaLight} strokeWidth="1.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <div style={{ fontFamily: s.handwrite, fontSize: 12, color: s.inkDim, marginTop: 6 }}>补传</div>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmitRetake}
              disabled={isUploading}
              style={{
                marginTop: 14,
                width: '100%',
                height: 52,
                borderRadius: 26,
                background: isUploading ? s.terracottaLight : s.terracotta,
                border: 'none',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8,
                boxShadow: isUploading ? 'none' : '0 8px 20px rgba(217,118,87,0.35)',
              }}
            >
              {isUploading ? '提交中...' : '提交补拍照片'}
            </button>
          </div>
        )}

        {/* 订单信息 */}
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ fontFamily: s.handwrite, fontSize: 18, color: s.terracotta }}>订单详情</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Details</div>
          </div>

          <div style={{
            background: s.paper,
            borderRadius: 16,
            border: `1px solid ${s.border}`,
            overflow: 'hidden',
            boxShadow: '0 3px 12px rgba(58,46,37,0.05)',
          }}>
            {[
              { label: '套餐', value: order.productName },
              { label: '风格', value: order.styleName },
              { label: '参考照片', value: `${order.reference_photo_count} 张 🌄` },
              { label: '交付数量', value: `${order.delivery_file_count} 张 📸` },
              { label: '照片审核', value:
                order.photo_check === 'unchecked' ? '未审核' :
                order.photo_check === 'passed' ? '已通过 ✓' :
                order.photo_check === 'need_retake' ? '需补拍' : '已拒绝'
              },
              { label: '价格', value: order.price },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: i < 5 ? `1px dashed ${s.borderSoft}` : 'none',
              }}>
                <span style={{ fontSize: 13, color: s.inkSec }}>{row.label}</span>
                <span style={{
                  fontSize: 13, color: s.ink,
                  fontWeight: i === 5 ? 600 : 400,
                  fontFamily: i === 5 ? s.handwrite : s.body,
                  fontSize: i === 5 ? 18 : 13,
                  color: i === 5 ? s.terracotta : s.ink,
                }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 参考图 */}
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ fontFamily: s.handwrite, fontSize: 18, color: s.terracotta }}>参考照片</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Original</div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            {order.photos?.map(p => (
              <PolaroidPhoto key={p.id} src={p.url} caption="原始" rotate={-3} width={82} />
            ))}
          </div>
        </div>

        {/* 交付区 */}
        <div style={{ padding: '0 20px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ fontFamily: s.handwrite, fontSize: 18, color: s.terracotta }}>成品展示</div>
            <div style={{ fontSize: 10, color: s.inkDim }}>→ Results</div>
          </div>

          {order.order_status === 'delivered' ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'inline-block', animation: 'float 4s ease-in-out infinite' }}>
                <PolaroidPhoto src={IMG.idBlue} caption="成品照 ✨" rotate={2} width={200} />
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              padding: '40px 20px',
              background: s.cream,
              borderRadius: 16,
              border: `1px solid ${s.border}`,
              flexDirection: 'column',
              gap: 12,
            }}>
              <div style={{ fontSize: 36, animation: 'float 2s ease-in-out infinite' }}>⏳</div>
              <div style={{ fontFamily: s.handwrite, fontSize: 18, color: s.ink }}>
                正在显影中...
              </div>
              <div style={{ fontSize: 12, color: s.inkDim }}>
                照片一好会马上通知你哒
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
function PolaroidAdminLogin(props) {
  const { navigate, setIsAdmin, showToast, goBack } = props;
  const s = PO;
  const [password, setPassword] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!password.trim()) { setError('口令不能空哦'); return; }
    setIsChecking(true);
    setError('');
    setTimeout(() => {
      setIsChecking(false);
      setIsAdmin(true);
      showToast('登录成功 ♡', 'success');
      setTimeout(() => navigate('admin'), 400);
    }, 800);
  };

  return (
    <div className="screen-root" style={{ background: s.bg, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: s.ink }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        <div style={{
          padding: '56px 20px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div
            onClick={goBack}
            style={{
              width: 38, height: 38,
              borderRadius: '50%',
              background: s.paper,
              border: `1px solid ${s.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, color: s.ink }}>管理登录</div>
          <div style={{ width: 38 }} />
        </div>

        <div style={{ padding: '32px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              width: 80, height: 80,
              borderRadius: 20,
              background: s.terracottaSoft,
              border: `2px solid ${s.terracotta}`,
              margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'rotate(-5deg)',
              boxShadow: '0 8px 20px rgba(217,118,87,0.2)',
            }}>
              <span style={{ fontSize: 36 }}>📸</span>
            </div>
            <div style={{
              fontFamily: s.handwrite,
              fontSize: 20,
              color: s.terracotta,
              marginBottom: 6,
            }}>PhotoMuse Admin</div>
            <h2 style={{
              fontFamily: s.serif,
              fontSize: 22,
              fontWeight: 600,
              color: s.ink,
              marginBottom: 8,
            }}>影楼运营后台</h2>
            <p style={{ fontSize: 13, color: s.inkSec, lineHeight: 1.6 }}>
              输入管理口令进入后台
            </p>
          </div>

          {/* 权限列表 */}
          <div style={{
            background: s.paper,
            borderRadius: 16,
            border: `1px solid ${s.border}`,
            padding: '18px',
            marginBottom: 24,
            boxShadow: '0 3px 12px rgba(58,46,37,0.05)',
          }}>
            <div style={{
              fontFamily: s.handwrite,
              fontSize: 16,
              color: s.terracotta,
              marginBottom: 12,
            }}>可以做的事：</div>
            {[
              '审核订单和照片质量',
              '派发补拍和拒绝订单',
              '上传交付的成品图',
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center',
                padding: '6px 0',
                fontSize: 13,
                color: s.inkSec,
              }}>
                <span style={{ marginRight: 10 }}>✓</span>
                {item}
              </div>
            ))}
          </div>

          {/* 密码输入 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: s.handwrite,
              fontSize: 16,
              color: s.terracotta,
              marginBottom: 8,
            }}>管理口令 🔐</div>
            <input
              type="password"
              placeholder="请输入管理口令"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%',
                height: 54,
                padding: '0 18px',
                background: s.paper,
                border: `1px solid ${error ? s.red : s.border}`,
                borderRadius: 14,
                fontSize: 15,
                color: s.ink,
                outline: 'none',
                fontFamily: s.body,
                boxShadow: '0 2px 8px rgba(58,46,37,0.04)',
              }}
            />
            {error && (
              <div style={{
                marginTop: 10,
                fontSize: 12,
                color: s.red,
                padding: '8px 12px',
                background: 'rgba(201,90,74,0.1)',
                borderRadius: 10,
              }}>{error}</div>
            )}
          </div>

          <button
            onClick={handleLogin}
            disabled={isChecking}
            style={{
              width: '100%',
              height: 54,
              borderRadius: 27,
              background: isChecking
                ? s.terracottaLight
                : `linear-gradient(135deg, ${s.terracotta}, ${s.terracottaLight})`,
              border: 'none',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: isChecking ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8,
              boxShadow: isChecking ? 'none' : '0 10px 28px rgba(217,118,87,0.35)',
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
            ) : '进入后台 ✨'}
          </button>

          <div style={{
            textAlign: 'center',
            marginTop: 16,
            fontFamily: s.handwrite,
            fontSize: 13,
            color: s.inkDim,
          }}>
            演示模式：随便输都能进~
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 管理后台 =====
function PolaroidAdmin(props) {
  const { adminTab, setAdminTab, goBack, showToast, setIsAdmin, setCurrentOrder, navigate } = props;
  const s = PO;
  const [orders, setOrders] = useState([
    { id: 1, orderId: 'AIStudio-201', product: '证件照体验版', style: '蓝底正装', status: 'photo_review', photoCheck: 'unchecked', photos: [IMG.cinematic], price: '¥3.9', urgent: false },
    { id: 2, orderId: 'AIStudio-202', product: '简历形象照', style: '白底简约', status: 'photo_review', photoCheck: 'unchecked', photos: [IMG.polaroid], price: '¥29.9', urgent: true },
    { id: 3, orderId: 'AIStudio-203', product: '证件照体验版', style: '红底经典', status: 'photo_review', photoCheck: 'unchecked', photos: [IMG.idRed], price: '¥3.9', urgent: false },
  ]);
  const [actionId, setActionId] = useState(null);

  const statusOptions = [
    { value: 'photo_review', label: '待审核', count: 3 },
    { value: 'queued', label: '队列中', count: 5 },
    { value: 'generating', label: '生成中', count: 2 },
    { value: 'delivered', label: '已交付' },
    { value: 'waiting_photos', label: '补拍中' },
    { value: 'cancelled', label: '已取消' },
  ];

  const handleReview = (id, action) => {
    setActionId(id);
    const labels = { pass: '通过啦 ✓', need_retake: '要求补拍', reject: '已拒单' };
    showToast(labels[action], 'info');
    setTimeout(() => {
      setOrders(prev => prev.filter(o => o.id !== id));
      showToast('操作成功 ♡', 'success');
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
          padding: '56px 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div
            onClick={handleLogout}
            style={{
              width: 38, height: 38,
              borderRadius: '50%',
              background: s.paper,
              border: `1px solid ${s.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.ink} strokeWidth="1.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: s.ink }}>订单管理</div>
            <div style={{ fontFamily: s.handwrite, fontSize: 14, color: s.terracotta, marginTop: 1 }}>~ Admin Console ~</div>
          </div>
          <div
            onClick={handleLogout}
            style={{
              fontSize: 14, color: s.red,
              fontFamily: s.handwrite,
              cursor: 'pointer',
            }}
          >退出</div>
        </div>

        {/* 统计 */}
        <div style={{ padding: '4px 20px 16px' }}>
          <div style={{
            display: 'flex', gap: 10,
          }}>
            {[
              { label: '待审核', value: 3, color: s.terracotta, emoji: '📷' },
              { label: '生成中', value: 5, color: s.orange, emoji: '✨' },
              { label: '今日交付', value: 12, color: s.green, emoji: '🎉' },
            ].map((stat, i) => (
              <div key={i} style={{
                flex: 1,
                padding: '16px 12px',
                background: s.paper,
                borderRadius: 16,
                border: `1px solid ${s.border}`,
                textAlign: 'center',
                boxShadow: '0 3px 10px rgba(58,46,37,0.05)',
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.emoji}</div>
                <div style={{
                  fontFamily: s.handwrite,
                  fontSize: 24, fontWeight: 600,
                  color: stat.color,
                  marginBottom: 2,
                }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: s.inkDim }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 状态 Tabs */}
        <div style={{
          padding: '0 20px 16px',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
        }}>
          {statusOptions.map(tab => (
            <div
              key={tab.value}
              onClick={() => setAdminTab(tab.value)}
              style={{
                flexShrink: 0,
                padding: '9px 16px',
                fontSize: 13,
                borderRadius: 999,
                background: adminTab === tab.value ? s.terracotta : s.paper,
                border: `1px solid ${adminTab === tab.value ? s.terracotta : s.border}`,
                color: adminTab === tab.value ? '#fff' : s.inkSec,
                fontWeight: adminTab === tab.value ? 500 : 400,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: adminTab === tab.value ? '0 4px 14px rgba(217,118,87,0.3)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
              {tab.count && (
                <span style={{
                  fontSize: 11,
                  background: adminTab === tab.value ? 'rgba(255,255,255,0.25)' : s.terracottaSoft,
                  color: adminTab === tab.value ? '#fff' : s.terracotta,
                  padding: '1px 8px',
                  borderRadius: 999,
                  fontWeight: 600,
                }}>{tab.count}</span>
              )}
            </div>
          ))}
        </div>

        {/* 订单列表 */}
        <div style={{ padding: '4px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orders.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12, animation: 'float 3s ease-in-out infinite' }}>🎉</div>
              <div style={{ fontFamily: s.handwrite, fontSize: 18, color: s.ink, marginBottom: 4 }}>全部处理完啦</div>
              <div style={{ fontSize: 12, color: s.inkDim }}>这个状态下没有订单</div>
            </div>
          ) : (
            orders.map(order => (
              <div
                key={order.id}
                onClick={() => openOrder(order)}
                style={{
                  background: s.paper,
                  borderRadius: 18,
                  padding: 18,
                  border: `1px solid ${s.border}`,
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: '0 4px 14px rgba(58,46,37,0.06)',
                  transition: 'all 0.2s',
                }}
              >
                {order.urgent && (
                  <div style={{
                    position: 'absolute',
                    top: -10, right: 20,
                    fontFamily: s.handwrite,
                    fontSize: 13,
                    color: '#fff',
                    background: s.terracotta,
                    padding: '2px 12px',
                    borderRadius: 6,
                    transform: 'rotate(3deg)',
                    boxShadow: '0 2px 6px rgba(217,118,87,0.3)',
                  }}>加急 ★</div>
                )}

                {/* 订单头 */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 14,
                }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: s.ink, marginBottom: 3 }}>
                      {order.product} · {order.style}
                    </div>
                    <div style={{
                      fontFamily: s.serif,
                      fontSize: 11, color: s.inkDim,
                      letterSpacing: 0.3,
                    }}>
                      {order.orderId}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: s.handwrite,
                    fontSize: 14,
                    color: s.terracotta,
                    background: s.terracottaSoft,
                    padding: '4px 12px',
                    borderRadius: 999,
                  }}>待审核</div>
                </div>

                {/* 参考图小拍立得 */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  {order.photos.map((url, i) => (
                    <PolaroidPhoto key={i} src={url} caption="" rotate={-3} width={56} shadow={false} />
                  ))}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                    <div style={{ fontSize: 12, color: s.inkSec }}>照片审核：待检查</div>
                    <div style={{ fontSize: 12, color: s.inkSec }}>参考照片：{order.photos.length} 张</div>
                    <div style={{
                      fontFamily: s.handwrite,
                      fontSize: 18,
                      color: s.terracotta,
                      marginTop: 2,
                    }}>{order.price}</div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { label: '✓ 通过', color: s.green, bg: 'rgba(107,158,107,0.15)', action: 'pass' },
                    { label: '↻ 重拍', color: s.orange, bg: 'rgba(226,139,94,0.15)', action: 'need_retake' },
                    { label: '✕ 拒单', color: s.red, bg: 'rgba(201,90,74,0.15)', action: 'reject' },
                  ].map((btn, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); handleReview(order.id, btn.action); }}
                      disabled={actionId === order.id}
                      style={{
                        flex: 1,
                        height: 40,
                        borderRadius: 12,
                        background: btn.bg,
                        border: 'none',
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
                    onClick={(e) => { e.stopPropagation(); showToast('选择交付图片~', 'info'); }}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 12,
                      background: s.terracotta,
                      border: 'none',
                      color: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 500,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >📦 交付</button>
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
  PolaroidIndex,
  PolaroidDetail,
  PolaroidAdmin,
  PolaroidAdminLogin,
});
