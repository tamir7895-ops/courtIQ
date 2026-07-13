/* app-v10/screens/drill-library.js
   DRILL LIBRARY — browse the full _DRILLS_DB from /js/drill-engine.js.
   Layout: header pill + ribbon + category chips (sticky top),
           flex-1 scrolling list of drill rows (the only scroller),
           tap a row to expand inline preview + START DRILL CTA.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, icon = window.V10UI.icon;

  /* ── Category metadata ─────────────────────────────────────
     Maps drill `focus_area` strings to a chip label, icon, and
     accent color (cycles orange / sage / mustard / ink).
  ──────────────────────────────────────────────────────────── */
  var CATEGORIES = [
    { key: 'Shooting',      label: 'SHOOT',  icon: 'ph-crosshair-simple', accent: 'orange'  },
    { key: 'Ball Handling', label: 'HANDLE', icon: 'ph-lightning',        accent: 'sage'    },
    { key: 'Finishing',     label: 'FINISH', icon: 'ph-basketball',       accent: 'mustard' },
    { key: 'Defense',       label: 'D',      icon: 'ph-shield',           accent: 'ink'     },
    { key: 'Conditioning',  label: 'CONDIT', icon: 'ph-heartbeat',        accent: 'orange'  },
    { key: 'Strength',      label: 'STR',    icon: 'ph-barbell',          accent: 'sage'    },
    { key: 'Passing',       label: 'PASS',   icon: 'ph-arrows-out',       accent: 'mustard' },
    { key: 'Footwork',      label: 'FOOT',   icon: 'ph-sneaker',          accent: 'ink'     }
  ];

  var CAT_INDEX = {};
  CATEGORIES.forEach(function (c) { CAT_INDEX[c.key] = c; });

  function categoryMeta(key) {
    return CAT_INDEX[key] || { key: key, label: (key || '').toUpperCase(),
      icon: 'ph-basketball', accent: 'orange' };
  }

  /* ── Difficulty badge mapping ─────────────────────────────── */
  function diffShort(d) {
    if (!d) return 'EASY';
    var s = String(d).toLowerCase();
    if (s.indexOf('adv') === 0) return 'HARD';
    if (s.indexOf('int') === 0) return 'MED';
    return 'EASY';
  }

  /* ── Source data (bare global from /js/drill-engine.js) ──── */
  function loadDrills() {
    try {
      // _DRILLS_DB is declared as `const _DRILLS_DB` in drill-engine.js
      // and is available as a bare identifier on classic scripts.
      if (typeof _DRILLS_DB !== 'undefined' && Array.isArray(_DRILLS_DB)) {
        return _DRILLS_DB;
      }
    } catch (e) { /* ignore */ }
    return [];
  }

  /* ── Drill row (collapsed) ────────────────────────────────── */
  function drillRow(d, isOpen, onToggle, ctx) {
    var cat = categoryMeta(d.focus_area);
    var diff = diffShort(d.difficulty);

    var diffColor = diff === 'HARD' ? 'var(--orange)'
                  : diff === 'MED'  ? 'var(--mustard)'
                                    : 'var(--sage)';

    var topRow = h('div', {
      class: 'v10-row',
      style: {
        // .v10-row owns flex/border/padding/bg; we just suppress the
        // default bottom margin since drillRow's outer wrapper handles it.
        marginBottom: '0',
        border: 'none',
        background: 'transparent'
      },
      onClick: onToggle
    }, [
      // Category icon swatch
      h('div', {
        style: {
          width: '32px', height: '32px', flexShrink: '0',
          background: 'var(--' + cat.accent + ')',
          border: '1.5px solid var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }
      }, [
        h('i', {
          class: 'ph-bold ' + cat.icon,
          style: {
            fontSize: '16px',
            color: cat.accent === 'mustard' ? 'var(--ink)' : 'var(--cream)'
          }
        })
      ]),

      // Title + reps/mins line (v10-row__main/title/sub)
      h('div', { class: 'v10-row__main' }, [
        h('div', {
          class: 'v10-row__title',
          style: {
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          },
          text: d.name || 'Untitled'
        }),
        h('div', {
          class: 'v10-row__sub',
          style: {
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            letterSpacing: '0.05em'
          },
          text: (d.reps_or_sets || '') + ' · ' + (d.duration_minutes || 0) + ' MIN'
        })
      ]),

      // Difficulty badge
      h('div', {
        style: {
          background: diffColor, color: 'var(--cream)',
          padding: '3px 6px', flexShrink: '0',
          fontFamily: 'var(--font-display)', fontSize: '9px',
          fontWeight: '900', letterSpacing: '0.12em',
          border: '1.5px solid var(--ink)'
        },
        text: diff
      }),

      // Chevron
      h('i', {
        class: 'ph-bold ' + (isOpen ? 'ph-caret-up' : 'ph-caret-down'),
        style: { fontSize: '14px', color: 'var(--ink)', flexShrink: '0' }
      })
    ]);

    var children = [topRow];

    if (isOpen) {
      // Expanded preview
      var equip = (d.equipment_needed && d.equipment_needed.length)
        ? d.equipment_needed.join(' · ') : '';
      var positions = (d.positions && d.positions.length)
        ? d.positions.join('/') : '';

      children.push(h('div', {
        style: {
          padding: '8px 12px 12px', borderTop: '1.5px dashed var(--ink)',
          background: 'var(--cream-deep)'
        }
      }, [
        // Tags row (focus + positions + equipment)
        h('div', {
          style: {
            display: 'flex', flexWrap: 'wrap', gap: '4px',
            marginBottom: '8px'
          }
        }, [
          h('span', {
            style: {
              background: 'var(--ink)', color: 'var(--cream)',
              padding: '2px 6px',
              fontFamily: 'var(--font-display)', fontSize: '8px',
              fontWeight: '800', letterSpacing: '0.14em'
            },
            text: (d.focus_area || '').toUpperCase()
          }),
          positions ? h('span', {
            style: {
              background: 'transparent', color: 'var(--ink)',
              border: '1px solid var(--ink)',
              padding: '1px 5px',
              fontFamily: 'var(--font-mono)', fontSize: '8px',
              fontWeight: '700', letterSpacing: '0.08em'
            },
            text: positions
          }) : null,
          equip ? h('span', {
            style: {
              color: 'var(--muted)', padding: '2px 0',
              fontFamily: 'var(--font-mono)', fontSize: '8px',
              fontWeight: '600', letterSpacing: '0.05em'
            },
            text: equip.toUpperCase()
          }) : null
        ]),

        // Description (Lora italic)
        h('div', {
          style: {
            fontFamily: 'var(--font-body)', fontStyle: 'italic',
            fontSize: '12.5px', color: 'var(--ink)', lineHeight: '1.4',
            marginBottom: '10px'
          },
          text: '“' + (d.description || 'Practice this drill at game pace.') + '”'
        }),

        // START DRILL cta
        h('button', {
          class: 'v10-cta v10-cta--mustard',
          style: { padding: '10px', fontSize: '13px' },
          onClick: function (ev) {
            ev.stopPropagation();
            if (ctx && ctx.go) ctx.go('workout-player');
          }
        }, [
          h('i', { class: 'ph-bold ph-play-circle' }),
          h('span', { text: 'START DRILL' })
        ])
      ]));
    }

    return h('div', {
      style: {
        border: '1.5px solid var(--ink)',
        background: 'var(--cream)',
        marginBottom: '6px',
        boxShadow: isOpen ? '3px 3px 0 var(--' + cat.accent + ')' : 'none'
      }
    }, children);
  }

  /* ── Empty state ──────────────────────────────────────────── */
  function emptyState(label, ctx, isDbMissing) {
    var children = [
      h('div', {
        style: {
          padding: '20px 12px 8px', textAlign: 'center',
          fontFamily: 'var(--font-body)', fontStyle: 'italic',
          color: 'var(--muted)', fontSize: '13px'
        },
        text: label || 'No drills in this category yet.'
      })
    ];
    // When the DB itself is missing, give the user a way out
    // (workout-player is the closest practice surface).
    if (isDbMissing && ctx && ctx.go) {
      children.push(h('button', {
        class: 'v10-cta v10-cta--mustard',
        style: { margin: '0 12px', padding: '10px', fontSize: '13px' },
        onClick: function () { ctx.go('workout-player'); }
      }, [
        h('i', { class: 'ph-bold ph-play-circle' }),
        h('span', { text: 'OPEN WORKOUT PLAYER' })
      ]));
    }
    return h('div', {}, children);
  }

  /* ── Category chips (horizontally scrollable) ─────────────── */
  function categoryChips(activeKey, counts, onPick) {
    var chips = ['ALL'].concat(CATEGORIES.map(function (c) { return c.key; }));

    // Use .v10-chips as base, then override for horizontal scroll +
    // edge-to-edge bleed (9 chips don't fit flex:1 evenly on 390px).
    var row = h('div', {
      class: 'v10-chips',
      style: {
        overflowX: 'auto', overflowY: 'hidden',
        margin: '0 -16px 8px',
        padding: '0 16px 4px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none'
      }
    });
    row.style.setProperty('-ms-overflow-style', 'none');

    chips.forEach(function (key) {
      var isActive = (key === activeKey);
      var meta = key === 'ALL'
        ? { label: 'ALL', icon: 'ph-list-bullets' }
        : categoryMeta(key);
      var count = key === 'ALL' ? counts.total : (counts.byCat[key] || 0);

      row.appendChild(h('button', {
        class: 'v10-chip' + (isActive ? ' is-active' : ''),
        style: {
          // .v10-chip is flex:1; we want chips to keep their natural width
          // and scroll horizontally instead.
          flex: '0 0 auto',
          padding: '7px 10px',
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          whiteSpace: 'nowrap'
        },
        onClick: function () { onPick(key); }
      }, [
        h('i', {
          class: 'ph-bold ' + meta.icon,
          style: { fontSize: '12px' }
        }),
        h('span', { text: meta.label }),
        h('span', {
          style: {
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            opacity: '0.7', marginLeft: '2px'
          },
          text: '' + count
        })
      ]));
    });

    return row;
  }

  /* ── Featured row (rotates between categories) ────────────── */
  function featuredHero(drill, ctx) {
    if (!drill) return null;
    var cat = categoryMeta(drill.focus_area);
    var heroVariant = cat.accent === 'ink' ? 'ink'
                    : cat.accent === 'sage' ? 'sage'
                    : cat.accent === 'mustard' ? 'mustard'
                    : '';
    var heroCls = 'v10-hero' + (heroVariant ? ' v10-hero--' + heroVariant : '');

    return h('div', {
      class: heroCls,
      style: { marginBottom: '10px', cursor: 'pointer' },
      onClick: function () { if (ctx && ctx.go) ctx.go('workout-player'); }
    }, [
      h('div', { class: 'v10-hero__main' }, [
        h('div', { class: 'v10-hero__eyebrow' }, [
          icon('ph-fire'),
          h('span', { text: 'FEATURED · ' + (drill.focus_area || '').toUpperCase() })
        ]),
        h('div', {
          class: 'v10-hero__headline',
          style: { fontSize: '22px' },
          text: (drill.name || '').toUpperCase()
        }),
        h('div', {
          class: 'v10-hero__sub',
          text: (drill.reps_or_sets || '') + ' · ' + (drill.duration_minutes || 0) + ' min · ' + (drill.difficulty || '')
        })
      ])
    ]);
  }

  /* ── Main render ──────────────────────────────────────────── */
  function render(args) {
    var hostEl = args.host;
    var ctx = args.ctx;

    var drills = loadDrills();

    // Bucket by focus_area
    var byCat = {};
    drills.forEach(function (d) {
      var k = d.focus_area || 'Other';
      if (!byCat[k]) byCat[k] = [];
      byCat[k].push(d);
    });
    var counts = { total: drills.length, byCat: {} };
    Object.keys(byCat).forEach(function (k) { counts.byCat[k] = byCat[k].length; });

    var state = {
      filter: 'ALL',
      openId: null,
      // Pick a featured drill: first Shooting drill if available, else first overall
      featured: (byCat['Shooting'] && byCat['Shooting'][0]) || drills[0] || null
    };

    function visibleDrills() {
      if (state.filter === 'ALL') return drills;
      return byCat[state.filter] || [];
    }

    function paint(profile) {
      while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild);
      hostEl.appendChild(ctx.ui.headerPill({ profile: profile }));

      // Ribbon
      hostEl.appendChild(ctx.ui.ribbon({
        icon: 'ph-books',
        title: 'DRILL LIBRARY',
        meta: drills.length + ' DRILLS'
      }));

      // Featured (only on ALL)
      if (state.filter === 'ALL' && state.featured) {
        hostEl.appendChild(featuredHero(state.featured, ctx));
      }

      // Hosts that we re-render on filter / expand changes
      var chipsHost = h('div');
      var listHost = h('div', {
        style: {
          flex: '1 1 auto',
          minHeight: '0',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          // bleed slightly into page padding so rows align with screen edges
          margin: '0 -4px',
          padding: '0 4px 4px'
        }
      });

      function refreshChips() {
        while (chipsHost.firstChild) chipsHost.removeChild(chipsHost.firstChild);
        chipsHost.appendChild(categoryChips(state.filter, counts, function (key) {
          state.filter = key;
          state.openId = null;
          // Toggling filter affects featured visibility — full repaint.
          paint(profile);
          // Reset scroll on filter change
          try { listHost.scrollTop = 0; } catch (e) {}
        }));
      }

      function refreshList() {
        while (listHost.firstChild) listHost.removeChild(listHost.firstChild);
        var rows = visibleDrills();
        if (!rows.length) {
          var dbMissing = !drills.length;
          listHost.appendChild(emptyState(
            dbMissing
              ? 'Drill database not loaded.'
              : 'No drills in this category yet.',
            ctx,
            dbMissing
          ));
          return;
        }
        rows.forEach(function (d) {
          var isOpen = (state.openId === d.id);
          listHost.appendChild(drillRow(d, isOpen, function () {
            state.openId = isOpen ? null : d.id;
            refreshList();
          }, ctx));
        });
      }

      refreshChips();
      hostEl.appendChild(chipsHost);
      refreshList();
      hostEl.appendChild(listHost);
    }

    ctx.data.getProfile().then(paint, function () { paint({}); });
  }

  window.app.register('drill-library', render);
})();
