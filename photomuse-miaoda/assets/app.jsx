/* ============================================================
 * 浅焦映像 v3 · 暗房影楼 · 应用入口
 * ============================================================ */

function App() {
  const [currentPage, setCurrentPage] = React.useState('home');
  const [toast, setToast] = React.useState({ message: '', type: '' });
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  const showToast = (message, type) => {
    setToast({ message, type: type || '' });
  };

  const closeToast = () => {
    setToast({ message: '', type: '' });
  };

  const navigate = (page) => {
    if (page === currentPage) {
      window.scrollTo(0, 0);
      return;
    }
    setIsTransitioning(true);
    window.scrollTo(0, 0);
    // 下一帧完成切换
    requestAnimationFrame(() => {
      setCurrentPage(page);
      setIsTransitioning(false);
      window.scrollTo(0, 0);
    });
  };

  // 页面切换后重新初始化动效
  React.useLayoutEffect(() => {
    if (window.__initAnimations) {
      window.__initAnimations();
    }
  }, [currentPage]);

  window.__navigateTo = navigate;

  let PageComponent;
  switch (currentPage) {
    case 'order':
      PageComponent = React.createElement(OrderPage, { showToast: showToast });
      break;
    case 'query':
      PageComponent = React.createElement(QueryPage, { showToast: showToast });
      break;
    case 'showcase':
      PageComponent = React.createElement(ShowcasePage, { showToast: showToast });
      break;
    case 'home':
    default:
      PageComponent = React.createElement(HomePage, { onNavigate: navigate });
      break;
  }

  return React.createElement(React.Fragment, null,
    React.createElement(SiteHeader, { currentPage: currentPage, onNavigate: navigate }),
    React.createElement('div', {
      key: currentPage,
      className: 'page-transition-enter',
      style: willChangeContents
    }, PageComponent),
    React.createElement(Footer, null),
    React.createElement(Toast, {
      message: toast.message,
      type: toast.type,
      onClose: closeToast
    })
  );
}

const willChangeContents = { willChange: 'opacity, transform' };

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));
