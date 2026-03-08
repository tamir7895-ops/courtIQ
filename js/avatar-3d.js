/* ============================================================
   AVATAR 3D ENGINE — /js/avatar-3d.js  v3
   Three.js procedural character — Realistic human proportions.
   Layered construction: skin body → clothing shells → details.
   ============================================================ */
(function () {
  'use strict';

  /* ── Guard ─────────────────────────────────────────────── */
  function hasThree() { return typeof THREE !== 'undefined'; }

  /* ── Color helpers ─────────────────────────────────────── */
  function hexToInt(hex) {
    return parseInt((hex || '').replace('#', ''), 16) || 0xC68642;
  }

  /* ── Body type configs (enhanced with chest/waist) ─────── */
  var BODY = {
    lean:     { sx: 0.88, sz: 0.88, sh: 0.92, limb: 0.88, leg: 0.93, chest: 0.90, waist: 0.82 },
    athletic: { sx: 1.0,  sz: 1.0,  sh: 1.0,  limb: 1.0,  leg: 1.0,  chest: 1.0,  waist: 1.0  },
    heavy:    { sx: 1.18, sz: 1.12, sh: 1.1,  limb: 1.12, leg: 1.06, chest: 1.15, waist: 1.20 }
  };

  /* ── Palette ───────────────────────────────────────────── */
  var PAL = {
    jersey:    0x1b1b30,
    jerseyAlt: 0x22223d,
    shorts:    0x141428,
    shoe:      0x1a1a1a,
    sole:      0xeeeeee,
    midsole:   0xcccccc,
    collar:    0x2a2a45,
    stripe:    0xFFB347,
    sock:      0xffffff,
    sockBand:  0xdddddd,
    waistband: 0x333350,
    lace:      0xcccccc
  };

  /* ── Material factory ───────────────────────────────────── */
  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: rough !== undefined ? rough : 0.7,
      metalness: metal !== undefined ? metal : 0.0
    });
  }

  /* ═══════════════════════════════════════════════════════════
     CHARACTER BUILDER — Realistic proportions (~2.3 units tall)
     Layered: skin body → jersey shell → shorts shell → details
     ═══════════════════════════════════════════════════════════ */

  function buildCharacter(scene, av) {
    var root = new THREE.Group();
    root.name = 'avatar-root';
    var B = BODY[av.bodyType] || BODY.athletic;
    var skin = hexToInt(av.skinTone);
    var hair = hexToInt(av.hairColor);

    /* ── Materials ─────────────────────────────────────── */
    var mSkin     = mat(skin, 0.55, 0.02);
    var mJersey   = mat(PAL.jersey, 0.80);
    var mJerseyAlt = mat(PAL.jerseyAlt, 0.78);
    var mShorts   = mat(PAL.shorts, 0.78);
    var mShoe     = mat(PAL.shoe, 0.35, 0.08);
    var mSole     = mat(PAL.sole, 0.6);
    var mMidsole  = mat(PAL.midsole, 0.55);
    var mSock     = mat(PAL.sock, 0.82);
    var mSockBand = mat(PAL.sockBand, 0.75);
    var mHair     = mat(hair, 0.88);
    var mCollar   = mat(PAL.collar, 0.72);
    var mStripe   = mat(PAL.stripe, 0.4, 0.2);
    var mWaist    = mat(PAL.waistband, 0.72);
    var mEyeW     = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.3, metalness: 0.05 });
    var mIris     = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.2, metalness: 0.1 });
    var mBrow     = mat(hair, 0.9);
    var mLip      = mat(0x7a3b2e, 0.65);

    /* ═════════════════════════════════════════════════════
       LAYER 1: SKIN BODY (anatomical compound shapes)
       ═════════════════════════════════════════════════════ */

    /* ── Skin Torso (chest + waist + bridge) ─────────── */
    // Upper chest — wider for shoulder width
    var chestGeo = new THREE.CapsuleGeometry(0.16 * B.chest, 0.2, 8, 16);
    var chest = new THREE.Mesh(chestGeo, mSkin);
    chest.position.set(0, 1.45, 0);
    chest.scale.set(B.sx, 1, B.sz * 0.92);
    root.add(chest);

    // Lower torso — narrower for waist taper
    var waistGeo = new THREE.CapsuleGeometry(0.13 * B.waist, 0.15, 8, 14);
    var waist = new THREE.Mesh(waistGeo, mSkin);
    waist.position.set(0, 1.2, 0);
    waist.scale.set(B.sx * 0.95, 1, B.sz * 0.9);
    root.add(waist);

    // Core bridge — cylinder for ribcage-to-waist transition
    var coreGeo = new THREE.CylinderGeometry(0.15 * B.chest, 0.12 * B.waist, 0.2, 14);
    var core = new THREE.Mesh(coreGeo, mSkin);
    core.position.set(0, 1.32, 0);
    core.scale.set(B.sx, 1, B.sz * 0.92);
    root.add(core);

    // Shoulder caps — rounded deltoids (bigger for arm connection)
    var shCapGeo = new THREE.SphereGeometry(0.08 * B.limb, 12, 12);
    var shCapL = new THREE.Mesh(shCapGeo, mSkin);
    shCapL.position.set(-0.22 * B.sh, 1.55, 0);
    shCapL.scale.set(1.0, 0.85, 0.9);
    root.add(shCapL);
    var shCapR = shCapL.clone();
    shCapR.position.set(0.22 * B.sh, 1.55, 0);
    root.add(shCapR);

    /* ── Skin Arms (grouped at shoulder pivot) ───────── */
    var shOff = 0.21 * B.sh;

    function buildArm(side) {
      var s = side === 'L' ? -1 : 1;
      var grp = new THREE.Group();
      grp.position.set(s * shOff, 1.53, 0);
      grp.rotation.z = s * 0.08;
      grp.name = 'armGroup' + side;

      // Upper arm — substantial, jersey sleeve overlays this
      var ua = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.065 * B.limb, 0.22, 8, 12), mSkin
      );
      ua.position.set(0, -0.14, 0);
      ua.name = 'upperArm' + side;
      grp.add(ua);

      // Bicep bulge — subtle muscle shape
      var bicep = new THREE.Mesh(
        new THREE.SphereGeometry(0.058 * B.limb, 8, 8), mSkin
      );
      bicep.position.set(0, -0.08, 0.02);
      bicep.scale.set(1.0, 1.2, 0.85);
      grp.add(bicep);

      // Elbow joint — smooth bridge
      var elbow = new THREE.Mesh(
        new THREE.SphereGeometry(0.054 * B.limb, 10, 10), mSkin
      );
      elbow.position.set(0, -0.27, 0.015);
      elbow.scale.set(1.0, 0.8, 0.9);
      grp.add(elbow);

      // Forearm — thicker, tapered with slight curve
      var fa = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.05 * B.limb, 0.2, 8, 10), mSkin
      );
      fa.position.set(0, -0.40, 0.03);
      fa.rotation.x = -0.1;
      fa.name = 'forearm' + side;
      grp.add(fa);

      // Wrist joint
      var wrist = new THREE.Mesh(
        new THREE.SphereGeometry(0.04 * B.limb, 8, 8), mSkin
      );
      wrist.position.set(0, -0.53, 0.05);
      wrist.scale.set(0.85, 0.65, 0.8);
      grp.add(wrist);

      // Hand — proportional
      var hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.044, 10, 10), mSkin
      );
      hand.position.set(0, -0.58, 0.06);
      hand.scale.set(0.7, 0.95, 0.5);
      grp.add(hand);

      return grp;
    }

    root.add(buildArm('L'));
    root.add(buildArm('R'));

    /* ── Skin Legs ───────────────────────────────────── */
    var legX = 0.09;

    function buildSkinLeg(side) {
      var s = side === 'L' ? -1 : 1;

      // Upper thigh (skin — shorts overlay this)
      var thigh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.062 * B.leg, 0.26, 8, 12), mSkin
      );
      thigh.position.set(s * legX, 0.72, 0);
      root.add(thigh);

      // Knee joint — sphere to bridge thigh/calf
      var knee = new THREE.Mesh(
        new THREE.SphereGeometry(0.052 * B.leg, 8, 8), mSkin
      );
      knee.position.set(s * legX, 0.56, 0.02);
      knee.scale.set(1.0, 0.7, 0.85);
      root.add(knee);

      // Lower leg / calf (skin — tapered)
      var calfGeo = new THREE.CylinderGeometry(0.052 * B.leg, 0.044 * B.leg, 0.36, 10);
      var calf = new THREE.Mesh(calfGeo, mSkin);
      calf.position.set(s * legX, 0.36, 0);
      root.add(calf);
    }

    buildSkinLeg('L');
    buildSkinLeg('R');

    /* ═════════════════════════════════════════════════════
       LAYER 2: JERSEY SHELL (separate garment over body)
       ═════════════════════════════════════════════════════ */

    // Jersey body — slightly larger than skin torso
    var jBodyGeo = new THREE.CapsuleGeometry(0.175 * B.chest, 0.22, 8, 16);
    var jerseyBody = new THREE.Mesh(jBodyGeo, mJersey);
    jerseyBody.position.set(0, 1.44, 0);
    jerseyBody.scale.set(B.sx, 1, B.sz * 0.93);
    jerseyBody.name = 'torso';
    root.add(jerseyBody);

    // Jersey lower section — covers waist area
    var jLowerGeo = new THREE.CylinderGeometry(0.17 * B.chest, 0.155 * B.waist, 0.16, 14);
    var jerseyLower = new THREE.Mesh(jLowerGeo, mJersey);
    jerseyLower.position.set(0, 1.24, 0);
    jerseyLower.scale.set(B.sx * 0.98, 1, B.sz * 0.93);
    root.add(jerseyLower);

    // Collar — V-neck style arc
    var collarGeo = new THREE.TorusGeometry(0.1 * B.sx, 0.015, 8, 16, Math.PI * 1.2);
    var collar = new THREE.Mesh(collarGeo, mCollar);
    collar.position.set(0, 1.625, 0.1);
    collar.rotation.x = Math.PI * 0.3;
    collar.rotation.y = Math.PI * 0.9;
    root.add(collar);

    // Jersey bottom hem — visible line where jersey ends
    var jHemGeo = new THREE.TorusGeometry(0.155 * B.waist * B.sx, 0.006, 6, 22);
    var jerseyHem = new THREE.Mesh(jHemGeo, mCollar);
    jerseyHem.position.set(0, 1.15, 0);
    jerseyHem.rotation.x = Math.PI * 0.5;
    root.add(jerseyHem);

    // Sleeves — wrapping upper arms, wider than skin for fabric look
    function buildSleeve(side) {
      var s = side === 'L' ? -1 : 1;
      // Sleeve shell — wider than upper arm, longer to cover more
      var sleeveGeo = new THREE.CapsuleGeometry(0.078 * B.limb, 0.16, 8, 12);
      var sleeve = new THREE.Mesh(sleeveGeo, mJersey);
      sleeve.position.set(s * shOff, 1.40, 0);
      sleeve.rotation.z = s * 0.08;
      root.add(sleeve);

      // Sleeve cuff — visible hem ring at sleeve end
      var cuffGeo = new THREE.TorusGeometry(0.074 * B.limb, 0.007, 8, 16);
      var cuff = new THREE.Mesh(cuffGeo, mCollar);
      cuff.position.set(s * (shOff + s * 0.01), 1.28, 0.01);
      cuff.rotation.x = Math.PI * 0.5;
      cuff.rotation.z = s * 0.08;
      root.add(cuff);
    }

    buildSleeve('L');
    buildSleeve('R');

    // Side stripes on jersey (subtle)
    var stripeGeo = new THREE.BoxGeometry(0.004, 0.28, 0.06);
    var stripeL = new THREE.Mesh(stripeGeo, mStripe);
    stripeL.position.set(-0.175 * B.sx, 1.38, 0);
    root.add(stripeL);
    var stripeR = stripeL.clone();
    stripeR.position.set(0.175 * B.sx, 1.38, 0);
    root.add(stripeR);

    /* ═════════════════════════════════════════════════════
       LAYER 3: SHORTS SHELL (separate garment over thighs)
       ═════════════════════════════════════════════════════ */

    // Shorts main body — hip area
    var sBodyGeo = new THREE.CapsuleGeometry(0.17 * B.sx, 0.08, 8, 14);
    var shortsBody = new THREE.Mesh(sBodyGeo, mShorts);
    shortsBody.position.set(0, 1.04, 0);
    root.add(shortsBody);

    // Shorts leg tubes — wider than thighs for fabric drape
    function buildShortsLeg(side) {
      var s = side === 'L' ? -1 : 1;
      var sLegGeo = new THREE.CylinderGeometry(0.068 * B.leg, 0.072 * B.leg, 0.22, 10);
      var sLeg = new THREE.Mesh(sLegGeo, mShorts);
      sLeg.position.set(s * legX, 0.84, 0);
      root.add(sLeg);

      // Shorts leg hem — visible opening
      var sHemGeo = new THREE.TorusGeometry(0.072 * B.leg, 0.004, 6, 14);
      var sHem = new THREE.Mesh(sHemGeo, mCollar);
      sHem.position.set(s * legX, 0.73, 0);
      sHem.rotation.x = Math.PI * 0.5;
      root.add(sHem);
    }

    buildShortsLeg('L');
    buildShortsLeg('R');

    // Waistband
    var wbGeo = new THREE.TorusGeometry(0.17 * B.sx, 0.01, 8, 22);
    var waistband = new THREE.Mesh(wbGeo, mStripe);
    waistband.position.set(0, 1.09, 0);
    waistband.rotation.x = Math.PI * 0.5;
    root.add(waistband);

    // Shorts side stripes
    var sStripeGeo = new THREE.BoxGeometry(0.004, 0.22, 0.04);
    var sStripeL = new THREE.Mesh(sStripeGeo, mStripe);
    sStripeL.position.set(-0.075 - legX * 0.3, 0.84, 0.04);
    root.add(sStripeL);
    var sStripeR = sStripeL.clone();
    sStripeR.position.set(0.075 + legX * 0.3, 0.84, 0.04);
    root.add(sStripeR);

    /* ═════════════════════════════════════════════════════
       LAYER 4: SOCKS (mid-calf basketball socks)
       ═════════════════════════════════════════════════════ */

    function buildSock(side) {
      var s = side === 'L' ? -1 : 1;
      // Sock tube
      var sockGeo = new THREE.CylinderGeometry(0.052 * B.leg, 0.050 * B.leg, 0.2, 10);
      var sock = new THREE.Mesh(sockGeo, mSock);
      sock.position.set(s * legX, 0.24, 0);
      root.add(sock);

      // Sock top band — ribbed edge
      var bandGeo = new THREE.TorusGeometry(0.053 * B.leg, 0.005, 6, 12);
      var band = new THREE.Mesh(bandGeo, mSockBand);
      band.position.set(s * legX, 0.34, 0);
      band.rotation.x = Math.PI * 0.5;
      root.add(band);
    }

    buildSock('L');
    buildSock('R');

    /* ═════════════════════════════════════════════════════
       LAYER 5: SHOES (compound basketball high-tops)
       ═════════════════════════════════════════════════════ */

    function buildShoe(side) {
      var s = side === 'L' ? -1 : 1;
      var sx = s * legX;

      // Shoe upper — rounded half-sphere
      var upperGeo = new THREE.SphereGeometry(0.058, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
      var upper = new THREE.Mesh(upperGeo, mShoe);
      upper.position.set(sx, 0.1, 0.01);
      upper.scale.set(1, 0.65, 1.35);
      root.add(upper);

      // Toebox — rounded front
      var toeGeo = new THREE.SphereGeometry(0.04, 10, 10);
      var toe = new THREE.Mesh(toeGeo, mShoe);
      toe.position.set(sx, 0.06, 0.08);
      toe.scale.set(1.1, 0.55, 1.0);
      root.add(toe);

      // Heel cup
      var heelGeo = new THREE.SphereGeometry(0.035, 8, 8);
      var heel = new THREE.Mesh(heelGeo, mShoe);
      heel.position.set(sx, 0.065, -0.05);
      heel.scale.set(1.0, 0.6, 0.8);
      root.add(heel);

      // Sole — slightly wider/longer than upper
      var soleGeo = new THREE.CapsuleGeometry(0.012, 0.16, 4, 10);
      var sole = new THREE.Mesh(soleGeo, mSole);
      sole.position.set(sx, 0.015, 0.01);
      sole.rotation.z = Math.PI * 0.5;
      sole.rotation.y = Math.PI * 0.5;
      sole.scale.set(1, 1, 0.65);
      root.add(sole);

      // Midsole accent — thin white line between upper and sole
      var midGeo = new THREE.CylinderGeometry(0.056, 0.058, 0.008, 12);
      var mid = new THREE.Mesh(midGeo, mMidsole);
      mid.position.set(sx, 0.03, 0.01);
      mid.scale.set(1, 1, 1.35);
      root.add(mid);

      // Ankle collar — high-top opening
      var anklGeo = new THREE.TorusGeometry(0.046, 0.005, 6, 12);
      var ankle = new THREE.Mesh(anklGeo, mShoe);
      ankle.position.set(sx, 0.13, -0.005);
      ankle.rotation.x = Math.PI * 0.5;
      root.add(ankle);
    }

    buildShoe('L');
    buildShoe('R');

    /* ═════════════════════════════════════════════════════
       LAYER 6: NECK + HEAD + FACE (realistic proportions)
       ═════════════════════════════════════════════════════ */

    // Neck
    var neckGeo = new THREE.CylinderGeometry(0.055, 0.068, 0.1, 12);
    var neck = new THREE.Mesh(neckGeo, mSkin);
    neck.position.set(0, 1.72, 0);
    neck.name = 'neck';
    root.add(neck);

    // Head — slightly smaller for realism
    var headGeo = new THREE.SphereGeometry(0.17, 28, 28);
    var head = new THREE.Mesh(headGeo, mSkin);
    head.scale.set(1.0, 1.1, 0.95);
    head.position.set(0, 1.92, 0);
    head.name = 'head';
    root.add(head);

    /* ── FACE — realistic proportional features ──────── */

    // Eye whites — smaller, reacts to lighting (MeshStandard)
    var ewGeo = new THREE.SphereGeometry(0.028, 14, 14);
    var eyeL = new THREE.Mesh(ewGeo, mEyeW);
    eyeL.position.set(-0.058, 1.935, 0.145);
    eyeL.scale.set(1.1, 0.65, 0.35);
    eyeL.name = 'eyeL';
    root.add(eyeL);
    var eyeR = eyeL.clone();
    eyeR.position.set(0.058, 1.935, 0.145);
    eyeR.name = 'eyeR';
    root.add(eyeR);

    // Irises — subtle reflection
    var irGeo = new THREE.SphereGeometry(0.016, 10, 10);
    var irisL = new THREE.Mesh(irGeo, mIris);
    irisL.position.set(-0.056, 1.935, 0.172);
    irisL.scale.set(1, 0.8, 0.5);
    irisL.name = 'irisL';
    root.add(irisL);
    var irisR = irisL.clone();
    irisR.position.set(0.056, 1.935, 0.172);
    irisR.name = 'irisR';
    root.add(irisR);

    // Eyebrows — thicker, more natural
    var brGeo = new THREE.BoxGeometry(0.052, 0.016, 0.018);
    var browL = new THREE.Mesh(brGeo, mBrow);
    browL.position.set(-0.058, 1.98, 0.148);
    browL.rotation.z = 0.08;
    browL.rotation.x = -0.08;
    root.add(browL);
    var browR = browL.clone();
    browR.position.set(0.058, 1.98, 0.148);
    browR.rotation.z = -0.08;
    root.add(browR);

    // Cheekbones — subtle geometry for lighting highlight
    var cheekGeo = new THREE.SphereGeometry(0.028, 8, 8);
    var cheekL = new THREE.Mesh(cheekGeo, mSkin);
    cheekL.position.set(-0.1, 1.92, 0.1);
    cheekL.scale.set(0.8, 0.5, 0.4);
    root.add(cheekL);
    var cheekR = cheekL.clone();
    cheekR.position.set(0.1, 1.92, 0.1);
    root.add(cheekR);

    // Nose — wider, more defined
    var noseGeo = new THREE.SphereGeometry(0.026, 12, 12);
    var nose = new THREE.Mesh(noseGeo, mSkin);
    nose.position.set(0, 1.9, 0.165);
    nose.scale.set(0.85, 0.55, 0.5);
    root.add(nose);

    // Nose bridge
    var bridgeGeo = new THREE.BoxGeometry(0.02, 0.035, 0.012);
    var bridge = new THREE.Mesh(bridgeGeo, mSkin);
    bridge.position.set(0, 1.925, 0.16);
    root.add(bridge);

    // Nostrils (subtle)
    var nMat = mat(0x000000, 0.9); nMat.transparent = true; nMat.opacity = 0.15;
    var nostGeo = new THREE.SphereGeometry(0.007, 6, 6);
    var nostL = new THREE.Mesh(nostGeo, nMat);
    nostL.position.set(-0.012, 1.893, 0.18);
    root.add(nostL);
    var nostR = nostL.clone();
    nostR.position.set(0.012, 1.893, 0.18);
    root.add(nostR);

    // Mouth / lips — natural width
    var lipGeo = new THREE.CapsuleGeometry(0.02, 0.035, 4, 10);
    var lips = new THREE.Mesh(lipGeo, mLip);
    lips.position.set(0, 1.862, 0.155);
    lips.rotation.z = Math.PI * 0.5;
    lips.scale.set(0.5, 1, 0.35);
    root.add(lips);

    // Lower lip
    var llipGeo = new THREE.CapsuleGeometry(0.014, 0.025, 4, 8);
    var lowerLip = new THREE.Mesh(llipGeo, mLip);
    lowerLip.position.set(0, 1.854, 0.153);
    lowerLip.rotation.z = Math.PI * 0.5;
    lowerLip.scale.set(0.42, 1.0, 0.28);
    root.add(lowerLip);

    // Chin — more prominent
    var chinGeo = new THREE.SphereGeometry(0.038, 10, 10);
    var chin = new THREE.Mesh(chinGeo, mSkin);
    chin.position.set(0, 1.825, 0.12);
    chin.scale.set(0.85, 0.6, 0.55);
    root.add(chin);

    // Jaw
    var jawGeo = new THREE.SphereGeometry(0.15, 16, 16, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48);
    var jaw = new THREE.Mesh(jawGeo, mSkin);
    jaw.position.set(0, 1.88, 0.01);
    jaw.scale.set(1.0, 0.85, 0.9);
    root.add(jaw);

    // Ears
    var earGeo = new THREE.SphereGeometry(0.028, 8, 8);
    var earL = new THREE.Mesh(earGeo, mSkin);
    earL.position.set(-0.168, 1.92, 0.01);
    earL.scale.set(0.28, 0.65, 0.45);
    root.add(earL);
    var earR = earL.clone();
    earR.position.set(0.168, 1.92, 0.01);
    root.add(earR);

    /* ═════════════════════════════════════════════════════
       LAYER 7: HAIR / BEARD / ACCESSORY
       ═════════════════════════════════════════════════════ */

    var hairG = buildHair(av.hairStyle, mHair);
    if (hairG) { hairG.name = 'hair'; root.add(hairG); }

    var beardG = buildBeard(av.beardStyle, mHair);
    if (beardG) { beardG.name = 'beard'; root.add(beardG); }

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
     Head center = 1.92, radius = 0.17, top ≈ 2.10
     Face plane ≈ z 0.14+. Hair must stay z ≤ 0.08 in front
     ═══════════════════════════════════════════════════════════ */
  var H = { cx: 0, cy: 1.92, r: 0.17 };

  function buildHair(style, m) {
    var g = new THREE.Group();

    switch (style) {
      case 'bald': return null;

      case 'buzz': {
        var cap = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.012, 22, 22, 0, Math.PI * 2, 0, Math.PI * 0.46),
          m
        );
        cap.position.set(H.cx, H.cy + 0.02, -0.01);
        g.add(cap);
        break;
      }

      case 'short': {
        var top = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.025, 22, 22, 0, Math.PI * 2, 0, Math.PI * 0.44),
          m
        );
        top.position.set(H.cx, H.cy + 0.03, -0.015);
        top.scale.set(1.02, 1.1, 1.0);
        g.add(top);
        break;
      }

      case 'fade': {
        var fadeTop = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.03, 22, 22, 0, Math.PI * 2, 0, Math.PI * 0.38),
          m
        );
        fadeTop.position.set(H.cx, H.cy + 0.04, -0.01);
        fadeTop.scale.set(0.92, 1.25, 0.95);
        g.add(fadeTop);
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
        var afro = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.14, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.44),
          m
        );
        afro.position.set(H.cx, H.cy + 0.06, -0.04);
        afro.scale.set(1.3, 1.1, 1.2);
        g.add(afro);
        var puffGeo = new THREE.SphereGeometry(0.1, 14, 14);
        var puffL = new THREE.Mesh(puffGeo, m);
        puffL.position.set(-0.2, H.cy + 0.02, -0.06);
        puffL.scale.set(0.8, 1.0, 0.9);
        g.add(puffL);
        var puffR = puffL.clone();
        puffR.position.set(0.2, H.cy + 0.02, -0.06);
        g.add(puffR);
        var afBack = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 14, 14), m
        );
        afBack.position.set(0, H.cy + 0.02, -0.16);
        afBack.scale.set(1.1, 1.0, 0.8);
        g.add(afBack);
        break;
      }

      case 'dreads': {
        var dCap = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.02, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.44),
          m
        );
        dCap.position.set(H.cx, H.cy + 0.03, -0.01);
        g.add(dCap);
        var dGeo = new THREE.CapsuleGeometry(0.018, 0.14, 4, 8);
        for (var i = 0; i < 14; i++) {
          var a = (i / 14) * Math.PI * 2;
          var dz = Math.sin(a) * 0.16;
          if (dz > 0.06) continue;
          var dr = new THREE.Mesh(dGeo, m);
          dr.position.set(Math.cos(a) * 0.16, H.cy - 0.12, dz - 0.02);
          dr.rotation.z = Math.cos(a) * 0.25;
          dr.rotation.x = -Math.sin(a) * 0.15;
          g.add(dr);
        }
        break;
      }

      case 'mohawk': {
        var mhGeo = new THREE.BoxGeometry(0.06, 0.1, 0.22);
        var mh = new THREE.Mesh(mhGeo, m);
        mh.position.set(H.cx, H.cy + H.r + 0.03, -0.02);
        g.add(mh);
        var peak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 8), m);
        peak.position.set(H.cx, H.cy + H.r + 0.06, 0.08);
        peak.rotation.x = -0.3;
        g.add(peak);
        var tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 6), m);
        tail.position.set(H.cx, H.cy + H.r + 0.02, -0.14);
        tail.rotation.x = 0.4;
        g.add(tail);
        break;
      }

      case 'waves': {
        var wCap = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.022, 26, 26, 0, Math.PI * 2, 0, Math.PI * 0.44),
          m
        );
        wCap.position.set(H.cx, H.cy + 0.025, -0.01);
        wCap.scale.set(1.02, 1.06, 1.0);
        g.add(wCap);
        var bGeo = new THREE.SphereGeometry(0.025, 6, 6);
        for (var w = 0; w < 10; w++) {
          var wa = (w / 10) * Math.PI * 2;
          var wz = Math.sin(wa) * 0.12;
          if (wz > 0.05) continue;
          var bump = new THREE.Mesh(bGeo, m);
          bump.position.set(Math.cos(wa) * 0.13, H.cy + 0.12 + Math.sin(wa * 3) * 0.008, wz - 0.01);
          g.add(bump);
        }
        break;
      }

      case 'cornrows': {
        var cGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.26, 6);
        var cPositions = [-0.1, -0.05, 0, 0.05, 0.1];
        for (var c = 0; c < cPositions.length; c++) {
          var row = new THREE.Mesh(cGeo, m);
          row.position.set(cPositions[c], H.cy + 0.1, -0.04);
          row.rotation.x = Math.PI * 0.5;
          g.add(row);
        }
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
     BEARD — jaw area around y=1.82..1.86
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
        var gt = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), m);
        gt.position.set(0, 1.8, 0.12);
        gt.scale.set(0.85, 1.0, 0.5);
        g.add(gt);
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
     ACCESSORIES — positioned for realistic proportions
     ═══════════════════════════════════════════════════════════ */

  function buildAccessory(type, skinColor) {
    if (!type || type === 'none') return null;
    var g = new THREE.Group();

    var mMetal  = mat(0xDAA520, 0.3, 0.8);
    var mFabric = mat(0xDD3333, 0.65);
    var mDark   = mat(0x1a2d5a, 0.5, 0.1);

    switch (type) {
      case 'headband': {
        var hb = new THREE.Mesh(
          new THREE.TorusGeometry(0.18, 0.018, 8, 32), mFabric
        );
        hb.position.set(0, H.cy + 0.06, 0);
        hb.rotation.x = Math.PI * 0.5;
        g.add(hb);
        break;
      }

      case 'sweatband': {
        var sw = new THREE.Mesh(
          new THREE.TorusGeometry(0.048, 0.012, 8, 14), mFabric
        );
        sw.position.set(-0.28, 1.22, 0.04);
        sw.rotation.x = Math.PI * 0.5;
        g.add(sw);
        break;
      }

      case 'armband': {
        var ab = new THREE.Mesh(
          new THREE.TorusGeometry(0.052, 0.01, 8, 14), mMetal
        );
        ab.position.set(0.28, 1.38, 0);
        ab.rotation.x = Math.PI * 0.5;
        g.add(ab);
        break;
      }

      case 'glasses': {
        var lensMat = mat(0x333333, 0.25, 0.5);
        lensMat.side = THREE.DoubleSide;
        var lGeo = new THREE.RingGeometry(0.018, 0.028, 18);
        var lL = new THREE.Mesh(lGeo, lensMat);
        lL.position.set(-0.058, 1.935, 0.185);
        g.add(lL);
        var lR = lL.clone();
        lR.position.set(0.058, 1.935, 0.185);
        g.add(lR);
        var bGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6);
        var br = new THREE.Mesh(bGeo, lensMat);
        br.position.set(0, 1.935, 0.185);
        br.rotation.z = Math.PI * 0.5;
        g.add(br);
        var tGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.1, 4);
        var tL = new THREE.Mesh(tGeo, lensMat);
        tL.position.set(-0.1, 1.935, 0.13);
        tL.rotation.z = Math.PI * 0.5;
        tL.rotation.y = 0.45;
        g.add(tL);
        var tR = tL.clone();
        tR.position.set(0.1, 1.935, 0.13);
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
        var pd = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), mMetal);
        pd.position.set(0, 1.6, 0.1);
        g.add(pd);
        break;
      }

      case 'durag': {
        var dg = new THREE.Mesh(
          new THREE.SphereGeometry(H.r + 0.022, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.46),
          mDark
        );
        dg.position.set(0, H.cy + 0.035, -0.01);
        g.add(dg);
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

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();

    var camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 1.35, 3.8);
    camera.lookAt(0, 1.1, 0);

    setupLighting(scene);

    var controls = null;
    if (opts.interactive !== false && typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.target.set(0, 1.1, 0);
      controls.minPolarAngle = Math.PI * 0.35;
      controls.maxPolarAngle = Math.PI * 0.65;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.7;
      controls.update();
    }

    var avatarRoot = buildCharacter(scene, avatarData);

    var clock = new THREE.Clock();
    var animState = {
      blinkTimer: 3 + Math.random() * 2,
      blinking: false,
      blinkDur: 0
    };

    var running = true;
    var rafId = null;

    function animate() {
      if (!running) return;
      rafId = requestAnimationFrame(animate);

      var dt = clock.getDelta();
      var t = clock.getElapsedTime();

      if (opts.animate !== false) {
        // Breathing — jersey torso
        var torso = avatarRoot.getObjectByName('torso');
        if (torso) torso.scale.y = 1.0 + Math.sin(t * 1.8) * 0.008;

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
          var sq = animState.blinkDur < 0.06 ? 0.05 : (animState.blinkDur < 0.12 ? 0.05 : 0.65);
          if (eyeL) eyeL.scale.y = sq;
          if (eyeR) eyeR.scale.y = sq;
          if (animState.blinkDur > 0.14) {
            animState.blinking = false;
            animState.blinkTimer = 2 + Math.random() * 3;
            if (eyeL) eyeL.scale.y = 0.65;
            if (eyeR) eyeR.scale.y = 0.65;
          }
        }
      }

      if (controls) controls.update();
      renderer.render(scene, camera);
    }

    animate();

    var observer = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(function (entries) {
        var vis = entries[0].isIntersecting;
        if (vis && !running) { running = true; clock.start(); animate(); }
        else if (!vis && running) { running = false; if (rafId) cancelAnimationFrame(rafId); }
      }, { threshold: 0.1 });
      observer.observe(container);
    }

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
