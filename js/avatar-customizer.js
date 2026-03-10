/* ============================================================
   AVATAR CUSTOMIZER v2 — js/avatar-customizer.js
   DiceBear avataaars · full-body portrait preview
   API: window.AvatarCustomizer.open()
   ============================================================ */
(function () {
  'use strict';

  var BASE = 'https://api.dicebear.com/9.x/avataaars/png';

  /* ── Option tables ──────────────────────────────────────── */
  var SKIN_COLORS = [
    { name: 'Pale',       id: 'pale',      hex: 'ffdbb4' },
    { name: 'Light',      id: 'light',     hex: 'edb98a' },
    { name: 'Mellow',     id: 'mellow',    hex: 'd08b5b' },
    { name: 'Brown',      id: 'brown',     hex: 'ae5d29' },
    { name: 'Dark Brown', id: 'darkBrown', hex: '614335' }
  ];

  var HAIR_COLORS = [
    { name: 'Auburn',   id: 'auburn',     hex: 'a55728' },
    { name: 'Black',    id: 'black',      hex: '2c1b18' },
    { name: 'Blonde',   id: 'blonde',     hex: 'b58143' },
    { name: 'Brown',    id: 'brown',      hex: '724133' },
    { name: 'Platinum', id: 'platinum',   hex: 'ecdcbf' },
    { name: 'Red',      id: 'red',        hex: 'c93305' },
    { name: 'Pink',     id: 'pastelPink', hex: 'f59797' },
    { name: 'Silver',   id: 'silver',     hex: 'e8e1e1' }
  ];

  var CLOTHES_COLORS = [
    { name: 'Charcoal', id: 'charcoal', hex: '262e33' },
    { name: 'Sky Blue', id: 'skyblue',  hex: '65c9ff' },
    { name: 'Blue',     id: 'blue',     hex: '5199e4' },
    { name: 'Navy',     id: 'navy',     hex: '25557c' },
    { name: 'Mint',     id: 'mint',     hex: 'a7ffc4' },
    { name: 'Pink',     id: 'pink',     hex: 'ffafb9' },
    { name: 'Red',      id: 'red',      hex: 'ff5c5c' },
    { name: 'White',    id: 'white',    hex: 'e6e6e6' }
  ];

  var BG_COLORS = [
    { name: 'None',      id: 'none',   hex: '' },
    { name: 'Sky Blue',  id: 'skyblue',hex: '65c9ff' },
    { name: 'Pale Blue', id: 'pale',   hex: 'b1e2ff' },
    { name: 'Mint',      id: 'mint',   hex: 'a7ffc4' },
    { name: 'Pink',      id: 'pink',   hex: 'ffafb9' },
    { name: 'Yellow',    id: 'yellow', hex: 'ffffb1' },
    { name: 'Dark',      id: 'dark',   hex: '262e33' }
  ];

  var HAIR_MALE = [
    { name: 'Short Flat',  id: 'shortFlat',  top: 'shortFlat'        },
    { name: 'Short Round', id: 'shortRound', top: 'shortRound'       },
    { name: 'Short Curly', id: 'shortCurly', top: 'shortCurly'       },
    { name: 'Short Wavy',  id: 'shortWaved', top: 'shortWaved'       },
    { name: 'Caesar',      id: 'theCaesar',  top: 'theCaesar'        },
    { name: 'Bun',         id: 'bun',        top: 'bun'              },
    { name: 'Dreads',      id: 'dreads',     top: 'dreads01'         },
    { name: 'Frizzle',     id: 'frizzle',    top: 'frizzle'          },
    { name: 'Hat',         id: 'hat',        top: 'hat'              },
    { name: 'Hijab',       id: 'hijab',      top: 'hijab'            }
  ];

  var HAIR_FEMALE = [
    { name: 'Short Flat',  id: 'shortFlat',  top: 'shortFlat'        },
    { name: 'Long Str.',   id: 'straight01', top: 'straight01'       },
    { name: 'Long Wavy',   id: 'straight02', top: 'straight02'       },
    { name: 'Big Hair',    id: 'bigHair',    top: 'bigHair'          },
    { name: 'Curly',       id: 'curly',      top: 'curly'            },
    { name: 'Curvy',       id: 'curvy',      top: 'curvy'            },
    { name: 'Long Bun',    id: 'bun',        top: 'bun'              },
    { name: 'Frida',       id: 'frida',      top: 'frida'            },
    { name: 'Hat',         id: 'hat',        top: 'hat'              },
    { name: 'Hijab',       id: 'hijab',      top: 'hijab'            }
  ];

  var EYE_STYLES = [
    { name: 'Default',   id: 'default'  },
    { name: 'Happy',     id: 'happy'    },
    { name: 'Wink',      id: 'wink'     },
    { name: 'Squint',    id: 'squint'   },
    { name: 'Surprised', id: 'surprised'},
    { name: 'Eye Roll',  id: 'eyeRoll'  },
    { name: 'Cry',       id: 'cry'      },
    { name: 'Side',      id: 'side'     },
    { name: 'X Dizzy',   id: 'xDizzy'  },
    { name: 'Hearts',    id: 'hearts'   }
  ];

  var EYEBROW_STYLES = [
    { name: 'Default',   id: 'default'              },
    { name: 'Raised',    id: 'raisedExcited'        },
    { name: 'Natural',   id: 'defaultNatural'       },
    { name: 'Flat',      id: 'flatNatural'          },
    { name: 'Frown',     id: 'frownNatural'         },
    { name: 'Sad',       id: 'sadConcerned'         },
    { name: 'Angry',     id: 'angryNatural'         },
    { name: 'Up/Down',   id: 'upDown'               },
    { name: 'Unibrow',   id: 'unibrowNatural'       }
  ];

  var MOUTH_STYLES = [
    { name: 'Default',   id: 'default'   },
    { name: 'Smile',     id: 'smile'     },
    { name: 'Serious',   id: 'serious'   },
    { name: 'Grimace',   id: 'grimace'   },
    { name: 'Tongue',    id: 'tongue'    },
    { name: 'Twinkle',   id: 'twinkle'   },
    { name: 'Disbelief', id: 'disbelief' },
    { name: 'Sad',       id: 'sad'       },
    { name: 'Eating',    id: 'eating'    },
    { name: 'Scream',    id: 'screamOpen'}
  ];

  var FACIAL_HAIR = [
    { name: 'None',     id: 'none',           param: '' },
    { name: 'Light',    id: 'beardLight',     param: 'beardLight'     },
    { name: 'Medium',   id: 'beardMedium',    param: 'beardMedium'    },
    { name: 'Majestic', id: 'beardMajestic',  param: 'beardMajestic'  },
    { name: 'Fancy Moustache',  id: 'moustacheFancy',  param: 'moustacheFancy'  },
    { name: 'Magnum',   id: 'moustacheMagnum',param: 'moustacheMagnum'}
  ];

  var CLOTHES = [
    { name: 'Blazer',    id: 'blazerAndShirt'  },
    { name: 'Graphic',   id: 'graphicShirt'    },
    { name: 'Hoodie',    id: 'hoodie'          },
    { name: 'Overall',   id: 'overall'         },
    { name: 'Crew Neck', id: 'shirtCrewNeck'   },
    { name: 'V-Neck',    id: 'shirtVNeck'      },
    { name: 'Sweater',   id: 'collarAndSweater'},
    { name: 'Blazer+SW', id: 'blazerAndSweater'}
  ];

  var ACCESSORIES = [
    { name: 'None',        id: 'none',          param: ''              },
    { name: 'Glasses',     id: 'prescription01',param: 'prescription01'},
    { name: 'Round',       id: 'round',         param: 'round'         },
    { name: 'Sunglasses',  id: 'sunglasses',    param: 'sunglasses'    },
    { name: 'Wayfarers',   id: 'wayfarers',     param: 'wayfarers'     }
  ];

  /* ── State ──────────────────────────────────────────────── */
  var st = {
    gender:          null,
    skin:            'light',
    hair:            'shortFlat',
    hairColor:       'black',
    eyebrows:        'default',
    eyes:            'default',
    mouth:           'default',
    facialHair:      'none',
    facialHairColor: 'black',
    clothes:         'hoodie',
    clothesColor:    'skyblue',
    accessory:       'none',
    bgColor:         'none',
    tab:             'face'
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

  function buildURL() {
    var clothesHex = hexFor(CLOTHES_COLORS, st.clothesColor);
    var p = [
      'size=300',
      'skinColor='    + hexFor(SKIN_COLORS, st.skin),
      'top='          + topParam(),
      'hairColor='    + hexFor(HAIR_COLORS, st.hairColor),
      'eyebrows='     + st.eyebrows,
      'eyes='         + st.eyes,
      'mouth='        + st.mouth,
      'clothing='     + st.clothes,
      'clothesColor=' + clothesHex,
      'seed=courtiq-' + (st.gender || 'x') + '-' + st.hair + '-' + st.skin
    ];

    /* accessories */
    var accS = find(ACCESSORIES, function (a) { return a.id === st.accessory; });
    if (accS && accS.param) p.push('accessories=' + accS.param);

    /* facial hair (male) */
    if (st.gender !== 'female') {
      var fhS = find(FACIAL_HAIR, function (f) { return f.id === st.facialHair; });
      if (fhS && fhS.param) {
        p.push('facialHair=' + fhS.param);
        p.push('facialHairColor=' + hexFor(HAIR_COLORS, st.facialHairColor));
      }
    }

    /* background */
    var bgS = find(BG_COLORS, function (b) { return b.id === st.bgColor; });
    if (bgS && bgS.hex) {
      p.push('backgroundColor=' + bgS.hex);
      p.push('backgroundType=solid');
    }

    return BASE + '?' + p.join('&');
  }

  /* ── Preview ────────────────────────────────────────────── */
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
    '<div class="ac2-modal" role="dialog" aria-modal="true">',

    /* Step 1 */
    '<div class="ac2-step" id="ac2-step-gender">',
      '<div class="ac2-header">',
        '<h2 class="ac2-title">Create Your Avatar</h2>',
        '<button class="ac2-close-btn" id="ac2-close-gender" type="button">&#x2715;</button>',
      '</div>',
      '<p class="ac2-subtitle">Choose your avatar style</p>',
      '<div class="ac2-gender-grid">',
        '<button class="ac2-gender-card" data-gender="male" type="button">',
          '<div class="ac2-gender-icon">',
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>',
          '</div>',
          '<span class="ac2-gender-label">Male</span>',
        '</button>',
        '<button class="ac2-gender-card" data-gender="female" type="button">',
          '<div class="ac2-gender-icon">',
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/><path d="M8 13 Q12 18 16 13"/></svg>',
          '</div>',
          '<span class="ac2-gender-label">Female</span>',
        '</button>',
      '</div>',
    '</div>',

    /* Step 2 */
    '<div class="ac2-step ac2-step--hidden" id="ac2-step-editor">',
      '<div class="ac2-header">',
        '<button class="ac2-back-btn" id="ac2-back" type="button">&#8592; Back</button>',
        '<h2 class="ac2-title">Customize Avatar</h2>',
        '<button class="ac2-close-btn" id="ac2-close-editor" type="button">&#x2715;</button>',
      '</div>',

      /* preview — fixed, does NOT scroll */
      '<div class="ac2-preview-wrap" id="ac2-preview-wrap">',
        '<div class="ac2-spinner" aria-hidden="true"></div>',
        '<img class="ac2-preview-img" id="ac2-preview-img" alt="Avatar" width="300" height="300" />',
      '</div>',

      /* tabs — fixed */
      '<nav class="ac2-tabs" id="ac2-tabs" role="tablist">',
        '<button class="ac2-tab active" data-tab="face"    role="tab" type="button">Face</button>',
        '<button class="ac2-tab"        data-tab="hair"    role="tab" type="button">Hair</button>',
        '<button class="ac2-tab"        data-tab="eyes"    role="tab" type="button">Eyes</button>',
        '<button class="ac2-tab"        data-tab="clothes" role="tab" type="button">Clothes</button>',
        '<button class="ac2-tab"        data-tab="more"    role="tab" type="button">More</button>',
      '</nav>',

      /* panel — scrolls independently */
      '<div class="ac2-panel" id="ac2-panel"></div>',

      '<div class="ac2-footer">',
        '<button class="ac2-btn-ghost"   id="ac2-cancel" type="button">Cancel</button>',
        '<button class="ac2-btn-primary" id="ac2-save"   type="button">Save Avatar</button>',
      '</div>',
    '</div>',

    '</div>'
  ].join('');

  /* ── Panel rendering ────────────────────────────────────── */
  function renderPanel(tab) {
    var host = document.getElementById('ac2-panel');
    if (!host) return;
    var html = '';

    if (tab === 'face') {
      html += section('Skin Color',  swatchRow(SKIN_COLORS, 'skin', st.skin));
      html += section('Eyebrows',    optGrid(EYEBROW_STYLES, 'eyebrows', st.eyebrows));
      html += section('Mouth',       optGrid(MOUTH_STYLES,   'mouth',    st.mouth));
    }

    if (tab === 'hair') {
      html += section('Style',       optGrid(hairList(),    'hair',      st.hair));
      html += section('Color',       swatchRow(HAIR_COLORS, 'hairColor', st.hairColor));
      if (st.gender !== 'female') {
        html += section('Facial Hair', optGrid(FACIAL_HAIR, 'facialHair', st.facialHair));
        html += section('Beard Color', swatchRow(HAIR_COLORS, 'facialHairColor', st.facialHairColor));
      }
    }

    if (tab === 'eyes') {
      html += section('Eye Style',   optGrid(EYE_STYLES, 'eyes', st.eyes));
    }

    if (tab === 'clothes') {
      html += section('Style',       optGrid(CLOTHES,         'clothes',     st.clothes));
      html += section('Clothes Color', swatchRow(CLOTHES_COLORS, 'clothesColor', st.clothesColor));
    }

    if (tab === 'more') {
      html += section('Accessories', optGrid(ACCESSORIES, 'accessory', st.accessory));
      html += section('Background',  swatchRow(BG_COLORS,   'bgColor',  st.bgColor, true));
    }

    host.innerHTML = html;

    /* wire clicks */
    var nodes = host.querySelectorAll('[data-prop]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener('click', onOptionClick);
    }
  }

  function section(label, inner) {
    return '<div class="ac2-section">' +
      '<div class="ac2-section-label">' + label + '</div>' + inner +
    '</div>';
  }

  function swatchRow(arr, prop, current, showNone) {
    var html = '<div class="ac2-swatch-row">';
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      var sel = (c.id === current) ? ' ac2-swatch--sel' : '';
      var style = c.hex
        ? 'background:#' + c.hex
        : 'background:repeating-conic-gradient(#555 0% 25%,#333 0% 50%) 0 0/10px 10px';
      html += '<button class="ac2-swatch' + sel + '"' +
        ' data-prop="' + prop + '" data-value="' + c.id + '"' +
        ' style="' + style + '"' +
        ' title="' + c.name + '" type="button">' +
        (c.id === current ? '<span class="ac2-check">&#x2713;</span>' : '') +
        '</button>';
    }
    return html + '</div>';
  }

  function optGrid(arr, prop, current) {
    var html = '<div class="ac2-opt-grid">';
    for (var i = 0; i < arr.length; i++) {
      var o = arr[i];
      var sel = (o.id === current) ? ' ac2-opt--sel' : '';
      html += '<button class="ac2-opt' + sel + '"' +
        ' data-prop="' + prop + '" data-value="' + o.id + '"' +
        ' type="button">' + o.name + '</button>';
    }
    return html + '</div>';
  }

  function onOptionClick() {
    var prop = this.dataset.prop;
    var val  = this.dataset.value;
    st[prop] = val;

    /* update selection state without full re-render */
    var siblings = document.querySelectorAll('#ac2-panel [data-prop="' + prop + '"]');
    for (var i = 0; i < siblings.length; i++) {
      var s   = siblings[i];
      var hit = (s.dataset.value === val);
      s.classList.toggle('ac2-swatch--sel', hit);
      s.classList.toggle('ac2-opt--sel', hit);
      if (s.classList.contains('ac2-swatch')) {
        s.innerHTML = hit ? '<span class="ac2-check">&#x2713;</span>' : '';
      }
    }
    refreshPreview();
  }

  /* ── Tabs ───────────────────────────────────────────────── */
  function activateTab(name) {
    st.tab = name;
    var tabs = document.querySelectorAll('#ac2-tabs .ac2-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].dataset.tab === name);
    }
    renderPanel(name);
  }

  /* ── Steps ──────────────────────────────────────────────── */
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

  /* ── Wire ───────────────────────────────────────────────── */
  function ensureModal() {
    if (document.getElementById('ac2-overlay')) return;
    var el = document.createElement('div');
    el.id = 'ac2-overlay';
    el.className = 'ac2-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = MODAL_HTML;
    document.body.appendChild(el);

    /* gender */
    var cards = el.querySelectorAll('.ac2-gender-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function () {
        st.gender = this.dataset.gender;
        st.hair   = hairList()[0].id;
        showEditor();
      });
    }

    /* close / cancel / back */
    ['ac2-close-gender','ac2-close-editor','ac2-cancel'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener('click', closeModal);
    });
    var back = document.getElementById('ac2-back');
    if (back) back.addEventListener('click', showGender);

    /* save */
    var save = document.getElementById('ac2-save');
    if (save) save.addEventListener('click', saveAvatar);

    /* tabs */
    var tabBtns = el.querySelectorAll('.ac2-tab');
    for (var j = 0; j < tabBtns.length; j++) {
      tabBtns[j].addEventListener('click', function () { activateTab(this.dataset.tab); });
    }

    /* backdrop */
    el.addEventListener('click', function (e) {
      if (e.target === el) closeModal();
    });
  }

  /* ── Open / Close ───────────────────────────────────────── */
  function openModal() {
    ensureModal();
    /* reset */
    Object.assign(st, {
      gender: null, skin: 'light', hair: 'shortFlat', hairColor: 'black',
      eyebrows: 'default', eyes: 'default', mouth: 'default',
      facialHair: 'none', facialHairColor: 'black',
      clothes: 'hoodie', clothesColor: 'skyblue',
      accessory: 'none', bgColor: 'none', tab: 'face'
    });
    showGender();
    var ov = document.getElementById('ac2-overlay');
    ov.classList.add('ac2-open');
    ov.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var ov = document.getElementById('ac2-overlay');
    if (!ov) return;
    ov.classList.remove('ac2-open');
    ov.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ── Save ───────────────────────────────────────────────── */
  function saveAvatar() {
    var url = buildURL();
    localStorage.setItem('courtiq_avatar_url', url);
    injectAvatarImg(url);
    closeModal();
    if (typeof showToast === 'function') showToast('Avatar saved');
  }

  /* ── Inject DiceBear img into all avatar slots ──────────── */
  function injectAvatarImg(url) {
    /* sidebar */
    var sidebar = document.getElementById('db-sidebar-avatar');
    if (sidebar) {
      sidebar.innerHTML = '<img src="' + url + '" alt="Avatar" ' +
        'style="width:100%;height:100%;object-fit:cover;border-radius:50%;object-position:center top;" />';
      sidebar.style.cssText += ';padding:0;font-size:0;line-height:1';
    }

    /* profile mini avatar (canvas → img) */
    var mini = document.getElementById('profile-mini-avatar');
    if (mini) replaceWithDiceBearImg(mini, url, '48px', '48px');

    /* profile summary avatar placeholder */
    var placeholder = document.querySelector('.profile-summary-avatar');
    if (placeholder && !placeholder.querySelector('img')) {
      placeholder.innerHTML = '<img src="' + url + '" alt="Avatar" ' +
        'style="width:100%;height:100%;object-fit:cover;border-radius:50%;object-position:center top;" />';
      placeholder.style.cssText += ';padding:0;font-size:0;overflow:hidden;border-radius:50%';
    }
  }

  function replaceWithDiceBearImg(el, url, w, h) {
    var img = document.createElement('img');
    img.src   = url;
    img.id    = el.id;
    img.alt   = 'Avatar';
    img.style.cssText = 'width:' + w + ';height:' + h + ';border-radius:50%;' +
      'object-fit:cover;object-position:center top;flex-shrink:0;cursor:pointer;';
    img.onclick = function () { openModal(); };
    img.title   = 'Customize Avatar';
    if (el.parentNode) el.parentNode.replaceChild(img, el);
  }

  /* ── Patch PlayerProfile.renderSummary ──────────────────── */
  function patchPlayerProfile() {
    if (typeof PlayerProfile === 'undefined' || !PlayerProfile.renderSummary) return;
    var orig = PlayerProfile.renderSummary.bind(PlayerProfile);
    PlayerProfile.renderSummary = function () {
      orig();
      var url = localStorage.getItem('courtiq_avatar_url');
      if (!url) return;
      setTimeout(function () { injectAvatarImg(url); }, 30);
    };
  }

  /* ── Restore on load ────────────────────────────────────── */
  function restoreOnLoad() {
    var url = localStorage.getItem('courtiq_avatar_url');
    if (url) injectAvatarImg(url);
    patchPlayerProfile();
  }

  /* ── Escape key ─────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var ov = document.getElementById('ac2-overlay');
    if (ov && ov.classList.contains('ac2-open')) closeModal();
  });

  /* ── Boot ───────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreOnLoad);
  } else {
    restoreOnLoad();
  }

  window.AvatarCustomizer = { open: openModal, close: closeModal };
})();
