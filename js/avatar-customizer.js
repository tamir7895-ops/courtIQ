/* ============================================================
   AVATAR CUSTOMIZER v3 — js/avatar-customizer.js
   DiceBear avataaars · Basketball-themed · XP-linked
   API: window.AvatarCustomizer.open()
   ============================================================ */
(function () {
  'use strict';

  var BASE = 'https://api.dicebear.com/9.x/avataaars/png';

  /* ── Skin tones ─────────────────────────────────────────── */
  var SKIN_COLORS = [
    { name: 'Pale',       id: 'pale',      hex: 'ffdbb4' },
    { name: 'Light',      id: 'light',     hex: 'edb98a' },
    { name: 'Mellow',     id: 'mellow',    hex: 'd08b5b' },
    { name: 'Brown',      id: 'brown',     hex: 'ae5d29' },
    { name: 'Dark Brown', id: 'darkBrown', hex: '614335' }
  ];

  /* ── Hair colors ─────────────────────────────────────────── */
  var HAIR_COLORS = [
    { name: 'Black',    id: 'black',      hex: '2c1b18' },
    { name: 'Brown',    id: 'brown',      hex: '724133' },
    { name: 'Auburn',   id: 'auburn',     hex: 'a55728' },
    { name: 'Blonde',   id: 'blonde',     hex: 'b58143' },
    { name: 'Red',      id: 'red',        hex: 'c93305' },
    { name: 'Platinum', id: 'platinum',   hex: 'ecdcbf' },
    { name: 'Silver',   id: 'silver',     hex: 'e8e1e1' },
    { name: 'Pink',     id: 'pastelPink', hex: 'f59797' },
    { name: 'Blue',     id: 'blue',       hex: '4a90d9', xpRequired: 5 },
    { name: 'Green',    id: 'green',      hex: '4caf50', xpRequired: 5 }
  ];

  /* ── Jersey / Clothes colors — NBA palette ──────────────── */
  var JERSEY_COLORS = [
    { name: 'Black',          id: 'black',         hex: '1a1a1a' },
    { name: 'White',          id: 'white',         hex: 'e8e8e8' },
    { name: 'Gray',           id: 'gray',          hex: '828282' },
    { name: 'Charcoal',       id: 'charcoal',      hex: '262e33' },
    { name: 'Sky Blue',       id: 'skyblue',       hex: '65c9ff' },
    { name: 'Navy',           id: 'navy',          hex: '25557c' },
    { name: 'Red',            id: 'red',           hex: 'ff5c5c' },
    { name: 'Mint',           id: 'mint',          hex: 'a7ffc4' },
    { name: 'Pink',           id: 'pink',          hex: 'ffafb9' },
    { name: 'Lakers Purple',  id: 'lakers_purple', hex: '552583', xpRequired: 3 },
    { name: 'Lakers Gold',    id: 'lakers_gold',   hex: 'fdb927', xpRequired: 3 },
    { name: 'Bulls Red',      id: 'bulls_red',     hex: 'ce1141', xpRequired: 3 },
    { name: 'Celtics',        id: 'celtics',       hex: '007a33', xpRequired: 3 },
    { name: 'Warriors Blue',  id: 'warriors_blue', hex: '1d428a', xpRequired: 3 },
    { name: 'Warriors Gold',  id: 'warriors_gold', hex: 'ffc72c', xpRequired: 3 },
    { name: 'Heat Red',       id: 'heat_red',      hex: '98002e', xpRequired: 5 },
    { name: 'Knicks Blue',    id: 'knicks_blue',   hex: '006bb6', xpRequired: 5 },
    { name: 'Knicks Orange',  id: 'knicks_orange', hex: 'f58426', xpRequired: 5 },
    { name: 'Bucks Green',    id: 'bucks_green',   hex: '00471b', xpRequired: 5 },
    { name: 'Suns Orange',    id: 'suns_orange',   hex: 'e56020', xpRequired: 7 }
  ];

  /* ── Basketball court backgrounds ───────────────────────── */
  var COURT_BG_COLORS = [
    { name: 'None',          id: 'none',        hex: ''       },
    { name: '🏀 Ball',       id: 'ball',        hex: 'f89527' },
    { name: '🌑 Arena',      id: 'arena',       hex: '1a1a2e' },
    { name: '🏟️ Hardwood',  id: 'hardwood',    hex: 'c8a165' },
    { name: '⚡ CourtIQ',    id: 'courtiq',     hex: '1d428a' },
    { name: '🩵 Sky',        id: 'sky',         hex: 'b1e2ff' },
    { name: '⚫ Dark',       id: 'dark',        hex: '262e33' },
    { name: '🏆 Gold',       id: 'gold',        hex: 'ffc72c', xpRequired: 3 },
    { name: '💜 Lakers',     id: 'bg_lakers',   hex: '552583', xpRequired: 5 },
    { name: '🟢 Celtics',    id: 'bg_celtics',  hex: '007a33', xpRequired: 5 },
    { name: '🔵 Warriors',   id: 'bg_warriors', hex: '1d428a', xpRequired: 5 },
    { name: '❤️ Bulls',      id: 'bg_bulls',    hex: 'ce1141', xpRequired: 5 },
    { name: '🌆 Street',     id: 'street',      hex: '4a4a6a', xpRequired: 3 }
  ];

  /* ── Male hair styles (all verified valid in DiceBear v9) ── */
  var HAIR_MALE = [
    { name: 'Buzz Cut',     id: 'shortFlat',        top: 'shortFlat'          },
    { name: 'Shaved Sides', id: 'shavedSides',       top: 'shavedSides'        },
    { name: 'Short Curly',  id: 'shortCurly',        top: 'shortCurly'         },
    { name: 'Short Round',  id: 'shortRound',        top: 'shortRound'         },
    { name: 'Short Wavy',   id: 'shortWaved',        top: 'shortWaved'         },
    { name: 'Sides',        id: 'sides',             top: 'sides'              },
    { name: 'Afro',         id: 'fro',               top: 'fro'                },
    { name: 'Dreads 1',     id: 'dreads01',          top: 'dreads01'           },
    { name: 'Dreads 2',     id: 'dreads02',          top: 'dreads02'           },
    { name: '🧢 Cap',       id: 'hat',               top: 'hat'                },
    { name: 'Man Bun',      id: 'bun',               top: 'bun'                },
    { name: 'Mia Wallace',  id: 'miaWallace',        top: 'miaWallace'         },
    { name: 'Big Hair',     id: 'bigHair',           top: 'bigHair',           xpRequired: 3 },
    { name: 'Bob',          id: 'bob',               top: 'bob',               xpRequired: 3 },
    { name: 'Curly',        id: 'curly',             top: 'curly',             xpRequired: 3 },
    { name: 'Curvy',        id: 'curvy',             top: 'curvy',             xpRequired: 3 },
    { name: 'Long Hair',    id: 'longButNotTooLong', top: 'longButNotTooLong', xpRequired: 3 },
    { name: 'Straight 1',   id: 'straight01',        top: 'straight01',        xpRequired: 5 },
    { name: 'Straight 2',   id: 'straight02',        top: 'straight02',        xpRequired: 5 },
    { name: 'Str+Strand',   id: 'straightAndStrand', top: 'straightAndStrand', xpRequired: 5 },
    { name: 'Frida',        id: 'frida',             top: 'frida',             xpRequired: 5 },
    { name: 'Hijab',        id: 'hijab',             top: 'hijab',             xpRequired: 5 }
  ];

  /* ── Female hair styles (all verified valid in DiceBear v9) */
  var HAIR_FEMALE = [
    { name: 'Bob',          id: 'bob',               top: 'bob'              },
    { name: 'Curly',        id: 'curly',             top: 'curly'            },
    { name: 'Curvy',        id: 'curvy',             top: 'curvy'            },
    { name: 'Short Flat',   id: 'shortFlat',         top: 'shortFlat'        },
    { name: 'Straight 1',   id: 'straight01',        top: 'straight01'       },
    { name: 'Long Wavy',    id: 'straight02',        top: 'straight02'       },
    { name: 'Str+Strand',   id: 'straightAndStrand', top: 'straightAndStrand'},
    { name: 'Big Hair',     id: 'bigHair',           top: 'bigHair',         xpRequired: 3 },
    { name: 'Long Hair',    id: 'longButNotTooLong', top: 'longButNotTooLong', xpRequired: 3 },
    { name: 'Mia Wallace',  id: 'miaWallace',        top: 'miaWallace',      xpRequired: 3 },
    { name: 'Frida',        id: 'frida',             top: 'frida',           xpRequired: 3 },
    { name: 'Dreads 1',     id: 'dreads01',          top: 'dreads01',        xpRequired: 3 },
    { name: 'Man Bun',      id: 'bun',               top: 'bun',             xpRequired: 3 },
    { name: 'Shaved Sides', id: 'shavedSides',       top: 'shavedSides',     xpRequired: 3 },
    { name: 'Short Round',  id: 'shortRound',        top: 'shortRound',      xpRequired: 3 },
    { name: 'Short Wavy',   id: 'shortWaved',        top: 'shortWaved',      xpRequired: 3 },
    { name: 'Short Curly',  id: 'shortCurly',        top: 'shortCurly',      xpRequired: 3 },
    { name: 'Afro',         id: 'fro',               top: 'fro',             xpRequired: 5 },
    { name: 'Sides',        id: 'sides',             top: 'sides',           xpRequired: 5 },
    { name: '🧢 Cap',       id: 'hat',               top: 'hat',             xpRequired: 5 },
    { name: 'Hijab',        id: 'hijab',             top: 'hijab',           xpRequired: 5 }
  ];

  /* ── Eyes (all verified valid in DiceBear v9) ───────────── */
  var EYE_STYLES = [
    { name: 'Default',     id: 'default'                 },
    { name: 'Happy',       id: 'happy'                   },
    { name: 'Wink',        id: 'wink'                    },
    { name: 'Wink Wild',   id: 'winkWacky'               },
    { name: 'Squint',      id: 'squint'                  },
    { name: 'Surprised',   id: 'surprised'               },
    { name: 'Side Glance', id: 'side'                    },
    { name: 'Eye Roll',    id: 'eyeRoll'                 },
    { name: 'Cry',         id: 'cry'                     },
    { name: '✕ Dizzy',    id: 'xDizzy',  xpRequired: 3  },
    { name: '💜 Hearts',   id: 'hearts',  xpRequired: 3  }
  ];

  /* ── Eyebrows ─────────────────────────────────────────────── */
  var EYEBROW_STYLES = [
    { name: 'Default',        id: 'default'              },
    { name: 'Natural',        id: 'defaultNatural'       },
    { name: 'Raised',         id: 'raisedExcited'        },
    { name: 'Raised+Nat.',    id: 'raisedExcitedNatural' },
    { name: 'Flat',           id: 'flatNatural'          },
    { name: 'Frown',          id: 'frownNatural'         },
    { name: 'Sad',            id: 'sadConcerned'         },
    { name: 'Sad+Nat.',       id: 'sadConcernedNatural'  },
    { name: 'Angry',          id: 'angryNatural'         },
    { name: 'Angry Sharp',    id: 'angry'                },
    { name: 'Up/Down',        id: 'upDown'               },
    { name: 'Up/Down+Nat.',   id: 'upDownNatural'        },
    { name: 'Unibrow',        id: 'unibrowNatural'       }
  ];

  /* ── Mouth ───────────────────────────────────────────────── */
  var MOUTH_STYLES = [
    { name: 'Default',    id: 'default'    },
    { name: 'Smile',      id: 'smile'      },
    { name: 'Serious',    id: 'serious'    },
    { name: 'Grimace',    id: 'grimace'    },
    { name: 'Tongue',     id: 'tongue'     },
    { name: 'Twinkle',    id: 'twinkle'    },
    { name: 'Disbelief',  id: 'disbelief'  },
    { name: 'Concerned',  id: 'concerned'  },
    { name: 'Sad',        id: 'sad'        },
    { name: 'Eating',     id: 'eating'     },
    { name: 'Scream',     id: 'screamOpen' },
    { name: 'Vomit',      id: 'vomit',     xpRequired: 7 }
  ];

  /* ── Facial hair (male only) ─────────────────────────────── */
  var FACIAL_HAIR = [
    { name: 'None',      id: 'none',           param: ''               },
    { name: 'Light',     id: 'beardLight',     param: 'beardLight'     },
    { name: 'Medium',    id: 'beardMedium',    param: 'beardMedium'    },
    { name: 'Majestic',  id: 'beardMajestic',  param: 'beardMajestic'  },
    { name: 'Moustache', id: 'moustacheFancy', param: 'moustacheFancy' },
    { name: 'Magnum',    id: 'moustacheMagnum',param: 'moustacheMagnum'}
  ];

  /* ── Clothes ─────────────────────────────────────────────── */
  var CLOTHES = [
    { name: '🏀 Jersey',   id: 'shirtCrewNeck'    },
    { name: 'V-Neck',      id: 'shirtVNeck'       },
    { name: 'Scoop Neck',  id: 'shirtScoopNeck'   },
    { name: 'Hoodie',      id: 'hoodie'           },
    { name: 'Graphic Tee', id: 'graphicShirt'     },
    { name: 'Overall',     id: 'overall'          },
    { name: 'Blazer',      id: 'blazerAndShirt'   },
    { name: 'Blazer+SW',   id: 'blazerAndSweater' },
    { name: 'Sweater',     id: 'collarAndSweater' }
  ];

  /* ── Accessories ─────────────────────────────────────────── */
  var ACCESSORIES = [
    { name: 'None',          id: 'none',           param: ''               },
    { name: 'Glasses',       id: 'prescription01', param: 'prescription01' },
    { name: 'Glasses 2',     id: 'prescription02', param: 'prescription02' },
    { name: 'Round',         id: 'round',          param: 'round'          },
    { name: 'Sunglasses',    id: 'sunglasses',     param: 'sunglasses'     },
    { name: 'Wayfarers',     id: 'wayfarers',      param: 'wayfarers'      },
    { name: 'Kurt',          id: 'kurt',           param: 'kurt'           }
  ];

  /* ── Basketball presets ──────────────────────────────────── */
  var PRESETS = [
    {
      name: 'Street Baller', emoji: '🏀', desc: 'Classic court player',
      state: {
        skin: 'brown', hair: 'fro', hairColor: 'black',
        eyebrows: 'default', eyes: 'squint', mouth: 'smile',
        facialHair: 'none', facialHairColor: 'black',
        clothes: 'hoodie', clothesColor: 'charcoal',
        accessory: 'none', bgColor: 'ball'
      }
    },
    {
      name: 'Game Face', emoji: '😤', desc: 'Locked in & focused',
      state: {
        skin: 'mellow', hair: 'shavedSides', hairColor: 'black',
        eyebrows: 'angryNatural', eyes: 'squint', mouth: 'serious',
        facialHair: 'none', facialHairColor: 'black',
        clothes: 'shirtCrewNeck', clothesColor: 'bulls_red',
        accessory: 'none', bgColor: 'arena'
      }
    },
    {
      name: 'MVP', emoji: '🏆', desc: 'Most Valuable Player',
      state: {
        skin: 'light', hair: 'fro', hairColor: 'black',
        eyebrows: 'raisedExcited', eyes: 'happy', mouth: 'smile',
        facialHair: 'beardLight', facialHairColor: 'black',
        clothes: 'blazerAndShirt', clothesColor: 'lakers_gold',
        accessory: 'none', bgColor: 'gold'
      }
    },
    {
      name: 'Drip King', emoji: '🕶️', desc: 'Fresh fit, always',
      state: {
        skin: 'brown', hair: 'bun', hairColor: 'auburn',
        eyebrows: 'defaultNatural', eyes: 'default', mouth: 'twinkle',
        facialHair: 'beardMedium', facialHairColor: 'auburn',
        clothes: 'blazerAndShirt', clothesColor: 'black',
        accessory: 'sunglasses', bgColor: 'arena'
      }
    },
    {
      name: 'Hoop Star', emoji: '⭐', desc: 'Born for the game',
      state: {
        skin: 'pale', hair: 'shortCurly', hairColor: 'blonde',
        eyebrows: 'raisedExcitedNatural', eyes: 'happy', mouth: 'smile',
        facialHair: 'none', facialHairColor: 'black',
        clothes: 'shirtCrewNeck', clothesColor: 'warriors_blue',
        accessory: 'none', bgColor: 'bg_warriors'
      }
    },
    {
      name: 'Court Legend', emoji: '🌟', desc: 'The G.O.A.T.',
      state: {
        skin: 'darkBrown', hair: 'shavedSides', hairColor: 'black',
        eyebrows: 'defaultNatural', eyes: 'default', mouth: 'serious',
        facialHair: 'beardMedium', facialHairColor: 'black',
        clothes: 'hoodie', clothesColor: 'celtics',
        accessory: 'none', bgColor: 'bg_celtics'
      }
    }
  ];

  /* ── State ───────────────────────────────────────────────── */
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
    clothes:         'shirtCrewNeck',
    clothesColor:    'warriors_blue',
    accessory:       'none',
    bgColor:         'none',
    tab:             'presets'
  };

  /* ── Helpers ─────────────────────────────────────────────── */
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
    return s && s.hex ? s.hex : (arr[0] ? arr[0].hex : '000000');
  }

  /* ── XP / Level helpers ──────────────────────────────────── */
  function getXPLevel() {
    try {
      var gd = JSON.parse(localStorage.getItem('courtiq-gamification-data') || '{}');
      return gd.level || gd.xpLevel || 1;
    } catch (e) { return 1; }
  }

  function updateXPChip() {
    var chip = document.getElementById('ac2-xp-chip');
    if (!chip) return;
    var lv = getXPLevel();
    chip.textContent = '⚡ Lvl ' + lv;
  }

  /* ── URL builder ─────────────────────────────────────────── */
  function buildURL() {
    var clothesHex = hexFor(JERSEY_COLORS, st.clothesColor);
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
    else p.push('accessoriesProbability=0'); /* no accessory → force hide */

    /* facial hair (male) */
    if (st.gender !== 'female') {
      var fhS = find(FACIAL_HAIR, function (f) { return f.id === st.facialHair; });
      if (fhS && fhS.param) {
        p.push('facialHair=' + fhS.param);
        p.push('facialHairColor=' + hexFor(HAIR_COLORS, st.facialHairColor));
      } else {
        p.push('facialHairProbability=0'); /* force no beard */
      }
    }

    /* background */
    var bgS = find(COURT_BG_COLORS, function (b) { return b.id === st.bgColor; });
    if (bgS && bgS.hex) {
      p.push('backgroundColor=' + bgS.hex);
      p.push('backgroundType=solid');
    }

    return BASE + '?' + p.join('&');
  }

  /* ── Preview ─────────────────────────────────────────────── */
  function refreshPreview() {
    var img  = document.getElementById('ac2-preview-img');
    var wrap = document.getElementById('ac2-preview-wrap');
    if (!img) return;
    var newSrc = buildURL();
    if (img.src === newSrc) return; /* no change, skip */
    wrap && wrap.classList.add('ac2-loading');
    img.onload = img.onerror = function () {
      wrap && wrap.classList.remove('ac2-loading');
    };
    img.src = newSrc;
    /* If browser served from cache and already complete, hide spinner immediately */
    if (img.complete) wrap && wrap.classList.remove('ac2-loading');
  }

  /* ── Modal HTML ──────────────────────────────────────────── */
  var MODAL_HTML = [
    '<div class="ac2-modal" role="dialog" aria-modal="true">',

    /* Step 1 — Gender */
    '<div class="ac2-step" id="ac2-step-gender">',
      '<div class="ac2-header">',
        '<h2 class="ac2-title">Create Your Avatar</h2>',
        '<button class="ac2-close-btn" id="ac2-close-gender" type="button">&#x2715;</button>',
      '</div>',
      '<p class="ac2-subtitle">Pick your style to get started</p>',
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

    /* Step 2 — Editor */
    '<div class="ac2-step ac2-step--hidden" id="ac2-step-editor">',
      '<div class="ac2-header">',
        '<button class="ac2-back-btn" id="ac2-back" type="button">&#8592; Back</button>',
        '<h2 class="ac2-title">Customize Avatar</h2>',
        '<span class="ac2-xp-chip" id="ac2-xp-chip">⚡ Lvl 1</span>',
        '<button class="ac2-close-btn" id="ac2-close-editor" type="button">&#x2715;</button>',
      '</div>',

      /* preview */
      '<div class="ac2-preview-wrap" id="ac2-preview-wrap">',
        '<div class="ac2-spinner" aria-hidden="true"></div>',
        '<img class="ac2-preview-img" id="ac2-preview-img" alt="Avatar" width="300" height="300" />',
      '</div>',

      /* tabs */
      '<nav class="ac2-tabs" id="ac2-tabs" role="tablist">',
        '<button class="ac2-tab active" data-tab="presets" role="tab" type="button">🏀 Presets</button>',
        '<button class="ac2-tab"        data-tab="face"    role="tab" type="button">Face</button>',
        '<button class="ac2-tab"        data-tab="hair"    role="tab" type="button">Hair</button>',
        '<button class="ac2-tab"        data-tab="eyes"    role="tab" type="button">Eyes</button>',
        '<button class="ac2-tab"        data-tab="jersey"  role="tab" type="button">Jersey</button>',
        '<button class="ac2-tab"        data-tab="more"    role="tab" type="button">More</button>',
      '</nav>',

      /* panel — only scrollable zone */
      '<div class="ac2-panel" id="ac2-panel"></div>',

      '<div class="ac2-footer">',
        '<button class="ac2-btn-ghost"   id="ac2-cancel" type="button">Cancel</button>',
        '<button class="ac2-btn-primary" id="ac2-save"   type="button">💾 Save Avatar</button>',
      '</div>',
    '</div>',

    '</div>'
  ].join('');

  /* ── Panel rendering ─────────────────────────────────────── */
  function renderPanel(tab) {
    var host = document.getElementById('ac2-panel');
    if (!host) return;
    var html = '';

    if (tab === 'presets') {
      html += '<div class="ac2-preset-intro">Choose a basketball persona — then customize further</div>';
      html += '<div class="ac2-preset-grid">';
      for (var pi = 0; pi < PRESETS.length; pi++) {
        var pr = PRESETS[pi];
        html += '<button class="ac2-preset-card" data-preset="' + pi + '" type="button">' +
          '<div class="ac2-preset-emoji">' + pr.emoji + '</div>' +
          '<div class="ac2-preset-name">' + pr.name + '</div>' +
          '<div class="ac2-preset-desc">' + pr.desc + '</div>' +
          '</button>';
      }
      html += '</div>';
    }

    if (tab === 'face') {
      html += section('Skin Color', swatchRow(SKIN_COLORS, 'skin', st.skin));
      html += section('Eyebrows',   optGrid(EYEBROW_STYLES, 'eyebrows', st.eyebrows));
      html += section('Mouth',      optGrid(MOUTH_STYLES,   'mouth',    st.mouth));
    }

    if (tab === 'hair') {
      html += section('Style',       optGrid(hairList(),    'hair',          st.hair));
      html += section('Color',       swatchRow(HAIR_COLORS, 'hairColor',     st.hairColor));
      if (st.gender !== 'female') {
        html += section('Facial Hair', optGrid(FACIAL_HAIR, 'facialHair',    st.facialHair));
        html += section('Beard Color', swatchRow(HAIR_COLORS,'facialHairColor',st.facialHairColor));
      }
    }

    if (tab === 'eyes') {
      html += section('Eye Style', optGrid(EYE_STYLES, 'eyes', st.eyes));
    }

    if (tab === 'jersey') {
      html += section('Style',      optGrid(CLOTHES,         'clothes',     st.clothes));
      html += section('Team Color', swatchRow(JERSEY_COLORS, 'clothesColor',st.clothesColor));
    }

    if (tab === 'more') {
      html += section('Accessories',        optGrid(ACCESSORIES,     'accessory', st.accessory));
      html += section('Court Background',   swatchRow(COURT_BG_COLORS,'bgColor',  st.bgColor, true));
    }

    host.innerHTML = html;

    /* wire normal option/swatch clicks */
    var nodes = host.querySelectorAll('[data-prop]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener('click', onOptionClick);
    }

    /* wire preset card clicks */
    if (tab === 'presets') {
      var pcards = host.querySelectorAll('[data-preset]');
      for (var j = 0; j < pcards.length; j++) {
        (function (card, idx) {
          card.addEventListener('click', function () {
            applyPreset(PRESETS[idx]);
            var all = host.querySelectorAll('[data-preset]');
            for (var k = 0; k < all.length; k++) {
              all[k].classList.toggle('ac2-preset-card--sel',
                parseInt(all[k].dataset.preset, 10) === idx);
            }
          });
        })(pcards[j], parseInt(pcards[j].dataset.preset, 10));
      }
    }
  }

  function section(label, inner) {
    return '<div class="ac2-section">' +
      '<div class="ac2-section-label">' + label + '</div>' + inner +
      '</div>';
  }

  function swatchRow(arr, prop, current) {
    var xpLvl = getXPLevel();
    var html = '<div class="ac2-swatch-row">';
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      var locked = c.xpRequired && xpLvl < c.xpRequired;
      var sel = (!locked && c.id === current) ? ' ac2-swatch--sel' : '';
      var lockCls = locked ? ' ac2-swatch--locked' : '';
      var style = c.hex
        ? 'background:#' + c.hex
        : 'background:repeating-conic-gradient(#555 0% 25%,#333 0% 50%) 0 0/10px 10px';
      var lockAttr = locked ? ' data-locked="1" data-lvl="' + c.xpRequired + '"' : '';
      html += '<button class="ac2-swatch' + sel + lockCls + '"' +
        ' data-prop="' + prop + '" data-value="' + c.id + '"' + lockAttr +
        ' style="' + style + '"' +
        ' title="' + c.name + (locked ? ' — Lvl ' + c.xpRequired : '') + '" type="button">' +
        (locked ? '<span style="font-size:11px;line-height:1">🔒</span>'
                : (c.id === current ? '<span class="ac2-check">&#x2713;</span>' : '')) +
        '</button>';
    }
    return html + '</div>';
  }

  function optGrid(arr, prop, current) {
    var xpLvl = getXPLevel();
    var html = '<div class="ac2-opt-grid">';
    for (var i = 0; i < arr.length; i++) {
      var o = arr[i];
      var locked = o.xpRequired && xpLvl < o.xpRequired;
      var sel = (!locked && o.id === current) ? ' ac2-opt--sel' : '';
      var lockCls = locked ? ' ac2-opt--locked' : '';
      var lockAttr = locked ? ' data-locked="1" data-lvl="' + o.xpRequired + '"' : '';
      var lockBadge = locked ? '<span class="ac2-lock-badge">⚡' + o.xpRequired + '</span>' : '';
      html += '<button class="ac2-opt' + sel + lockCls + '"' +
        ' data-prop="' + prop + '" data-value="' + o.id + '"' + lockAttr +
        ' type="button">' + o.name + lockBadge + '</button>';
    }
    return html + '</div>';
  }

  /* ── Apply preset ────────────────────────────────────────── */
  function applyPreset(preset) {
    var s = preset.state;
    st.skin           = s.skin;
    st.hair           = s.hair;
    st.hairColor      = s.hairColor;
    st.eyebrows       = s.eyebrows;
    st.eyes           = s.eyes;
    st.mouth          = s.mouth;
    st.facialHair     = s.facialHair;
    st.facialHairColor= s.facialHairColor;
    st.clothes        = s.clothes;
    st.clothesColor   = s.clothesColor;
    st.accessory      = s.accessory;
    st.bgColor        = s.bgColor;
    refreshPreview();
  }

  /* ── Option click handler ────────────────────────────────── */
  function onOptionClick() {
    /* locked item? */
    if (this.dataset.locked === '1') {
      var lvl = this.dataset.lvl;
      if (typeof showToast === 'function') {
        showToast('🔒 Reach Level ' + lvl + ' to unlock this!', 'warning');
      }
      return;
    }

    var prop = this.dataset.prop;
    var val  = this.dataset.value;
    st[prop] = val;

    /* update active state without full re-render */
    var siblings = document.querySelectorAll('#ac2-panel [data-prop="' + prop + '"]');
    for (var i = 0; i < siblings.length; i++) {
      var s   = siblings[i];
      var hit = (s.dataset.value === val);
      s.classList.toggle('ac2-swatch--sel', hit && s.classList.contains('ac2-swatch'));
      s.classList.toggle('ac2-opt--sel',    hit && s.classList.contains('ac2-opt'));
      if (s.classList.contains('ac2-swatch') && !s.classList.contains('ac2-swatch--locked')) {
        s.innerHTML = hit ? '<span class="ac2-check">&#x2713;</span>' : '';
      }
    }
    refreshPreview();
  }

  /* ── Tabs ────────────────────────────────────────────────── */
  function activateTab(name) {
    st.tab = name;
    var tabs = document.querySelectorAll('#ac2-tabs .ac2-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].dataset.tab === name);
    }
    renderPanel(name);
  }

  /* ── Steps ───────────────────────────────────────────────── */
  function showGender() {
    document.getElementById('ac2-step-gender').classList.remove('ac2-step--hidden');
    document.getElementById('ac2-step-editor').classList.add('ac2-step--hidden');
  }

  function showEditor() {
    document.getElementById('ac2-step-gender').classList.add('ac2-step--hidden');
    document.getElementById('ac2-step-editor').classList.remove('ac2-step--hidden');
    updateXPChip();
    activateTab('presets');
    refreshPreview();
  }

  /* ── Wire modal ──────────────────────────────────────────── */
  function ensureModal() {
    if (document.getElementById('ac2-overlay')) return;
    var el = document.createElement('div');
    el.id = 'ac2-overlay';
    el.className = 'ac2-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = MODAL_HTML;
    document.body.appendChild(el);

    /* gender cards */
    var cards = el.querySelectorAll('.ac2-gender-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function () {
        st.gender = this.dataset.gender;
        st.hair   = hairList()[0].id;
        showEditor();
      });
    }

    /* close / cancel / back */
    ['ac2-close-gender', 'ac2-close-editor', 'ac2-cancel'].forEach(function (id) {
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

  /* ── Open / Close ────────────────────────────────────────── */
  function openModal() {
    ensureModal();
    Object.assign(st, {
      gender: null, skin: 'light', hair: 'shortFlat', hairColor: 'black',
      eyebrows: 'default', eyes: 'default', mouth: 'default',
      facialHair: 'none', facialHairColor: 'black',
      clothes: 'shirtCrewNeck', clothesColor: 'warriors_blue',
      accessory: 'none', bgColor: 'none', tab: 'presets'
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

  /* ── Avatar cache (PERF-01) ──────────────────────────────────
     Fetches the DiceBear PNG once and stores as a data URL so
     every subsequent page-load is served from localStorage with
     zero network round-trips.  Cache is invalidated whenever the
     user saves a new avatar (different URL → stale entry replaced).
  ─────────────────────────────────────────────────────────── */
  var LS_AVATAR_CACHE = 'courtiq_avatar_cache';

  function getCachedAvatarDataUrl(url) {
    try {
      var c = JSON.parse(localStorage.getItem(LS_AVATAR_CACHE) || 'null');
      if (c && c.url === url && c.dataUrl) return c.dataUrl;
    } catch (e) { /* silent */ }
    return null;
  }

  function prewarmAvatarCache(url) {
    if (!url || getCachedAvatarDataUrl(url)) return; // already cached
    fetch(url)
      .then(function (res) { return res.blob(); })
      .then(function (blob) {
        var reader = new FileReader();
        reader.onload = function () {
          try {
            localStorage.setItem(LS_AVATAR_CACHE,
              JSON.stringify({ url: url, dataUrl: reader.result }));
          } catch (e) { /* silent — storage full */ }
        };
        reader.readAsDataURL(blob);
      })
      .catch(function () { /* silent — network unavailable */ });
  }

  /* ── Save ────────────────────────────────────────────────── */
  function saveAvatar() {
    var url = buildURL();
    localStorage.setItem('courtiq_avatar_url', url);
    prewarmAvatarCache(url); // prime / refresh cache for new avatar

    try {
      var ob = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}');
      ob.dicebear_avatar_url = url;
      localStorage.setItem('courtiq-onboarding-data', JSON.stringify(ob));

      if (typeof window.currentUser !== 'undefined' && window.currentUser &&
          typeof DataService !== 'undefined') {
        DataService.saveUserData({ onboarding_data: ob }).catch(function (e) { console.warn('[Avatar] Sync failed:', e); });
      }
    } catch (e) { /* silent */ }

    injectAvatarImg(url);
    closeModal();
    if (typeof showToast === 'function') showToast('🏀 Avatar saved!');
  }

  /* ── Inject DiceBear img into all avatar slots ───────────── */
  function injectAvatarImg(url) {
    var displayUrl = getCachedAvatarDataUrl(url) || url; // use cache if warm
    var sidebar = document.getElementById('db-sidebar-avatar');
    if (sidebar) {
      sidebar.innerHTML = '<img src="' + displayUrl + '" alt="Avatar" ' +
        'style="width:100%;height:100%;object-fit:cover;border-radius:50%;object-position:center top;" />';
      sidebar.style.cssText += ';padding:0;font-size:0;line-height:1';
    }

    var mini = document.getElementById('profile-mini-avatar');
    if (mini) replaceWithDiceBearImg(mini, url, '48px', '48px');

    var topbar = document.getElementById('topbar-mini-avatar');
    if (topbar) replaceWithDiceBearImg(topbar, url, '32px', '32px');

    // Top nav avatar (desktop)
    var topNavAvatar = document.getElementById('top-nav-avatar');
    if (topNavAvatar) {
      injectAvatarIntoEl(topNavAvatar, displayUrl, '100%', '100%');
      topNavAvatar.style.cssText += ';padding:0;overflow:hidden;cursor:pointer';
      topNavAvatar.onclick = function () { openModal(); };
    }

    // Profile mini widget avatar
    var profileMini = document.getElementById('db-profile-mini-avatar');
    if (profileMini) {
      injectAvatarIntoEl(profileMini, displayUrl, '100%', '100%');
      profileMini.style.cssText += ';padding:0;overflow:hidden';
    }

    // Onboarding avatar preview
    var obPreview = document.getElementById('ob-dicebear-preview');
    if (obPreview) {
      injectAvatarIntoEl(obPreview, displayUrl, '100%', '100%');
    }

    var placeholder = document.querySelector('.profile-summary-avatar');
    if (placeholder && !placeholder.querySelector('img')) {
      placeholder.innerHTML = '<img src="' + displayUrl + '" alt="Avatar" ' +
        'style="width:100%;height:100%;object-fit:cover;border-radius:50%;object-position:center top;" />';
      placeholder.style.cssText += ';padding:0;font-size:0;overflow:hidden;border-radius:50%';
    }

    var shopContainer = document.getElementById('shop-avatar-container');
    if (shopContainer) {
      shopContainer.innerHTML = '<img src="' + displayUrl + '" alt="Avatar" ' +
        'style="width:100%;height:100%;object-fit:contain;object-position:center top;" />';
    }
  }

  function injectAvatarIntoEl(el, url, w, h) {
    var img = document.createElement('img');
    img.src = url;
    img.alt = 'Avatar';
    img.style.cssText = 'width:' + w + ';height:' + h + ';object-fit:cover;border-radius:50%;object-position:center top;';
    el.textContent = '';
    el.appendChild(img);
  }

  function replaceWithDiceBearImg(el, url, w, h) {
    var displayUrl = getCachedAvatarDataUrl(url) || url; // use cache if warm
    var img = document.createElement('img');
    img.src   = displayUrl;
    img.id    = el.id;
    img.alt   = 'Avatar';
    img.style.cssText = 'width:' + w + ';height:' + h + ';border-radius:50%;' +
      'object-fit:cover;object-position:center top;flex-shrink:0;cursor:pointer;';
    img.onclick = function () { openModal(); };
    img.title   = 'Customize Avatar';
    if (el.parentNode) el.parentNode.replaceChild(img, el);
  }

  /* ── Patch PlayerProfile ─────────────────────────────────── */
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

  /* ── Restore on load ─────────────────────────────────────── */
  function restoreOnLoad() {
    var url = localStorage.getItem('courtiq_avatar_url');
    if (!url) {
      try {
        var ob = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}');
        url = ob.dicebear_avatar_url || null;
        if (url) localStorage.setItem('courtiq_avatar_url', url);
      } catch (e) { /* silent */ }
    }
    if (url) {
      injectAvatarImg(url);
      prewarmAvatarCache(url); // ensure cache is ready for next page load
    }
    patchPlayerProfile();
  }

  /* ── Escape key ──────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var ov = document.getElementById('ac2-overlay');
    if (ov && ov.classList.contains('ac2-open')) closeModal();
  });

  /* ── Boot ────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreOnLoad);
  } else {
    restoreOnLoad();
  }

  window.AvatarCustomizer = { open: openModal, close: closeModal };
})();
