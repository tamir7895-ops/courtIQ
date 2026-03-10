/* ============================================================
   AVATAR CUSTOMIZER — js/avatar-customizer.js
   DiceBear-based avatar creator.  Replaces the old 3-D system.
   API: window.AvatarCustomizer.open()
   ============================================================ */
(function () {
  'use strict';

  /* ── DiceBear endpoint ──────────────────────────────────── */
  var BASE = 'https://api.dicebear.com/9.x/avataaars/png';

  /* ── Option tables ──────────────────────────────────────── */
  var SKIN_COLORS = [
    { name: 'Pale',       id: 'pale',      hex: 'ffdbb4' },  /* schema: ffdbb4 */
    { name: 'Light',      id: 'light',     hex: 'edb98a' },
    { name: 'Mellow',     id: 'mellow',    hex: 'd08b5b' },
    { name: 'Brown',      id: 'brown',     hex: 'ae5d29' },
    { name: 'Dark Brown', id: 'darkBrown', hex: '614335' }
  ];

  var HAIR_COLORS = [
    { name: 'Auburn',      id: 'auburn',     hex: 'a55728' },
    { name: 'Black',       id: 'black',      hex: '2c1b18' },
    { name: 'Blonde',      id: 'blonde',     hex: 'b58143' },
    { name: 'Brown',       id: 'brown',      hex: '724133' },
    { name: 'Pastel Pink', id: 'pastelPink', hex: 'f59797' }
  ];

  /* top= values use DiceBear v9 avataaars schema identifiers */
  var HAIR_MALE = [
    { name: 'Short',  id: 'shortHair', top: 'shortFlat'       },
    { name: 'Curly',  id: 'curly',     top: 'shortCurly'      },
    { name: 'Wavy',   id: 'wavy',      top: 'shortWaved'      },
    { name: 'Bun',    id: 'bun',       top: 'bun'             },
    { name: 'Hat',    id: 'hat',       top: 'hat'             },
    { name: 'Hijab',  id: 'hijab',     top: 'hijab'           }
  ];

  var HAIR_FEMALE = [
    { name: 'Short',  id: 'shortHair', top: 'shortFlat'       },
    { name: 'Long',   id: 'longHair',  top: 'straight02'      },
    { name: 'Curly',  id: 'curly',     top: 'curly'           },
    { name: 'Bun',    id: 'bun',       top: 'bun'             },
    { name: 'Hat',    id: 'hat',       top: 'hat'             },
    { name: 'Hijab',  id: 'hijab',     top: 'hijab'           }
  ];

  var EYE_STYLES = [
    { name: 'Default', id: 'default' },
    { name: 'Happy',   id: 'happy'   },
    { name: 'Wink',    id: 'wink'    },
    { name: 'Squint',  id: 'squint'  }
  ];

  var CLOTHES = [
    { name: 'Blazer',    id: 'blazerShirt'   },
    { name: 'Graphic',   id: 'graphicShirt'  },
    { name: 'Hoodie',    id: 'hoodie'        },
    { name: 'Overall',   id: 'overall'       },
    { name: 'Crew Neck', id: 'shirtCrewNeck' },
    { name: 'V-Neck',    id: 'shirtVNeck'    }
  ];

  var ACCESSORIES = [
    { name: 'None',    id: 'none',           param: 'blank'          },
    { name: 'Glasses', id: 'prescription01', param: 'prescription01' }
  ];

  /* ── Mutable editor state ───────────────────────────────── */
  var st = {
    gender:    null,
    skin:      'light',
    hair:      'shortHair',
    hairColor: 'black',
    eyes:      'default',
    clothes:   'hoodie',
    accessory: 'none',
    tab:       'face'
  };

  /* ── Helpers ────────────────────────────────────────────── */
  function find(arr, fn) {
    for (var i = 0; i < arr.length; i++) { if (fn(arr[i])) return arr[i]; }
    return null;
  }

  function hairList() {
    return st.gender === 'female' ? HAIR_FEMALE : HAIR_MALE;
  }

  function topParam() {
    var s = find(hairList(), function (h) { return h.id === st.hair; });
    return s ? s.top : hairList()[0].top;
  }

  function hexFor(arr, id) {
    var s = find(arr, function (x) { return x.id === id; });
    return s ? s.hex : arr[0].hex;
  }

  function accessoryParam() {
    var s = find(ACCESSORIES, function (a) { return a.id === st.accessory; });
    return s ? s.param : 'blank';
  }

  function buildURL() {
    var p = [
      'size=300',
      'skinColor='    + hexFor(SKIN_COLORS,  st.skin),
      'top='          + topParam(),
      'hairColor='    + hexFor(HAIR_COLORS,  st.hairColor),
      'eyes='         + st.eyes,
      'clothing='     + st.clothes,
      'accessories='  + accessoryParam(),
      'seed=courtiq-' + (st.gender || 'x') + '-' + st.hair
    ];
    return BASE + '?' + p.join('&');
  }

  /* ── Preview refresh ────────────────────────────────────── */
  function refreshPreview() {
    var img  = document.getElementById('ac2-preview-img');
    var wrap = document.getElementById('ac2-preview-wrap');
    if (!img) return;
    wrap && wrap.classList.add('ac2-loading');
    img.onload = img.onerror = function () {
      wrap && wrap.classList.remove('ac2-loading');
    };
    img.src = buildURL();
  }

  /* ── Modal HTML ─────────────────────────────────────────── */
  var MODAL_HTML = [
    '<div class="ac2-modal" role="dialog" aria-modal="true" aria-label="Avatar Customizer">',

      /* ─ Step 1 : Gender ─ */
      '<div class="ac2-step" id="ac2-step-gender">',
        '<div class="ac2-header">',
          '<h2 class="ac2-title">Create Your Avatar</h2>',
          '<button class="ac2-close-btn" id="ac2-close-gender" type="button" aria-label="Close">&#x2715;</button>',
        '</div>',
        '<p class="ac2-subtitle">Choose a style to begin</p>',
        '<div class="ac2-gender-grid">',
          '<button class="ac2-gender-card" data-gender="male" type="button">',
            '<div class="ac2-gender-icon">',
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">',
                '<circle cx="12" cy="7" r="4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
              '</svg>',
            '</div>',
            '<span class="ac2-gender-label">Male</span>',
          '</button>',
          '<button class="ac2-gender-card" data-gender="female" type="button">',
            '<div class="ac2-gender-icon">',
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">',
                '<circle cx="12" cy="7" r="4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
                '<path d="M8 12 Q12 16 16 12"/>',
              '</svg>',
            '</div>',
            '<span class="ac2-gender-label">Female</span>',
          '</button>',
        '</div>',
      '</div>',

      /* ─ Step 2 : Editor ─ */
      '<div class="ac2-step ac2-step--hidden" id="ac2-step-editor">',
        '<div class="ac2-header">',
          '<button class="ac2-back-btn" id="ac2-back" type="button">&#8592; Back</button>',
          '<h2 class="ac2-title">Customize Avatar</h2>',
          '<button class="ac2-close-btn" id="ac2-close-editor" type="button" aria-label="Close">&#x2715;</button>',
        '</div>',

        '<div class="ac2-preview-wrap" id="ac2-preview-wrap">',
          '<div class="ac2-spinner" aria-hidden="true"></div>',
          '<img class="ac2-preview-img" id="ac2-preview-img" alt="Avatar preview" width="300" height="300" />',
        '</div>',

        '<nav class="ac2-tabs" id="ac2-tabs" role="tablist">',
          '<button class="ac2-tab active" data-tab="face"        role="tab" type="button">Face</button>',
          '<button class="ac2-tab"        data-tab="hair"        role="tab" type="button">Hair</button>',
          '<button class="ac2-tab"        data-tab="eyes"        role="tab" type="button">Eyes</button>',
          '<button class="ac2-tab"        data-tab="clothes"     role="tab" type="button">Clothes</button>',
          '<button class="ac2-tab"        data-tab="accessories" role="tab" type="button">Accessories</button>',
        '</nav>',

        '<div class="ac2-panel" id="ac2-panel"></div>',

        '<div class="ac2-footer">',
          '<button class="ac2-btn-ghost"   id="ac2-cancel" type="button">Cancel</button>',
          '<button class="ac2-btn-primary" id="ac2-save"   type="button">Save Avatar</button>',
        '</div>',
      '</div>',

    '</div>'
  ].join('');

  /* ── Inject overlay once ────────────────────────────────── */
  function ensureModal() {
    if (document.getElementById('ac2-overlay')) return;
    var el = document.createElement('div');
    el.id        = 'ac2-overlay';
    el.className = 'ac2-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = MODAL_HTML;
    document.body.appendChild(el);
    wireOverlay(el);
  }

  /* ── Render panel content ───────────────────────────────── */
  function renderPanel(tab) {
    var host = document.getElementById('ac2-panel');
    if (!host) return;
    var html = '';

    if (tab === 'face') {
      html += section('Skin Color', swatches(SKIN_COLORS, 'skin', st.skin));
    }

    if (tab === 'hair') {
      html += section('Style',      optGrid(hairList(),  'hair',      st.hair));
      html += section('Color',      swatches(HAIR_COLORS, 'hairColor', st.hairColor));
    }

    if (tab === 'eyes') {
      html += section('Eye Style',  optGrid(EYE_STYLES,  'eyes',      st.eyes));
    }

    if (tab === 'clothes') {
      html += section('Shirt Style',optGrid(CLOTHES,     'clothes',   st.clothes));
    }

    if (tab === 'accessories') {
      html += section('Accessories',optGrid(ACCESSORIES, 'accessory', st.accessory));
    }

    host.innerHTML = html;

    /* wire option buttons */
    var buttons = host.querySelectorAll('[data-prop]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', onOption);
    }
  }

  function section(label, inner) {
    return '<div class="ac2-section"><div class="ac2-section-label">' + label + '</div>' + inner + '</div>';
  }

  function swatches(arr, prop, current) {
    var html = '<div class="ac2-swatch-row">';
    for (var i = 0; i < arr.length; i++) {
      var c   = arr[i];
      var sel = (c.id === current) ? ' ac2-swatch--sel' : '';
      html += '<button class="ac2-swatch' + sel + '"' +
        ' data-prop="' + prop + '" data-value="' + c.id + '"' +
        ' style="background:#' + c.hex + '"' +
        ' title="' + c.name + '" type="button">' +
        (c.id === current ? '<span class="ac2-check">&#x2713;</span>' : '') +
        '</button>';
    }
    return html + '</div>';
  }

  function optGrid(arr, prop, current) {
    var html = '<div class="ac2-opt-grid">';
    for (var i = 0; i < arr.length; i++) {
      var o   = arr[i];
      var sel = (o.id === current) ? ' ac2-opt--sel' : '';
      html += '<button class="ac2-opt' + sel + '"' +
        ' data-prop="' + prop + '" data-value="' + o.id + '"' +
        ' type="button">' + o.name + '</button>';
    }
    return html + '</div>';
  }

  function onOption() {
    var prop = this.dataset.prop;
    var val  = this.dataset.value;
    st[prop] = val;

    /* update selection UI without full re-render */
    var siblings = document.querySelectorAll('#ac2-panel [data-prop="' + prop + '"]');
    for (var i = 0; i < siblings.length; i++) {
      var s   = siblings[i];
      var hit = (s.dataset.value === val);
      s.classList.toggle('ac2-swatch--sel', hit);
      s.classList.toggle('ac2-opt--sel',    hit);
      /* update checkmark for swatches */
      if (s.classList.contains('ac2-swatch')) {
        s.innerHTML = hit ? '<span class="ac2-check">&#x2713;</span>' : '';
      }
    }

    refreshPreview();
  }

  /* ── Tab switching ──────────────────────────────────────── */
  function activateTab(name) {
    st.tab = name;
    var tabs = document.querySelectorAll('.ac2-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].dataset.tab === name);
    }
    renderPanel(name);
  }

  /* ── Step navigation ────────────────────────────────────── */
  function showGender() {
    document.getElementById('ac2-step-gender').classList.remove('ac2-step--hidden');
    document.getElementById('ac2-step-editor').classList.add('ac2-step--hidden');
  }

  function showEditor() {
    document.getElementById('ac2-step-gender').classList.add('ac2-step--hidden');
    document.getElementById('ac2-step-editor').classList.remove('ac2-step--hidden');
    activateTab('face');
    refreshPreview();
  }

  /* ── Wire all event listeners ───────────────────────────── */
  function wireOverlay(overlay) {
    /* gender cards */
    var cards = overlay.querySelectorAll('.ac2-gender-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function () {
        st.gender = this.dataset.gender;
        st.hair   = hairList()[0].id;   /* reset hair to gender default */
        showEditor();
      });
    }

    /* close / cancel */
    var closeIds = ['ac2-close-gender', 'ac2-close-editor', 'ac2-cancel'];
    for (var j = 0; j < closeIds.length; j++) {
      var el = document.getElementById(closeIds[j]);
      if (el) el.addEventListener('click', closeModal);
    }

    /* back */
    var back = document.getElementById('ac2-back');
    if (back) back.addEventListener('click', showGender);

    /* save */
    var save = document.getElementById('ac2-save');
    if (save) save.addEventListener('click', saveAvatar);

    /* tabs */
    var tabBtns = overlay.querySelectorAll('.ac2-tab');
    for (var k = 0; k < tabBtns.length; k++) {
      tabBtns[k].addEventListener('click', function () { activateTab(this.dataset.tab); });
    }

    /* backdrop */
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
  }

  /* ── Open ───────────────────────────────────────────────── */
  function openModal() {
    ensureModal();
    /* reset state */
    st.gender    = null;
    st.skin      = 'light';
    st.hair      = 'shortHair';
    st.hairColor = 'black';
    st.eyes      = 'default';
    st.clothes   = 'hoodie';
    st.accessory = 'none';
    st.tab       = 'face';

    showGender();

    var overlay = document.getElementById('ac2-overlay');
    overlay.classList.add('ac2-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  /* ── Close ──────────────────────────────────────────────── */
  function closeModal() {
    var overlay = document.getElementById('ac2-overlay');
    if (!overlay) return;
    overlay.classList.remove('ac2-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ── Save ───────────────────────────────────────────────── */
  function saveAvatar() {
    var url = buildURL();
    localStorage.setItem('courtiq_avatar_url', url);

    updateSidebarAvatar(url);
    closeModal();

    if (typeof showToast === 'function') showToast('Avatar saved');
  }

  /* ── Sidebar helper ─────────────────────────────────────── */
  function updateSidebarAvatar(url) {
    var el = document.getElementById('db-sidebar-avatar');
    if (!el) return;
    el.innerHTML = '<img src="' + url +
      '" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />';
    el.style.padding  = '0';
    el.style.fontSize = '0';
    el.style.lineHeight = '1';
  }

  /* ── Restore saved avatar on load ───────────────────────── */
  function restoreOnLoad() {
    var url = localStorage.getItem('courtiq_avatar_url');
    if (url) updateSidebarAvatar(url);
  }

  /* ── Escape key ─────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var overlay = document.getElementById('ac2-overlay');
    if (overlay && overlay.classList.contains('ac2-open')) closeModal();
  });

  /* ── Boot ───────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreOnLoad);
  } else {
    restoreOnLoad();
  }

  /* ── Public API ─────────────────────────────────────────── */
  window.AvatarCustomizer = { open: openModal, close: closeModal };
})();
