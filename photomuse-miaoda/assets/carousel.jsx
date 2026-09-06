/* ============================================================
 * Hero Carousel 组件（带实况效果）
 * ============================================================ */

function HeroCarousel({ photos }) {
  const trackRef = React.useRef(null);
  const [activeIndex, setActiveIndex] = React.useState(1);
  const prefersReduced = typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 滚动吸附检测
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const slides = track.querySelectorAll('.hero-carousel-slide');
        if (!slides.length) return;
        const trackRect = track.getBoundingClientRect();
        const center = trackRect.left + trackRect.width / 2;
        let best = 0;
        let bestDist = Infinity;
        slides.forEach((slide, i) => {
          const rect = slide.getBoundingClientRect();
          const slideCenter = rect.left + rect.width / 2;
          const dist = Math.abs(center - slideCenter);
          if (dist < bestDist) { bestDist = dist; best = i; }
        });
        setActiveIndex(best);
      });
    };

    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // 初始化
    setTimeout(onScroll, 50);

    return () => {
      track.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // 键盘左右键
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goTo(activeIndex - 1);
      else if (e.key === 'ArrowRight') goTo(activeIndex + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex]);

  // 滚轮横向滚动
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        track.scrollLeft += e.deltaY;
      }
    };
    track.addEventListener('wheel', onWheel, { passive: false });
    return () => track.removeEventListener('wheel', onWheel);
  }, []);

  // 鼠标拖拽
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let isDown = false;
    let startX = 0;
    let startScroll = 0;

    const onDown = (e) => {
      isDown = true;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      track.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      track.scrollLeft = startScroll - dx;
    };
    const onUp = () => {
      isDown = false;
      track.style.cursor = '';
    };

    track.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      track.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const goTo = (index) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(photos.length - 1, index));
    const slide = track.querySelectorAll('.hero-carousel-slide')[clamped];
    if (slide) {
      slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  return React.createElement('div', { className: 'hero-carousel', 'aria-hidden': 'true' },
    React.createElement('div', { className: 'hero-carousel-arrows' },
      React.createElement('button', {
        className: 'hero-carousel-arrow hero-carousel-arrow--prev',
        onClick: () => goTo(activeIndex - 1),
        'aria-label': '上一张'
      }, '‹'),
      React.createElement('button', {
        className: 'hero-carousel-arrow hero-carousel-arrow--next',
        onClick: () => goTo(activeIndex + 1),
        'aria-label': '下一张'
      }, '›')
    ),
    React.createElement('div', { className: 'hero-carousel-track', ref: trackRef },
      photos.map((p, i) =>
        React.createElement('div', {
          key: i,
          className: 'hero-carousel-slide' + (i === activeIndex ? ' is-active' : '')
        },
          React.createElement('div', { className: 'hero-carousel-polaroid' },
            i === activeIndex && !prefersReduced && React.createElement('div', { className: 'hero-live-badge' },
              React.createElement('span', { className: 'hero-live-dot' }),
              'LIVE',
              React.createElement('span', { className: 'hero-live-waves' },
                React.createElement('span'),
                React.createElement('span'),
                React.createElement('span')
              )
            ),
            React.createElement('img', {
              src: p.src,
              alt: p.alt,
              loading: i === 1 ? 'eager' : 'lazy',
              draggable: false
            })
          )
        )
      )
    ),
    React.createElement('div', { className: 'hero-carousel-dots' },
      photos.map((_, i) =>
        React.createElement('button', {
          key: i,
          className: 'hero-carousel-dot' + (i === activeIndex ? ' is-active' : ''),
          onClick: () => goTo(i),
          'aria-label': '第 ' + (i + 1) + ' 张'
        })
      )
    ),
    React.createElement('p', { className: 'hero-carousel-caption' },
      '成片样张 · SHALLOW FOCUS'
    )
  );
}

Object.assign(window, { HeroCarousel });
