/* ============================================================
 * 公共组件：顶部导航 + Hero
 * ============================================================ */

function SiteHeader({ currentPage, onNavigate }) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const navItems = [
    { key: 'home', label: '首页' },
    { key: 'order', label: '在线下单' },
    { key: 'query', label: '订单查询' },
    { key: 'showcase', label: '场景模拟' }
  ];

  const handleNav = (key) => {
    setMenuOpen(false);
    onNavigate(key);
  };

  return React.createElement('header', { className: 'site-header' },
    React.createElement('nav', { className: 'nav' },
      React.createElement('div', {
        className: 'nav-brand',
        onClick: () => handleNav('home'),
        style: { cursor: 'pointer' }
      },
        React.createElement('span', { className: 'nav-brand-mark' },
          React.createElement('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.2', strokeLinecap: 'round', strokeLinejoin: 'round' },
            React.createElement('rect', { x: '4', y: '4', width: '16', height: '18', rx: '1' }),
            React.createElement('path', { d: 'M4 19 L10 14 L14 17 L20 10 L20 22 L4 22 Z', fill: 'currentColor', fillOpacity: '0.15', stroke: 'none' }),
            React.createElement('circle', { cx: '17', cy: '8', r: '1.5', fill: 'currentColor', stroke: 'none' })
          )
        ),
        '浅焦·映像'
      ),
      React.createElement('button', {
        className: 'nav-toggle',
        onClick: () => setMenuOpen(!menuOpen),
        'aria-label': '菜单'
      },
        React.createElement('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' },
          menuOpen
            ? React.createElement('path', { d: 'M18 6L6 18M6 6l12 12' })
            : React.createElement(React.Fragment, null,
                React.createElement('path', { d: 'M3 6h18' }),
                React.createElement('path', { d: 'M3 12h18' }),
                React.createElement('path', { d: 'M3 18h18' })
              )
        )
      ),
      React.createElement('div', { className: 'nav-links' + (menuOpen ? ' open' : '') },
        navItems.map((item) =>
          React.createElement('a', {
            key: item.key,
            href: '#' + item.key,
            className: currentPage === item.key ? 'active' : '',
            onClick: (e) => { e.preventDefault(); handleNav(item.key); }
          }, item.label)
        )
      )
    )
  );
}

function Hero({ compact, eyebrow, title, sub, showPhotos }) {
  const photos = [
    { src: 'assets/img/mother-2.jpg', alt: '国风旗袍样张' },
    { src: 'assets/img/family-1.jpg', alt: '亲子全家福样张' },
    { src: 'assets/img/father-1.jpg', alt: '绅士商务样张' }
  ];

  return React.createElement('section', { className: 'hero' + (compact ? ' hero--compact' : '') },
    React.createElement('div', { className: 'hero-inner' },
      React.createElement('div', { className: 'hero-copy' },
        eyebrow && React.createElement('p', { className: 'hero-eyebrow' }, eyebrow),
        React.createElement('h1', { className: 'hero-title' }, title),
        React.createElement('div', { className: 'hero-rule', 'aria-hidden': 'true' }),
        sub && React.createElement('p', { className: 'hero-sub' }, sub)
      ),
       showPhotos && React.createElement('div', { className: 'hero-photos', 'aria-hidden': 'true' },
         photos.map((p, i) =>
           React.createElement('div', { key: i, className: 'hero-photo' },
             i === 1 && React.createElement('div', { className: 'hero-live-badge' },
               React.createElement('span', { className: 'hero-live-dot' }),
               'LIVE',
               React.createElement('span', { className: 'hero-live-waves' },
                 React.createElement('span'),
                 React.createElement('span'),
                 React.createElement('span')
               )
             ),
             React.createElement('img', { src: p.src, alt: p.alt, loading: 'eager' })
           )
         ),
         React.createElement('div', { className: 'hero-photos-caption' }, '成片样张 · SHALLOW FOCUS')
       ),

    )
  );
}

function Footer() {
  return React.createElement('footer', { className: 'footer' },
    '浅焦映像 · 上传一张照片，生成证件照、形象照与 AI 写真 · ',
    React.createElement('span', null, 'SHALLOW FOCUS STUDIO')
  );
}

function Toast({ message, type, onClose }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, 2500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const cls = 'pm-toast show' +
    (type === 'error' ? ' pm-toast-error' : '') +
    (type === 'success' ? ' pm-toast-success' : '');

  return React.createElement('div', { className: cls }, message);
}

function Loading({ show, text }) {
  if (!show) return null;
  return React.createElement('div', { className: 'pm-loading show' },
    React.createElement('div', { className: 'spinner' }),
    React.createElement('div', { className: 'pm-loading-text' }, text || '加载中…')
  );
}

// 暴露到全局
Object.assign(window, { SiteHeader, Hero, Footer, Toast, Loading });
