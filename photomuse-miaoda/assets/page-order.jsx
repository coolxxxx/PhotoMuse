/* ============================================================
 * 在线下单页
 * ============================================================ */

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const OK_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function OrderPage({ showToast }) {
  const [productId, setProductId] = React.useState(PRODUCTS[2].productId);
  const [styleId, setStyleId] = React.useState(STYLES[0].styleId);
  const [selectedThemes, setSelectedThemes] = React.useState(['guofeng']);
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [sceneDesc, setSceneDesc] = React.useState('');
  const [files, setFiles] = React.useState([]);
  const [authChecks, setAuthChecks] = React.useState([false, false, false]);
  const [submitting, setSubmitting] = React.useState(false);
  const [successOrder, setSuccessOrder] = React.useState(null);
  const [analysis, setAnalysis] = React.useState(null);
  const [aiAnalyzing, setAiAnalyzing] = React.useState(false);

  const fileInputRef = React.useRef(null);
  const aiInputRef = React.useRef(null);

  const currentProduct = PRODUCTS.find((p) => p.productId === productId) || PRODUCTS[0];
  const isPortrait = currentProduct.productType === 'portrait';

  // 主题切换
  const toggleTheme = (id) => {
    const pos = selectedThemes.indexOf(id);
    if (pos >= 0) {
      setSelectedThemes(selectedThemes.filter((t) => t !== id));
    } else if (selectedThemes.length >= PRICING.maxThemes) {
      showToast('最多选择 ' + PRICING.maxThemes + ' 个主题', 'error');
    } else {
      setSelectedThemes([...selectedThemes, id]);
    }
  };

  // 价格计算
  const count = selectedThemes.length;
  const extraCount = Math.max(0, count - 1);
  const total = count > 0 ? PRICING.baseThemePrice + extraCount * PRICING.extraThemePrice : 0;

  let priceDetail;
  if (count === 0) {
    priceDetail = '基础 1 主题 ¥' + fmtPrice(PRICING.baseThemePrice) + '，每加 1 主题 +¥' + fmtPrice(PRICING.extraThemePrice);
  } else if (count === 1) {
    priceDetail = '基础 1 主题 ¥' + fmtPrice(PRICING.baseThemePrice);
  } else {
    priceDetail = '基础 1 主题 ¥' + fmtPrice(PRICING.baseThemePrice) + ' + ' + extraCount + ' 主题 ×¥' + fmtPrice(PRICING.extraThemePrice);
  }

  // 照片上传
  const handleFiles = (fileList) => {
    const newFiles = [...files];
    let rejected = '';
    Array.from(fileList).forEach((f) => {
      if (newFiles.length >= MAX_PHOTOS) { rejected = '最多上传 ' + MAX_PHOTOS + ' 张照片'; return; }
      const typeOk = OK_MIME_TYPES.indexOf(f.type) >= 0 || /\.(jpe?g|png|webp)$/i.test(f.name || '');
      if (!typeOk) { rejected = '「' + f.name + '」格式不支持，仅支持 jpg/png/webp'; return; }
      if (f.size > MAX_PHOTO_BYTES) { rejected = '「' + f.name + '」超过 10MB 限制'; return; }
      newFiles.push(f);
    });
    if (rejected) showToast(rejected, 'error');
    setFiles(newFiles);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // AI 分析（模拟）
  const handleAiAnalyze = () => {
    if (aiAnalyzing) return;
    aiInputRef.current && aiInputRef.current.click();
  };

  const handleAiFile = (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    setAiAnalyzing(true);
    showToast('AI 分析中，约需 10 秒…', 'success');

    setTimeout(() => {
      const themes = ['guofeng', 'family', 'casual', 'travel', 'sports'];
      const scores = themes.map((tid, i) => {
        const theme = PORTRAIT_THEMES.find((t) => t.themeId === tid);
        const score = 92 - i * 7 - Math.floor(Math.random() * 5);
        return {
          themeId: tid,
          themeName: theme.name,
          score: score,
          reason: [
            '面部轮廓与光影层次适合此主题的表现形式，成片还原度高',
            '气质匹配度较高，搭配场景色调能呈现理想氛围',
            '可尝试此主题，建议补充场景描述以获得更精准的效果',
            '整体适配度一般，若偏好此风格可在场景描述中注明',
            '与照片气质的匹配度较低，不太推荐'
          ][Math.min(4, Math.floor(i / 1.2))]
        };
      });
      setAnalysis({
        summary: 'AI 已完成照片分析。照片光线充足、构图端正，整体气质适合表现温婉与亲切感强的主题，以下为各主题适配度评分。',
        scores: scores
      });
      setAiAnalyzing(false);
      showToast('AI 分析完成', 'success');
    }, 1500);
  };

  const applyRecommend = () => {
    const ids = analysis.scores.slice(0, 2).map((s) => s.themeId);
    setSelectedThemes(ids);
    showToast('已勾选 ' + ids.length + ' 个推荐主题', 'success');
  };

  // 提交
  const handleSubmit = () => {
    if (isPortrait && !selectedThemes.length) {
      showToast('请至少选择 1 个写真主题', 'error'); return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      showToast('请填写正确的 11 位手机号', 'error'); return;
    }
    if (password.length < 6 || password.length > 32) {
      showToast('查询密码需 6-32 位', 'error'); return;
    }
    if (!(authChecks[0] && authChecks[1] && authChecks[2])) {
      showToast('请勾选全部 3 项授权确认', 'error'); return;
    }
    if (!files.length) {
      showToast('请至少上传 1 张照片', 'error'); return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSuccessOrder({
        orderId: generateOrderId(),
        productName: currentProduct.name,
        themes: isPortrait ? selectedThemes : null,
        styleId: !isPortrait ? styleId : null,
        phone: phone,
        total: isPortrait ? total : currentProduct.price,
        photos: files.length,
        createdAt: new Date().toLocaleString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        })
      });
    }, 1800);
  };

  // 成功页
  if (successOrder) {
    return React.createElement(React.Fragment, null,
      React.createElement(Hero, {
        compact: true,
        eyebrow: 'ORDER CREATED',
        title: '下单成功',
        sub: '订单已进入制作队列 · 成片一般 1-3 个工作日内交付'
      }),
      React.createElement('main', { className: 'page page-single' },
        React.createElement('section', { className: 'card success-page-card' },
          React.createElement('div', { className: 'success-view' },
            React.createElement('div', { className: 'success-icon' }, '✓'),
            React.createElement('h2', { className: 'success-title' }, '订单已提交'),
            React.createElement('p', { className: 'success-text' },
              '你的照片已交给暗房。我们会在成片完成后通过短信通知你，凭下方订单号随时查询进度。'
            ),
            React.createElement('div', { className: 'order-id-display' }, successOrder.orderId)
          ),
          React.createElement('dl', { className: 'kv' },
            React.createElement('div', { className: 'kv-row' },
              React.createElement('dt', null, '套餐'),
              React.createElement('dd', null, successOrder.productName)
            ),
            successOrder.themes && React.createElement('div', { className: 'kv-row' },
              React.createElement('dt', null, '写真主题'),
              React.createElement('dd', null,
                successOrder.themes.map((tid) => {
                  const t = PORTRAIT_THEMES.find((x) => x.themeId === tid);
                  return t ? t.name : tid;
                }).join(' · ')
              )
            ),
            !successOrder.themes && successOrder.styleId && React.createElement('div', { className: 'kv-row' },
              React.createElement('dt', null, '照片风格'),
              React.createElement('dd', null,
                (STYLES.find((s) => s.styleId === successOrder.styleId) || {}).name || ''
              )
            ),
            React.createElement('div', { className: 'kv-row' },
              React.createElement('dt', null, '上传照片'),
              React.createElement('dd', null, successOrder.photos + ' 张')
            ),
            React.createElement('div', { className: 'kv-row' },
              React.createElement('dt', null, '下单时间'),
              React.createElement('dd', null, successOrder.createdAt)
            ),
            React.createElement('div', { className: 'kv-row' },
              React.createElement('dt', null, '订单金额'),
              React.createElement('dd', null, '¥' + fmtPrice(successOrder.total))
            )
          ),
          React.createElement('div', { className: 'actions' },
            React.createElement('button', {
              className: 'btn',
              onClick: () => { setSuccessOrder(null); window.scrollTo(0, 0); }
            }, '再下一单'),
            React.createElement('button', {
              className: 'btn btn-outline',
              onClick: () => {
                setSuccessOrder(null);
                window.__navigateTo && window.__navigateTo('query');
              }
            }, '去订单查询')
          ),
          React.createElement('p', { className: 'muted small center', style: { marginTop: '12px' } },
            '请妥善保管订单号 · 凭「订单号 + 手机号 + 查询密码」可随时查询订单'
          )
        )
      )
    );
  }

  return React.createElement(React.Fragment, null,
    React.createElement(Hero, {
      eyebrow: 'SHALLOW FOCUS STUDIO — No.01',
      title: '浅焦·映像',
      sub: '不用出门的影楼 · 上传一张照片，收获整套专业形象',
      showPhotos: true
    }),
    React.createElement('main', { className: 'page' },
      React.createElement('div', { className: 'grid-col grid-col-a' },
        // 01 选择套餐
        React.createElement('section', { className: 'card reveal-card' },
          React.createElement('div', { className: 'pm-sec-head' },
            React.createElement('span', { className: 'pm-sec-mark' }, '№'),
            React.createElement('span', { className: 'pm-sec-no' }, '01'),
            React.createElement('h2', { className: 'pm-sec-title' }, '选择套餐'),
            React.createElement('span', { className: 'pm-sec-line' })
          ),
          React.createElement('div', { className: 'product-list' },
            PRODUCTS.map((p, i) =>
              React.createElement('label', {
                key: p.productId,
                className: 'product-card reveal-fade delay-' + ((i % 4) + 1) +
                  (productId === p.productId ? ' selected' : '')
              },
                React.createElement('input', {
                  type: 'radio', name: 'product', value: p.productId,
                  checked: productId === p.productId,
                  onChange: () => setProductId(p.productId),
                  hidden: true
                }),
                React.createElement('div', { className: 'product-head' },
                  React.createElement('span', { className: 'product-name' }, p.name),
                  React.createElement('span', { className: 'product-price' }, priceText(p.price))
                ),
                React.createElement('p', { className: 'product-desc' }, p.description),
                React.createElement('div', { className: 'tag-row' },
                  React.createElement('span', { className: 'tag' }, '交付 ' + p.deliveryCount + ' 张'),
                  p.productType === 'portrait'
                    ? React.createElement('span', { className: 'tag tag-gold' }, 'AI 写真')
                    : null
                )
              )
            )
          )
        ),

        // 02A 写真主题选择
        isPortrait && React.createElement('section', { className: 'card reveal-card delay-1' },
          React.createElement('div', { className: 'pm-sec-head' },
            React.createElement('span', { className: 'pm-sec-mark' }, '№'),
            React.createElement('span', { className: 'pm-sec-no' }, '02'),
            React.createElement('h2', { className: 'pm-sec-title' }, '选择写真主题（可多选）'),
            React.createElement('span', { className: 'badge badge-gold pm-sec-badge' }, '已选 ' + count + ' / ' + PRICING.maxThemes),
            React.createElement('span', { className: 'pm-sec-line' })
          ),
          React.createElement('div', { className: 'theme-list' },
            PORTRAIT_THEMES.map((t, i) =>
              React.createElement('div', {
                key: t.themeId,
                className: 'theme-block reveal-fade delay-' + ((i % 6) + 1) +
                  (selectedThemes.indexOf(t.themeId) >= 0 ? ' selected' : '')
              },
                React.createElement('button', {
                  type: 'button', className: 'theme-chip',
                  onClick: () => toggleTheme(t.themeId)
                },
                  React.createElement('span', { className: 'theme-name-row' },
                    React.createElement('span', { className: 'theme-name' }, t.name),
                    React.createElement('span', { className: 'theme-check' },
                      selectedThemes.indexOf(t.themeId) >= 0 ? '✓' : '+'
                    )
                  ),
                  React.createElement('span', { className: 'theme-desc' }, t.desc)
                ),
                React.createElement('div', { className: 'sample-slot' },
                  React.createElement('div', { className: 'sample-scroll' },
                    React.createElement('div', { className: 'sample-row' },
                      t.samples.map((s, si) =>
                        React.createElement('div', {
                          key: si, className: 'sample-card',
                          onClick: () => showToast('样张大图请访问线上版本查看', 'success')
                        },
                          React.createElement('img', {
                            className: 'sample-image',
                            src: s.img, alt: s.caption, loading: 'lazy'
                          }),
                          React.createElement('span', { className: 'sample-caption' }, s.caption)
                        )
                      )
                    )
                  )
                )
              )
            )
          ),

          // 价格条
          React.createElement('div', { className: 'price-bar' },
            React.createElement('div', { className: 'price-info' },
              React.createElement('div', { className: 'price-detail' }, priceDetail),
              React.createElement('div', { className: 'price-count' }, '已选 ' + count + ' / ' + PRICING.maxThemes + ' 个主题')
            ),
            React.createElement('div', { className: 'price-total' },
              React.createElement('div', { className: 'price-amount' },
                count > 0 ? '¥' + fmtPrice(total) : '¥' + fmtPrice(PRICING.baseThemePrice) + ' 起'
              ),
              React.createElement('div', { className: 'price-photos' },
                count > 0 ? count * PRICING.photosPerTheme + ' 张成片' : '每主题 ' + PRICING.photosPerTheme + ' 张'
              )
            )
          ),

          // AI 推荐
          React.createElement('div', { className: 'ai-analyze-wrap' },
            React.createElement('button', {
              type: 'button', className: 'btn btn-ai',
              disabled: aiAnalyzing,
              onClick: handleAiAnalyze
            }, aiAnalyzing ? 'AI 分析中…' : 'AI 帮我选主题'),
            React.createElement('input', {
              ref: aiInputRef, type: 'file',
              accept: 'image/jpeg,image/png,image/webp',
              hidden: true, onChange: handleAiFile
            }),
            React.createElement('p', { className: 'muted small', style: { color: 'var(--dr-ink-3)' } },
              '选一张正脸照，AI 分析气质并推荐最合适的写真主题（约需 10 秒，分析用图不进入订单）。'
            )
          ),
          analysis && React.createElement('div', { className: 'analysis-panel' },
            React.createElement('div', { className: 'card-head' },
              React.createElement('h2', null, 'AI 主题推荐')
            ),
            React.createElement('div', { className: 'analysis-summary' }, analysis.summary),
            analysis.scores.map((item, i) =>
              React.createElement('div', { key: item.themeId, className: 'score-row' },
                React.createElement('div', { className: 'score-head' },
                  React.createElement('span', { className: 'score-name' }, item.themeName),
                  i < 2 ? React.createElement('span', { className: 'recommend-badge' }, '推荐') : null,
                  React.createElement('span', { className: 'score-value' }, item.score + ' 分')
                ),
                React.createElement('div', { className: 'score-track' },
                  React.createElement('div', { className: 'score-fill', style: { width: item.score + '%' } })
                ),
                React.createElement('div', { className: 'score-reason' }, item.reason)
              )
            ),
            React.createElement('button', {
              type: 'button', className: 'btn btn-outline btn-sm',
              style: { width: '100%', minHeight: '44px', marginTop: '4px' },
              onClick: applyRecommend
            }, '采用推荐')
          ),

          // 场景描述
          React.createElement('label', { className: 'field', style: { marginTop: '14px' } },
            React.createElement('span', { className: 'field-label' }, '场景描述（选填）'),
            React.createElement('textarea', {
              rows: 3, maxLength: 200,
              placeholder: '想要的效果、服装道具、背景氛围…',
              value: sceneDesc,
              onChange: (e) => setSceneDesc(e.target.value)
            })
          )
        ),

        // 02B 照片风格选择
        !isPortrait && React.createElement('section', { className: 'card reveal-card delay-1' },
          React.createElement('div', { className: 'pm-sec-head' },
            React.createElement('span', { className: 'pm-sec-mark' }, '№'),
            React.createElement('span', { className: 'pm-sec-no' }, '02'),
            React.createElement('h2', { className: 'pm-sec-title' }, '选择照片风格'),
            React.createElement('span', { className: 'pm-sec-line' })
          ),
          React.createElement('div', { className: 'option-list' },
            STYLES.map((s, i) =>
              React.createElement('label', {
                key: s.styleId,
                className: 'option-card reveal-fade delay-' + ((i % 4) + 1) +
                  (styleId === s.styleId ? ' selected' : '')
              },
                React.createElement('input', {
                  type: 'radio', name: 'style', value: s.styleId,
                  checked: styleId === s.styleId,
                  onChange: () => setStyleId(s.styleId),
                  hidden: true
                }),
                React.createElement('div', { className: 'option-name' }, s.name),
                React.createElement('p', { className: 'option-desc' }, s.notes)
              )
            )
          )
        )
      ),

      React.createElement('div', { className: 'grid-col grid-col-b' },
        // 03 联系方式
        React.createElement('section', { className: 'card reveal-card delay-2' },
          React.createElement('div', { className: 'pm-sec-head' },
            React.createElement('span', { className: 'pm-sec-mark' }, '№'),
            React.createElement('span', { className: 'pm-sec-no' }, '03'),
            React.createElement('h2', { className: 'pm-sec-title' }, '联系方式与查询密码'),
            React.createElement('span', { className: 'pm-sec-line' })
          ),
          React.createElement('label', { className: 'field' },
            React.createElement('span', { className: 'field-label' }, '手机号'),
            React.createElement('input', {
              type: 'tel', maxLength: 11, inputMode: 'numeric',
              placeholder: '用于订单联系与查询',
              value: phone,
              onChange: (e) => setPhone(e.target.value)
            })
          ),
          React.createElement('label', { className: 'field' },
            React.createElement('span', { className: 'field-label' }, '查询密码（6-32 位）'),
            React.createElement('input', {
              type: 'text', maxLength: 32,
              placeholder: '与订单号、手机号一起用于查询订单',
              value: password,
              onChange: (e) => setPassword(e.target.value)
            })
          ),
          React.createElement('p', { className: 'muted small', style: { color: 'var(--dr-ink-3)' } },
            '查询密码仅保存哈希，请牢记；凭「订单号 + 手机号 + 查询密码」可在任意设备查询订单与选片。'
          )
        ),

        // 04 上传照片
        React.createElement('section', { className: 'card reveal-card delay-3' },
          React.createElement('div', { className: 'pm-sec-head' },
            React.createElement('span', { className: 'pm-sec-mark' }, '№'),
            React.createElement('span', { className: 'pm-sec-no' }, '04'),
            React.createElement('h2', { className: 'pm-sec-title' }, '上传照片'),
            React.createElement('span', { className: 'badge badge-gray pm-sec-badge' }, '最多 ' + MAX_PHOTOS + ' 张'),
            React.createElement('span', { className: 'pm-sec-line' })
          ),
          React.createElement('label', { className: 'file-label' },
            '点击选择照片',
            React.createElement('input', {
              ref: fileInputRef, type: 'file',
              accept: 'image/*', multiple: true, hidden: true,
              onChange: (e) => { handleFiles(e.target.files); e.target.value = ''; }
            })
          ),
          files.length > 0 && React.createElement('div', { className: 'photo-preview-list' },
            files.map((f, i) =>
              React.createElement('div', { key: i, className: 'photo-item' },
                React.createElement('img', { src: URL.createObjectURL(f), alt: '照片预览' }),
                React.createElement('button', {
                  type: 'button', className: 'photo-remove',
                  onClick: () => removeFile(i), 'aria-label': '删除'
                }, '×'),
                React.createElement('div', { className: 'photo-meta' }, f.name + ' · ' + fmtSize(f.size))
              )
            )
          ),
          React.createElement('p', { className: 'muted small', style: { color: 'var(--dr-ink-3)' } },
            '最多 3 张，每张不超过 10MB，支持 jpg / png / webp。请上传清晰正脸照：光线充足、脸部无遮挡、不要多人合照。'
          )
        ),

        // 05 授权确认
        React.createElement('section', { className: 'card reveal-card delay-4' },
          React.createElement('div', { className: 'pm-sec-head' },
            React.createElement('span', { className: 'pm-sec-mark' }, '№'),
            React.createElement('span', { className: 'pm-sec-no' }, '05'),
            React.createElement('h2', { className: 'pm-sec-title' }, '授权确认'),
            React.createElement('span', { className: 'pm-sec-line' })
          ),
          React.createElement('div', { className: 'auth-list' },
            ['我确认提交的照片为本人照片，或已获得照片中人物的明确授权。',
             '我确认照片中人物已满 18 周岁。',
             '我授权商家将这些照片用于本次证件照成片制作。'
            ].map((text, i) =>
              React.createElement('label', { key: i, className: 'auth-item' },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: authChecks[i],
                  onChange: () => {
                    const next = [...authChecks];
                    next[i] = !next[i];
                    setAuthChecks(next);
                  }
                }),
                React.createElement('span', null, text)
              )
            )
          )
        )
      ),

      // 提交按钮
      React.createElement('button', {
        className: 'btn reveal-card delay-5',
        disabled: submitting,
        onClick: handleSubmit
      }, submitting ? '提交中…' : '提交订单'),

      React.createElement('p', { className: 'muted small center reveal delay-6' },
        '提交即表示同意以上授权 · 成片一般 1-3 个工作日内交付'
      )
    ),
    React.createElement(Loading, { show: submitting, text: '正在创建订单…' })
  );
}

Object.assign(window, { OrderPage });
