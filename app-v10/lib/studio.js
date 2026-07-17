/* CourtIQ — DESIGN STUDIO
   ------------------------------------------------------------------
   A live token editor. Open it, drag things, watch the real app change.

   Why this exists: the design loop was broken. I can't see the screens
   (screenshots time out in my environment), so I was designing blind,
   verifying with DOM measurements — and a measurement can't tell you if
   something looks good. Every iteration cost a round-trip through a human
   who had to look at it for me. This closes that loop by putting the
   controls in the hands of the person who CAN see.

   Why it works at all: components.css is 100% token-driven — 131 var()
   references, zero hardcoded hex. So overriding a token on :root moves
   every component that uses it, consistently, with no per-component work.
   That's not luck, it's the payoff of how the system was built.

   Everything writes to documentElement.style, persists to localStorage,
   and survives reload. "Copy CSS" emits only what you actually changed,
   so it's a diff, not a dump.

   DEV ONLY — index.html loads this behind a localhost/?studio check.
   ============================================================ */
(function () {
  'use strict';

  var LS = 'courtiq_studio_v1';

  /* Overrides go on <body>, NOT <html>. v11.css re-declares the palette on
     `body:is([data-screen=...])` to scope the dark theme to the tab
     screens — so a token set on :root is shadowed by body and the app
     ignores it entirely. An inline style on body outranks that rule, so
     this is the one place the override actually lands.
     (Found the hard way: the Cream preset changed --ink on <html> and the
     page stayed dark.) */
  var root = document.body || document.documentElement;
  var state = {};
  var panel = null, open = false;

  /* Grouped by the QUESTION each one answers, not by CSS type — that's
     how you actually think when something "feels wrong". */
  var GROUPS = [
    {
      name: 'GROUND', hint: 'The page itself.',
      items: [
        { k: '--h-void',   t: 'color', label: 'Page background' },
        { k: '--h-lift',   t: 'color', label: 'Top glow' },
        { k: '--cream',    t: 'color', label: 'Card surface' },
        { k: '--cream-deep', t: 'color', label: 'Nested surface' }
      ]
    },
    {
      name: 'INK', hint: 'Everything you read.',
      items: [
        { k: '--ink',    t: 'color', label: 'Text' },
        { k: '--muted',  t: 'color', label: 'Quiet text' }
      ]
    },
    {
      name: 'ACCENT', hint: 'Oura caps accent at 5% of a dark screen. Spend it on the tappable and the achieved.',
      items: [
        { k: '--orange',  t: 'color', label: 'Primary / miss' },
        { k: '--sage',    t: 'color', label: 'Made / good' },
        { k: '--mustard', t: 'color', label: 'Warning' }
      ]
    },
    {
      name: 'TYPE', hint: 'Scale multiplies every size at once.',
      items: [
        { k: '--x-type',  t: 'range', label: 'Type scale', min: 0.8, max: 1.35, step: 0.01, def: 1 },
        { k: '--x-track', t: 'range', label: 'Letter spacing', min: -0.02, max: 0.12, step: 0.005, def: 0, unit: 'em' },
        { k: '--font-display', t: 'font', label: 'Headline face' },
        { k: '--font-body',    t: 'font', label: 'Body face' }
      ]
    },
    {
      name: 'SHAPE', hint: 'Radius 0 is the print language. Raise it and it becomes a normal app.',
      items: [
        { k: '--x-radius', t: 'range', label: 'Corner radius', min: 0, max: 24, step: 1, def: 4, unit: 'px' },
        { k: '--x-border', t: 'range', label: 'Border weight', min: 0, max: 3, step: .5, def: 1.5, unit: 'px' },
        { k: '--x-space',  t: 'range', label: 'Density', min: 0.6, max: 1.6, step: 0.05, def: 1 }
      ]
    }
  ];

  /* The three directions we actually discussed, as one tap each. Judging
     them on real screens beats judging them on a mockup — that mismatch
     is how the striping got approved in the first place. */
  var PRESETS = {
    'Dark': {
      '--h-void': '#060D18', '--h-lift': '#132741',
      '--cream': '#111D30', '--cream-deep': '#18263C',
      '--ink': '#E9EDF3', '--muted': '#93A6C2', '--x-radius': '4'
    },
    'Cream': {
      '--h-void': '#FBF5E8', '--h-lift': '#FFFDF7',
      '--cream': '#FBF5E8', '--cream-deep': '#F0E8D8',
      '--ink': '#0A2850', '--muted': '#6B5840', '--x-radius': '0'
    },
    'Soft dark': {
      '--h-void': '#14161A', '--h-lift': '#22262E',
      '--cream': '#1C2027', '--cream-deep': '#242932',
      '--ink': '#ECEEF1', '--muted': '#98A0AC', '--x-radius': '14'
    },
    'Court': {
      '--h-void': '#0B0E0C', '--h-lift': '#1A2118',
      '--cream': '#151A14', '--cream-deep': '#1E251C',
      '--ink': '#EDEFEA', '--muted': '#98A394',
      '--orange': '#FF6B2C', '--x-radius': '8'
    }
  };

  var FONTS = [
    "'Barlow Condensed', Impact, sans-serif",
    "'Lora', Georgia, serif",
    "'JetBrains Mono', ui-monospace, monospace",
    "system-ui, -apple-system, 'Segoe UI', sans-serif",
    "Georgia, 'Times New Roman', serif",
    "Impact, 'Arial Narrow Bold', sans-serif"
  ];

  function load() {
    try { state = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { state = {}; }
  }
  function save() {
    try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {}
  }

  function apply() {
    Object.keys(state).forEach(function (k) { root.style.setProperty(k, state[k]); });
    // The x- knobs aren't real tokens; they drive derived rules below.
    derive();
  }

  /* The multiplier knobs can't be plain tokens because the values they
     scale are baked into components.css. So they're applied as a live
     stylesheet instead — same effect, no source edits. */
  var derived = null;
  function derive() {
    if (!derived) {
      derived = document.createElement('style');
      derived.id = 'studio-derived';
      document.head.appendChild(derived);
    }
    var type   = state['--x-type']   || 1;
    var track  = state['--x-track'];
    var radius = state['--x-radius'];
    var border = state['--x-border'];
    var space  = state['--x-space']  || 1;
    var css = '';

    if (type && +type !== 1) css += 'html{font-size:' + (100 * type) + '%}\n';
    if (radius != null && radius !== '') {
      css += ':root{--x-r:' + radius + 'px}\n' +
        '#app [class*="v10-"], #app [class*="v11-"], .v11-hud__frame, .v11-snack' +
        '{border-radius:var(--x-r) !important}\n' +
        '.v11-hd__av, .v11-id__av, .v11-node__dot{border-radius:50% !important}\n';
    }
    if (border != null && border !== '') {
      css += '#app [class*="v10-"], #app [class*="v11-"]{border-width:' + border + 'px}\n';
    }
    if (track != null && track !== '' && +track !== 0) {
      css += '#app [class*="__t"], #app [class*="title"], #app .v11-title' +
             '{letter-spacing:' + track + 'em}\n';
    }
    if (+space !== 1) {
      ['1:4','2:8','3:12','4:16','5:20','6:24','8:32','10:40','12:48'].forEach(function (p) {
        var a = p.split(':');
        css += ':root{--s-' + a[0] + ':' + Math.round(+a[1] * space) + 'px}\n';
      });
    }
    derived.textContent = css;
  }

  function set(k, v) {
    state[k] = v; save();
    if (k.indexOf('--x-') === 0) derive();
    else root.style.setProperty(k, v);
  }

  function cur(k, fallback) {
    if (state[k] != null) return state[k];
    var v = getComputedStyle(root).getPropertyValue(k).trim();
    return v || fallback || '';
  }

  /* getComputedStyle hands back rgb(); <input type=color> demands hex. */
  function toHex(c) {
    if (!c) return '#000000';
    if (c[0] === '#') return c.length === 4
      ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(0, 7);
    var m = c.match(/\d+/g);
    if (!m) return '#000000';
    return '#' + m.slice(0, 3).map(function (n) {
      return ('0' + (+n).toString(16)).slice(-2);
    }).join('');
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function buildRow(it) {
    var row = el('div', 'stu-row');
    row.appendChild(el('label', 'stu-lab', it.label));

    if (it.t === 'color') {
      var wrap = el('div', 'stu-cw');
      var inp = document.createElement('input');
      inp.type = 'color';
      inp.value = toHex(cur(it.k));
      inp.oninput = function () { set(it.k, inp.value); hexTxt.value = inp.value; };
      var hexTxt = document.createElement('input');
      hexTxt.type = 'text'; hexTxt.className = 'stu-hex';
      hexTxt.value = toHex(cur(it.k));
      hexTxt.onchange = function () {
        if (/^#[0-9a-f]{6}$/i.test(hexTxt.value)) { set(it.k, hexTxt.value); inp.value = hexTxt.value; }
      };
      wrap.appendChild(inp); wrap.appendChild(hexTxt);
      row.appendChild(wrap);
      row._sync = function () {
        inp.value = toHex(cur(it.k)); hexTxt.value = inp.value;
      };
    } else if (it.t === 'range') {
      var v = state[it.k] != null ? +state[it.k] : it.def;
      var out = el('span', 'stu-out', String(v) + (it.unit || ''));
      var r = document.createElement('input');
      r.type = 'range'; r.min = it.min; r.max = it.max; r.step = it.step; r.value = v;
      r.oninput = function () { out.textContent = r.value + (it.unit || ''); set(it.k, r.value); };
      var wr = el('div', 'stu-cw'); wr.appendChild(r); wr.appendChild(out);
      row.appendChild(wr);
      row._sync = function () {
        var vv = state[it.k] != null ? +state[it.k] : it.def;
        r.value = vv; out.textContent = vv + (it.unit || '');
      };
    } else if (it.t === 'font') {
      var s = document.createElement('select'); s.className = 'stu-sel';
      FONTS.forEach(function (f) {
        var o = document.createElement('option');
        o.value = f; o.textContent = f.split(',')[0].replace(/'/g, '');
        s.appendChild(o);
      });
      s.value = cur(it.k) || FONTS[0];
      s.onchange = function () { set(it.k, s.value); };
      row.appendChild(s);
      row._sync = function () { s.value = cur(it.k) || FONTS[0]; };
    }
    return row;
  }

  var rows = [];
  function syncAll() { rows.forEach(function (r) { if (r._sync) r._sync(); }); }

  function cssOut() {
    var keys = Object.keys(state);
    if (!keys.length) return '/* nothing changed yet */';
    var tok = keys.filter(function (k) { return k.indexOf('--x-') !== 0; });
    var knb = keys.filter(function (k) { return k.indexOf('--x-') === 0; });
    /* Emit the selector the app actually READS. `:root` would look right
       and do nothing — v11.css re-declares the palette on the body
       selector, which shadows :root. Export what can be pasted, not what
       reads nicely. */
    var SEL = 'body:is([data-screen="home"], [data-screen="track"],\n' +
              '        [data-screen="train"], [data-screen="coach"],\n' +
              '        [data-screen="me"], [data-screen="post-session"])';
    var s = '';
    if (tok.length) {
      s += SEL + ' {\n' + tok.map(function (k) {
        return '  ' + k + ': ' + state[k] + ';';
      }).join('\n') + '\n}\n';
    }
    if (knb.length) {
      s += '\n/* knobs — tell Claude these, they are not raw tokens:\n' +
        knb.map(function (k) { return '   ' + k + ' = ' + state[k]; }).join('\n') + '\n*/\n';
    }
    return s;
  }

  function build() {
    panel = el('div', 'stu');
    var hd = el('div', 'stu-hd');
    hd.appendChild(el('div', 'stu-ttl', 'DESIGN STUDIO'));
    var x = el('button', 'stu-x', '✕');
    x.onclick = toggle;
    hd.appendChild(x);
    panel.appendChild(hd);

    var body = el('div', 'stu-body');

    var pl = el('div', 'stu-pre');
    pl.appendChild(el('div', 'stu-hint', 'Start from a direction, then tune it:'));
    var pr = el('div', 'stu-prow');
    Object.keys(PRESETS).forEach(function (name) {
      var b = el('button', 'stu-p', name);
      b.onclick = function () {
        Object.keys(PRESETS[name]).forEach(function (k) { set(k, PRESETS[name][k]); });
        apply(); syncAll();
      };
      pr.appendChild(b);
    });
    pl.appendChild(pr);
    body.appendChild(pl);

    GROUPS.forEach(function (g) {
      body.appendChild(el('div', 'stu-g', g.name));
      if (g.hint) body.appendChild(el('div', 'stu-hint', g.hint));
      g.items.forEach(function (it) {
        var r = buildRow(it);
        rows.push(r);
        body.appendChild(r);
      });
    });

    var out = el('textarea', 'stu-ta');
    out.readOnly = true;
    body.appendChild(el('div', 'stu-g', 'EXPORT'));
    body.appendChild(el('div', 'stu-hint',
      'Only what you changed. Paste it to Claude, or hit Copy.'));
    body.appendChild(out);

    var acts = el('div', 'stu-acts');
    var copy = el('button', 'stu-b stu-b--go', 'Copy CSS');
    copy.onclick = function () {
      out.value = cssOut();
      out.select();
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(out.value);
        else document.execCommand('copy');
        copy.textContent = 'Copied';
        setTimeout(function () { copy.textContent = 'Copy CSS'; }, 1200);
      } catch (e) {}
    };
    var reset = el('button', 'stu-b', 'Reset all');
    reset.onclick = function () {
      Object.keys(state).forEach(function (k) { root.style.removeProperty(k); });
      state = {}; save();
      if (derived) derived.textContent = '';
      syncAll(); out.value = '';
    };
    acts.appendChild(copy); acts.appendChild(reset);
    body.appendChild(acts);

    panel.appendChild(body);
    document.body.appendChild(panel);

    var fab = el('button', 'stu-fab', '◐');
    fab.title = 'Design Studio';
    fab.onclick = toggle;
    document.body.appendChild(fab);
  }

  function toggle() {
    open = !open;
    panel.classList.toggle('is-open', open);
    if (open) { syncAll(); }
  }

  load();
  function boot() { root = document.body; build(); apply(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  window.Studio = { apply: apply, state: state, css: cssOut, toggle: toggle };
})();
