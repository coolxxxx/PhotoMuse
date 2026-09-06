/* ============================================================
 * 订单查询页
 * ============================================================ */

function QueryPage({ showToast }) {
  const [orderId, setOrderId] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [queried, setQueried] = React.useState(false);
  const [querying, setQuerying] = React.useState(false);

  const handleQuery = (e) => {
    e.preventDefault();
    if (!orderId) { showToast('请输入订单号', 'error'); return; }
    if (!/^1[3-9]\d{9}$/.test(phone)) { showToast('请填写正确的 11 位手机号', 'error'); return; }
    if (password.length < 6) { showToast('查询密码需 6-32 位', 'error'); return; }

    setQuerying(true);
    setTimeout(() => {
      setQuerying(false);
      setQueried(true);
      showToast('订单查询成功', 'success');
    }, 1200);
  };

  const handleRefresh = () => {
    showToast('订单最新状态：制作中', 'success');
  };

  const themeNames = (ids) => ids.map((tid) => {
    const t = PORTRAIT_THEMES.find((x) => x.themeId === tid);
    return t ? t.name : tid;
  }).join(' · ');

  const OrderDetail = () => {
    const order = MOCK_ORDER;

    return React.createElement('section', { className: 'card reveal-card' },
      React.createElement('div', { className: 'order-status-banner' },
        React.createElement('p', { className: 'order-status-label' }, '订单状态'),
        React.createElement('p', { className: 'order-status-text' }, order.statusText)
      ),
      React.createElement('dl', { className: 'kv' },
        React.createElement('div', { className: 'kv-row' },
          React.createElement('dt', null, '订单号'),
          React.createElement('dd', { className: 'mono' }, order.orderId)
        ),
        React.createElement('div', { className: 'kv-row' },
          React.createElement('dt', null, '套餐'),
          React.createElement('dd', null, order.productName)
        ),
        React.createElement('div', { className: 'kv-row' },
          React.createElement('dt', null, '写真主题'),
          React.createElement('dd', null, themeNames(order.themes))
        ),
        React.createElement('div', { className: 'kv-row' },
          React.createElement('dt', null, '下单时间'),
          React.createElement('dd', null, order.createdAt)
        ),
        React.createElement('div', { className: 'kv-row' },
          React.createElement('dt', null, '联系手机'),
          React.createElement('dd', null, order.contactPhone)
        ),
        React.createElement('div', { className: 'kv-row' },
          React.createElement('dt', null, '订单金额'),
          React.createElement('dd', null, '¥' + fmtPrice(order.totalAmount))
        )
      ),

      // 分主题成片展示
      React.createElement('div', { style: { marginTop: '18px' } },
        React.createElement('div', { className: 'pm-sec-head' },
          React.createElement('span', { className: 'pm-sec-mark' }, '№'),
          React.createElement('span', { className: 'pm-sec-no' }, 'SAMPLE'),
          React.createElement('h2', { className: 'pm-sec-title' }, '成片预览'),
          React.createElement('span', { className: 'pm-sec-line' })
        ),
        order.themes.map((tid, ti) => {
          const theme = PORTRAIT_THEMES.find((t) => t.themeId === tid);
          const samples = order.samples[tid] || [];
          const selectedCount = samples.filter((s) => s.selected).length;

          return React.createElement('div', {
            key: tid,
            className: 'reveal-fade delay-' + (ti + 1),
            style: {
              marginTop: '12px',
              paddingBottom: '14px',
              borderBottom: '1px solid var(--dr-hairline)'
            }
          },
            React.createElement('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px'
              }
            },
              React.createElement('span', {
                style: {
                  fontWeight: 700,
                  fontSize: '14px',
                  color: 'var(--dr-ink)'
                }
              }, theme ? theme.name : tid),
              React.createElement('span', { className: 'badge badge-gold' },
                '已选 ' + selectedCount + ' / ' + samples.length
              )
            ),
            React.createElement('div', { className: 'photo-grid' },
              samples.map((s, si) =>
                React.createElement('div', {
                  key: s.id,
                  className: 'grid-photo reveal-fade delay-' + ((si % 6) + 1)
                },
                  React.createElement('img', { src: s.url, alt: s.caption, loading: 'lazy' })
                )
              )
            )
          );
        })
      )
    );
  };

  return React.createElement(React.Fragment, null,
    React.createElement(Hero, {
      compact: true,
      eyebrow: 'SHALLOW FOCUS STUDIO',
      title: '订单查询',
      sub: '不用出门的影楼 · 随时查看订单进度'
    }),
    React.createElement('main', { className: 'page page-single' },
      React.createElement('section', { className: 'card reveal-card' },
        React.createElement('div', { className: 'pm-sec-head' },
          React.createElement('span', { className: 'pm-sec-mark' }, '№'),
          React.createElement('span', { className: 'pm-sec-no' }, '01'),
          React.createElement('h2', { className: 'pm-sec-title' }, '订单查询（免登录）'),
          React.createElement('span', { className: 'pm-sec-line' })
        ),
        React.createElement('form', { onSubmit: handleQuery },
          React.createElement('label', { className: 'field' },
            React.createElement('span', { className: 'field-label' }, '订单号'),
            React.createElement('input', {
              type: 'text', maxLength: 80,
              placeholder: '下单成功后返回的订单号',
              autoComplete: 'off',
              value: orderId,
              onChange: (e) => setOrderId(e.target.value)
            })
          ),
          React.createElement('label', { className: 'field' },
            React.createElement('span', { className: 'field-label' }, '手机号'),
            React.createElement('input', {
              type: 'tel', maxLength: 11, inputMode: 'numeric',
              placeholder: '下单时填写的手机号',
              autoComplete: 'off',
              value: phone,
              onChange: (e) => setPhone(e.target.value)
            })
          ),
          React.createElement('label', { className: 'field' },
            React.createElement('span', { className: 'field-label' }, '查询密码'),
            React.createElement('input', {
              type: 'password', maxLength: 32,
              placeholder: '下单时设置的查询密码（至少 6 位）',
              value: password,
              onChange: (e) => setPassword(e.target.value)
            })
          ),
          React.createElement('button', {
            className: 'btn', type: 'submit', disabled: querying
          }, querying ? '查询中…' : '查询订单')
        ),
        React.createElement('p', { className: 'muted small', style: { marginTop: '10px', color: 'var(--dr-ink-3)' } },
          '三元组即订单凭证，请妥善保管。不知道订单号？可使用示例订单号 ',
          React.createElement('span', { className: 'mono', style: { color: 'var(--dr-gold)' } }, MOCK_ORDER.orderId),
          ' 体验查询流程。'
        )
      ),

      queried && React.createElement('section', { className: 'card reveal-card delay-1' },
        React.createElement('div', { className: 'toolbar' },
          React.createElement('span', { className: 'muted' }, '订单 ' + MOCK_ORDER.orderId),
          React.createElement('button', {
            className: 'btn btn-sm btn-outline',
            onClick: handleRefresh
          }, '刷新订单')
        )
      ),

      queried && React.createElement(OrderDetail, null),

      queried && React.createElement('section', { className: 'card reveal-card delay-2' },
        React.createElement('div', { className: 'pm-sec-head' },
          React.createElement('span', { className: 'pm-sec-mark' }, '№'),
          React.createElement('span', { className: 'pm-sec-no' }, '02'),
          React.createElement('h2', { className: 'pm-sec-title' }, '周边好物'),
          React.createElement('span', { className: 'pm-sec-line' })
        ),
        React.createElement('div', { className: 'tip-box' },
          '成片满意？将你的照片印成实体周边，珍藏每一份美好。'
        ),
        React.createElement('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
            marginTop: '12px'
          }
        },
          SHOWCASE_CATEGORIES.slice(0, 4).map((cat, i) =>
            React.createElement('div', {
              key: cat.id,
              className: 'reveal-fade delay-' + (i + 1),
              style: {
                border: '1px solid var(--dr-hairline)',
                borderRadius: '3px',
                padding: '12px',
                background: '#FFF',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }
            },
              React.createElement('span', {
                style: {
                  alignSelf: 'flex-start',
                  fontSize: '11px',
                  padding: '1px 7px',
                  border: '1px solid var(--dr-gold-dim)',
                  borderRadius: '2px',
                  background: 'var(--dr-gold-bg)',
                  color: 'var(--dr-gold)',
                  fontWeight: 600,
                  letterSpacing: '1px'
                }
              }, '热销'),
              React.createElement('div', {
                style: { fontWeight: 700, fontSize: '13.5px', color: 'var(--dr-ink)' }
              }, cat.name),
              React.createElement('span', {
                style: {
                  marginTop: 'auto',
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: '15px',
                  color: 'var(--dr-ink)'
                }
              }, cat.price)
            )
          )
        )
      ),

      // 收款码区
      queried && React.createElement('section', { className: 'card reveal-card delay-3' },
        React.createElement('div', { className: 'pm-sec-head' },
          React.createElement('span', { className: 'pm-sec-mark' }, '№'),
          React.createElement('span', { className: 'pm-sec-no' }, 'PAY'),
          React.createElement('h2', { className: 'pm-sec-title' }, '尾款支付'),
          React.createElement('span', { className: 'pm-sec-line' })
        ),
        React.createElement('div', { className: 'payment-body' },
          React.createElement('div', { className: 'payment-slot' },
            React.createElement('div', {
              style: {
                width: '100%', height: '100%',
                background: '#FAFAFA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--dr-ink-3)',
                fontSize: '12px'
              }
            }, '微信收款码')
          ),
          React.createElement('p', { className: 'payment-note' },
            '尾款 ¥' + fmtPrice(MOCK_ORDER.totalAmount) + ' · 请备注订单号后四位'
          ),
          React.createElement('p', { className: 'muted small', style: { color: 'var(--dr-ink-3)' } },
            '支付完成后请联系客服登记 · 成片将在 1-3 个工作日内交付'
          )
        )
      )
    ),
    React.createElement(Loading, { show: querying, text: '查询中…' })
  );
}

Object.assign(window, { QueryPage });
