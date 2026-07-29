/* app-v10/screens/drill-library.js — v12
   DRILL LIBRARY — the user's ask: a library like the drills shelf,
   with a COURT DIAGRAM ON EVERY DRILL. Each card carries a real
   half-court thumbnail (lib/v12.js courtThumb — true NBA geometry)
   whose pattern comes from the drill's focus area.

   Browse the full _DRILLS_DB from /js/drill-engine.js:
   category chips → card list → tap to expand → START DRILL.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;

  var T = {
    en: {
      'lib.cat.all':       'All',
      'lib.cat.shoot':     'Shoot',
      'lib.cat.handle':    'Handle',
      'lib.cat.finish':    'Finish',
      'lib.cat.defense':   'Defense',
      'lib.cat.condition': 'Condition',
      'lib.cat.strength':  'Strength',
      'lib.cat.pass':      'Pass',
      'lib.cat.feet':      'Feet',
      'lib.diff.easy':     'Easy',
      'lib.diff.med':      'Med',
      'lib.diff.hard':     'Hard',
      'lib.back':          'Back',
      'lib.title':         'Drill library',
      'lib.subtitle':      '{n} drills · every one on a real court',
      'lib.untitled':      'Untitled',
      'lib.cardsub':       '{reps} · {mins} min',
      'lib.defaultdesc':   'Practice this drill at game pace.',
      'lib.start':         'Start drill',
      'lib.empty.title':   'Nothing here',
      'lib.empty.cat':     'No drills in this category yet.',
      'lib.empty.db':      'Drill database not loaded.',
      'lib.drill':         'Drill'
    },
    he: {
      'lib.cat.all':       'הכל',
      'lib.cat.shoot':     'קליעה',
      'lib.cat.handle':    'כדרור',
      'lib.cat.finish':    'סיומות',
      'lib.cat.defense':   'הגנה',
      'lib.cat.condition': 'כושר',
      'lib.cat.strength':  'כוח',
      'lib.cat.pass':      'מסירות',
      'lib.cat.feet':      'רגליים',
      'lib.diff.easy':     'קל',
      'lib.diff.med':      'בינוני',
      'lib.diff.hard':     'קשה',
      'lib.back':          'חזרה',
      'lib.title':         'ספריית תרגילים',
      'lib.subtitle':      '{n} תרגילים · כל אחד על מגרש אמיתי',
      'lib.untitled':      'ללא שם',
      'lib.cardsub':       '{reps} · {mins} דק׳',
      'lib.defaultdesc':   'תרגל בקצב משחק אמיתי.',
      'lib.start':         'התחל תרגיל',
      'lib.empty.title':   'אין פה כלום',
      'lib.empty.cat':     'עוד אין תרגילים בקטגוריה הזאת.',
      'lib.empty.db':      'מאגר התרגילים לא נטען.',
      'lib.drill':         'תרגיל'
    }
  };
  if (window.V12I18n) V12I18n.add(T);
  function t(k, p) { return window.V12I18n ? window.V12I18n.t(k, p) : k; }

  var CATEGORIES = [
    { key: 'Shooting',      label: 'Shoot',   labelKey: 'lib.cat.shoot',     icon: 'ph-crosshair-simple', tone: 'orange' },
    { key: 'Ball Handling', label: 'Handle',  labelKey: 'lib.cat.handle',    icon: 'ph-lightning',        tone: 'blue'   },
    { key: 'Finishing',     label: 'Finish',  labelKey: 'lib.cat.finish',    icon: 'ph-basketball',       tone: 'green'  },
    { key: 'Defense',       label: 'Defense', labelKey: 'lib.cat.defense',   icon: 'ph-shield',           tone: 'purple' },
    { key: 'Conditioning',  label: 'Condition', labelKey: 'lib.cat.condition', icon: 'ph-heartbeat',      tone: 'gold'   },
    { key: 'Strength',      label: 'Strength', labelKey: 'lib.cat.strength', icon: 'ph-barbell',          tone: 'blue'   },
    { key: 'Passing',       label: 'Pass',    labelKey: 'lib.cat.pass',      icon: 'ph-arrows-out',       tone: 'green'  },
    { key: 'Footwork',      label: 'Feet',    labelKey: 'lib.cat.feet',      icon: 'ph-sneaker',          tone: 'purple' }
  ];
  var CAT_INDEX = {};
  CATEGORIES.forEach(function (c) { CAT_INDEX[c.key] = c; });
  function meta(key) {
    return CAT_INDEX[key] || { key: key, label: key || t('lib.drill'), icon: 'ph-basketball', tone: 'orange' };
  }

  function diffShort(d) {
    var s = String(d || '').toLowerCase();
    if (s.indexOf('adv') === 0) return { t: t('lib.diff.hard'), cls: 'is-hard' };
    if (s.indexOf('int') === 0) return { t: t('lib.diff.med'), cls: 'is-med' };
    return { t: t('lib.diff.easy'), cls: 'is-easy' };
  }

  function loadDrills() {
    try {
      if (typeof _DRILLS_DB !== 'undefined' && Array.isArray(_DRILLS_DB)) return _DRILLS_DB;
    } catch (e) {}
    return [];
  }

  function startDrill(d, ctx) {
    try {
      sessionStorage.setItem('courtiq_v11_drill', JSON.stringify({
        id: d.id, name: d.name,
        reps: d.reps_or_sets ? parseInt(String(d.reps_or_sets), 10) || 30 : 30,
        mins: d.duration_minutes || 6,
        focus: d.focus_area || 'Skill',
        description: d.description || ''
      }));
    } catch (e) {}
    ctx.go('workout-player');
  }

  /* ── one drill card ─────────────────────────────────────────── */
  function drillCard(d, i, isOpen, onToggle, ctx) {
    var cat = meta(d.focus_area);
    var diff = diffShort(d.difficulty);

    var head = h('div', { class: 'dl12-head' }, [
      h('div', { class: 'dl12-thumb' }, [
        /* the SAME diagram the open card animates, frozen — a thumb that
           doesn't match its drill promises the wrong thing */
        (function () {
          try {
            var c = window.V12DrillChoreo && window.V12DrillCourt &&
                    window.V12DrillChoreo.get(d);
            if (c) return window.V12DrillCourt.render(c, { label: d.name, still: true });
          } catch (e) {}
          return V12.courtThumb(d.focus_area, i, { label: d.name });
        })()
      ]),
      h('div', { class: 'dl12-main' }, [
        h('div', { class: 'dl12-name',
          text: (window.V12Drills ? V12Drills.name(d) : d.name) || t('lib.untitled') }),
        h('div', { class: 'dl12-sub',
          text: t('lib.cardsub', { reps: d.reps_or_sets || '', mins: d.duration_minutes || 0 }) })
      ]),
      h('div', { class: 'dl12-diff ' + diff.cls, text: diff.t }),
      h('i', { class: 'ph-bold ' + (isOpen ? 'ph-caret-up' : 'ph-caret-down') + ' dl12-chev' })
    ]);

    var kids = [head];
    if (isOpen) {
      var equip = (d.equipment_needed && d.equipment_needed.length) ? d.equipment_needed.join(' · ') : '';
      kids.push(h('div', { class: 'dl12-body' }, [
        h('div', { class: 'dl12-bigcourt' }, [
          /* the drill's OWN choreography — spots, paths and ball on the
             real court; category thumb only if the choreo layer is out */
          (function () {
            try {
              var c = window.V12DrillChoreo && window.V12DrillCourt &&
                      window.V12DrillChoreo.get(d);
              if (c) return window.V12DrillCourt.render(c, { label: d.name });
            } catch (e) {}
            return V12.courtThumb(d.focus_area, i, { label: d.name, bg: '#FFFFFF' });
          })()
        ]),
        h('div', { class: 'dl12-desc',
          text: (window.V12Drills ? V12Drills.desc(d) : d.description) || t('lib.defaultdesc') }),
        equip ? h('div', { class: 'dl12-equip' }, [
          h('i', { class: 'ph-bold ph-package' }),
          h('span', { text: equip })
        ]) : null,
        V12.btn({
          label: t('lib.start'), icon: 'ph-play-circle',
          onClick: function () { startDrill(d, ctx); }
        })
      ].filter(Boolean)));
    }

    var el = V12.card({ class: 'dl12-card' + (isOpen ? ' is-open is-' + cat.tone : '') }, kids);
    head.addEventListener('click', onToggle);
    return el;
  }

  /* ── chips ──────────────────────────────────────────────────── */
  function chips(activeKey, counts, onPick) {
    var row = h('div', { class: 'dl12-chips' });
    var all = [{ key: 'ALL', label: 'All', labelKey: 'lib.cat.all', icon: 'ph-list-bullets', tone: 'orange' }]
      .concat(CATEGORIES);
    all.forEach(function (c) {
      var n = c.key === 'ALL' ? counts.total : (counts.byCat[c.key] || 0);
      if (c.key !== 'ALL' && !n) return;
      row.appendChild(h('button', {
        class: 'dl12-chip dl12-chip--' + c.tone + (c.key === activeKey ? ' is-active' : ''),
        type: 'button',
        onclick: function () { onPick(c.key); }
      }, [
        h('i', { class: 'ph-bold ' + c.icon }),
        h('span', { text: c.labelKey ? t(c.labelKey) : c.label }),
        h('span', { class: 'dl12-chip__n', text: String(n) })
      ]));
    });
    return row;
  }

  /* ── render ─────────────────────────────────────────────────── */
  function render(args) {
    var host = args.host, ctx = args.ctx;
    var drills = loadDrills();

    var byCat = {};
    drills.forEach(function (d) {
      var k = d.focus_area || 'Other';
      (byCat[k] = byCat[k] || []).push(d);
    });
    var counts = { total: drills.length, byCat: {} };
    Object.keys(byCat).forEach(function (k) { counts.byCat[k] = byCat[k].length; });

    var state = { filter: 'ALL', openId: null };

    function visible() {
      return state.filter === 'ALL' ? drills : (byCat[state.filter] || []);
    }

    function paint() {
      while (host.firstChild) host.removeChild(host.firstChild);

      host.appendChild(h('div', { class: 'c12-chat-hd' }, [
        h('button', {
          class: 'c12-back', type: 'button', 'aria-label': t('lib.back'),
          onclick: function () { ctx.back(); }
        }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
        h('div', {}, [
          h('div', { class: 'c12-chat-hd__t', text: t('lib.title') }),
          h('div', { class: 'c12-chat-hd__s', text: t('lib.subtitle', { n: drills.length }) })
        ])
      ]));

      host.appendChild(chips(state.filter, counts, function (key) {
        state.filter = key; state.openId = null; paint();
        try { window.scrollTo(0, 0); } catch (e) {}
      }));

      var list = h('div', { class: 'dl12-list' });
      var rows = visible();
      if (!rows.length) {
        list.appendChild(h('div', { class: 'd-empty' }, [
          h('i', { class: 'ph-bold ph-books d-empty__icon' }),
          h('div', { class: 'd-empty__t', text: t('lib.empty.title') }),
          h('div', { class: 'd-empty__b', text: drills.length
            ? t('lib.empty.cat') : t('lib.empty.db') })
        ]));
      }
      /* 178 cards × an SVG each in one synchronous pass blocked the main
         thread for the whole entry animation — that jank read as "the
         transition is broken". First 30 land instantly, the rest stream
         in 30 per frame; a repaint (or leaving) cancels the stream. */
      var BATCH = 30, cursor = 0;
      var myPaint = (paint._gen = (paint._gen || 0) + 1);
      function addCard(d, i) {
        var isOpen = state.openId === d.id;
        list.appendChild(drillCard(d, i, isOpen, function () {
          state.openId = isOpen ? null : d.id;
          paint();
        }, ctx));
      }
      /* setTimeout, not rAF: rAF never fires in a backgrounded webview,
         which would freeze the stream until the app is foregrounded. */
      function pump() {
        if (paint._gen !== myPaint || !list.isConnected) return;
        var end = Math.min(rows.length, cursor + BATCH);
        for (; cursor < end; cursor++) addCard(rows[cursor], cursor);
        if (cursor < rows.length) setTimeout(pump, 16);
      }
      var first = Math.min(rows.length, BATCH);
      for (; cursor < first; cursor++) addCard(rows[cursor], cursor);
      host.appendChild(list);
      if (cursor < rows.length) setTimeout(pump, 16);
    }

    paint();
  }

  window.app.register('drill-library', render);
})();
