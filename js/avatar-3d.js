/* ============================================================
   AVATAR 3D ENGINE — /js/avatar-3d.js  v2
   Three.js procedural character — Fortnite-inspired proportions.
   Hair sits cleanly on the skull. Arms hang naturally.
   ============================================================ */
(function () {
  'use strict';

  /* ── Guard ─────────────────────────────────────────────── */
  function hasThree() { return typeof THREE !== 'undefined'; }

  /* ── Color helpers ─────────────────────────────────────── */
  function hexToInt(hex) {
    return parseInt((hex || '').replace('#', ''), 16) || 0xC68642;
  }

  /* ── Body type configs ─────────────────────────────────── */
  var BODY = {
    lean:     { sx: 0.85, sz: 0.85, sh: 0.93, limb: 0.88, leg: 0.93 },
    athletic: { sx: 1.0,  sz: 1.0,  sh: 1.0,  limb: 1.0,  leg: 1.0  },
    heavy:    { sx: 1.2,  sz: 1.15, sh: 1.1,  limb: 1.15, leg: 1.08 }
  };

  /* ── Palette ───────────────────────────────────────────── */
  var PAL = {
    jersey:  0x1b1b30,
    shorts:  0x141428,
    shoe:    0x1a1a1a,
    sole:    0xeeeeee,
    collar:  0x2a2a45,
    stripe:  0xFFB347
  };

  /* helper — make material */
  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color: color, roughness: rough !== undefined ? rough : 0.7,
      metalness: metal !== undefined ? metal : 0.0
    });
  }

  /* ═══════════════════════════════════════════════════════════
     CHARACTER BUILDER — realistic proportions (~2.3 units tall)
     ═══════════════════════════════════════════════════════════ */

  function buildCharacter(scene, av) {
    var root = new THREE.Group();
    root.name = 'avatar-root';
    var B = BODY[av.bodyType] || BODY.athletic;
    var skin = hexToInt(av.skinTone);
    var hair = hexToInt(av.hairColor);

    /* ── Materials ─────────────────────────────────────── */
    var mSkin    = mat(skin, 0.65, 0.05);
    var mJersey  = mat(PAL.jersey, 0.55);
    var mShorts  = mat(PAL.shorts, 0.6);
    var mShoe    = mat(PAL.shoe, 0.4, 0.1);
    var mSole    = mat(PAL.sole, 0.5);
    var mHair    = mat(hair, 0.85);
    var mCollar  = mat(PAL.collar, 0.5);
    var mStripe  = mat(PAL.stripe, 0.4, 0.2);
    var mEyeW    = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var mIris    = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    var mBrow    = mat(hair, 0.9);
    var mLip     = mat(0x7a3b2e, 0.75);

    /* ── TORSO (jersey) ───────────────────────────────── */
    // Main chest
    var tGeo = new THREE.CapsuleGeometry(0.2, 0.48, 8, 16);
    var torso = new THREE.Mesh(tGeo, mJersey);
    torso.scale.set(B.sx, 1, B.sz);
    torso.position.set(0, 1.32, 0);
    torso.name = 'torso';
    root.add(torso);

    // Collar detail
    var collarGeo = new THREE.TorusGeometry(0.15 * B.sx, 0.025, 8, 20, Math.PI * 1.3);
    var collar = new THREE.Mesh(collarGeo, mCollar);
    collar.position.set(0, 1.63, 0.1);
    collar.rotation.x = Math.PI * 0.35;
    collar.rotation.y = Math.PI * 0.85;
    root.add(collar);

    // Sleeve cuffs (small rings at shoulder ends)
    var cuffGeo = new THREE.TorusGeometry(0.065 * B.limb, 0.012, 6, 12);
    var cuffL = new THREE.Mesh(cuffGeo, mCollar);
    cuffL.position.set(-0.28 * B.sh, 1.5, 0);
    cuffL.rotation.x = Math.PI * 0.5;
    cuffL.rotation.z = 0.3;
    root.add(cuffL);
    var cuffR = cuffL.clone();
    cuffR.position.set(0.28 * B.sh, 1.5, 0);
    cuffR.rotation.z = -0.3;
    root.add(cuffR);

    /* ── NECK ─────────────────────────────────────────── */
    var neckGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.1, 12);
    var neck = new THREE.Mesh(neckGeo, mSkin);
    neck.position.set(0, 1.72, 0);
    neck.name = 'neck';
    root.add(neck);

    /* ── HEAD ─────────────────────────────────────────── */
    var headGeo = new THREE.SphereGeometry(0.18, 28, 28);
    var head = new THREE.Mesh(headGeo, mSkin);
    head.scale.set(1.0, 1.08, 0.95);
    head.position.set(0, 1.92, 0);
    head.name = 'head';
    root.add(head);

    /* ── FACE — eyes, brows, nose, mouth, jaw, ears ─── */
    // Eye whites — BIG expressive eyes (Fortnite-style)
    var ewGeo = new THREE.SphereGeometry(0.042, 16, 16);
    var eyeL = new THREE.Mesh(ewGeo, mEyeW);
    eyeL.position.set(-0.068, 1.94, 0.145);
    eyeL.scale.set(1.15, 0.75, 0.35);
    eyeL.name = 'eyeL';
    root.add(eyeL);
    var eyeR = eyeL.clone();
    eyeR.position.set(0.068, 1.94, 0.145);
    eyeR.name = 'eyeR';
    root.add(eyeR);

    // Irises — larger, with subtle pupil
    var irGeo = new THREE.SphereGeometry(0.024, 12, 12);
    var irisL = new THREE.Mesh(irGeo, mIris);
    irisL.position.set(-0.065, 1.94, 0.175);
    irisL.scale.set(1, 0.85, 0.5);
    irisL.name = 'irisL';
    root.add(irisL);
    var irisR = irisL.clone();
    irisR.position.set(0.065, 1.94, 0.175);
    irisR.name = 'irisR';
    root.add(irisR);

    // Eyebrows — thicker, more defined
    var brGeo = new THREE.BoxGeometry(0.06, 0.018, 0.02);
    var browL = new THREE.Mesh(brGeo, mBrow);
    browL.position.set(-0.068, 1.995, 0.148);
    browL.rotation.z = 0.1;
    browL.rotation.x = -0.1;
    root.add(browL);
    var browR = browL.clone();
    browR.position.set(0.068, 1.995, 0.148);
    browR.rotation.z = -0.1;
    root.add(browR);

    // Nose — wider, more defined tip
    var noseGeo = new THREE.SphereGeometry(0.028, 12, 12);
    var nose = new THREE.Mesh(noseGeo, mSkin);
    nose.position.set(0, 1.905, 0.17);
    nose.scale.set(0.85, 0.6, 0.5);
    root.add(nose);
    // Nose bridge
    var bridgeGeo = new THREE.BoxGeometry(0.022, 0.035, 0.012);
    var bridge = new THREE.Mesh(bridgeGeo, mSkin);
    bridge.position.set(0, 1.928, 0.165);
    root.add(bridge);
    // Nostrils (subtle dark dots)
    var nostrilMat = mat(0x000000, 0.9); nostrilMat.transparent = true; nostrilMat.opacity = 0.2;
    var nostGeo = new THREE.SphereGeometry(0.008, 6, 6);
    var nostL = new THREE.Mesh(nostGeo, nostrilMat);
    nostL.position.set(-0.012, 1.898, 0.185);
    root.add(nostL);
    var nostR = nostL.clone();
    nostR.position.set(0.012, 1.898, 0.185);
    root.add(nostR);

    // Mouth / lips — wider, fuller
    var lipGeo = new THREE.CapsuleGeometry(0.022, 0.04, 4, 10);
    var lips = new THREE.Mesh(lipGeo, mLip);
    lips.position.set(0, 1.865, 0.16);
    lips.rotation.z = Math.PI * 0.5;
    lips.scale.set(0.55, 1, 0.35);
    root.add(lips);
    // Lower lip highlight
    var llipGeo = new THREE.CapsuleGeometry(0.015, 0.028, 4, 8);
    var lowerLip = new THREE.Mesh(llipGeo, mLip);
    lowerLip.position.set(0, 1.856, 0.158);
    lowerLip.rotation.z = Math.PI * 0.5;
    lowerLip.scale.set(0.45, 1.0, 0.3);
    root.add(lowerLip);

    // Jaw / chin — more defined
    var jawGeo = new THREE.SphereGeometry(0.155, 16, 16, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48);
    var jaw = new THREE.Mesh(jawGeo, mSkin);
    jaw.position.set(0, 1.88, 0.01);
    jaw.scale.set(1.0, 0.85, 0.92);
    root.add(jaw);

    // Ears
    var earGeo = new THREE.SphereGeometry(0.032, 8, 8);
    var earL = new THREE.Mesh(earGeo, mSkin);
    earL.position.set(-0.178, 1.92, 0.01);
    earL.scale.set(0.3, 0.7, 0.5);
    root.add(earL);
    var earR = earL.clone();
    earR.position.set(0.178, 1.92, 0.01);
    root.add(earR);

    /* ── ARMS (grouped at shoulder pivot) ─────────────── */
    var shOff = 0.26 * B.sh;
    var uaR0 = 0.048 * B.limb;
    var faR0 = 0.038 * B.limb;

    function buildArm(side) {
      var s = side === 'L' ? -1 : 1;
      var grp = new THREE.Group();
      grp.position.set(s * shOff, 1.55, 0);
      grp.rotation.z = s * 0.18;  // slight angle out
      grp.name = 'armGroup' + side;

      // Upper arm (jersey sleeve)
      var ua = new THREE.Mesh(new THREE.CapsuleGeometry(uaR0, 0.22, 6, 12), mJersey);
      ua.position.set(0, -0.16, 0);
      ua.name = 'upperArm' + side;
      grp.add(ua);

      // Forearm (skin) — slight forward bend for natural pose
      var fa = new THREE.Mesh(new THREE.CapsuleGeometry(faR0, 0.2, 6, 12), mSkin);
      fa.position.set(s * 0.01, -0.42, 0.08);
      fa.rotation.x = -0.2;
      fa.name = 'forearm' + side;
      grp.add(fa);

      // Hand (skin) — positioned at end of bent forearm
      var hand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), mSkin);
      hand.position.set(s * 0.015, -0.58, 0.14);
      hand.scale.set(0.85, 1.1, 0.7);
      grp.add(hand);

      return grp;
    }

    root.add(buildArm('L'));
    root.add(buildArm('R'));

    /* ── HIPS / SHORTS ────────────────────────────────── */
    var hipGeo = new THREE.CapsuleGeometry(0.17 * B.sx, 0.14, 8, 14);
    var hips = new THREE.Mesh(hipGeo, mShorts);
    hips.position.set(0, 0.96, 0);
    hips.name = 'hips';
    root.add(hips);

    // Waistband stripe
    var wbGeo = new THREE.TorusGeometry(0.17 * B.sx, 0.008, 6, 20);
    var wb = new THREE.Mesh(wbGeo, mStripe);
    wb.position.set(0, 1.04, 0);
    wb.rotation.x = Math.PI * 0.5;
    root.add(wb);

    /* ── LEGS ─────────────────────────────────────────── */
    var legX = 0.09;

    function buildLeg(side) {
      var s = side === 'L' ? -1 : 1;

      // Upper leg (shorts material)
      var ul = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.06 * B.leg, 0.26, 6, 12), mShorts
      );
      ul.position.set(s * legX, 0.72, 0);
      ul.name = 'upperLeg' + side;
      root.add(ul);

      // Lower leg (skin / long socks)
      var ll = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.05 * B.leg, 0.3, 6, 12), mSkin
      );
      ll.position.set(s * legX, 0.38, 0);
      ll.name = 'lowerLeg' + side;
      root.add(ll);

      // Knee cap subtle
      var kn = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 8, 8), mSkin
      );
      kn.position.set(s * legX, 0.55, 0.05);
      kn.scale.set(1, 0.6, 0.5);
      root.add(kn);

      // Shoe
      var shoeGeo = new THREE.BoxGeometry(0.1, 0.07, 0.18);
      var shoe = new THREE.Mesh(shoeGeo, mShoe);
      shoe.position.set(s * legX, 0.04, 0.02);
      root.add(shoe);

      // Sole highlight
      var soleGeo = new THREE.BoxGeometry(0.1, 0.015, 0.19);
      var sole = new THREE.Mesh(soleGeo, mSole);
      sole.position.set(s * legX, 0.008, 0.025);
      root.add(sole);
    }

    buildLeg('L');
    buildLeg('R');

    /* ── HAIR ─────────────────────────────────────────── */
    var hairG = buildHair(av.hairStyle, mHair);
    if (hairG) { hairG.name = 'hair'; root.add(hairG); }

    /* ── BEARD ────────────────────────────────────────── */
    var beardG = buildBeard(av.beardStyle, mHair);
    if (beardG) { beardG.name = 'beard'; root.add(beardG); }

    /* ── ACCESSORY ────────────────────────────────────── */
    var accG = buildAccessory(av.accessory, skin);
    if (accG) { accG.name = 'accessory'; root.add(accG); }

    /* ── Store for live update ────────────────────────── */
    root.userData = {
      skinMat: mSkin, hairMat: mHair, jerseyMat: mJersey,
      shortsMat: mShorts, browMat: mBrow,
      avatarData: JSON.parse(JSON.stringify(av))
    };

    scene.add(root);
    return root;
  }

  /* ═══════════════════════════════════════════════════════════
     HAIR — all styles sit ON TOP of skull, never cover face
     Head center = 1.92, radius = 0.18, top of head ≈ 2.12
     Face plane ≈ z 0.15+. Hair must stay z ≤ 0.08 in front
     ═══════════════════════════════════════════════════════════ */
  var H = { cx: 0, cy: 1.92, r: 0.18 };  // head reference

  function buildHair(style, m) {
    var g = new THREE.Group();

    switch (style) {
      case 'bald': return null;

      case 'buzz': {
        // Tight skull cap — only top hemisphere, stops above ears
        var cap = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.012, 22, 22, 0, Math.PI * 2, 0, Math.PI * 0.48),
          m
        );
        cap.position.set(H.cx, H.cy + 0.02, -0.01);
        g.add(cap);
        break;
      }

      case 'short': {
        // Slightly thicker cap on top
        var top = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.025, 22, 22, 0, Math.PI * 2, 0, Math.PI * 0.45),
          m
        );
        top.position.set(H.cx, H.cy + 0.03, -0.015);
        top.scale.set(1.02, 1.1, 1.0);
        g.add(top);
        break;
      }

      case 'fade': {
        // Volume on top, tapered sides
        var fadeTop = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.03, 22, 22, 0, Math.PI * 2, 0, Math.PI * 0.38),
          m
        );
        fadeTop.position.set(H.cx, H.cy + 0.04, -0.01);
        fadeTop.scale.set(0.92, 1.25, 0.95);
        g.add(fadeTop);
        // Subtle side fade (transparent)
        var fadeMat = m.clone();
        fadeMat.transparent = true;
        fadeMat.opacity = 0.3;
        var fadeSide = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.015, 16, 16, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.2),
          fadeMat
        );
        fadeSide.position.set(H.cx, H.cy + 0.01, -0.01);
        g.add(fadeSide);
        break;
      }

      case 'afro': {
        // Big round afro — sits on TOP of skull, open at front so face shows
        // Main dome: only top 80° (PI*0.44) so it never reaches the face
        var afro = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.14, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.44),
          m
        );
        afro.position.set(H.cx, H.cy + 0.06, -0.04);
        afro.scale.set(1.3, 1.1, 1.2);
        g.add(afro);
        // Side puffs — pushed BEHIND the ear line (z negative)
        var puffGeo = new THREE.SphereGeometry(0.1, 14, 14);
        var puffL = new THREE.Mesh(puffGeo, m);
        puffL.position.set(-0.2, H.cy + 0.02, -0.06);
        puffL.scale.set(0.8, 1.0, 0.9);
        g.add(puffL);
        var puffR = puffL.clone();
        puffR.position.set(0.2, H.cy + 0.02, -0.06);
        g.add(puffR);
        // Back volume — large, behind head
        var afBack = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 14, 14), m
        );
        afBack.position.set(0, H.cy + 0.02, -0.16);
        afBack.scale.set(1.1, 1.0, 0.8);
        g.add(afBack);
        break;
      }

      case 'dreads': {
        // Cap on top of skull
        var dCap = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.02, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.45),
          m
        );
        dCap.position.set(H.cx, H.cy + 0.03, -0.01);
        g.add(dCap);
        // Dread strands hanging from BACK and SIDES only (not front face area)
        var dGeo = new THREE.CapsuleGeometry(0.018, 0.14, 4, 8);
        for (var i = 0; i < 14; i++) {
          var a = (i / 14) * Math.PI * 2;
          // Skip front face zone (z > 0.06)
          var dz = Math.sin(a) * 0.16;
          if (dz > 0.06) continue;
          var dr = new THREE.Mesh(dGeo, m);
          dr.position.set(
            Math.cos(a) * 0.17,
            H.cy - 0.12,
            dz - 0.02
          );
          dr.rotation.z = Math.cos(a) * 0.25;
          dr.rotation.x = -Math.sin(a) * 0.15;
          g.add(dr);
        }
        break;
      }

      case 'mohawk': {
        // Central ridge on top of skull
        var mhGeo = new THREE.BoxGeometry(0.06, 0.1, 0.22);
        var mh = new THREE.Mesh(mhGeo, m);
        mh.position.set(H.cx, H.cy + H.r + 0.03, -0.02);
        g.add(mh);
        // Pointed front
        var peak = new THREE.Mesh(
          new THREE.ConeGeometry(0.035, 0.07, 8), m
        );
        peak.position.set(H.cx, H.cy + H.r + 0.06, 0.08);
        peak.rotation.x = -0.3;
        g.add(peak);
        // Pointed back
        var tail = new THREE.Mesh(
          new THREE.ConeGeometry(0.03, 0.06, 6), m
        );
        tail.position.set(H.cx, H.cy + H.r + 0.02, -0.14);
        tail.rotation.x = 0.4;
        g.add(tail);
        break;
      }

      case 'waves': {
        // Clean wave cap
        var wCap = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.022, 26, 26, 0, Math.PI * 2, 0, Math.PI * 0.46),
          m
        );
        wCap.position.set(H.cx, H.cy + 0.025, -0.01);
        wCap.scale.set(1.02, 1.06, 1.0);
        g.add(wCap);
        // Wave ridges (small bumps on top — back half)
        var bGeo = new THREE.SphereGeometry(0.025, 6, 6);
        for (var w = 0; w < 10; w++) {
          var wa = (w / 10) * Math.PI * 2;
          var wz = Math.sin(wa) * 0.12;
          if (wz > 0.05) continue;  // skip face zone
          var bump = new THREE.Mesh(bGeo, m);
          bump.position.set(
            Math.cos(wa) * 0.13,
            H.cy + 0.12 + Math.sin(wa * 3) * 0.008,
            wz - 0.01
          );
          g.add(bump);
        }
        break;
      }

      case 'cornrows': {
        // Thin braided rows going front-to-back on top of skull
        var cGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.28, 6);
        var cPositions = [-0.1, -0.05, 0, 0.05, 0.1];
        for (var c = 0; c < cPositions.length; c++) {
          var row = new THREE.Mesh(cGeo, m);
          row.position.set(cPositions[c], H.cy + 0.1, -0.04);
          row.rotation.x = Math.PI * 0.5;
          g.add(row);
        }
        // Thin cap under rows
        var cCap = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.012, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.38),
          m
        );
        cCap.position.set(H.cx, H.cy + 0.02, -0.01);
        cCap.scale.y = 0.7;
        g.add(cCap);
        break;
      }
    }

    return g.children.length ? g : null;
  }

  /* ═══════════════════════════════════════════════════════════
     BEARD — jaw area around y=1.82..1.86, z=0.1..0.16
     ═══════════════════════════════════════════════════════════ */

  function buildBeard(style, m) {
    if (!style || style === 'none') return null;
    var g = new THREE.Group();

    switch (style) {
      case 'stubble': {
        var sMat = m.clone();
        sMat.transparent = true;
        sMat.opacity = 0.3;
        var stub = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), sMat);
        stub.position.set(0, 1.83, 0.06);
        stub.scale.set(1.2, 0.6, 0.6);
        g.add(stub);
        break;
      }

      case 'short': {
        var sb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), m);
        sb.position.set(0, 1.82, 0.08);
        sb.scale.set(1.15, 0.65, 0.5);
        g.add(sb);
        break;
      }

      case 'full': {
        var fb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), m);
        fb.position.set(0, 1.81, 0.06);
        fb.scale.set(1.15, 0.75, 0.6);
        g.add(fb);
        // Side burns
        var sbGeo = new THREE.SphereGeometry(0.04, 8, 8);
        var sL = new THREE.Mesh(sbGeo, m);
        sL.position.set(-0.14, 1.87, 0.05);
        g.add(sL);
        var sR = sL.clone();
        sR.position.set(0.14, 1.87, 0.05);
        g.add(sR);
        break;
      }

      case 'goatee': {
        // Chin tuft
        var gt = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), m);
        gt.position.set(0, 1.8, 0.12);
        gt.scale.set(0.85, 1.0, 0.5);
        g.add(gt);
        // Mustache
        var mu = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.012, 0.015), m);
        mu.position.set(0, 1.875, 0.17);
        g.add(mu);
        break;
      }

      case 'chinstrap': {
        var cs = new THREE.Mesh(
          new THREE.TorusGeometry(0.14, 0.012, 8, 24, Math.PI), m
        );
        cs.position.set(0, 1.84, 0.01);
        cs.rotation.x = -0.25;
        g.add(cs);
        break;
      }
    }

    return g.children.length ? g : null;
  }

  /* ═══════════════════════════════════════════════════════════
     ACCESSORIES — positioned for new proportions
     ═══════════════════════════════════════════════════════════ */

  function buildAccessory(type, skinColor) {
    if (!type || type === 'none') return null;
    var g = new THREE.Group();

    var mMetal = mat(0xDAA520, 0.3, 0.8);
    var mFabric = mat(0xDD3333, 0.65);
    var mDark = mat(0x1a2d5a, 0.5, 0.1);

    switch (type) {
      case 'headband': {
        var hb = new THREE.Mesh(
          new THREE.TorusGeometry(0.19, 0.018, 8, 32), mFabric
        );
        hb.position.set(0, H.cy + 0.06, 0);
        hb.rotation.x = Math.PI * 0.5;
        g.add(hb);
        break;
      }

      case 'sweatband': {
        var sw = new THREE.Mesh(
          new THREE.TorusGeometry(0.05, 0.012, 8, 14), mFabric
        );
        sw.position.set(-0.3, 1.25, 0.02);
        sw.rotation.x = Math.PI * 0.5;
        g.add(sw);
        break;
      }

      case 'armband': {
        var ab = new THREE.Mesh(
          new THREE.TorusGeometry(0.055, 0.01, 8, 14), mMetal
        );
        ab.position.set(0.3, 1.4, 0);
        ab.rotation.x = Math.PI * 0.5;
        g.add(ab);
        break;
      }

      case 'glasses': {
        var lensMat = mat(0x333333, 0.25, 0.5);
        lensMat.side = THREE.DoubleSide;
        var lGeo = new THREE.RingGeometry(0.022, 0.032, 18);
        var lL = new THREE.Mesh(lGeo, lensMat);
        lL.position.set(-0.065, 1.94, 0.19);
        g.add(lL);
        var lR = lL.clone();
        lR.position.set(0.065, 1.94, 0.19);
        g.add(lR);
        // Bridge
        var bGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.07, 6);
        var br = new THREE.Mesh(bGeo, lensMat);
        br.position.set(0, 1.94, 0.19);
        br.rotation.z = Math.PI * 0.5;
        g.add(br);
        // Temple arms
        var tGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.12, 4);
        var tL = new THREE.Mesh(tGeo, lensMat);
        tL.position.set(-0.12, 1.94, 0.13);
        tL.rotation.z = Math.PI * 0.5;
        tL.rotation.y = 0.45;
        g.add(tL);
        var tR = tL.clone();
        tR.position.set(0.12, 1.94, 0.13);
        tR.rotation.y = -0.45;
        g.add(tR);
        break;
      }

      case 'chain': {
        var ch = new THREE.Mesh(
          new THREE.TorusGeometry(0.1, 0.007, 8, 28), mMetal
        );
        ch.position.set(0, 1.68, 0.06);
        ch.rotation.x = Math.PI * 0.42;
        g.add(ch);
        // Pendant
        var pd = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), mMetal);
        pd.position.set(0, 1.6, 0.1);
        g.add(pd);
        break;
      }

      case 'durag': {
        var dg = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.02, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.52),
          mDark
        );
        dg.position.set(0, H.cy + 0.02, 0);
        g.add(dg);
        // Tail flap
        var tl = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.018, 0.1, 4, 8), mDark
        );
        tl.position.set(0, H.cy - 0.1, -0.16);
        tl.rotation.x = 0.4;
        g.add(tl);
        break;
      }
    }

    return g.children.length ? g : null;
  }

  /* ═══════════════════════════════════════════════════════════
     LIGHTING — 3-point cinematic
     ═══════════════════════════════════════════════════════════ */

  function setupLighting(scene) {
    var key = new THREE.DirectionalLight(0xFFF5E6, 1.3);
    key.position.set(2, 3.5, 2.5);
    scene.add(key);

    var fill = new THREE.DirectionalLight(0xE6F0FF, 0.5);
    fill.position.set(-2, 1.5, 1);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xFFB347, 0.7);
    rim.position.set(0, 2.5, -2.5);
    scene.add(rim);

    var ambient = new THREE.AmbientLight(0x404050, 0.45);
    scene.add(ambient);

    var bounce = new THREE.DirectionalLight(0xFFE4C4, 0.2);
    bounce.position.set(0, -1, 1);
    scene.add(bounce);
  }

  /* ═══════════════════════════════════════════════════════════
     SCENE CREATION
     ═══════════════════════════════════════════════════════════ */

  function create(container, avatarData, opts) {
    if (!hasThree()) return null;
    opts = opts || {};

    var width  = opts.width  || container.clientWidth  || 200;
    var height = opts.height || container.clientHeight || 280;

    /* Renderer */
    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    /* Scene */
    var scene = new THREE.Scene();

    /* Camera — framed for taller character */
    var camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 3.8);
    camera.lookAt(0, 1.15, 0);

    /* Lighting */
    setupLighting(scene);

    /* Controls */
    var controls = null;
    if (opts.interactive !== false && typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.target.set(0, 1.15, 0);
      controls.minPolarAngle = Math.PI * 0.35;
      controls.maxPolarAngle = Math.PI * 0.65;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.7;
      controls.update();
    }

    /* Build character */
    var avatarRoot = buildCharacter(scene, avatarData);

    /* Animation state */
    var clock = new THREE.Clock();
    var animState = {
      blinkTimer: 3 + Math.random() * 2,
      blinking: false,
      blinkDur: 0
    };

    /* Render loop */
    var running = true;
    var rafId = null;

    function animate() {
      if (!running) return;
      rafId = requestAnimationFrame(animate);

      var dt = clock.getDelta();
      var t = clock.getElapsedTime();

      if (opts.animate !== false) {
        // Breathing
        var torso = avatarRoot.getObjectByName('torso');
        if (torso) torso.scale.y = 1.0 + Math.sin(t * 1.8) * 0.01;

        // Subtle idle sway
        avatarRoot.rotation.y += Math.sin(t * 0.8) * 0.0002;

        // Blink cycle
        animState.blinkTimer -= dt;
        if (animState.blinkTimer <= 0 && !animState.blinking) {
          animState.blinking = true;
          animState.blinkDur = 0;
        }
        if (animState.blinking) {
          animState.blinkDur += dt;
          var eyeL = avatarRoot.getObjectByName('eyeL');
          var eyeR = avatarRoot.getObjectByName('eyeR');
          var sq = animState.blinkDur < 0.06 ? 0.08 : (animState.blinkDur < 0.12 ? 0.08 : 0.7);
          if (eyeL) eyeL.scale.y = sq;
          if (eyeR) eyeR.scale.y = sq;
          if (animState.blinkDur > 0.14) {
            animState.blinking = false;
            animState.blinkTimer = 2 + Math.random() * 3;
            if (eyeL) eyeL.scale.y = 0.7;
            if (eyeR) eyeR.scale.y = 0.7;
          }
        }
      }

      if (controls) controls.update();
      renderer.render(scene, camera);
    }

    animate();

    /* Visibility observer */
    var observer = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(function (entries) {
        var vis = entries[0].isIntersecting;
        if (vis && !running) { running = true; clock.start(); animate(); }
        else if (!vis && running) { running = false; if (rafId) cancelAnimationFrame(rafId); }
      }, { threshold: 0.1 });
      observer.observe(container);
    }

    /* Resize handler */
    function onResize() {
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (w && h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    }

    return {
      scene: scene, camera: camera, renderer: renderer,
      controls: controls, avatarRoot: avatarRoot,
      container: container, observer: observer,
      onResize: onResize,
      _rafId: rafId,
      _running: function () { return running; },
      _setRunning: function (v) { running = v; }
    };
  }

  /* ═══════════════════════════════════════════════════════════
     LIVE UPDATE
     ═══════════════════════════════════════════════════════════ */

  function update(handle, avatarData) {
    if (!handle || !handle.scene) return;
    var scene = handle.scene;
    var oldRoot = handle.avatarRoot;

    if (oldRoot) { scene.remove(oldRoot); disposeGroup(oldRoot); }

    var newRoot = buildCharacter(scene, avatarData);
    handle.avatarRoot = newRoot;

    // Reactive GSAP animations
    if (typeof gsap !== 'undefined' && oldRoot && oldRoot.userData.avatarData) {
      var old = oldRoot.userData.avatarData;
      if (old.hairStyle !== avatarData.hairStyle || old.beardStyle !== avatarData.beardStyle) {
        gsap.fromTo(newRoot.rotation, { y: -0.2 }, { y: 0, duration: 0.4, ease: 'back.out(1.3)' });
      }
      if (old.bodyType !== avatarData.bodyType) {
        gsap.fromTo(newRoot.scale, { y: 0.93 }, { y: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
      }
      if (old.skinTone !== avatarData.skinTone) {
        gsap.fromTo(newRoot.scale, { x: 0.97, z: 0.97 }, { x: 1, z: 1, duration: 0.3, ease: 'power2.out' });
      }
      if (old.accessory !== avatarData.accessory) {
        var acc = newRoot.getObjectByName('accessory');
        if (acc) {
          acc.traverse(function (ch) {
            if (ch.isMesh && ch.material && ch.material.emissive) {
              var orig = ch.material.emissive.getHex();
              ch.material.emissive.set(0xFFB347);
              ch.material.emissiveIntensity = 0.8;
              gsap.to(ch.material, {
                emissiveIntensity: 0, duration: 0.5, ease: 'power2.out',
                onComplete: function () { ch.material.emissive.set(orig); }
              });
            }
          });
        }
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
     DISPOSE
     ═══════════════════════════════════════════════════════════ */

  function disposeGroup(group) {
    group.traverse(function (ch) {
      if (ch.isMesh) {
        if (ch.geometry) ch.geometry.dispose();
        if (ch.material) {
          if (Array.isArray(ch.material)) ch.material.forEach(function (m) { m.dispose(); });
          else ch.material.dispose();
        }
      }
    });
  }

  function dispose(handle) {
    if (!handle) return;
    handle._setRunning(false);
    if (handle._rafId) cancelAnimationFrame(handle._rafId);
    if (handle.observer) handle.observer.disconnect();
    if (handle.controls) handle.controls.dispose();
    if (handle.avatarRoot) { handle.scene.remove(handle.avatarRoot); disposeGroup(handle.avatarRoot); }
    if (handle.renderer) {
      handle.renderer.dispose();
      if (handle.renderer.domElement && handle.renderer.domElement.parentNode) {
        handle.renderer.domElement.parentNode.removeChild(handle.renderer.domElement);
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════════════════════════ */
  window.Avatar3D = { create: create, update: update, dispose: dispose };

})();
