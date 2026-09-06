/* ============================================================
 * 首页
 * ============================================================ */

function HomePage({ onNavigate }) {
  return React.createElement(React.Fragment, null,
    React.createElement(Hero, {
      eyebrow: 'SHALLOW FOCUS STUDIO — No.01',
      title: '浅焦·映像',
      sub: '不用出门的影楼 · 上传一张照片，收获整套专业形象',
      showPhotos: true
    }),

    // 特色介绍
    React.createElement('section', { className: 'features-section' },
      React.createElement('div', { className: 'features-inner' },
        React.createElement('p', { className: 'section-eyebrow reveal' }, 'WHY SHALLOW FOCUS'),
        React.createElement('h2', { className: 'section-title reveal delay-1' }, '暗房级的影像仪式'),
        React.createElement('div', { className: 'section-rule reveal delay-2' }),
        React.createElement('p', { className: 'section-sub reveal delay-2' },
          '我们相信每一张照片都值得被郑重对待。从暗房里走出的光影，到相纸上定格的瞬间——浅焦映像，把影楼级的专业质感带到你指尖。'
        ),
        React.createElement('div', { className: 'features-grid' },
          FEATURES.map((f, i) =>
            React.createElement('div', {
              key: f.no,
              className: 'feature-card reveal delay-' + (i + 1)
            },
              React.createElement('div', { className: 'feature-no' }, '№ ' + f.no),
              React.createElement('h3', { className: 'feature-title' }, f.title),
              React.createElement('p', { className: 'feature-desc' }, f.desc)
            )
          )
        )
      )
    ),

    // 成片样张画廊
    React.createElement('section', { className: 'gallery-section' },
      React.createElement('div', { className: 'gallery-inner' },
        React.createElement('p', { className: 'section-eyebrow reveal' }, 'OUR WORKS'),
        React.createElement('h2', { className: 'section-title reveal delay-1' }, '真实成片样张'),
        React.createElement('div', { className: 'section-rule reveal delay-2' }),
        React.createElement('p', { className: 'section-sub reveal delay-2' },
          '以下均为真实客户的成片效果。你的照片，也能拥有这样的质感。'
        ),
        React.createElement('div', { className: 'gallery-grid' },
          [
            { img: 'assets/img/mother-2.jpg', caption: '国风 · 旗袍' },
            { img: 'assets/img/family-1.jpg', caption: '亲子 · 全家福' },
            { img: 'assets/img/father-1.jpg', caption: '商务 · 绅士' }
          ].map((item, i) =>
            React.createElement('div', {
              key: i,
              className: 'gallery-item reveal-fade delay-' + (i + 1)
            },
              React.createElement('img', { src: item.img, alt: item.caption, loading: 'lazy' }),
              React.createElement('div', { className: 'gallery-caption' }, item.caption)
            )
          )
        )
      )
    ),

    // CTA
    React.createElement('section', { className: 'cta-section' },
      React.createElement('div', { className: 'cta-inner' },
        React.createElement('h2', { className: 'cta-title reveal' }, '现在就开拍'),
        React.createElement('p', { className: 'cta-sub reveal delay-1' },
          '上传一张清晰正脸照，1–3 个工作日内收获你的专属写真。'
        ),
        React.createElement('button', {
          className: 'cta-btn reveal delay-2',
          onClick: () => onNavigate('order')
        }, '立即下单 →')
      )
    )
  );
}

Object.assign(window, { HomePage });
