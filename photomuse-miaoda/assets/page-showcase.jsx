/* ============================================================
 * 场景模拟页
 * ============================================================ */

function ShowcasePage({ showToast }) {
  const [activeCat, setActiveCat] = React.useState('wall');

  const currentPhoto = 'assets/img/family-1.jpg';

  // 挂墙场景
  const WallScene = () =>
    React.createElement('div', { className: 'showcase-stage sc-wall' },
      React.createElement('div', { className: 'sc-baseboard' }),
      React.createElement('div', { className: 'sc-frame-group' },
        React.createElement('div', { className: 'sc-frame' },
          React.createElement('div', { className: 'sc-mat' },
            React.createElement('img', {
              className: 'sc-photo-img',
              src: currentPhoto, alt: '挂墙效果'
            })
          )
        )
      )
    );

  // 摆台场景（简化版）
  const DeskScene = () =>
    React.createElement('div', {
      className: 'showcase-stage',
      style: {
        height: '310px',
        background: 'linear-gradient(180deg, #EDF1F6 0%, #E8EDF3 52%, #C9A075 52%, #C9A075 100%)'
      }
    },
      React.createElement('div', {
        style: {
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '150px',
          background: 'linear-gradient(180deg, #C9A075 0%, #BD8F66 60%, #B0855C 100%)',
          clipPath: 'polygon(3% 0, 97% 0, 100% 100%, 0 100%)'
        }
      }),
      React.createElement('div', {
        style: {
          position: 'absolute', bottom: '110px', left: '50%',
          transform: 'translateX(-50%) perspective(450px) rotateX(8deg)'
        }
      },
        React.createElement('div', {
          style: {
            background: '#FFF', padding: '8px',
            boxShadow: '0 8px 17px rgba(62, 39, 35, 0.3)'
          }
        },
          React.createElement('img', {
            src: currentPhoto, alt: '摆台效果',
            style: { width: '135px', height: '189px', objectFit: 'cover' }
          })
        )
      )
    );

  // 挂历场景（简化）
  const CalendarScene = () =>
    React.createElement('div', {
      className: 'showcase-stage',
      style: {
        minHeight: 0,
        height: 'auto',
        overflow: 'visible',
        padding: '26px 0 20px',
        background: 'linear-gradient(180deg, #E9EEF4 0%, #DFE7F0 100%)',
        display: 'flex',
        justifyContent: 'center',
        borderRadius: '10px'
      }
    },
      React.createElement('div', {
        style: {
          position: 'relative',
          width: '260px',
          background: '#FFFDF9',
          borderRadius: '7px',
          boxShadow: '0 11px 23px rgba(31, 45, 61, 0.18)',
          transform: 'rotate(0.6deg)',
          paddingBottom: '4px'
        }
      },
        React.createElement('img', {
          src: currentPhoto, alt: '挂历效果',
          style: {
            display: 'block',
            width: '226px', height: '260px',
            margin: '24px auto 0',
            borderRadius: '5px',
            objectFit: 'cover'
          }
        }),
        React.createElement('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '5px',
            padding: '8px 10px 12px'
          }
        },
          Array(12).fill(0).map((_, i) =>
            React.createElement('div', {
              key: i,
              style: {
                borderTop: '1px solid #E8E2D6',
                paddingTop: '2px',
                textAlign: 'center',
                color: '#90A4AE',
                fontSize: '9px',
                fontWeight: 700
              }
            }, (i + 1) + '月')
          )
        )
      )
    );

  // 钱包场景（简化）
  const WalletScene = () =>
    React.createElement('div', {
      className: 'showcase-stage',
      style: {
        height: '310px',
        background: 'linear-gradient(180deg, #F3F0EA 0%, #E9E3D7 100%)'
      }
    },
      React.createElement('div', {
        style: {
          position: 'absolute', left: '30px', bottom: '75px',
          width: '150px', height: '118px',
          borderRadius: '13px',
          background: 'linear-gradient(160deg, #6D4C41 0%, #4E342E 100%)',
          boxShadow: '0 9px 18px rgba(62, 39, 35, 0.35)'
        }
      }),
      // 几张散落的钱包照
      [0, 1, 2].map((i) =>
        React.createElement('div', {
          key: i,
          style: {
            position: 'absolute',
            width: '78px', height: '58px',
            padding: '4px',
            borderRadius: '4px',
            background: '#FFF',
            boxShadow: '0 4px 8px rgba(31, 45, 61, 0.2)',
            right: (40 + i * 50) + 'px',
            bottom: (100 + i * 15) + 'px',
            transform: 'rotate(' + (i * 5 - 5) + 'deg)',
            zIndex: 6 - i
          }
        },
          React.createElement('img', {
            src: currentPhoto, alt: '钱包照',
            style: { width: '100%', height: '100%', objectFit: 'cover' }
          })
        )
      )
    );

  // 亚克力挂件（简化）
  const KeychainScene = () =>
    React.createElement('div', {
      className: 'showcase-stage',
      style: {
        height: '310px',
        background: 'linear-gradient(180deg, #E8E4DB 0%, #D4CEC0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    },
      React.createElement('div', {
        style: {
          position: 'relative',
          width: '140px', height: '180px',
          background: 'rgba(255,255,255,0.9)',
          borderRadius: '16px',
          padding: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          border: '2px solid rgba(255,255,255,0.6)'
        }
      },
        React.createElement('img', {
          src: currentPhoto, alt: '亚克力挂件',
          style: {
            width: '100%', height: 'calc(100% - 20px)',
            objectFit: 'cover', borderRadius: '10px'
          }
        }),
        React.createElement('div', {
          style: {
            position: 'absolute', top: '-18px', left: '50%',
            transform: 'translateX(-50%)',
            width: '22px', height: '22px',
            borderRadius: '50%',
            border: '3px solid rgba(200,200,200,0.8)',
            background: 'rgba(255,255,255,0.3)'
          }
        })
      )
    );

  // 相册场景（简化）
  const AlbumScene = () =>
    React.createElement('div', {
      className: 'showcase-stage',
      style: {
        height: '310px',
        background: 'linear-gradient(180deg, #2C2418 0%, #1A1510 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    },
      React.createElement('div', {
        style: {
          position: 'relative',
          width: '260px', height: '180px',
          background: 'linear-gradient(90deg, #5C4A36 0%, #7A634A 50%, #5C4A36 100%)',
          borderRadius: '4px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          padding: '14px 10px'
        }
      },
        React.createElement('div', {
          style: {
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '2px', height: '85%',
            background: 'rgba(0,0,0,0.3)'
          }
        }),
        React.createElement('div', {
          style: {
            display: 'flex',
            gap: '8px',
            height: '100%'
          }
        },
          React.createElement('div', {
            style: {
              flex: 1,
              background: '#FFF',
              padding: '6px',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
            }
          },
            React.createElement('img', {
              src: currentPhoto,
              style: { width: '100%', height: '100%', objectFit: 'cover' }
            })
          ),
          React.createElement('div', {
            style: {
              flex: 1,
              background: '#FFF',
              padding: '6px',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
            }
          },
            React.createElement('img', {
              src: 'assets/img/mother-2.jpg',
              style: { width: '100%', height: '100%', objectFit: 'cover' }
            })
          )
        )
      )
    );

  const scenes = {
    wall: WallScene,
    desk: DeskScene,
    calendar: CalendarScene,
    wallet: WalletScene,
    keychain: KeychainScene,
    album: AlbumScene
  };

  const ActiveScene = scenes[activeCat] || WallScene;
  const currentCatName = (SHOWCASE_CATEGORIES.find((c) => c.id === activeCat) || {}).name || '';

  return React.createElement(React.Fragment, null,
    React.createElement(Hero, {
      compact: true,
      eyebrow: 'SHALLOW FOCUS SHOWCASE',
      title: '场景模拟',
      sub: '看看你的成片印在周边上的样子'
    }),
    React.createElement('main', { className: 'page page-single' },
      React.createElement('section', { className: 'card reveal-card' },
        React.createElement('div', { style: { marginBottom: '6px' } },
          React.createElement('div', {
            style: {
              display: 'flex', alignItems: 'center', gap: '10px',
              marginBottom: '6px'
            }
          },
            React.createElement('div', {
              style: {
                flex: 1, textAlign: 'center',
                fontFamily: 'var(--serif)',
                fontSize: '16px', fontWeight: 700,
                letterSpacing: '4px', color: 'var(--dr-ink)'
              }
            }, currentCatName)
          ),
          React.createElement('div', {
            style: {
              marginBottom: '12px',
              padding: '9px 12px',
              border: '1px solid var(--dr-gold-dim)',
              borderRadius: '3px',
              color: 'var(--dr-gold)',
              background: 'var(--dr-gold-bg)',
              fontSize: '12.5px',
              lineHeight: '1.55'
            }
          },
            '选择下方品类，实时预览你的成片印在周边上的实物效果。点击场景中的照片可放大查看。'
          )
        ),

        // 品类切换条
        React.createElement('div', { className: 'sc-chipbar' },
          SHOWCASE_CATEGORIES.map((cat) =>
            React.createElement('button', {
              key: cat.id,
              className: 'sc-chip' + (activeCat === cat.id ? ' active' : ''),
              onClick: () => setActiveCat(cat.id)
            },
              React.createElement('span', { className: 'sc-chip-name' }, cat.name),
              React.createElement('span', { className: 'sc-chip-price' }, cat.price)
            )
          )
        ),

        // 场景舞台
        React.createElement(ActiveScene, null),

        React.createElement('p', {
          className: 'muted small',
          style: { textAlign: 'center', marginTop: '6px', color: 'var(--dr-ink-3)' }
        },
          '实物效果仅供参考，以最终成品为准 · 尺寸可定制'
        )
      ),

      // 上传自己的照片
      React.createElement('section', { className: 'card reveal-card delay-1' },
        React.createElement('div', { className: 'pm-sec-head' },
          React.createElement('span', { className: 'pm-sec-mark' }, '№'),
          React.createElement('span', { className: 'pm-sec-no' }, '02'),
          React.createElement('h2', { className: 'pm-sec-title' }, '上传你的成片'),
          React.createElement('span', { className: 'pm-sec-line' })
        ),
        React.createElement('label', { className: 'file-label' },
          '上传照片预览效果',
          React.createElement('input', {
            type: 'file', accept: 'image/*', hidden: true,
            onChange: (e) => {
              showToast('已上传，效果将在正式版本中实时渲染', 'success');
              e.target.value = '';
            }
          })
        ),
        React.createElement('p', { className: 'muted small', style: { color: 'var(--dr-ink-3)' } },
          '上传一张你的成片，实时查看在不同周边上的呈现效果。'
        )
      )
    )
  );
}

Object.assign(window, { ShowcasePage });
