/* ============================================================
   AVATAR 3D ENGINE — /js/avatar-3d.js
   Three.js procedural character builder for CourtIQ.
   Replaces the 2D canvas avatar with a fully 3D, interactive,
   animated character. Requires Three.js r160+ via CDN.
   ============================================================ */
(function () {
  'use strict';

  /* ── Guard ─────────────────────────────────────────────── */
  function hasThree() { return typeof THREE !== 'undefined'; }

  /* ── Skin tone lookup ──────────────────────────────────── */
  var SKIN_COLORS = {
    '#FDDBB4': 0xFDDBB4, '#E8B98D': 0xE8B98D, '#C68642': 0xC68642,
    '#8D5524': 0x8D5524, '#5C3317': 0x5C3317, '#3B1E0E': 0x3B1E0E
  };

  function skinHex(hex) {
    return SKIN_COLORS[hex] || parseInt(hex.replace('#', ''), 16) || 0xC68642;
  }

  function hairHex(hex) {
    return parseInt(hex.replace('#', ''), 16) || 0x1a1a1a;
  }

  /* ── Body type configs ─────────────────────────────────── */
  var BODY_SCALES = {
    lean:     { torsoX: 0.82, torsoZ: 0.82, shoulderW: 0.92, limbScale: 0.9,  legScale: 0.95 },
    athletic: { torsoX: 1.0,  torsoZ: 1.0,  shoulderW: 1.0,  limbScale: 1.0,  legScale: 1.0  },
    heavy:    { torsoX: 1.18, torsoZ: 1.15, shoulderW: 1.12, limbScale: 1.12, legScale: 1.08 }
  };

  /* ── Jersey/shorts colors ──────────────────────────────── */
  var JERSEY_COLOR = 0x1a1a2e;
  var SHORTS_COLOR = 0x16213e;
  var SHOE_COLOR   = 0x222222;

  /* ═══════════════════════════════════════════════════════════
     CHARACTER BUILDER
     ═══════════════════════════════════════════════════════════ */

  function buildCharacter(scene, avatarData) {
    var root = new THREE.Group();
    root.name = 'avatar-root';
    var bs = BODY_SCALES[avatarData.bodyType] || BODY_SCALES.athletic;
    var skinColor = skinHex(avatarData.skinTone);
    var hColor = hairHex(avatarData.hairColor);

    /* ── Materials ────────────────────────────────────────── */
    var skinMat = new THREE.MeshStandardMaterial({
      color: skinColor, roughness: 0.7, metalness: 0.05
    });
    var jerseyMat = new THREE.MeshStandardMaterial({
      color: JERSEY_COLOR, roughness: 0.6, metalness: 0.0
    });
    var shortsMat = new THREE.MeshStandardMaterial({
      color: SHORTS_COLOR, roughness: 0.65, metalness: 0.0
    });
    var shoeMat = new THREE.MeshStandardMaterial({
      color: SHOE_COLOR, roughness: 0.5, metalness: 0.1
    });
    var hairMat = new THREE.MeshStandardMaterial({
      color: hColor, roughness: 0.85, metalness: 0.0
    });
    var eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var eyeIrisMat  = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });

    /* ── Torso (jersey) ──────────────────────────────────── */
    var torsoGeo = new THREE.CapsuleGeometry(0.22, 0.38, 8, 16);
    var torso = new THREE.Mesh(torsoGeo, jerseyMat);
    torso.scale.set(bs.torsoX, 1, bs.torsoZ);
    torso.position.set(0, 0.9, 0);
    torso.name = 'torso';
    root.add(torso);

    /* ── Neck ────────────────────────────────────────────── */
    var neckGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.08, 12);
    var neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.set(0, 1.28, 0);
    neck.name = 'neck';
    root.add(neck);

    /* ── Head ────────────────────────────────────────────── */
    var headGeo = new THREE.SphereGeometry(0.2, 24, 24);
    var head = new THREE.Mesh(headGeo, skinMat);
    head.scale.set(1, 1.08, 0.95);
    head.position.set(0, 1.48, 0);
    head.name = 'head';
    root.add(head);

    /* ── Eyes ────────────────────────────────────────────── */
    var eyeLGeo = new THREE.SphereGeometry(0.032, 12, 12);
    var eyeL = new THREE.Mesh(eyeLGeo, eyeWhiteMat);
    eyeL.position.set(-0.07, 1.5, 0.17);
    eyeL.scale.set(1, 0.8, 0.5);
    eyeL.name = 'eyeL';
    root.add(eyeL);

    var eyeR = new THREE.Mesh(eyeLGeo, eyeWhiteMat);
    eyeR.position.set(0.07, 1.5, 0.17);
    eyeR.scale.set(1, 0.8, 0.5);
    eyeR.name = 'eyeR';
    root.add(eyeR);

    var irisGeo = new THREE.SphereGeometry(0.018, 10, 10);
    var irisL = new THREE.Mesh(irisGeo, eyeIrisMat);
    irisL.position.set(-0.07, 1.5, 0.2);
    irisL.name = 'irisL';
    root.add(irisL);

    var irisR = new THREE.Mesh(irisGeo, eyeIrisMat);
    irisR.position.set(0.07, 1.5, 0.2);
    irisR.name = 'irisR';
    root.add(irisR);

    /* ── Eyebrows ────────────────────────────────────────── */
    var browGeo = new THREE.BoxGeometry(0.05, 0.012, 0.015);
    var browMat = new THREE.MeshStandardMaterial({ color: hColor, roughness: 0.9 });
    var browL = new THREE.Mesh(browGeo, browMat);
    browL.position.set(-0.07, 1.55, 0.18);
    browL.rotation.z = 0.1;
    root.add(browL);
    var browR = new THREE.Mesh(browGeo, browMat);
    browR.position.set(0.07, 1.55, 0.18);
    browR.rotation.z = -0.1;
    root.add(browR);

    /* ── Nose ────────────────────────────────────────────── */
    var noseGeo = new THREE.SphereGeometry(0.025, 8, 8);
    var nose = new THREE.Mesh(noseGeo, skinMat);
    nose.position.set(0, 1.46, 0.2);
    nose.scale.set(0.8, 0.7, 0.6);
    root.add(nose);

    /* ── Mouth ───────────────────────────────────────────── */
    var mouthGeo = new THREE.TorusGeometry(0.025, 0.005, 8, 16, Math.PI);
    var mouthMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });
    var mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 1.4, 0.18);
    mouth.rotation.x = Math.PI;
    root.add(mouth);

    /* ── Ears ────────────────────────────────────────────── */
    var earGeo = new THREE.SphereGeometry(0.035, 8, 8);
    var earL = new THREE.Mesh(earGeo, skinMat);
    earL.position.set(-0.19, 1.48, 0);
    earL.scale.set(0.4, 0.7, 0.5);
    root.add(earL);
    var earR = new THREE.Mesh(earGeo, skinMat);
    earR.position.set(0.19, 1.48, 0);
    earR.scale.set(0.4, 0.7, 0.5);
    root.add(earR);

    /* ── Arms (relaxed at sides) ────────────────────────── */
    var shoulderOffset = 0.28 * bs.shoulderW;

    // Upper arms — angled down ~55° from horizontal
    var uaGeo = new THREE.CapsuleGeometry(0.05 * bs.limbScale, 0.2, 6, 12);
    var uaL = new THREE.Mesh(uaGeo, skinMat);
    uaL.position.set(-shoulderOffset - 0.03, 0.95, 0);
    uaL.rotation.z = 0.65;
    uaL.name = 'upperArmL';
    root.add(uaL);
    var uaR = new THREE.Mesh(uaGeo, skinMat);
    uaR.position.set(shoulderOffset + 0.03, 0.95, 0);
    uaR.rotation.z = -0.65;
    uaR.name = 'upperArmR';
    root.add(uaR);

    // Forearms — continuing downward with slight bend
    var faGeo = new THREE.CapsuleGeometry(0.04 * bs.limbScale, 0.18, 6, 12);
    var faL = new THREE.Mesh(faGeo, skinMat);
    faL.position.set(-shoulderOffset - 0.08, 0.68, 0.04);
    faL.rotation.z = 0.25;
    faL.rotation.x = -0.1;
    faL.name = 'forearmL';
    root.add(faL);
    var faR = new THREE.Mesh(faGeo, skinMat);
    faR.position.set(shoulderOffset + 0.08, 0.68, 0.04);
    faR.rotation.z = -0.25;
    faR.rotation.x = -0.1;
    faR.name = 'forearmR';
    root.add(faR);

    // Hands
    var handGeo = new THREE.SphereGeometry(0.04, 8, 8);
    var handL = new THREE.Mesh(handGeo, skinMat);
    handL.position.set(-shoulderOffset - 0.1, 0.52, 0.05);
    root.add(handL);
    var handR = new THREE.Mesh(handGeo, skinMat);
    handR.position.set(shoulderOffset + 0.1, 0.52, 0.05);
    root.add(handR);

    /* ── Hips / Shorts ───────────────────────────────────── */
    var hipsGeo = new THREE.CapsuleGeometry(0.18 * bs.torsoX, 0.12, 8, 12);
    var hips = new THREE.Mesh(hipsGeo, shortsMat);
    hips.position.set(0, 0.62, 0);
    hips.name = 'hips';
    root.add(hips);

    /* ── Legs ────────────────────────────────────────────── */
    var legSpacing = 0.1;

    // Upper legs (shorts cover these)
    var ulGeo = new THREE.CapsuleGeometry(0.065 * bs.legScale, 0.22, 6, 12);
    var ulL = new THREE.Mesh(ulGeo, shortsMat);
    ulL.position.set(-legSpacing, 0.42, 0);
    ulL.name = 'upperLegL';
    root.add(ulL);
    var ulR = new THREE.Mesh(ulGeo, shortsMat);
    ulR.position.set(legSpacing, 0.42, 0);
    ulR.name = 'upperLegR';
    root.add(ulR);

    // Lower legs (skin)
    var llGeo = new THREE.CapsuleGeometry(0.055 * bs.legScale, 0.22, 6, 12);
    var llL = new THREE.Mesh(llGeo, skinMat);
    llL.position.set(-legSpacing, 0.18, 0);
    llL.name = 'lowerLegL';
    root.add(llL);
    var llR = new THREE.Mesh(llGeo, skinMat);
    llR.position.set(legSpacing, 0.18, 0);
    llR.name = 'lowerLegR';
    root.add(llR);

    // Feet (shoes)
    var footGeo = new THREE.BoxGeometry(0.09, 0.05, 0.16);
    var footL = new THREE.Mesh(footGeo, shoeMat);
    footL.position.set(-legSpacing, 0.025, 0.03);
    root.add(footL);
    var footR = new THREE.Mesh(footGeo, shoeMat);
    footR.position.set(legSpacing, 0.025, 0.03);
    root.add(footR);

    /* ── Hair ────────────────────────────────────────────── */
    var hairGroup = buildHair(avatarData.hairStyle, hairMat);
    if (hairGroup) {
      hairGroup.name = 'hair';
      root.add(hairGroup);
    }

    /* ── Beard ───────────────────────────────────────────── */
    var beardGroup = buildBeard(avatarData.beardStyle, hairMat);
    if (beardGroup) {
      beardGroup.name = 'beard';
      root.add(beardGroup);
    }

    /* ── Accessory ───────────────────────────────────────── */
    var accGroup = buildAccessory(avatarData.accessory, skinColor);
    if (accGroup) {
      accGroup.name = 'accessory';
      root.add(accGroup);
    }

    /* ── Store materials for live update ──────────────────── */
    root.userData = {
      skinMat: skinMat,
      hairMat: hairMat,
      jerseyMat: jerseyMat,
      shortsMat: shortsMat,
      browMat: browMat,
      avatarData: JSON.parse(JSON.stringify(avatarData))
    };

    scene.add(root);
    return root;
  }

  /* ═══════════════════════════════════════════════════════════
     HAIR STYLES
     ═══════════════════════════════════════════════════════════ */

  function buildHair(style, mat) {
    var g = new THREE.Group();

    switch (style) {
      case 'bald':
        return null;

      case 'buzz': {
        var cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.205, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55),
          mat
        );
        cap.position.set(0, 1.5, 0);
        g.add(cap);
        break;
      }

      case 'short': {
        var top = new THREE.Mesh(
          new THREE.SphereGeometry(0.215, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.5),
          mat
        );
        top.position.set(0, 1.52, 0);
        top.scale.set(1, 1.1, 1);
        g.add(top);
        break;
      }

      case 'fade': {
        // Top volume + faded sides
        var fadeTop = new THREE.Mesh(
          new THREE.SphereGeometry(0.215, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.45),
          mat
        );
        fadeTop.position.set(0, 1.53, 0);
        fadeTop.scale.set(0.95, 1.15, 0.95);
        g.add(fadeTop);
        break;
      }

      case 'afro': {
        var afro = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 20, 20),
          mat
        );
        afro.position.set(0, 1.55, 0);
        afro.scale.set(1, 1.05, 0.95);
        g.add(afro);
        break;
      }

      case 'dreads': {
        // Main cap
        var dreadCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
          mat
        );
        dreadCap.position.set(0, 1.52, 0);
        g.add(dreadCap);
        // Hanging dread strands
        var dreadGeo = new THREE.CapsuleGeometry(0.02, 0.15, 4, 8);
        for (var i = 0; i < 12; i++) {
          var angle = (i / 12) * Math.PI * 2;
          var dr = new THREE.Mesh(dreadGeo, mat);
          dr.position.set(
            Math.cos(angle) * 0.18,
            1.38,
            Math.sin(angle) * 0.16
          );
          dr.rotation.z = Math.cos(angle) * 0.3;
          dr.rotation.x = -Math.sin(angle) * 0.2;
          g.add(dr);
        }
        break;
      }

      case 'mohawk': {
        var mohawkGeo = new THREE.BoxGeometry(0.06, 0.12, 0.28);
        var mohawk = new THREE.Mesh(mohawkGeo, mat);
        mohawk.position.set(0, 1.65, -0.02);
        g.add(mohawk);
        // Front peak
        var peakGeo = new THREE.ConeGeometry(0.04, 0.08, 8);
        var peak = new THREE.Mesh(peakGeo, mat);
        peak.position.set(0, 1.72, 0.08);
        peak.rotation.x = -0.3;
        g.add(peak);
        break;
      }

      case 'waves': {
        // Wavy top cap with slight bumps
        var waveCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.215, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.5),
          mat
        );
        waveCap.position.set(0, 1.52, 0);
        waveCap.scale.set(1, 1.05, 1);
        g.add(waveCap);
        // Small wave bumps
        var bumpGeo = new THREE.SphereGeometry(0.04, 6, 6);
        for (var w = 0; w < 8; w++) {
          var wa = (w / 8) * Math.PI * 2;
          var bump = new THREE.Mesh(bumpGeo, mat);
          bump.position.set(
            Math.cos(wa) * 0.15,
            1.58 + Math.sin(wa * 3) * 0.01,
            Math.sin(wa) * 0.14
          );
          g.add(bump);
        }
        break;
      }

      case 'cornrows': {
        // Rows of thin cylinders going front-to-back
        var rowGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.32, 6);
        var positions = [-0.12, -0.06, 0, 0.06, 0.12];
        for (var c = 0; c < positions.length; c++) {
          var row = new THREE.Mesh(rowGeo, mat);
          row.position.set(positions[c], 1.55, -0.02);
          row.rotation.x = Math.PI * 0.5;
          row.rotation.z = 0;
          g.add(row);
        }
        // Cap to cover top
        var cornCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.205, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.4),
          mat
        );
        cornCap.position.set(0, 1.52, 0);
        cornCap.scale.y = 0.6;
        g.add(cornCap);
        break;
      }
    }

    return g.children.length ? g : null;
  }

  /* ═══════════════════════════════════════════════════════════
     BEARD STYLES
     ═══════════════════════════════════════════════════════════ */

  function buildBeard(style, mat) {
    if (!style || style === 'none') return null;
    var g = new THREE.Group();

    switch (style) {
      case 'stubble': {
        // Subtle jaw shadow (slightly larger than face, darker)
        var stubbleMat = mat.clone();
        stubbleMat.transparent = true;
        stubbleMat.opacity = 0.35;
        var stubble = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 12, 12),
          stubbleMat
        );
        stubble.position.set(0, 1.38, 0.08);
        stubble.scale.set(1.3, 0.7, 0.7);
        g.add(stubble);
        break;
      }

      case 'short': {
        var shortBeard = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 12, 12),
          mat
        );
        shortBeard.position.set(0, 1.36, 0.1);
        shortBeard.scale.set(1.2, 0.75, 0.6);
        g.add(shortBeard);
        break;
      }

      case 'full': {
        var fullBeard = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 12, 12),
          mat
        );
        fullBeard.position.set(0, 1.35, 0.08);
        fullBeard.scale.set(1.2, 0.85, 0.7);
        g.add(fullBeard);
        // Side whiskers
        var sideGeo = new THREE.SphereGeometry(0.05, 8, 8);
        var sideL = new THREE.Mesh(sideGeo, mat);
        sideL.position.set(-0.15, 1.4, 0.08);
        g.add(sideL);
        var sideR = new THREE.Mesh(sideGeo, mat);
        sideR.position.set(0.15, 1.4, 0.08);
        g.add(sideR);
        break;
      }

      case 'goatee': {
        var goatee = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 10, 10),
          mat
        );
        goatee.position.set(0, 1.34, 0.14);
        goatee.scale.set(0.9, 1.1, 0.6);
        g.add(goatee);
        // Mustache portion
        var mustGeo = new THREE.BoxGeometry(0.08, 0.015, 0.02);
        var must = new THREE.Mesh(mustGeo, mat);
        must.position.set(0, 1.42, 0.18);
        g.add(must);
        break;
      }

      case 'chinstrap': {
        // Thin line along jaw
        var strapGeo = new THREE.TorusGeometry(0.16, 0.015, 8, 24, Math.PI);
        var strap = new THREE.Mesh(strapGeo, mat);
        strap.position.set(0, 1.38, 0.02);
        strap.rotation.x = -0.3;
        g.add(strap);
        break;
      }
    }

    return g.children.length ? g : null;
  }

  /* ═══════════════════════════════════════════════════════════
     ACCESSORIES
     ═══════════════════════════════════════════════════════════ */

  function buildAccessory(type, skinColor) {
    if (!type || type === 'none') return null;
    var g = new THREE.Group();

    var metalMat = new THREE.MeshStandardMaterial({
      color: 0xDAA520, roughness: 0.3, metalness: 0.8
    });
    var fabricMat = new THREE.MeshStandardMaterial({
      color: 0xDD3333, roughness: 0.7, metalness: 0.0
    });
    var darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a2d5a, roughness: 0.5, metalness: 0.1
    });

    switch (type) {
      case 'headband': {
        var hbGeo = new THREE.TorusGeometry(0.21, 0.02, 8, 32);
        var hb = new THREE.Mesh(hbGeo, fabricMat);
        hb.position.set(0, 1.56, 0);
        hb.rotation.x = Math.PI * 0.5;
        g.add(hb);
        break;
      }

      case 'sweatband': {
        var sbGeo = new THREE.TorusGeometry(0.055, 0.015, 8, 16);
        var sbL = new THREE.Mesh(sbGeo, fabricMat);
        sbL.position.set(-0.32, 0.82, 0.03);
        sbL.rotation.x = Math.PI * 0.5;
        g.add(sbL);
        break;
      }

      case 'armband': {
        var abGeo = new THREE.TorusGeometry(0.06, 0.012, 8, 16);
        var ab = new THREE.Mesh(abGeo, metalMat);
        ab.position.set(0.3, 1.0, 0);
        ab.rotation.x = Math.PI * 0.5;
        g.add(ab);
        break;
      }

      case 'glasses': {
        var lensGeo = new THREE.RingGeometry(0.025, 0.035, 16);
        var lensMat = new THREE.MeshStandardMaterial({
          color: 0x333333, roughness: 0.3, metalness: 0.5, side: THREE.DoubleSide
        });
        var lensL = new THREE.Mesh(lensGeo, lensMat);
        lensL.position.set(-0.07, 1.5, 0.21);
        g.add(lensL);
        var lensR = new THREE.Mesh(lensGeo, lensMat);
        lensR.position.set(0.07, 1.5, 0.21);
        g.add(lensR);
        // Bridge
        var bridgeGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6);
        var bridge = new THREE.Mesh(bridgeGeo, lensMat);
        bridge.position.set(0, 1.5, 0.21);
        bridge.rotation.z = Math.PI * 0.5;
        g.add(bridge);
        // Arms
        var armGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.14, 4);
        var armL = new THREE.Mesh(armGeo, lensMat);
        armL.position.set(-0.13, 1.5, 0.14);
        armL.rotation.z = Math.PI * 0.5;
        armL.rotation.y = 0.5;
        g.add(armL);
        var armR = new THREE.Mesh(armGeo, lensMat);
        armR.position.set(0.13, 1.5, 0.14);
        armR.rotation.z = Math.PI * 0.5;
        armR.rotation.y = -0.5;
        g.add(armR);
        break;
      }

      case 'chain': {
        var chainGeo = new THREE.TorusGeometry(0.12, 0.008, 8, 24);
        var chain = new THREE.Mesh(chainGeo, metalMat);
        chain.position.set(0, 1.22, 0.06);
        chain.rotation.x = Math.PI * 0.45;
        g.add(chain);
        // Pendant
        var pendGeo = new THREE.SphereGeometry(0.018, 8, 8);
        var pend = new THREE.Mesh(pendGeo, metalMat);
        pend.position.set(0, 1.12, 0.12);
        g.add(pend);
        break;
      }

      case 'durag': {
        var duragGeo = new THREE.SphereGeometry(0.215, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
        var durag = new THREE.Mesh(duragGeo, darkMat);
        durag.position.set(0, 1.51, 0);
        g.add(durag);
        // Tail
        var tailGeo = new THREE.CapsuleGeometry(0.02, 0.12, 4, 8);
        var tail = new THREE.Mesh(tailGeo, darkMat);
        tail.position.set(0, 1.42, -0.18);
        tail.rotation.x = 0.5;
        g.add(tail);
        break;
      }

      case 'armSleeve':
      case 'armband': {
        // Arm sleeve — long cylinder on left arm
        if (type === 'armSleeve') {
          var sleeveGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.25, 12);
          var sleeve = new THREE.Mesh(sleeveGeo, darkMat);
          sleeve.position.set(-0.32, 0.9, 0);
          g.add(sleeve);
        }
        break;
      }
    }

    return g.children.length ? g : null;
  }

  /* ═══════════════════════════════════════════════════════════
     LIGHTING
     ═══════════════════════════════════════════════════════════ */

  function setupLighting(scene) {
    // Key light (warm)
    var key = new THREE.DirectionalLight(0xFFF5E6, 1.2);
    key.position.set(2, 3, 2);
    key.castShadow = false;
    scene.add(key);

    // Fill light (cool)
    var fill = new THREE.DirectionalLight(0xE6F0FF, 0.5);
    fill.position.set(-2, 1, 1);
    scene.add(fill);

    // Rim light (amber brand accent)
    var rim = new THREE.DirectionalLight(0xFFB347, 0.8);
    rim.position.set(0, 2, -2);
    scene.add(rim);

    // Ambient
    var ambient = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambient);

    // Subtle ground bounce
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

    /* ── Renderer ─────────────────────────────────────────── */
    var renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    /* ── Scene ────────────────────────────────────────────── */
    var scene = new THREE.Scene();

    /* ── Camera ───────────────────────────────────────────── */
    var camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 3.2);
    camera.lookAt(0, 0.9, 0);

    /* ── Lighting ─────────────────────────────────────────── */
    setupLighting(scene);

    /* ── Controls (optional) ──────────────────────────────── */
    var controls = null;
    if (opts.interactive !== false && typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.target.set(0, 0.9, 0);
      controls.minPolarAngle = Math.PI * 0.35;
      controls.maxPolarAngle = Math.PI * 0.65;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.update();
    }

    /* ── Build character ──────────────────────────────────── */
    var avatarRoot = buildCharacter(scene, avatarData);

    /* ── Animation state ─────────────────────────────────── */
    var clock = new THREE.Clock();
    var animState = {
      breathing: 0,
      sway: 0,
      blinkTimer: 3 + Math.random() * 2,
      blinking: false,
      blinkDuration: 0
    };

    /* ── Render loop ──────────────────────────────────────── */
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
        if (torso) {
          torso.scale.y = 1.0 + Math.sin(t * 1.9) * 0.012;
        }

        // Subtle sway
        avatarRoot.rotation.y += Math.sin(t * 0.9) * 0.0003;

        // Blink
        animState.blinkTimer -= dt;
        if (animState.blinkTimer <= 0 && !animState.blinking) {
          animState.blinking = true;
          animState.blinkDuration = 0;
        }
        if (animState.blinking) {
          animState.blinkDuration += dt;
          var eyeL = avatarRoot.getObjectByName('eyeL');
          var eyeR = avatarRoot.getObjectByName('eyeR');
          var irisL = avatarRoot.getObjectByName('irisL');
          var irisR = avatarRoot.getObjectByName('irisR');
          var squeeze = animState.blinkDuration < 0.06 ? 0.1 : (animState.blinkDuration < 0.12 ? 0.1 : 0.8);
          if (animState.blinkDuration > 0.12) squeeze = 0.8;
          if (eyeL) eyeL.scale.y = squeeze;
          if (eyeR) eyeR.scale.y = squeeze;
          if (irisL) irisL.scale.y = squeeze;
          if (irisR) irisR.scale.y = squeeze;
          if (animState.blinkDuration > 0.15) {
            animState.blinking = false;
            animState.blinkTimer = 2.5 + Math.random() * 3;
            if (eyeL) eyeL.scale.y = 0.8;
            if (eyeR) eyeR.scale.y = 0.8;
            if (irisL) irisL.scale.y = 1;
            if (irisR) irisR.scale.y = 1;
          }
        }
      }

      if (controls) controls.update();
      renderer.render(scene, camera);
    }

    animate();

    /* ── Visibility observer ─────────────────────────────── */
    var observer = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(function (entries) {
        var visible = entries[0].isIntersecting;
        if (visible && !running) {
          running = true;
          clock.start();
          animate();
        } else if (!visible && running) {
          running = false;
          if (rafId) cancelAnimationFrame(rafId);
        }
      }, { threshold: 0.1 });
      observer.observe(container);
    }

    /* ── Resize handler ──────────────────────────────────── */
    function onResize() {
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (w && h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    }

    /* ── Scene handle ────────────────────────────────────── */
    var handle = {
      scene: scene,
      camera: camera,
      renderer: renderer,
      controls: controls,
      avatarRoot: avatarRoot,
      container: container,
      observer: observer,
      running: running,
      onResize: onResize,
      _rafId: rafId,
      _running: function () { return running; },
      _setRunning: function (v) { running = v; }
    };

    return handle;
  }

  /* ═══════════════════════════════════════════════════════════
     LIVE UPDATE — swap character parts without full rebuild
     ═══════════════════════════════════════════════════════════ */

  function update(handle, avatarData) {
    if (!handle || !handle.scene) return;

    var scene = handle.scene;
    var oldRoot = handle.avatarRoot;

    // Remove old character
    if (oldRoot) {
      scene.remove(oldRoot);
      disposeGroup(oldRoot);
    }

    // Build new character
    var newRoot = buildCharacter(scene, avatarData);
    handle.avatarRoot = newRoot;

    // Trigger reactive animation via GSAP if available
    if (typeof gsap !== 'undefined' && oldRoot && oldRoot.userData.avatarData) {
      var old = oldRoot.userData.avatarData;

      // Head turn on hair/beard change
      if (old.hairStyle !== avatarData.hairStyle || old.beardStyle !== avatarData.beardStyle) {
        gsap.fromTo(newRoot.rotation, { y: -0.25 }, { y: 0, duration: 0.4, ease: 'back.out(1.4)' });
      }

      // Bounce on body type change
      if (old.bodyType !== avatarData.bodyType) {
        gsap.fromTo(newRoot.scale, { y: 0.92 }, { y: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
      }

      // Skin tone smooth tween (color handled by rebuild, but scale pop)
      if (old.skinTone !== avatarData.skinTone) {
        gsap.fromTo(newRoot.scale, { x: 0.98, z: 0.98 }, { x: 1, z: 1, duration: 0.3, ease: 'power2.out' });
      }

      // Accessory equip flash
      if (old.accessory !== avatarData.accessory) {
        var accGroup = newRoot.getObjectByName('accessory');
        if (accGroup) {
          accGroup.traverse(function (child) {
            if (child.isMesh && child.material) {
              var origEmissive = child.material.emissive ? child.material.emissive.getHex() : 0;
              child.material.emissive = new THREE.Color(0xFFB347);
              child.material.emissiveIntensity = 0.8;
              gsap.to(child.material, {
                emissiveIntensity: 0,
                duration: 0.6,
                ease: 'power2.out',
                onComplete: function () {
                  child.material.emissive = new THREE.Color(origEmissive);
                }
              });
            }
          });
        }
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
     DISPOSE — clean up WebGL resources
     ═══════════════════════════════════════════════════════════ */

  function disposeGroup(group) {
    group.traverse(function (child) {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(function (m) { m.dispose(); });
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }

  function dispose(handle) {
    if (!handle) return;

    // Stop animation
    handle._setRunning(false);
    if (handle._rafId) cancelAnimationFrame(handle._rafId);

    // Remove observer
    if (handle.observer) {
      handle.observer.disconnect();
    }

    // Dispose controls
    if (handle.controls) handle.controls.dispose();

    // Dispose scene objects
    if (handle.avatarRoot) {
      handle.scene.remove(handle.avatarRoot);
      disposeGroup(handle.avatarRoot);
    }

    // Dispose renderer
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

  window.Avatar3D = {
    create: create,
    update: update,
    dispose: dispose
  };

})();
