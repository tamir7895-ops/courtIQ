/* ============================================================
   DRILL ENGINE — /js/drill-engine.js
   Personalized Drill Generator for CourtIQ.
   Handles drill generation, card rendering, expand/collapse,
   save-to-plan (localStorage), and lazy animation loading.
   ============================================================ */

/* ── Drill Database ──────────────────────────────────────────
   Each drill has:
     id, name, description, duration_minutes, reps_or_sets,
     difficulty, focus_area, equipment_needed
   Plus internal-only:
     positions  – which player positions this suits
     anim_type  – key into DrillAnimations.ANIMS
──────────────────────────────────────────────────────────── */
const _DRILLS_DB = [

  /* ──────────── SHOOTING ──────────────────────────────────── */
  {
    id: 'shoot-001',
    name: 'Catch & Shoot Corner 3s',
    description: 'Set up in the corners and catch passes, focusing on footwork and quick release. Get into your shooting stance before the catch — feet already set, eyes on target.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps per side',
    difficulty: 'Beginner',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'catch_shoot',
  },
  {
    id: 'shoot-002',
    name: 'Mid-Range Pull-Up',
    description: 'Drive to the elbow, gather off one hard dribble and pull up for a mid-range jumper. Focus on your balance point — gather, elevate, and finish square to the basket.',
    duration_minutes: 15,
    reps_or_sets: '5 sets × 8 reps',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'pullup',
  },
  {
    id: 'shoot-003',
    name: 'Step-Back Three',
    description: 'Attack the defender with a hard dribble, use a two-step step-back to create separation, and elevate for the three. Land balanced and follow through fully.',
    duration_minutes: 16,
    reps_or_sets: '4 sets × 6 reps each side',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'stepback',
  },
  {
    id: 'shoot-004',
    name: 'Five-Spot Shooting Circuit',
    description: 'Shoot from 5 fixed spots around the arc — left corner, left wing, top, right wing, right corner. Make 3 consecutive from each spot before moving. Track total time.',
    duration_minutes: 20,
    reps_or_sets: '3 full circuits',
    difficulty: 'Beginner',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'spot_shoot',
  },
  {
    id: 'shoot-005',
    name: 'Post Fade-Away',
    description: 'Catch in the low post, use a jab-step to freeze the defender, then execute a clean fade-away jumper. Keep your shot pocket tight and arc the ball over the help defender.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PF', 'C'],
    anim_type: 'post_fade',
  },
  {
    id: 'shoot-006',
    name: 'Free Throw Pressure Routine',
    description: 'Simulate game fatigue: do 10 push-ups, immediately step to the line and shoot 2 free throws. Track your percentage under physical stress across all rounds.',
    duration_minutes: 12,
    reps_or_sets: '10 rounds',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'free_throw',
  },
  {
    id: 'shoot-007',
    name: 'Off-Screen Curl Shot',
    description: 'Simulate curling off a screen at the elbow. Sprint around a cone, catch the ball in stride, and shoot in rhythm. Work both directions — curl left and curl right.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per direction',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'catch_shoot',
  },
  {
    id: 'shoot-008',
    name: 'Turnaround Jumper',
    description: 'Catch in the mid-post with your back to the basket, use a quick reverse-pivot to face up, and rise into a turnaround jumper. Focus on balance through the pivot and a high release point to shoot over the contest.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['SF', 'PF', 'C'],
    anim_type: 'post_fade',
  },
  {
    id: 'shoot-009',
    name: 'Floater off the Drive',
    description: 'Attack the lane off one dribble, gather inside the foul line, and release a soft floater over the outstretched arms of a help defender. Use your off-hand to protect the ball and vary the arc between flat and high.',
    duration_minutes: 15,
    reps_or_sets: '5 sets × 8 reps each side',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'pullup',
  },
  {
    id: 'shoot-010',
    name: 'Bank Shot Touch Series',
    description: 'Practice banking the ball off the glass from 45-degree angles on both sides of the lane. Aim for the top corner of the backboard square and develop a soft touch that uses the glass consistently.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps per side',
    difficulty: 'Beginner',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'spot_shoot',
  },
  {
    id: 'shoot-011',
    name: 'Deep Three-Point Bombing',
    description: 'Extend your shooting range by taking threes 2-4 feet behind the arc from five spots. Use the same mechanics as your normal three — do not push or change your release. Track percentage and stop if form breaks down.',
    duration_minutes: 18,
    reps_or_sets: '5 sets × 6 reps per spot',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'spot_shoot',
  },
  {
    id: 'shoot-012',
    name: 'Contested Shot Finishing',
    description: 'A partner closes out with a hand in your face while you catch and shoot from mid-range spots. Train yourself to maintain focus on the rim, not the contest, and keep your release consistent despite pressure.',
    duration_minutes: 16,
    reps_or_sets: '4 sets × 8 reps',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop', 'Partner'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'catch_shoot',
  },
  {
    id: 'shoot-013',
    name: 'Pick-and-Pop Threes',
    description: 'Simulate setting a ball screen, then popping out to the three-point line. Catch the pass with feet already squared and fire immediately. Work from both wings and the top of the key.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per spot',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop', 'Partner'],
    positions: ['PF', 'C', 'SF'],
    anim_type: 'catch_shoot',
  },
  {
    id: 'shoot-014',
    name: 'Transition Three-Pointers',
    description: 'Sprint full court, receive a pass in transition at the three-point line, and shoot without slowing down. Practice gathering your feet under you while running at full speed so you can shoot in rhythm.',
    duration_minutes: 16,
    reps_or_sets: '5 sets × 6 reps',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop', 'Full Court'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'catch_shoot',
  },
  {
    id: 'shoot-015',
    name: 'Step-Through Jumper',
    description: 'From the triple-threat position, use a shot fake to get the defender in the air, then step through with one long stride past them and elevate for an uncontested pull-up. Practice from the elbow and mid-post areas.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'pullup',
  },

  /* ──────────── BALL HANDLING ─────────────────────────────── */
  {
    id: 'bh-001',
    name: 'Two-Ball Stationary Dribble',
    description: 'Dribble two basketballs simultaneously at waist height. Alternate between same-time and alternating patterns. Keep your eyes up the entire set — no looking at the ball.',
    duration_minutes: 10,
    reps_or_sets: '6 sets × 45 seconds',
    difficulty: 'Beginner',
    focus_area: 'Ball Handling',
    equipment_needed: ['2 Basketballs'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'two_ball',
  },
  {
    id: 'bh-002',
    name: 'Cone Slalom Circuit',
    description: 'Set 6 cones in a line 3 feet apart. Dribble through alternating dominant and non-dominant hand. Add crossovers and between-the-legs moves at each cone.',
    duration_minutes: 15,
    reps_or_sets: '5 sets × 2 full lengths',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'slalom',
  },
  {
    id: 'bh-003',
    name: 'Spider Drill',
    description: 'Using only your fingertips, move the ball rapidly around all four sides of the ball while stationary — front, back, front, back. Build speed progressively each set.',
    duration_minutes: 8,
    reps_or_sets: '4 sets × 30 seconds each direction',
    difficulty: 'Beginner',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'spider',
  },
  {
    id: 'bh-004',
    name: 'Full-Speed Crossover Series',
    description: 'From the three-point line, attack full speed with a crossover, then reset. Work through the series: crossover → behind-the-back → through-the-legs → hesitation.',
    duration_minutes: 18,
    reps_or_sets: '5 sets × 4 moves each direction',
    difficulty: 'Advanced',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Full Court'],
    positions: ['PG', 'SG'],
    anim_type: 'crossover',
  },
  {
    id: 'bh-005',
    name: 'Chair Dribble Series',
    description: 'Set 4 chairs as defenders. Use different ball-handling moves around each — in-and-out, crossover, hesitation, behind-the-back — simulating live dribble penetration.',
    duration_minutes: 20,
    reps_or_sets: '4 full rounds',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Cones or Chairs'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'slalom',
  },
  {
    id: 'bh-006',
    name: 'Between-the-Legs Speed Drill',
    description: 'Rapid between-the-legs dribbles walking forward. Increase pace with each step. Switch to one-hand speed dribble every 5 reps. Builds coordination and hand speed.',
    duration_minutes: 10,
    reps_or_sets: '5 sets × court length',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Full Court'],
    positions: ['PG', 'SG'],
    anim_type: 'crossover',
  },
  {
    id: 'bh-007',
    name: 'Behind-the-Back Series',
    description: 'Perform behind-the-back dribble combos from a stationary position, then advance to walking, jogging, and full speed. Chain the behind-the-back with a crossover and hesitation move at each progression.',
    duration_minutes: 15,
    reps_or_sets: '4 sets × 1 minute each progression',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Full Court'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'crossover',
  },
  {
    id: 'bh-008',
    name: 'Hesitation Move Drill',
    description: 'Dribble at half speed toward a cone, execute a hard hesitation (hesi) fake to freeze the imaginary defender, then explode past. Alternate between right-hand and left-hand hesitation drives.',
    duration_minutes: 12,
    reps_or_sets: '5 sets × 6 reps each hand',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'crossover',
  },
  {
    id: 'bh-009',
    name: 'Zig-Zag Full Court Dribble',
    description: 'Dribble baseline to baseline in a zig-zag pattern, executing a different dribble move at each change of direction. Use crossover on the first pass, between-the-legs on the second, and behind-the-back on the third.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 3 full court lengths',
    difficulty: 'Beginner',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'slalom',
  },
  {
    id: 'bh-010',
    name: 'Tight Space Dribble Drill',
    description: 'Set up 8 cones in a tight 6×6 foot square. Perform rapid dribble moves while navigating the confined space. Emphasize staying low, protecting the ball, and making quick directional changes without losing control.',
    duration_minutes: 10,
    reps_or_sets: '5 sets × 45 seconds',
    difficulty: 'Advanced',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG'],
    anim_type: 'spider',
  },
  {
    id: 'bh-011',
    name: 'Tennis Ball Dribble',
    description: 'Dribble a basketball with one hand while catching and tossing a tennis ball with the other. This dual-task drill forces your eyes up and trains your off-hand coordination while building dribble confidence.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 1 minute each hand',
    difficulty: 'Advanced',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Tennis Ball'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'two_ball',
  },
  {
    id: 'bh-012',
    name: 'In-and-Out Move Drill',
    description: 'Drive toward a defender or cone and fake the crossover using an in-and-out dribble to change direction without switching hands. Sell the fake with a head and shoulder move, then explode past on the same side.',
    duration_minutes: 12,
    reps_or_sets: '5 sets × 8 reps each hand',
    difficulty: 'Beginner',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'crossover',
  },
  {
    id: 'bh-013',
    name: 'Speed Dribble Pushes',
    description: 'Push the ball ahead with long, aggressive dribbles from baseline to baseline at maximum speed. Keep the ball out in front of your body and work on controlling pace changes — full sprint then sudden stop.',
    duration_minutes: 12,
    reps_or_sets: '6 sets × 2 full court lengths',
    difficulty: 'Beginner',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'slalom',
  },
  {
    id: 'bh-014',
    name: 'Retreat Dribble Series',
    description: 'Drive forward two hard dribbles, then retreat-dribble backward quickly to create space. Follow the retreat with a pull-up jumper or re-drive. This drill trains you to reset the attack without turning your back to the defense.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps each direction',
    difficulty: 'Advanced',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG'],
    anim_type: 'crossover',
  },

  /* ──────────── DEFENSE ───────────────────────────────────── */
  {
    id: 'def-001',
    name: 'Defensive Slide Series',
    description: 'In a low defensive stance, slide from lane line to lane line without crossing your feet. Keep hips low and below your shoulders. Add a closeout sprint at each end.',
    duration_minutes: 10,
    reps_or_sets: '5 sets × 30 seconds',
    difficulty: 'Beginner',
    focus_area: 'Defense',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-002',
    name: 'Closeout & Contest',
    description: 'Start under the basket. On toss to wing, sprint to closeout with high hands and quick chopped steps. Slide to prevent the drive — no fouling, hands up only.',
    duration_minutes: 12,
    reps_or_sets: '3 sets × 10 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Defense',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'closeout',
  },
  {
    id: 'def-003',
    name: 'On-Ball Mirror Drill',
    description: 'Mirror the ball handler from half-court to the three-point line and back, maintaining active hands and a low stance. React instantly to every change of direction.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 45 seconds',
    difficulty: 'Intermediate',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Partner'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-004',
    name: 'Help & Recover Rotations',
    description: 'Three-man drill: ball-side, help-side, and ball. Practice rotating from help position to stop the drive, then recovering to your original assignment. Communication required.',
    duration_minutes: 20,
    reps_or_sets: '5 rotations each position',
    difficulty: 'Advanced',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Team / Partner'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'closeout',
  },
  {
    id: 'def-005',
    name: 'Post Defense Box-Out',
    description: 'Front-court defender fronts the post. On the shot, execute a full reverse-pivot box-out, secure the defensive board, and outlet pass quickly. Repeat with varied post entries.',
    duration_minutes: 15,
    reps_or_sets: '4 sets × 8 reps',
    difficulty: 'Advanced',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Partner'],
    positions: ['PF', 'C'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-006',
    name: 'Drop Step Shell Drill',
    description: 'Four-corner shell defensive rotations. As ball moves around the perimeter, all defenders adjust positioning simultaneously. Emphasize ball-you-man principles and deny cuts.',
    duration_minutes: 18,
    reps_or_sets: '4 rounds × 2 minutes each',
    difficulty: 'Advanced',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Team'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'closeout',
  },
  {
    id: 'def-007',
    name: 'Charge Drawing Drill',
    description: 'Practice sliding into legal position in the restricted arc and absorbing contact to draw an offensive foul. Set your feet, keep hands behind your back, and fall backward safely. Focus on timing and positioning.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 6 reps',
    difficulty: 'Intermediate',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Partner'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-008',
    name: 'Active Hands Steal Drill',
    description: 'Shadow a ball handler one-on-one and work on swiping at the ball without fouling. Keep your body low, mirror the dribble, and strike upward at the ball when the handler exposes it during crossovers or hesitations.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 1 minute',
    difficulty: 'Advanced',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Partner'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-009',
    name: 'Ball Denial Positioning',
    description: 'Deny the pass to the wing by positioning yourself in the passing lane with one hand extended toward the ball and the other feeling for the offensive player. React to back-cuts by opening up and recovering.',
    duration_minutes: 15,
    reps_or_sets: '5 sets × 45 seconds per side',
    difficulty: 'Intermediate',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Partner'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'closeout',
  },
  {
    id: 'def-010',
    name: 'Help Defense Rotation Drill',
    description: 'Start in help-side position. When the ball drives baseline, rotate to protect the rim. When the ball is kicked out, close out hard to the nearest shooter. Emphasize early recognition and explosive recovery.',
    duration_minutes: 18,
    reps_or_sets: '5 rotations × 3 minutes',
    difficulty: 'Advanced',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Team / Partner'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'closeout',
  },
  {
    id: 'def-011',
    name: 'Pick-and-Roll Defense',
    description: 'Practice defending the ball screen using different coverages — hedge and recover, switch, drop, and ICE. Communicate the screen call early, then execute the correct defensive technique with your partner.',
    duration_minutes: 20,
    reps_or_sets: '4 sets × 3 reps per coverage',
    difficulty: 'Advanced',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Partner'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-012',
    name: 'Zone Defense Rotations',
    description: 'Walk through 2-3 zone rotations as the ball moves around the perimeter. Each player shifts to fill gaps and cover threats. Build speed gradually from walk-through to live tempo, emphasizing communication at every pass.',
    duration_minutes: 20,
    reps_or_sets: '4 rounds × 3 minutes',
    difficulty: 'Beginner',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Team'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'closeout',
  },

  /* ──────────── FINISHING ─────────────────────────────────── */
  {
    id: 'fin-001',
    name: 'Mikan Drill',
    description: 'Alternating layups on each side of the basket — catch before it hits the floor, go immediately to the other side. Stay close to the rim. Build a rhythm, then increase speed.',
    duration_minutes: 8,
    reps_or_sets: '4 sets × 20 makes',
    difficulty: 'Beginner',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'mikan',
  },
  {
    id: 'fin-002',
    name: 'Euro Step Layup',
    description: 'Gather at the charge circle, take one step to one side then a long step to the opposite side to avoid the help defender. Protect the ball and finish off the glass or direct.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps each direction',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'eurostep',
  },
  {
    id: 'fin-003',
    name: 'Contact Layup Drill',
    description: 'Drive hard to the rim while a partner gives controlled contact at the gather. Train yourself to absorb, stay balanced, and finish strong through body contact.',
    duration_minutes: 14,
    reps_or_sets: '5 sets × 8 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop', 'Partner'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'drive_finish',
  },
  {
    id: 'fin-004',
    name: 'Power Dribble Post Finish',
    description: 'Catch the ball in the post, use 2 power dribbles toward baseline or middle, then execute a strong two-foot power layup or baby hook. Attack the glass — do not fade.',
    duration_minutes: 15,
    reps_or_sets: '4 sets × 10 reps each side',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PF', 'C'],
    anim_type: 'post_fade',
  },
  {
    id: 'fin-005',
    name: 'Reverse Layup Circuit',
    description: 'Drive baseline and use the backboard for a reverse layup. Keep your outside hand protecting the ball. Practice full speed from both sides. Trust the glass.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'drive_finish',
  },
  {
    id: 'fin-006',
    name: 'Drop-Step Power Move',
    description: 'Catch in the mid-post, use a jab to freeze the defender, drop-step toward the baseline, and finish with a power layup. Keep your shoulder into the defender throughout.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PF', 'C'],
    anim_type: 'mikan',
  },
  {
    id: 'fin-007',
    name: 'Floater / Runner in the Lane',
    description: 'Drive into the paint from the wing, gather with one foot just past the first hash, and release a soft one-hand runner over the rim protector. Practice left and right hands, varying the arc and distance from the basket.',
    duration_minutes: 14,
    reps_or_sets: '5 sets × 8 reps each hand',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'drive_finish',
  },
  {
    id: 'fin-008',
    name: 'Off-Hand Layup Challenge',
    description: 'Complete all layup attempts exclusively with your weaker hand — no dominant hand allowed. Drive from both sides and finish off the glass using proper off-hand mechanics. Track your make percentage each session.',
    duration_minutes: 12,
    reps_or_sets: '5 sets × 10 reps',
    difficulty: 'Beginner',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'mikan',
  },
  {
    id: 'fin-009',
    name: 'Finger Roll Touch Drill',
    description: 'Drive to the basket at moderate speed, extend your arm fully, and roll the ball gently off your fingertips with high arc over an imaginary shot blocker. Develop the delicate touch needed for close-range finishes.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 10 reps each hand',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'drive_finish',
  },
  {
    id: 'fin-010',
    name: 'Scoop Layup Drill',
    description: 'Attack the basket from the baseline or wing, lower the ball with an underhand scoop motion, and finish around the defender with a high-arcing scoop lay. Practice both hands and focus on body control through contact.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'eurostep',
  },
  {
    id: 'fin-011',
    name: 'And-1 Finish Through Contact',
    description: 'A partner provides controlled body contact as you drive to the rim. Absorb the hit with your shoulder, maintain ball control, and finish strong with two feet. Practice converting the and-1 free throw after each make.',
    duration_minutes: 16,
    reps_or_sets: '5 sets × 6 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop', 'Partner'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'drive_finish',
  },
  {
    id: 'fin-012',
    name: 'Up-and-Under Post Move',
    description: 'Catch in the low post, use a shot fake to get the defender airborne, then step through underneath them for a close-range finish. Alternate baseline and middle side steps. Keep the ball above your shoulder on the fake.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['SF', 'PF', 'C'],
    anim_type: 'post_fade',
  },
  {
    id: 'fin-013',
    name: 'Baby Hook Shot Series',
    description: 'Receive the ball in the paint, use one dribble to establish position, then execute a one-foot baby hook shot over the defender. Practice from both blocks and the middle of the lane. Keep the release quick and compact.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 10 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PF', 'C', 'SF'],
    anim_type: 'post_fade',
  },
  {
    id: 'fin-014',
    name: 'Tip-In Rebounding Drill',
    description: 'Toss the ball off the backboard from close range, jump and tip it back toward the rim repeatedly without letting it hit the floor. Develop timing, vertical leap, and soft touch around the basket for offensive rebounds.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 12 reps',
    difficulty: 'Beginner',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PF', 'C'],
    anim_type: 'mikan',
  },

  /* ──────────── CONDITIONING ──────────────────────────────── */
  {
    id: 'cond-001',
    name: 'Suicide Sprints',
    description: 'Sprint from baseline to foul line and back, then half-court and back, then far foul line and back, then full court and back. Rest 30 seconds between sets.',
    duration_minutes: 12,
    reps_or_sets: '5 sets',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-002',
    name: '17s Running Drill',
    description: 'Run sideline to sideline 17 times in under 60 seconds. Touch each line on every sprint. Elite standard is completing before the clock hits 60. Track your time every session.',
    duration_minutes: 15,
    reps_or_sets: '3 sets',
    difficulty: 'Advanced',
    focus_area: 'Conditioning',
    equipment_needed: ['Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-003',
    name: 'Dribble Conditioning Circuit',
    description: 'Full-court dribble sprint. Stop at each key line, execute 3 ball-handling moves, then continue. Combines conditioning with skill work — never stop moving.',
    duration_minutes: 18,
    reps_or_sets: '4 sets',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['Basketball', 'Full Court'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'full_court_run',
  },
  {
    id: 'cond-004',
    name: 'Jump Rope Power Circuit',
    description: 'Alternating 30-second sets: double-unders, rest, single-leg left, rest, single-leg right, rest. Builds calf endurance, ankle stability, and foot speed simultaneously.',
    duration_minutes: 15,
    reps_or_sets: '4 circuits',
    difficulty: 'Beginner',
    focus_area: 'Conditioning',
    equipment_needed: ['Jump Rope'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-005',
    name: 'Box Jump Series',
    description: 'Explosive jumps onto an 18–24 inch box. Step off carefully, reset, then repeat at maximum effort each rep. Quality over speed — do not let form deteriorate under fatigue.',
    duration_minutes: 12,
    reps_or_sets: '5 sets × 8 reps',
    difficulty: 'Advanced',
    focus_area: 'Conditioning',
    equipment_needed: ['Plyo Box'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-006',
    name: 'On-Court Agility Ladder',
    description: 'Agility ladder drills: two-in, lateral shuffle, Icky shuffle, and single-leg hops. Do every pattern at maximum speed with zero missed steps. Reset before each rep.',
    duration_minutes: 14,
    reps_or_sets: '3 sets × 5 patterns',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['Agility Ladder'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-007',
    name: 'Hill Sprints',
    description: 'Find a moderate hill or ramp and sprint to the top at maximum effort, then walk back down for recovery. Hill sprints build explosive leg power and cardiovascular endurance that translates directly to fast-break speed.',
    duration_minutes: 15,
    reps_or_sets: '8 sprints with walk-back recovery',
    difficulty: 'Advanced',
    focus_area: 'Conditioning',
    equipment_needed: ['Hill or Ramp'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-008',
    name: 'Bear Crawl Court Lengths',
    description: 'Get on all fours and crawl forward from baseline to half-court and back, keeping your knees hovering just above the ground. This full-body movement builds core stability, shoulder endurance, and hip mobility.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 2 half-court lengths',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-009',
    name: 'Burpee to Sprint',
    description: 'Perform a burpee at the baseline, then immediately sprint to half-court. Jog back and repeat. The combination of explosive floor-to-standing movement followed by a sprint simulates the rapid transitions of live basketball.',
    duration_minutes: 12,
    reps_or_sets: '5 sets × 6 reps',
    difficulty: 'Advanced',
    focus_area: 'Conditioning',
    equipment_needed: ['Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-010',
    name: 'Lateral Bound Series',
    description: 'Stand on one leg and bound laterally to the opposite leg, sticking each landing for a full second before bounding back. Increase distance progressively. Develops lateral power and ankle stability for defensive movement.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 12 bounds',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-011',
    name: 'Wall Sit Endurance',
    description: 'Sit against a wall with thighs parallel to the floor and hold the position. This isometric exercise builds the quad endurance needed for maintaining a low defensive stance throughout an entire game.',
    duration_minutes: 8,
    reps_or_sets: '5 sets × 45-60 seconds hold',
    difficulty: 'Beginner',
    focus_area: 'Conditioning',
    equipment_needed: ['Wall'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-012',
    name: 'Defensive Shuffle Intervals',
    description: 'Alternate between 20-second all-out defensive shuffles and 10-second rest periods. Cover as much lateral distance as possible during each work interval. Stay in a low stance the entire time.',
    duration_minutes: 12,
    reps_or_sets: '8 rounds of 20s on / 10s off',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-013',
    name: 'Medicine Ball Circuit',
    description: 'Perform a circuit of medicine ball slams, chest passes against a wall, rotational throws, and overhead tosses. Each station is 30 seconds with 15 seconds rest. Builds explosive power and full-body conditioning.',
    duration_minutes: 18,
    reps_or_sets: '4 circuits × 4 stations',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['Medicine Ball', 'Wall'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-014',
    name: 'Lane Agility Drill',
    description: 'Starting at the baseline, sprint to the foul line, defensive slide to the lane line, backpedal to the baseline, then sprint diagonally across the lane. This NBA combine drill tests multi-directional quickness.',
    duration_minutes: 10,
    reps_or_sets: '6 sets with 30 seconds rest',
    difficulty: 'Beginner',
    focus_area: 'Conditioning',
    equipment_needed: ['Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },

  /* ──────────── STRENGTH ──────────────────────────────────── */
  {
    id: 'str-001',
    name: 'Squat Jump Explosions',
    description: 'Perform bodyweight squats with an explosive jump at the top of each rep. Land softly with bent knees and immediately descend into the next squat. Builds the explosive lower-body power needed for rebounds, blocks, and dunks.',
    duration_minutes: 12,
    reps_or_sets: '5 sets × 10 reps',
    difficulty: 'Intermediate',
    focus_area: 'Strength',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-002',
    name: 'Walking Lunges',
    description: 'Perform walking lunges across the court with each step, keeping your torso upright and your front knee tracking over your toes. Add a twist toward the front leg to engage your core. Develops single-leg strength and hip stability.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 20 steps',
    difficulty: 'Beginner',
    focus_area: 'Strength',
    equipment_needed: ['Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-003',
    name: 'Deadlift Stance Hold & Hinge',
    description: 'Practice the hip-hinge movement pattern with bodyweight or light dumbbells. Keep your back flat, core braced, and push your hips back until you feel a hamstring stretch. This foundational movement prevents injury and builds posterior chain strength.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 12 reps',
    difficulty: 'Beginner',
    focus_area: 'Strength',
    equipment_needed: ['Dumbbells (optional)'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-004',
    name: 'Push-Up Variation Circuit',
    description: 'Cycle through standard push-ups, wide-grip, diamond, and staggered push-ups in a circuit format. Each variation targets different muscle fibers in the chest, shoulders, and triceps essential for physical play.',
    duration_minutes: 14,
    reps_or_sets: '4 circuits × 10 reps per variation',
    difficulty: 'Intermediate',
    focus_area: 'Strength',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-005',
    name: 'Plank Hold Series',
    description: 'Hold a front plank, then transition to left side plank, back to center, and finish with right side plank. Maintain a rigid body line throughout. A strong core is the foundation for balance, contact absorption, and shooting stability.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 30 seconds per position',
    difficulty: 'Beginner',
    focus_area: 'Strength',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-006',
    name: 'Resistance Band Lateral Walks',
    description: 'Place a resistance band around your ankles and walk laterally in a low athletic stance. Keep constant tension on the band and avoid letting your knees cave inward. Strengthens hip abductors critical for lateral defensive movement.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 15 steps per direction',
    difficulty: 'Beginner',
    focus_area: 'Strength',
    equipment_needed: ['Resistance Band'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-007',
    name: 'Calf Raise Power Series',
    description: 'Perform single-leg calf raises on a step or elevated surface, lowering below the edge for a full stretch and driving up onto your toes explosively. Strong calves improve vertical leap, sprint acceleration, and ankle injury prevention.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 15 reps per leg',
    difficulty: 'Intermediate',
    focus_area: 'Strength',
    equipment_needed: ['Step or Platform'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-008',
    name: 'Core Rotation with Medicine Ball',
    description: 'Sit on the floor with knees bent, hold a medicine ball, and rotate your torso side to side, tapping the ball on the ground beside each hip. Builds the rotational core strength essential for passing power and shot fakes.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 20 reps (10 per side)',
    difficulty: 'Intermediate',
    focus_area: 'Strength',
    equipment_needed: ['Medicine Ball'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-009',
    name: 'Single-Leg Pistol Squats',
    description: 'Stand on one leg, extend the other in front of you, and lower into a deep single-leg squat. Use a wall or post for balance assistance if needed. This advanced move builds unilateral leg strength, balance, and ankle mobility.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 6 reps per leg',
    difficulty: 'Advanced',
    focus_area: 'Strength',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-010',
    name: 'Farmer Walk Court Lengths',
    description: 'Hold heavy dumbbells or kettlebells at your sides and walk from baseline to baseline with an upright posture. Grip, core, and shoulder stability are all challenged simultaneously. Builds the functional strength for absorbing contact.',
    duration_minutes: 12,
    reps_or_sets: '5 sets × 2 full court lengths',
    difficulty: 'Intermediate',
    focus_area: 'Strength',
    equipment_needed: ['Dumbbells or Kettlebells'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-011',
    name: 'Battle Rope Intervals',
    description: 'Alternate between double-arm slams, alternating waves, and lateral whips with battle ropes in 30-second bursts. Rest 15 seconds between sets. Develops shoulder endurance, grip strength, and anaerobic conditioning.',
    duration_minutes: 15,
    reps_or_sets: '5 sets × 3 variations',
    difficulty: 'Advanced',
    focus_area: 'Strength',
    equipment_needed: ['Battle Ropes'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-012',
    name: 'Box Step-Up Power Drive',
    description: 'Step onto an 18-24 inch box with one foot and drive your opposite knee up explosively at the top. Step down and repeat on the same leg before switching. Builds the single-leg power essential for driving to the basket and rebounding.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps per leg',
    difficulty: 'Advanced',
    focus_area: 'Strength',
    equipment_needed: ['Plyo Box'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },

  /* ──────────── SHOOTING (Extended) ──────────────────────── */
  {
    id: 'shoot-016',
    name: 'Form Shooting Close Range',
    description: 'Stand 3–5 feet from the basket and shoot with perfect form — one hand only, focusing on wrist snap and follow-through. Build muscle memory for your release before adding distance. Track makes out of 20 attempts.',
    duration_minutes: 10,
    reps_or_sets: '5 sets × 20 reps',
    difficulty: 'Beginner',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'free_throw',
  },
  {
    id: 'shoot-017',
    name: 'One-Dribble Pull-Up',
    description: 'Start at the three-point line, take exactly one hard dribble toward the basket, gather your feet, and rise into a pull-up jumper. No extra steps — the one-dribble constraint forces efficient footwork and balance.',
    duration_minutes: 15,
    reps_or_sets: '5 sets × 8 reps each side',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'pullup',
  },
  {
    id: 'shoot-018',
    name: 'Fadeaway from the Elbow',
    description: 'Catch at the elbow, use a jab-step to get your defender on their heels, then elevate into a fadeaway jumper. Keep your balance even as you drift backwards. This shot requires significant shooting strength — do not compromise form.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'pullup',
  },
  {
    id: 'shoot-019',
    name: 'Corner Specialist Routine',
    description: 'Work exclusively from the corners — left and right. Alternate between catch-and-shoot, one-dribble pull-up, and step-back from each corner. The corner 3 is the highest-value shot in basketball; master it.',
    duration_minutes: 18,
    reps_or_sets: '3 sets × 12 reps per corner',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'catch_shoot',
  },
  {
    id: 'shoot-020',
    name: 'Logo Three-Pointers',
    description: 'Shoot from the logo or half-court extended range. Use the same release as a normal three — do not push. This drill builds shooting range and strength progressively. Only attempt this if your normal 3PT% is above 35%.',
    duration_minutes: 16,
    reps_or_sets: '4 sets × 5 reps per spot',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'spot_shoot',
  },
  {
    id: 'shoot-021',
    name: 'Elbow Jumper Series',
    description: 'Work from both elbows alternately — catch, face up, and shoot a crisp mid-range jumper. Add variety: straight-up, off one dribble, and after a shot-fake. The elbow is one of the most reliable spots on the floor.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 10 reps per elbow',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'pullup',
  },
  {
    id: 'shoot-022',
    name: 'Game-Speed Shooting Workout',
    description: 'Simulate real game scenarios: curl off a cone for a three, attack the paint and pull up, and spot-up from the wing. Move at game speed between each shot. Time each set and try to beat your previous record.',
    duration_minutes: 22,
    reps_or_sets: '4 circuits × 6 shots per circuit',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'spot_shoot',
  },
  {
    id: 'shoot-023',
    name: 'Partner Passing Shooting Drill',
    description: 'Partner feeds you from different angles while you relocate to open spots. Focus on catching and shooting in one motion. This drill builds the habit of always being ready to shoot before the ball arrives.',
    duration_minutes: 18,
    reps_or_sets: '4 sets × 10 reps per partner',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop', 'Partner'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'catch_shoot',
  },
  {
    id: 'shoot-024',
    name: 'Spot-Up Warmup Progression',
    description: 'Methodically shoot from 5 spots (2 corners, 2 wings, top of key) starting at 10 feet, then 15, then the arc. Make 5 consecutive from each spot before advancing. Perfect for pre-practice or game warmups.',
    duration_minutes: 20,
    reps_or_sets: '3 full progressions',
    difficulty: 'Beginner',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'spot_shoot',
  },
  {
    id: 'shoot-025',
    name: 'Pressure Free Throw Circuit',
    description: 'Shoot 10 free throws in a row, adding increasing physical difficulty each round: round 1 is normal, round 2 after 20 push-ups, round 3 after a 400m run equivalent. Test your mental composure under physical pressure.',
    duration_minutes: 15,
    reps_or_sets: '3 rounds × 10 free throws',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'free_throw',
  },

  /* ──────────── BALL HANDLING (Extended) ──────────────────── */
  {
    id: 'bh-015',
    name: 'Pound Dribble Foundation',
    description: 'Hard pound dribbles with one hand — 30 seconds strong hand then switch. The ball must hit the floor hard enough to bounce back to hip height. Develops hand strength, ball control, and the confidence to dribble in traffic.',
    duration_minutes: 10,
    reps_or_sets: '6 sets × 30 seconds per hand',
    difficulty: 'Beginner',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'spider',
  },
  {
    id: 'bh-016',
    name: 'Figure-8 Dribble',
    description: 'Dribble the ball through your legs in a figure-8 pattern while walking forward. Start slow and controlled, then increase speed. Progress to doing the figure-8 while jogging down court. Builds coordination and ambidextrous dribbling.',
    duration_minutes: 10,
    reps_or_sets: '5 sets × court length',
    difficulty: 'Beginner',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'spider',
  },
  {
    id: 'bh-017',
    name: 'Combo Move Mastery',
    description: 'Chain 4 advanced moves back to back without stopping: step-back, through-the-legs crossover, behind-the-back, and hesitation into a drive. This elite sequence builds the move vocabulary of a pro ballhandler.',
    duration_minutes: 18,
    reps_or_sets: '5 sets × 6 full sequences',
    difficulty: 'Advanced',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Full Court'],
    positions: ['PG', 'SG'],
    anim_type: 'crossover',
  },
  {
    id: 'bh-018',
    name: 'Reverse Dribble Series',
    description: 'Drive toward a cone, use a tight reverse spin (pivot while keeping the dribble alive) to protect the ball, and attack the next direction. Builds body control and the ability to change direction without turning your back to the defense.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps each direction',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'crossover',
  },
  {
    id: 'bh-019',
    name: 'Two-Ball Speed Dribble',
    description: 'Dribble two basketballs simultaneously while walking, then jogging, then full sprint. Progress only when you can maintain control at the previous speed. The ultimate ball-handling strength and coordination test.',
    duration_minutes: 15,
    reps_or_sets: '4 sets × court length',
    difficulty: 'Advanced',
    focus_area: 'Ball Handling',
    equipment_needed: ['2 Basketballs', 'Full Court'],
    positions: ['PG', 'SG'],
    anim_type: 'two_ball',
  },
  {
    id: 'bh-020',
    name: 'Rhythm Dribble Series',
    description: 'Dribble at a consistent rhythm matching a tempo (use a metronome app or count). Change between low, medium, and high dribbles on command. Perfect for building composure and timing when being guarded in the halfcourt.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 1 minute',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Metronome (optional)'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'spider',
  },
  {
    id: 'bh-021',
    name: 'Tight Crossover Attack',
    description: 'Use a tight crossover (ball stays close to the body, low dribble) to get past a cone defender. Attack immediately after the cross — no extra dribbles. This protects the ball from active defenders in traffic.',
    duration_minutes: 12,
    reps_or_sets: '5 sets × 8 reps each direction',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'crossover',
  },
  {
    id: 'bh-022',
    name: 'Off-Hand Isolation',
    description: 'Complete an entire ball handling session using only your weak hand. No dominant hand at all. Dribble at half speed and focus on fingertip control. This is the fastest way to develop a reliable off-hand.',
    duration_minutes: 15,
    reps_or_sets: '6 sets × 1 minute',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'spider',
  },

  /* ──────────── DEFENSE (Extended) ────────────────────────── */
  {
    id: 'def-013',
    name: 'Rim Protection Stance Drill',
    description: 'Stand at the restricted arc and practice vertical jump contests without fouling. Jump straight up with both arms raised — no reach or lean. Time your jump with a partner releasing the ball from 10 feet. Protect your space, not the ball.',
    duration_minutes: 14,
    reps_or_sets: '5 sets × 8 reps',
    difficulty: 'Advanced',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Hoop', 'Partner'],
    positions: ['PF', 'C'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-014',
    name: 'Transition Defense Sprint',
    description: 'Start at half-court. On signal, sprint back to prevent an easy layup, find your man, and communicate with a teammate. Transition defense requires speed, awareness, and instant recovery. Practice until getting back is automatic.',
    duration_minutes: 15,
    reps_or_sets: '4 sets × 5 reps full court',
    difficulty: 'Intermediate',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Full Court', 'Partner'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'closeout',
  },
  {
    id: 'def-015',
    name: 'Perimeter Lock-Up Series',
    description: 'Guard a ball handler 1-on-1 from halfcourt to the three-point arc, staying in front without reaching. Contest every shot attempt with a hand up and controlled footwork. Focus on staying between the ball handler and the basket.',
    duration_minutes: 18,
    reps_or_sets: '4 sets × 1 minute',
    difficulty: 'Intermediate',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Partner'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-016',
    name: 'Defensive Rebound Box-Out Circuit',
    description: 'Box out a partner from three different positions — front, side, and post. Seal them with your hips and back, then track the rebound. Great rebounders are made through proper technique, not just jumping.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 6 reps per position',
    difficulty: 'Beginner',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Hoop', 'Partner'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-017',
    name: '1-on-1 Full Court Defense',
    description: 'Guard a ball handler from baseline to baseline 1-on-1. Do not foul, do not let them score. Keep your hips low, mirror their moves, and contest every layup or pull-up attempt. This is the ultimate defensive conditioning drill.',
    duration_minutes: 20,
    reps_or_sets: '4 sets × 2 full court lengths',
    difficulty: 'Advanced',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Full Court', 'Partner'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'closeout',
  },

  /* ──────────── FINISHING (Extended) ──────────────────────── */
  {
    id: 'fin-015',
    name: 'Skip-Step Layup',
    description: 'Use a skip-step gather (two quick steps) to change speed and angle into the basket, avoiding the shot blocker. Attack from both wings and finish on the same or opposite side of the basket.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'drive_finish',
  },
  {
    id: 'fin-016',
    name: 'Post-Up Power Finish',
    description: 'Establish deep post position, catch, and make one power move to the basket — either baseline or middle. Execute two power dribbles to create space and finish with a strong two-foot layup. No fancy moves — just power.',
    duration_minutes: 15,
    reps_or_sets: '4 sets × 8 reps each side',
    difficulty: 'Advanced',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PF', 'C', 'SF'],
    anim_type: 'post_fade',
  },
  {
    id: 'fin-017',
    name: 'Running Hook Shot',
    description: 'Gather on the run from the wing, step across the key, and release a running hook shot on the opposite side of the basket. Use your body to shield the ball and extend your shooting arm fully on the release.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 10 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['SF', 'PF', 'C'],
    anim_type: 'mikan',
  },
  {
    id: 'fin-018',
    name: 'Left-Hand Form Layup Drill',
    description: 'Exclusively practice left-hand layups from the left side, approaching at full speed. Use the glass for banks from angles. Focus on proper footwork — left-right-jump — and extending your off-hand fully at the basket.',
    duration_minutes: 12,
    reps_or_sets: '5 sets × 10 reps',
    difficulty: 'Beginner',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'mikan',
  },
  {
    id: 'fin-019',
    name: 'Drive-and-Kick Simulation',
    description: 'Drive hard to the basket, draw the help defender, then kick out to an imaginary shooter at the three-point line (or pass to a partner). Develop the court vision and decision-making to score or create for teammates.',
    duration_minutes: 16,
    reps_or_sets: '5 sets × 6 reps',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop', 'Partner (optional)'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'drive_finish',
  },

  /* ──────────── CONDITIONING (Extended) ───────────────────── */
  {
    id: 'cond-015',
    name: '3/4 Court Sprints',
    description: 'Sprint from baseline to the far free-throw line and back. Rest exactly 20 seconds between reps. The 3/4 court distance targets fast-break speed more specifically than full-court runs while reducing total impact stress.',
    duration_minutes: 12,
    reps_or_sets: '8 sprints × 20s rest',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-016',
    name: 'Tempo Jog Recovery Run',
    description: 'Jog at a controlled 60–70% effort pace for 15 minutes continuously. Tempo runs build aerobic base and accelerate recovery. Maintain a pace where you can hold a conversation — if you cannot, slow down.',
    duration_minutes: 15,
    reps_or_sets: '1 continuous run',
    difficulty: 'Beginner',
    focus_area: 'Conditioning',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-017',
    name: 'Defensive Slide Cardio Intervals',
    description: 'Alternate 30-second max-effort defensive slides with 15-second rests. Stay in your defensive stance the entire 30 seconds — no standing up. This directly mimics the cardiovascular demands of guarding in a halfcourt defense.',
    duration_minutes: 14,
    reps_or_sets: '10 rounds × 30s on/15s off',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-018',
    name: 'Wind Sprint Intervals',
    description: 'Sprint at 100% effort for 10 seconds, rest 50 seconds. This 1:5 work-to-rest ratio develops the explosive anaerobic system that powers fast breaks and defensive rotations in basketball. Track how many you can do with consistent speed.',
    duration_minutes: 15,
    reps_or_sets: '10 sprints',
    difficulty: 'Advanced',
    focus_area: 'Conditioning',
    equipment_needed: ['Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-019',
    name: 'High Knees Speed Circuit',
    description: 'Sprint while driving your knees high — thigh parallel to the ground with each step. Alternate between high knees in place and moving forward. Builds hip flexor strength, running mechanics, and the fast-twitch fiber activation needed for explosive first steps.',
    duration_minutes: 10,
    reps_or_sets: '6 sets × 30 seconds',
    difficulty: 'Beginner',
    focus_area: 'Conditioning',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-020',
    name: 'Footwork Speed Circuit',
    description: 'Perform a timed circuit: rapid stutter steps (15s), pivot left and right (15s), defensive stance shuffle (15s), jump stops (15s). Rest 45 seconds between rounds. This drill sharpens every footwork pattern used in live basketball.',
    duration_minutes: 16,
    reps_or_sets: '5 circuits',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-021',
    name: 'Plyo Box Cardio Blast',
    description: 'Alternate between box jumps, lateral step-overs, and depth jumps for 30 seconds each with 10 seconds rest. This circuit combines plyometric power with conditioning volume to maximize explosive endurance.',
    duration_minutes: 15,
    reps_or_sets: '4 circuits × 3 exercises',
    difficulty: 'Advanced',
    focus_area: 'Conditioning',
    equipment_needed: ['Plyo Box'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-022',
    name: 'Court Laps with Dribble',
    description: 'Dribble a basketball while jogging court laps. Change hands every half-lap. This low-intensity drill builds dribbling automaticity and aerobic base simultaneously — perfect for recovery days or pre-practice.',
    duration_minutes: 12,
    reps_or_sets: '8 full court laps',
    difficulty: 'Beginner',
    focus_area: 'Conditioning',
    equipment_needed: ['Basketball', 'Full Court'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'full_court_run',
  },

  /* ──────────── STRENGTH (Extended) ───────────────────────── */
  {
    id: 'str-013',
    name: 'Hip Flexor Mobility Flow',
    description: 'Perform a sequence of hip flexor stretches and activation exercises: kneeling lunge stretch, pigeon pose, hip circles, and lateral band walks. Tight hip flexors limit your sprint stride and defensive stance — address this daily.',
    duration_minutes: 10,
    reps_or_sets: '3 sets × 45 seconds per stretch',
    difficulty: 'Beginner',
    focus_area: 'Strength',
    equipment_needed: ['Resistance Band (optional)'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-014',
    name: 'Glute Bridge Power Series',
    description: 'Lie on your back, feet flat on the floor, and drive your hips toward the ceiling while squeezing your glutes. Hold at the top for 2 seconds. Progress to single-leg bridges. Strong glutes protect your knees and fuel your vertical jump.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 15 reps',
    difficulty: 'Beginner',
    focus_area: 'Strength',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-015',
    name: 'Band Pull-Aparts',
    description: 'Hold a resistance band at arms length in front of you and pull it apart laterally until both hands reach shoulder height. This targets the rear deltoids and rotator cuffs — essential for injury-free shooting mechanics.',
    duration_minutes: 8,
    reps_or_sets: '4 sets × 15 reps',
    difficulty: 'Beginner',
    focus_area: 'Strength',
    equipment_needed: ['Resistance Band'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-016',
    name: 'Overhead Press for Court Strength',
    description: 'Press dumbbells or a barbell overhead from shoulder height to full extension. Keep your core braced and avoid arching your lower back. Upper-body pressing strength improves passing power, physical play, and shot fakes.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps',
    difficulty: 'Intermediate',
    focus_area: 'Strength',
    equipment_needed: ['Dumbbells or Barbell'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-017',
    name: 'Hip Hinge Romanian Deadlift',
    description: 'Hold dumbbells and hinge at the hips — back flat, slight knee bend — until you feel a hamstring stretch, then drive through your heels to return upright. This exercise directly builds the posterior chain strength needed for explosive jumping.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 12 reps',
    difficulty: 'Intermediate',
    focus_area: 'Strength',
    equipment_needed: ['Dumbbells'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-018',
    name: 'Explosive Split Squat',
    description: 'Drop into a split squat (lunge position), then explosively switch legs in the air. Land softly and immediately drop into the next split squat. This plyometric builds single-leg power and the fast-twitch strength required for quick first steps.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps per leg',
    difficulty: 'Advanced',
    focus_area: 'Strength',
    equipment_needed: ['None'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-019',
    name: 'Grip Strength Ball Squeezes',
    description: 'Squeeze a stress ball or tennis ball as hard as possible for 30 seconds each hand. Progress to using a grip trainer. Strong grip prevents turnovers, improves passing accuracy, and is essential for ripping rebounds in traffic.',
    duration_minutes: 8,
    reps_or_sets: '5 sets × 30 seconds per hand',
    difficulty: 'Beginner',
    focus_area: 'Strength',
    equipment_needed: ['Grip Trainer or Stress Ball'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },

  /* ──────────── PASSING ────────────────────────────────────── */
  {
    id: 'pass-001',
    name: 'Two-Ball Chest Pass Wall Drill',
    description: 'Stand 8 feet from a wall and alternate chest passes with two basketballs simultaneously. Focus on snapping your wrists and following through with thumbs pointing down. This builds the quick, accurate chest-pass mechanics needed to hit cutters in traffic.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 30 seconds',
    difficulty: 'Beginner',
    focus_area: 'Passing',
    equipment_needed: ['2 Basketballs', 'Wall'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'chest_pass',
  },
  {
    id: 'pass-002',
    name: 'Bounce Pass Accuracy Targets',
    description: 'Place cones or markers at varying distances and practice bounce passes that hit the target zone two-thirds of the way to the receiver. Alternate between stationary and on-the-move passes. Develop the timing and angle to thread bounce passes past defenders into the post.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps per target',
    difficulty: 'Beginner',
    focus_area: 'Passing',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'bounce_pass',
  },
  {
    id: 'pass-003',
    name: 'Overhead Skip Pass Drill',
    description: 'Start on one wing and throw overhead skip passes to a partner or target on the opposite wing, clearing the imaginary help defender. Emphasize stepping into the pass with a high release point. This pass is essential for reversing the ball against zone defenses.',
    duration_minutes: 10,
    reps_or_sets: '3 sets × 12 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Passing',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'skip_pass',
  },
  {
    id: 'pass-004',
    name: 'No-Look Pass Progression',
    description: 'Work with a partner, starting with simple no-look chest passes and advancing to no-look bounce passes and wraparounds. Keep your eyes fixed on a designated spot while delivering the pass to a moving target. Mastering this skill freezes defenders and opens passing lanes in half-court sets.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per type',
    difficulty: 'Advanced',
    focus_area: 'Passing',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG'],
    anim_type: 'chest_pass',
  },
  {
    id: 'pass-005',
    name: 'Outlet Pass Full-Court Drill',
    description: 'Grab a rebound off the glass, pivot to the outside, and fire a two-hand overhead outlet pass to a partner sprinting up the sideline. Emphasize quickness from rebound to release and accuracy hitting the receiver in stride. This is the foundation of fast-break offense.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Passing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SF', 'PF', 'C'],
    anim_type: 'outlet_pass',
  },
  {
    id: 'pass-006',
    name: 'Pocket Pass Through Traffic',
    description: 'Set up two defenders (or chairs) in the lane and practice threading one-hand pocket passes to a partner cutting to the basket. Use a quick flick of the wrist while keeping the ball low and away from the defense. This is the go-to pass for guards feeding big men on pick-and-roll plays.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps',
    difficulty: 'Advanced',
    focus_area: 'Passing',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG'],
    anim_type: 'bounce_pass',
  },
  {
    id: 'pass-007',
    name: 'Wrap-Around Pass Series',
    description: 'Drive baseline and practice wrap-around passes to a teammate positioned on the block or short corner. Use a sweeping motion around the defender with one or two hands depending on distance. This technique punishes defenses that collapse on baseline drives.',
    duration_minutes: 10,
    reps_or_sets: '3 sets × 10 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Passing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'bounce_pass',
  },
  {
    id: 'pass-008',
    name: 'Baseball Pass Long Distance',
    description: 'Start under the basket and throw one-hand baseball passes to a partner at half court or beyond. Wind up with a crow-hop step for power and aim to hit the receiver in the chest area. Developing this pass turns defensive rebounds into instant fast-break scoring opportunities.',
    duration_minutes: 10,
    reps_or_sets: '3 sets × 10 reps per arm',
    difficulty: 'Intermediate',
    focus_area: 'Passing',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'outlet_pass',
  },
  {
    id: 'pass-009',
    name: 'Lob Pass to the Rim',
    description: 'Work with a partner on alley-oop style lob passes, aiming to place the ball near the top of the backboard square. The passer must read the cutter timing and deliver a soft, high-arcing pass. Start at half speed and progress to game-speed cuts and deliveries.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps',
    difficulty: 'Advanced',
    focus_area: 'Passing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG'],
    anim_type: 'chest_pass',
  },
  {
    id: 'pass-010',
    name: 'Touch Pass Rapid Fire',
    description: 'Form a triangle with two partners and redirect the ball immediately upon catching it without gathering — just a quick touch redirect. Keep the ball moving for 60-second rounds, progressively increasing speed. This develops the reflexes needed for quick ball movement in motion offenses.',
    duration_minutes: 10,
    reps_or_sets: '5 sets × 60 seconds',
    difficulty: 'Intermediate',
    focus_area: 'Passing',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'chest_pass',
  },
  {
    id: 'pass-011',
    name: 'One-Hand Push Pass Drill',
    description: 'Practice delivering quick one-hand push passes from the triple-threat position using both your left and right hand. Step toward the target and extend your arm fully with backspin. This is the fastest pass in close quarters and is critical for guards breaking down zone defenses.',
    duration_minutes: 10,
    reps_or_sets: '3 sets × 12 reps per hand',
    difficulty: 'Beginner',
    focus_area: 'Passing',
    equipment_needed: ['Basketball', 'Wall'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'chest_pass',
  },
  {
    id: 'pass-012',
    name: 'Post Entry Pass Workshop',
    description: 'Work on feeding the post from the wing and the top of the key against simulated denial defense. Use bounce passes, overhead lobs, and direct chest passes depending on defensive positioning. Reading the defender angle is the key to consistent post-entry success.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per angle',
    difficulty: 'Intermediate',
    focus_area: 'Passing',
    equipment_needed: ['Basketball', 'Hoop', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'bounce_pass',
  },
  {
    id: 'pass-013',
    name: 'Transition Passing 3-Man Weave',
    description: 'Run the classic three-man weave from baseline to baseline, passing and going behind the receiver each time. Focus on passing ahead of the runner and filling the correct lane. Execute finishing layups at each end to simulate real transition flow.',
    duration_minutes: 15,
    reps_or_sets: '6 sets full-court',
    difficulty: 'Beginner',
    focus_area: 'Passing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'fast_break',
  },
  {
    id: 'pass-014',
    name: 'Behind-the-Back Pass Mastery',
    description: 'Practice behind-the-back passes while stationary first, then while moving on the dribble-drive. Wrap the ball around your hip and snap it to the target with pace and accuracy. This flashy but effective pass is a weapon for creative guards in open-court situations.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Passing',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG'],
    anim_type: 'crossover',
  },
  {
    id: 'pass-015',
    name: 'Pressure Passing Circle Drill',
    description: 'Stand in a circle of four or more players with two defenders in the middle trying to deflect passes. The passers must use fakes, pivots, and a variety of pass types to move the ball without turnovers. Develops poise under pressure and pass-selection decision-making.',
    duration_minutes: 15,
    reps_or_sets: '5 rounds × 90 seconds',
    difficulty: 'Intermediate',
    focus_area: 'Passing',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'chest_pass',
  },

  /* ──────────── FOOTWORK ───────────────────────────────────── */
  {
    id: 'foot-001',
    name: 'Jab Step Triple Threat Series',
    description: 'From triple threat, execute a hard jab step right, reset, jab left, then jab-and-go to the basket. Focus on selling the jab with a short explosive step while keeping the pivot foot cemented. This series trains the reads that separate good scorers from great ones.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per direction',
    difficulty: 'Beginner',
    focus_area: 'Footwork',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'triple_threat',
  },
  {
    id: 'foot-002',
    name: 'Front and Reverse Pivot Drill',
    description: 'Catch the ball on the block and alternate between front pivots and reverse pivots to face the basket. Hold each pivot position for two seconds before executing a shot fake or power move. Proper pivoting protects the ball and creates space without dribbling.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 10 reps per pivot type',
    difficulty: 'Beginner',
    focus_area: 'Footwork',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'pivot_moves',
  },
  {
    id: 'foot-003',
    name: 'Drop Step Power Finish',
    description: 'Receive the ball on the low block, execute a drop step toward the baseline, and finish with a power layup or dunk. Seal the defender with your body and take one explosive dribble to the rim. The drop step is the most fundamental post move and a must for every big man.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Footwork',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PF', 'C', 'SF'],
    anim_type: 'drop_step',
  },
  {
    id: 'foot-004',
    name: 'Euro Step Footwork Progression',
    description: 'Start at the three-point line, drive to the lane, and execute a euro step around a cone defender — long first step left, quick gather step right, then finish at the rim. Gradually increase speed and add contact pads. The euro step is the modern guard finish that avoids shot blockers.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Footwork',
    equipment_needed: ['Basketball', 'Hoop', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'eurostep',
  },
  {
    id: 'foot-005',
    name: 'Triple Threat Decision Making',
    description: 'Catch the ball at the wing in triple threat and react to a coach or partner signal — jab and shoot, jab and drive, or jab and pass. Hold the triple threat for one second minimum before attacking. This teaches players to read the defense before committing to an action.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps',
    difficulty: 'Beginner',
    focus_area: 'Footwork',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'triple_threat',
  },
  {
    id: 'foot-006',
    name: 'Agility Ladder Quick Feet',
    description: 'Run through an agility ladder performing ickey shuffles, in-out hops, lateral crossovers, and single-leg bounds. Keep your hips low and arms pumping like a defensive stance. Ladder work builds the fast-twitch foot speed needed for both offense and defense.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 4 ladder patterns',
    difficulty: 'Beginner',
    focus_area: 'Footwork',
    equipment_needed: ['Agility Ladder'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'footwork_ladder',
  },
  {
    id: 'foot-007',
    name: 'Defensive Stance Footwork Gauntlet',
    description: 'Start in a defensive stance and react to directional commands — slide left, slide right, drop step, closeout, and sprint recover. Each round lasts 30 seconds at maximum intensity. This builds the foundational stance discipline that elite defenders maintain for entire possessions.',
    duration_minutes: 14,
    reps_or_sets: '5 sets × 30 seconds',
    difficulty: 'Intermediate',
    focus_area: 'Footwork',
    equipment_needed: ['Cones'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'lateral_shuffle',
  },
  {
    id: 'foot-008',
    name: 'Close-Out Footwork to Contest',
    description: 'Start at the free-throw line, sprint to close out on a shooter at the three-point line, break down with choppy steps the last three feet, then contest with a high hand without fouling. Repeat to multiple spots around the arc. Proper close-out technique prevents open threes.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps',
    difficulty: 'Intermediate',
    focus_area: 'Footwork',
    equipment_needed: ['Cones'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'closeout',
  },
  {
    id: 'foot-009',
    name: 'Post Seal and Positioning Footwork',
    description: 'Work on sealing the defender on the low block using your forearm and lower body to maintain position. Alternate between sealing baseline side and middle, then receive the entry pass and finish. Establishing deep post position with your feet is the first step to easy baskets inside.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Footwork',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PF', 'C'],
    anim_type: 'drop_step',
  },
  {
    id: 'foot-010',
    name: 'Jump Stop to Shot Drill',
    description: 'Drive toward the basket and execute a two-foot jump stop at different spots in the lane — elbow, block, and free-throw line. From the jump stop, square up and shoot or pass. The jump stop gives you a legal two-foot landing and the option to pivot either direction.',
    duration_minutes: 10,
    reps_or_sets: '3 sets × 10 reps per spot',
    difficulty: 'Beginner',
    focus_area: 'Footwork',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'pullup',
  },
  {
    id: 'foot-011',
    name: 'Hop Step Gather Finish',
    description: 'Attack the baseline off the dribble and execute a hop-step gather into a power finish on the opposite side of the rim. The hop step covers lateral distance and lands on two feet for balance through contact. This move is devastating against help defenders who slide over late.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Footwork',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'layup_finish',
  },
  {
    id: 'foot-012',
    name: 'Spin Move Footwork Breakdown',
    description: 'Walk through the spin move in three phases: plant the inside foot, reverse pivot 180 degrees while pulling the ball tight to your body, then explode off the pivot foot to finish. Progress from walking speed to full-game speed. A clean spin move requires perfect footwork or it becomes a travel.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per direction',
    difficulty: 'Advanced',
    focus_area: 'Footwork',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'pivot_moves',
  },
  {
    id: 'foot-013',
    name: 'Slide-and-Seal Wing Denial',
    description: 'Start at the high post and work on sliding to deny the wing entry pass while maintaining contact with the offensive player. If beaten, execute a quick recovery slide and re-establish denial position. Wing denial footwork disrupts offensive rhythm and forces teams out of their sets.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Footwork',
    equipment_needed: ['Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'lateral_shuffle',
  },
  {
    id: 'foot-014',
    name: 'Reverse Pivot Fadeaway Series',
    description: 'Catch at the mid-post area, execute a reverse pivot to create separation from the defender, and fire a fadeaway jumper. Practice from both the left and right block, alternating pivot feet. This is the signature move of legendary mid-range scorers and is nearly unguardable when perfected.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Footwork',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['SF', 'PF', 'C'],
    anim_type: 'post_fade',
  },
  {
    id: 'foot-015',
    name: 'V-Cut to Catch Footwork',
    description: 'Start on the wing, make a hard V-cut toward the basket then explode back to the perimeter to receive the pass with your feet already squared to the hoop. Focus on selling the initial cut with a change of pace and planting hard off the inside foot to change direction. This is the primary method guards and wings use to get open against man-to-man defense.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 10 reps per side',
    difficulty: 'Beginner',
    focus_area: 'Footwork',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'footwork_ladder',
  },

  /* ──────────── MORE SHOOTING ──────────────────────────────── */
  {
    id: 'shoot-026',
    name: 'Catch-and-Shoot Off Pin-Down Screens',
    description: 'Start on the low block, sprint off a pin-down screen set at the elbow, and catch-and-shoot at the three-point line. Alternate between curling tight and fading to the corner based on the screen angle. This is the bread-and-butter action for shooting guards in motion offenses.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 10 reps per action',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop', 'Cones'],
    positions: ['SG', 'SF'],
    anim_type: 'catch_shoot',
  },
  {
    id: 'shoot-027',
    name: 'Mikan Drill Extended Series',
    description: 'Perform the classic Mikan drill — alternating right-hand and left-hand layups without letting the ball hit the floor — then extend it to include baby hooks and reverse layups. Complete 30 consecutive makes per set. This drill builds touch, timing, and ambidextrous finishing around the rim.',
    duration_minutes: 12,
    reps_or_sets: '3 sets × 30 makes',
    difficulty: 'Beginner',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'layup_finish',
  },
  {
    id: 'shoot-028',
    name: 'Dribble Combo to Pull-Up Jumper',
    description: 'Start at half court and attack with a specific dribble combination — crossover, between-the-legs, or behind-the-back — then pull up for a mid-range jumper at the elbow. Rotate through different combos each set to build versatility. The pull-up jumper off live dribble moves is the most unstoppable shot in basketball.',
    duration_minutes: 15,
    reps_or_sets: '4 sets × 8 reps per combo',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'pullup',
  },
  {
    id: 'shoot-029',
    name: 'NBA Range Deep Threes',
    description: 'Set up 3 to 5 feet behind the three-point line and shoot from five spots around the arc. Focus on generating power from your legs while maintaining proper shooting form and a high release. Start with set shots, then progress to catching on the move. This trains the extended range that modern NBA offenses demand.',
    duration_minutes: 14,
    reps_or_sets: '5 sets × 8 reps per spot',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'spot_shoot',
  },
  {
    id: 'shoot-030',
    name: 'Contested Mid-Range Shooting',
    description: 'A partner or coach closes out as you catch the ball at the mid-range area. Shoot over the contest using a high release point and proper footwork to create separation. Alternate between pulling up, stepping back, and fading away. The contested mid-range shot is the ultimate playoff weapon.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 10 reps',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'pullup',
  },
  {
    id: 'shoot-031',
    name: 'Rhythm Shooting Transition 3s',
    description: 'Sprint from half court to a designated spot behind the arc, receive a pass, and immediately fire a three-pointer in rhythm without gathering extra dribbles. Rotate through all five spots and focus on getting your feet set during the sprint deceleration. This simulates catching-and-shooting in transition when the defense is scrambling.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps per spot',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'catch_shoot',
  },
  {
    id: 'shoot-032',
    name: 'One-Motion Shot Rebuild Drill',
    description: 'Break down your shot into a single fluid motion from the dip to the release, shooting from 8 feet and gradually moving back. Focus on eliminating any hitch or pause between the gather and the release. Film your form from the side to check for a continuous upward motion. A one-motion shot is faster and harder to contest.',
    duration_minutes: 15,
    reps_or_sets: '5 sets × 10 reps per distance',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'spot_shoot',
  },
  {
    id: 'shoot-033',
    name: 'Fadeaway Bank Shot Drill',
    description: 'Post up on the block, execute a fadeaway jump shot using the backboard from 8 to 12 feet. Aim for the top corner of the backboard square from each side. Focus on creating separation with the fade while maintaining balance on the follow-through. The bank shot fadeaway gives you a reliable two-point option in crunch time.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['SF', 'PF', 'C'],
    anim_type: 'post_fade',
  },
  {
    id: 'shoot-034',
    name: 'Corner Pocket Three Specialist',
    description: 'Station yourself in both corners and practice catching-and-shooting from the shortest three-point distance on the floor. Work on getting your toes behind the line, squaring your shoulders to the basket, and shooting in one motion. The corner three is the most efficient shot in basketball and the shot role players must master.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 12 reps per corner',
    difficulty: 'Beginner',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['SG', 'SF', 'PF'],
    anim_type: 'catch_shoot',
  },
  {
    id: 'shoot-035',
    name: 'Shot Fake to Pull-Up Jumper',
    description: 'Catch the ball at the three-point line, execute a convincing shot fake to get the defender airborne, take one dribble into the lane, and pull up for a mid-range jumper. The shot fake must include raising the ball with your eyes on the rim to sell it. This two-point conversion is the counter to aggressive close-outs.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps per spot',
    difficulty: 'Intermediate',
    focus_area: 'Shooting',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'pullup',
  },

  /* ──────────── MORE BALL HANDLING ─────────────────────────── */
  {
    id: 'bh-023',
    name: 'Tennis Ball Dribbling Challenge',
    description: 'Dribble a basketball with one hand while catching and tossing a tennis ball with the other. Start stationary, then progress to walking and jogging. This forces your eyes up off the ball and trains the hand-eye independence that elite ball handlers possess.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 60 seconds per hand',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Tennis Ball'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'dribble_series',
  },
  {
    id: 'bh-024',
    name: 'Figure-8 Dribble Drill',
    description: 'Dribble the ball in a figure-8 pattern through and around your legs as low to the ground as possible. Alternate between slow, controlled figure-8s and rapid-fire speed rounds. This builds handle control in tight spaces and strengthens the wrists and fingertips for precise dribbling.',
    duration_minutes: 8,
    reps_or_sets: '4 sets × 30 seconds per speed',
    difficulty: 'Beginner',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'dribble_series',
  },
  {
    id: 'bh-025',
    name: 'Spider Dribble Low Control',
    description: 'Get in a wide stance and tap the ball rapidly between your hands in front and behind you in a spider-like pattern — front right, front left, back right, back left. Stay as low as possible and increase speed each set. The spider dribble builds the finger-tip control and rhythm that makes crossovers lethal.',
    duration_minutes: 8,
    reps_or_sets: '4 sets × 30 seconds',
    difficulty: 'Beginner',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'dribble_series',
  },
  {
    id: 'bh-026',
    name: 'Dribble Tag Competition',
    description: 'In a confined space like the three-point arc, all players dribble while trying to knock away each others balls and protect their own. Last player dribbling wins. This chaotic drill develops ball protection, court awareness, and the ability to handle pressure in traffic.',
    duration_minutes: 12,
    reps_or_sets: '5 rounds × 90 seconds',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'dribble_series',
  },
  {
    id: 'bh-027',
    name: 'Combo Move Chain Sequences',
    description: 'String together three dribble moves in rapid succession — for example, crossover to between-the-legs to behind-the-back — then attack the basket. Practice 5 different three-move combos each set. Combo chains teach your body to flow between moves without hesitation in game situations.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 5 combos',
    difficulty: 'Advanced',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Hoop', 'Cones'],
    positions: ['PG', 'SG'],
    anim_type: 'crossover',
  },
  {
    id: 'bh-028',
    name: 'Game-Speed Dribble Attack',
    description: 'Set up five cones from half court to the rim representing defenders. Attack each cone with a game-speed move — crossover, hesitation, spin, etc. — and finish at the basket. Walk back and repeat with different move selections. Training at game speed is the only way to make your handle transfer to real competition.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 6 reps',
    difficulty: 'Advanced',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Hoop', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'crossover',
  },
  {
    id: 'bh-029',
    name: 'Weak Hand Emphasis Drill',
    description: 'Perform all dribbling drills — pound dribbles, crossovers, between-the-legs, behind-the-back — exclusively with your non-dominant hand for the entire session. Include full-court dribbling and finishing layups with the weak hand only. Eliminating your weak hand makes you twice as dangerous in any pick-and-roll situation.',
    duration_minutes: 15,
    reps_or_sets: '5 sets × 60 seconds per drill type',
    difficulty: 'Intermediate',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'dribble_series',
  },
  {
    id: 'bh-030',
    name: 'Between-Legs Behind-Back Combo',
    description: 'Start at the three-point line and execute a between-the-legs dribble immediately followed by a behind-the-back crossover in one fluid motion. Attack the basket after completing the combo. Practice both directions — left-to-right and right-to-left. This two-move combo creates massive separation when executed at speed.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per direction',
    difficulty: 'Advanced',
    focus_area: 'Ball Handling',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG'],
    anim_type: 'crossover',
  },

  /* ──────────── MORE DEFENSE ───────────────────────────────── */
  {
    id: 'def-018',
    name: 'Help-and-Recover Rotation Drill',
    description: 'Start in help-side defensive position, sprint to help on a baseline drive, then recover to your original man on the kick-out pass. Emphasize staying in a low stance throughout the rotation and closing out under control. This is the fundamental defensive rotation that prevents open corner threes.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-019',
    name: 'Defensive Rebounding Box-Out Drill',
    description: 'On a shot attempt, make contact with the offensive player, execute a reverse pivot to seal them behind you, then go pursue the rebound aggressively. Practice from all five positions around the lane. Boxing out is 90% effort and technique — the team that boxes out wins the rebounding battle.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps',
    difficulty: 'Beginner',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-020',
    name: 'Charge-Taking Drill',
    description: 'Set up in the restricted area and practice sliding into position to draw offensive fouls on driving players. Focus on getting your feet set, absorbing contact with your chest, and falling backward safely. Taking charges is the ultimate hustle play and can swing momentum in close games.',
    duration_minutes: 10,
    reps_or_sets: '3 sets × 8 reps',
    difficulty: 'Intermediate',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-021',
    name: 'Lane Denial and Fronting',
    description: 'Deny the entry pass to the low post by positioning your body between the ball and the offensive player with your arm in the passing lane. Practice maintaining denial position through movement and counter-moves. Lane denial forces teams to abandon their post-up game entirely.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['SF', 'PF', 'C'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-022',
    name: 'Post Defense Fundamentals',
    description: 'Work on defending the low post — three-quarter fronting, full fronting, and playing behind depending on help-side positioning. Absorb the post player push with a wide base and active hands. Switch between fronting techniques based on where the ball is on the perimeter. Post defense is a chess match that requires constant adjustment.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 8 reps per technique',
    difficulty: 'Advanced',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PF', 'C'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-023',
    name: 'Transition Defense Sprint-Back',
    description: 'After a simulated turnover or made shot, sprint back to the paint before the offensive player reaches half court, then find and pick up your man. Practice the sprint-stop-find sequence until it becomes automatic. The first three seconds of transition defense determine whether the opponent gets an easy bucket.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps',
    difficulty: 'Beginner',
    focus_area: 'Defense',
    equipment_needed: ['Basketball'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprint_drill',
  },
  {
    id: 'def-024',
    name: 'Defensive Communication Drill',
    description: 'Run a 4-on-4 shell defense and call out every screen, switch, and help rotation verbally before it happens. A coach awards points for correct and loud communication while penalizing silent possessions. Teams that talk on defense eliminate breakdowns before they happen.',
    duration_minutes: 15,
    reps_or_sets: '5 sets × 2 minutes',
    difficulty: 'Advanced',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'def-025',
    name: '3-on-3 Shell Defense',
    description: 'Three defenders guard three offensive players who pass and cut without dribbling. Defenders practice jumping to the ball on every pass, maintaining proper help-side position, and closing out on ball reversals. Shell defense is the foundation that every great defensive team is built on.',
    duration_minutes: 15,
    reps_or_sets: '5 sets × 2 minutes',
    difficulty: 'Intermediate',
    focus_area: 'Defense',
    equipment_needed: ['Basketball', 'Cones'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'defensive_slide',
  },

  /* ──────────── MORE FINISHING ─────────────────────────────── */
  {
    id: 'fin-020',
    name: 'Off-Hand Layup Mastery',
    description: 'Spend the entire drill finishing exclusively with your non-dominant hand from both sides of the basket. Include finger rolls, reverse layups, and power finishes. Start without defense, then add a passive defender for contest. Finishing with either hand doubles your scoring options and makes you unpredictable at the rim.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 10 reps per finish type',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'layup_finish',
  },
  {
    id: 'fin-021',
    name: 'Power Dunk Approach Training',
    description: 'Drive from the wing with two hard dribbles and explode off two feet for a power layup or dunk, absorbing contact from a pad holder. Focus on a strong gather step and an explosive vertical leap. Even if you cannot dunk, training the power approach builds the explosiveness for high-percentage finishes.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Advanced',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['SG', 'SF', 'PF'],
    anim_type: 'layup_finish',
  },
  {
    id: 'fin-022',
    name: 'Tip-In and Putback Drill',
    description: 'Toss the ball off the backboard repeatedly and practice tipping it back in with one hand at the apex of your jump. Progress from standing tip-ins to running approach putback layups. This drill develops the timing, hand-eye coordination, and second-jump quickness needed for offensive rebounding.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 10 reps per hand',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['SF', 'PF', 'C'],
    anim_type: 'layup_finish',
  },
  {
    id: 'fin-023',
    name: 'Putback Layup Drill',
    description: 'Have a partner shoot a missed shot on purpose while you crash the glass from the weak side and finish the putback layup in one fluid motion. Focus on reading the ball trajectory off the rim and timing your jump to arrive at the peak. Second-chance points are free offense that reward effort over talent.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps per side',
    difficulty: 'Intermediate',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['SF', 'PF', 'C'],
    anim_type: 'layup_finish',
  },
  {
    id: 'fin-024',
    name: 'Acrobatic Finish Package',
    description: 'Practice off-balance finishes including the runner from 10 feet, the scoop layup under shot blockers, the double-clutch layup, and the up-and-under move. Use a chair or cone as a simulated defender. These circus finishes are the difference-makers for small guards who cannot finish over length.',
    duration_minutes: 15,
    reps_or_sets: '4 sets × 6 reps per finish type',
    difficulty: 'Advanced',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop', 'Cones'],
    positions: ['PG', 'SG', 'SF'],
    anim_type: 'layup_finish',
  },
  {
    id: 'fin-025',
    name: 'And-1 Contact Finishing',
    description: 'Drive to the basket while a partner applies body contact with a pad during the finish attempt. Maintain focus on the rim and complete the layup through the bump, then practice landing balanced for the free throw. The best finishers in the league seek contact because it means free throws and three-point plays.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 8 reps',
    difficulty: 'Advanced',
    focus_area: 'Finishing',
    equipment_needed: ['Basketball', 'Hoop', 'Contact Pad'],
    positions: ['PG', 'SG', 'SF', 'PF'],
    anim_type: 'layup_finish',
  },

  /* ──────────── MORE CONDITIONING ──────────────────────────── */
  {
    id: 'cond-023',
    name: 'Full-Court Suicide Variations',
    description: 'Run suicides with a twist — sprint to the free-throw line and back, half court and back, far free-throw line and back, then full court and back. Between each suicide, perform 5 push-ups. This variation prevents the body from adapting and keeps conditioning gains progressing week after week.',
    duration_minutes: 15,
    reps_or_sets: '4 sets with 90-second rest',
    difficulty: 'Advanced',
    focus_area: 'Conditioning',
    equipment_needed: [],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-024',
    name: 'Defensive Shuffle Marathon',
    description: 'Stay in a defensive stance and shuffle side to side across the lane for 60 seconds without standing up. Rest 30 seconds and repeat. The burn in your quads and glutes is building the leg endurance needed to stay in your stance during crunch time of the fourth quarter.',
    duration_minutes: 12,
    reps_or_sets: '6 sets × 60 seconds on / 30 seconds off',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: [],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'defensive_slide',
  },
  {
    id: 'cond-025',
    name: 'Continuous Layup Sprint Circuit',
    description: 'Sprint from baseline to the opposite hoop for a layup, immediately sprint back for a layup on the other end. Continue without stopping for 90 seconds, alternating hands on each layup. This drill builds cardiovascular endurance while maintaining shooting touch under extreme fatigue.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 90 seconds',
    difficulty: 'Advanced',
    focus_area: 'Conditioning',
    equipment_needed: ['Basketball', 'Hoop'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'full_court_run',
  },
  {
    id: 'cond-026',
    name: 'Four Corners Conditioning',
    description: 'Place cones at each corner of the half court. Sprint to cone 1, defensive slide to cone 2, backpedal to cone 3, and sprint to cone 4. Complete 6 laps without rest, then take 60 seconds recovery. This mirrors the multi-directional movement demands of actual game play.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 6 laps',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['Cones'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprint_drill',
  },
  {
    id: 'cond-027',
    name: 'Baseline-to-Baseline 17s',
    description: 'Sprint sideline to sideline on the baseline, touching each line, and complete 17 touches in 60 seconds. Rest 60 seconds between sets. The 17s drill is a staple conditioning test used by college and professional basketball programs to measure fitness levels.',
    duration_minutes: 14,
    reps_or_sets: '5 sets of 17 touches in 60 seconds',
    difficulty: 'Advanced',
    focus_area: 'Conditioning',
    equipment_needed: [],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-028',
    name: 'Medicine Ball Slam Circuit',
    description: 'Perform overhead medicine ball slams for 30 seconds, immediately transition to rotational side slams for 30 seconds each side, then finish with chest-pass wall throws for 30 seconds. Rest 60 seconds and repeat. This circuit builds explosive power and cardiovascular capacity simultaneously.',
    duration_minutes: 14,
    reps_or_sets: '4 sets × 2-minute circuits',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['Medicine Ball', 'Wall'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'cond-029',
    name: 'Reaction Sprint Drill',
    description: 'Start in a defensive stance facing a partner who points in a random direction. Sprint 10 yards in the indicated direction, touch the ground, and sprint back to the start. The partner varies the intervals and directions unpredictably. This trains the reactive acceleration that matters more than straight-line speed in basketball.',
    duration_minutes: 12,
    reps_or_sets: '5 sets × 8 sprints',
    difficulty: 'Intermediate',
    focus_area: 'Conditioning',
    equipment_needed: ['Cones'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprint_drill',
  },
  {
    id: 'cond-030',
    name: 'Tempo Run Intervals',
    description: 'Jog the full court at 60% effort, then sprint back at 100% effort. Continue alternating for 8 minutes without stopping. This tempo contrast trains your body to recover while still moving — exactly what happens in a real game between dead balls when you cannot fully rest.',
    duration_minutes: 12,
    reps_or_sets: '1 set × 8 minutes continuous',
    difficulty: 'Beginner',
    focus_area: 'Conditioning',
    equipment_needed: [],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'full_court_run',
  },

  /* ──────────── MORE STRENGTH ──────────────────────────────── */
  {
    id: 'str-020',
    name: 'Farmer\'s Walk for Court Strength',
    description: 'Hold a heavy dumbbell or kettlebell in each hand and walk the length of the court and back with an upright posture and engaged core. Squeeze the handles as tightly as possible throughout the walk. This builds the grip strength, trap endurance, and core stability that translates directly to physical play in the paint.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × full-court and back',
    difficulty: 'Intermediate',
    focus_area: 'Strength',
    equipment_needed: ['Dumbbells or Kettlebells'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-021',
    name: 'Battle Rope Power Slams',
    description: 'Grab a battle rope in each hand and perform alternating waves, double slams, and lateral whips in 30-second intervals with 15 seconds rest. Keep your knees bent and core braced throughout. Battle ropes build the shoulder endurance and explosive arm power needed for aggressive rebounding and physical defense.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 3 exercises × 30 seconds',
    difficulty: 'Intermediate',
    focus_area: 'Strength',
    equipment_needed: ['Battle Ropes'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-022',
    name: 'TRX Suspension Row Series',
    description: 'Using TRX straps, perform inverted rows at three different angles — feet close for easier, feet far for harder. Add a single-arm variation to challenge core stability. Strong pulling muscles protect your shoulders and give you the strength to fight through screens and hold position in the post.',
    duration_minutes: 12,
    reps_or_sets: '3 sets × 12 reps per angle',
    difficulty: 'Beginner',
    focus_area: 'Strength',
    equipment_needed: ['TRX Straps'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-023',
    name: 'Box Step-Ups with Power Drive',
    description: 'Step onto an 18-to-24-inch box with one foot and drive the opposite knee explosively upward at the top. Lower under control and repeat. Add dumbbells for resistance as you progress. Box step-ups build the single-leg power that fuels explosive first steps and vertical jumping ability.',
    duration_minutes: 12,
    reps_or_sets: '4 sets × 10 reps per leg',
    difficulty: 'Intermediate',
    focus_area: 'Strength',
    equipment_needed: ['Plyo Box', 'Dumbbells'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-024',
    name: 'Landmine Press for Shoulder Power',
    description: 'Anchor one end of a barbell in a corner or landmine attachment. Press the free end overhead with one arm at a time using a split stance. The angled pressing motion is joint-friendly and develops the pushing power needed for creating space, posting up, and finishing through contact.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 8 reps per arm',
    difficulty: 'Intermediate',
    focus_area: 'Strength',
    equipment_needed: ['Barbell', 'Weight Plates'],
    positions: ['SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
  {
    id: 'str-025',
    name: 'Med Ball Rotational Throws',
    description: 'Stand perpendicular to a wall, load a medicine ball at your back hip, and explosively rotate your core to throw the ball against the wall. Catch and repeat, then switch sides. This rotational power directly transfers to passing velocity, shot-blocking reach, and the ability to finish through contact with body torque.',
    duration_minutes: 10,
    reps_or_sets: '4 sets × 10 reps per side',
    difficulty: 'Beginner',
    focus_area: 'Strength',
    equipment_needed: ['Medicine Ball', 'Wall'],
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    anim_type: 'sprints',
  },
];

/* ── Position Normalizer ────────────────────────────────────── */
const _POS_MAP = {
  'PG': 'PG', 'Point Guard': 'PG',
  'SG': 'SG', 'Shooting Guard': 'SG',
  'SF': 'SF', 'Small Forward': 'SF',
  'PF': 'PF', 'Power Forward': 'PF',
  'C':  'C',  'Center': 'C',
};

const _DIFF_ORDER = { Beginner: 1, Intermediate: 2, Advanced: 3 };

/* ── Focus Area icon map ────────────────────────────────────── */
const _FOCUS_ICONS = {
  'Shooting':     '🎯',
  'Ball Handling':'⚡',
  'Defense':      '🛡️',
  'Finishing':    '🏀',
  'Conditioning': '💪',
  'Strength':     '🏋️',
  'Passing':      '🎯',
  'Footwork':     '👟',
};

/* ── Internal state ─────────────────────────────────────────── */
let _currentDrills = [];  // drills currently shown
let _animsLoaded   = false;
let _libFocusFilter = 'All';
let _libDiffFilter  = 'All';
let _currentMode    = 'generator';

/* ── localStorage helpers ───────────────────────────────────── */
const _LS_KEY = 'courtiq_saved_drills';

function _getSaved() {
  try { return JSON.parse(localStorage.getItem(_LS_KEY) || '[]'); }
  catch { return []; }
}

function _isSaved(id) {
  return _getSaved().some(d => d.id === id);
}

function _saveDrill(drill) {
  const list = _getSaved();
  if (list.some(d => d.id === drill.id)) return false;
  list.push({ ...drill, saved_at: new Date().toISOString() });
  localStorage.setItem(_LS_KEY, JSON.stringify(list));
  return true;
}

function _removeSaved(id) {
  const list = _getSaved().filter(d => d.id !== id);
  localStorage.setItem(_LS_KEY, JSON.stringify(list));
}

/* ── Toast helper (reuse existing showToast if available) ────── */
function _toast(msg) {
  if (typeof showToast === 'function') { showToast(msg); return; }
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

/* ── generateDrills ─────────────────────────────────────────── */
function drillsGenerate() {
  const posRaw   = document.getElementById('drill-position').value;
  const skill    = document.getElementById('drill-skill').value;
  const goal     = document.getElementById('drill-goal').value;
  const posCode  = _POS_MAP[posRaw] || 'PG';

  // Show loading
  document.getElementById('drills-empty').style.display   = 'none';
  document.getElementById('drills-results').style.display = 'none';
  document.getElementById('drills-loading').style.display = 'block';

  // Simulate a brief generation delay for UX
  setTimeout(() => {
    const drills = _generate(posCode, skill, goal);
    _currentDrills = drills;
    _renderResults(drills, posRaw, skill, goal);

    document.getElementById('drills-loading').style.display  = 'none';
    document.getElementById('drills-results').style.display  = 'block';

    // Lazy-load animations after results are visible
    requestAnimationFrame(() => _initAnimations(drills));
  }, 620);
}

function _generate(posCode, skillLevel, primaryGoal) {
  const targetDiff = _DIFF_ORDER[skillLevel] || 2;

  // Filter: match goal and position
  let pool = _DRILLS_DB.filter(d =>
    d.focus_area === primaryGoal && d.positions.includes(posCode)
  );

  // Relax position if not enough drills
  if (pool.length < 3) {
    pool = _DRILLS_DB.filter(d => d.focus_area === primaryGoal);
  }

  // Sort by difficulty proximity
  pool = pool.slice().sort((a, b) => {
    const da = Math.abs(_DIFF_ORDER[a.difficulty] - targetDiff);
    const db = Math.abs(_DIFF_ORDER[b.difficulty] - targetDiff);
    return da - db;
  });

  return pool.slice(0, 4);
}

/* ── Render results ─────────────────────────────────────────── */
function _renderResults(drills, posRaw, skill, goal) {
  const grid = document.getElementById('drills-grid');
  grid.innerHTML = '';

  // Update header meta
  const icon = _FOCUS_ICONS[goal] || '🏀';
  document.getElementById('drills-results-title').textContent =
    `${icon} ${goal} — ${posRaw}`;
  document.getElementById('drills-results-meta').textContent =
    `${drills.length} drills generated · ${skill} level`;

  drills.forEach((drill, idx) => {
    grid.insertAdjacentHTML('beforeend', _buildCard(drill, idx));
  });

  // Render saved section
  _renderSaved();
}

/* ── Card HTML builder ──────────────────────────────────────── */
function _buildCard(drill, idx) {
  const saved      = _isSaved(drill.id);
  const diffClass  = drill.difficulty.toLowerCase();
  const focusClass = drill.focus_area.toLowerCase().replace(' ', '-');
  const icon       = _FOCUS_ICONS[drill.focus_area] || '🏀';
  const equipment  = drill.equipment_needed
    .map(e => `<span class="drill-equipment-tag">⚙ ${e}</span>`)
    .join('');

  const saveLbl  = saved ? '✓ Saved' : '+ Save to Plan';
  const saveClass = saved ? 'drill-save-btn saved' : 'drill-save-btn';

  return `
<article class="drill-card" id="drill-card-${drill.id}" data-drill-id="${drill.id}">
  <div class="drill-anim-wrap">
    <canvas
      class="drill-anim-canvas"
      id="drill-canvas-${drill.id}"
      width="${DrillAnimations.CW}"
      height="${DrillAnimations.CH}"
      aria-label="${drill.name} animation preview"
      title="Hover to pause animation"
    ></canvas>
    <div class="drill-anim-pause-hint">HOVER TO PAUSE</div>
    <div class="drill-anim-pause-badge">⏸ PAUSED</div>
  </div>

  <div class="drill-card-body">
    <div class="drill-focus-tag ${focusClass}">${icon} ${drill.focus_area}</div>
    <div class="drill-card-top">
      <div class="drill-card-name">${drill.name}</div>
      <span class="drill-difficulty-badge ${diffClass}">${drill.difficulty}</span>
    </div>
    <p class="drill-card-desc">${drill.description}</p>
    <div class="drill-quick-stats">
      <div class="drill-stat">
        <span class="drill-stat-icon">⏱</span>
        <span class="drill-stat-val">${drill.duration_minutes} min</span>
      </div>
      <div class="drill-stat">
        <span class="drill-stat-icon">🔁</span>
        <span class="drill-stat-val">${drill.reps_or_sets}</span>
      </div>
    </div>
  </div>

  <div class="drill-card-actions">
    <button
      class="${saveClass}"
      id="drill-save-btn-${drill.id}"
      onclick="drillToggleSave('${drill.id}')"
      aria-label="${saved ? 'Saved to plan' : 'Save drill to my plan'}"
    >${saveLbl}</button>
    <button
      class="drill-expand-btn"
      id="drill-expand-btn-${drill.id}"
      onclick="drillToggleExpand('${drill.id}')"
      aria-expanded="false"
      aria-controls="drill-detail-${drill.id}"
    >Details <i class="drill-expand-arrow">▾</i></button>
  </div>

  <div class="drill-detail-panel" id="drill-detail-${drill.id}" role="region" aria-label="${drill.name} details">
    <div class="drill-detail-row">
      <div class="drill-detail-item">
        <span class="drill-detail-label">Duration</span>
        <span class="drill-detail-value">${drill.duration_minutes} minutes</span>
      </div>
      <div class="drill-detail-item">
        <span class="drill-detail-label">Sets / Reps</span>
        <span class="drill-detail-value">${drill.reps_or_sets}</span>
      </div>
      <div class="drill-detail-item">
        <span class="drill-detail-label">Difficulty</span>
        <span class="drill-detail-value">${drill.difficulty}</span>
      </div>
      <div class="drill-detail-item">
        <span class="drill-detail-label">Focus Area</span>
        <span class="drill-detail-value">${drill.focus_area}</span>
      </div>
    </div>
    <div>
      <span class="drill-detail-label" style="display:block;margin-bottom:8px;">Equipment Needed</span>
      <div class="drill-equipment-list">${equipment}</div>
    </div>
  </div>
</article>`;
}

/* ── Lazy-init animations ───────────────────────────────────── */
function _initAnimations(drills) {
  drills.forEach(drill => {
    const canvas = document.getElementById(`drill-canvas-${drill.id}`);
    if (canvas) {
      DrillAnimations.createAnimation(canvas, drill.anim_type);
    }
  });
}

/* ── Expand / Collapse detail panel ─────────────────────────── */
function drillToggleExpand(drillId) {
  const panel = document.getElementById(`drill-detail-${drillId}`);
  const btn   = document.getElementById(`drill-expand-btn-${drillId}`);
  if (!panel || !btn) return;

  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  btn.classList.toggle('open', !isOpen);
  btn.setAttribute('aria-expanded', String(!isOpen));
  btn.querySelector('.drill-expand-arrow').textContent = isOpen ? '▾' : '▴';
}

/* ── Save / Unsave drill ─────────────────────────────────────── */
function drillToggleSave(drillId) {
  const drill  = _currentDrills.find(d => d.id === drillId)
              || _DRILLS_DB.find(d => d.id === drillId)
              || _getSaved().find(d => d.id === drillId);
  if (!drill) return;

  // Collect all save buttons for this drill (generator + library views)
  const btns = document.querySelectorAll(`[id="drill-save-btn-${drillId}"], [data-save-id="${drillId}"]`);

  if (_isSaved(drillId)) {
    _removeSaved(drillId);
    btns.forEach(btn => {
      // Handle both old-style and new-style save buttons
      if (btn.classList.contains('drill-lib-save-btn')) {
        btn.textContent = '♡';
        btn.className   = 'drill-lib-save-btn';
      } else {
        btn.textContent = '+ Save to Plan';
        btn.className   = 'drill-save-btn';
      }
    });
    _toast('Drill removed from your plan.');
  } else {
    const added = _saveDrill(drill);
    if (added) {
      btns.forEach(btn => {
        if (btn.classList.contains('drill-lib-save-btn') || btn.classList.contains('drill-lib-save-btn')) {
          btn.textContent = '✓';
          btn.className   = 'drill-lib-save-btn saved';
        } else {
          btn.textContent = '✓ Saved';
          btn.className   = 'drill-save-btn saved';
        }
      });
      _toast('Drill saved to your plan!');
    }
  }

  // Refresh all saved panels
  _renderSaved();
  _renderPreloadSaved(_getSaved());
  _renderPlanView();

  // Update plan mode badge count
  const planCountEl = document.getElementById('drills-plan-count');
  if (planCountEl) {
    const c = _getSaved().length;
    planCountEl.textContent = `${c} drill${c !== 1 ? 's' : ''} saved`;
  }
}

/* ── Render Saved Drills section ────────────────────────────── */
function _renderSaved() {
  const list    = _getSaved();
  const section = document.getElementById('drills-saved-section');
  const count   = document.getElementById('drills-saved-count');
  const ul      = document.getElementById('drills-saved-list');
  if (!section || !ul) return;

  count.textContent = `${list.length} drill${list.length !== 1 ? 's' : ''} saved`;

  if (list.length === 0) {
    ul.innerHTML = '<div class="saved-drills-empty">No drills saved yet. Hit <strong>+ Save to Plan</strong> on any drill above.</div>';
    return;
  }

  ul.innerHTML = list.map(drill => {
    const icon = _FOCUS_ICONS[drill.focus_area] || '🏀';
    const savedDate = new Date(drill.saved_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
    return `
<div class="saved-drill-row" id="saved-row-${drill.id}">
  <div class="saved-drill-icon">${icon}</div>
  <div class="saved-drill-info">
    <div class="saved-drill-name">${drill.name}</div>
    <div class="saved-drill-meta">${drill.focus_area} · ${drill.difficulty} · ${drill.duration_minutes} min · Saved ${savedDate}</div>
  </div>
  <button class="saved-drill-remove-btn" onclick="drillRemoveFromPlan('${drill.id}')">Remove</button>
</div>`;
  }).join('');
}

/* ── Remove from saved plan ─────────────────────────────────── */
function drillRemoveFromPlan(drillId) {
  _removeSaved(drillId);

  // Update all save buttons for this drill across all views
  const btns = document.querySelectorAll(`[id="drill-save-btn-${drillId}"], [data-save-id="${drillId}"]`);
  btns.forEach(btn => {
    if (btn.classList.contains('drill-lib-save-btn')) {
      btn.textContent = '♡';
      btn.className   = 'drill-lib-save-btn';
    } else {
      btn.textContent = '+ Save to Plan';
      btn.className   = 'drill-save-btn';
    }
  });

  // Refresh all saved panels
  _renderSaved();
  const remaining = _getSaved();
  _renderPreloadSaved(remaining);
  _renderPlanView();

  _toast('Drill removed from your plan.');
}

/* ── Clear all saved drills ─────────────────────────────────── */
function drillsClearAll() {
  if (!confirm('Remove all saved drills from your plan?')) return;
  localStorage.removeItem(_LS_KEY);

  // Refresh all saved panels
  _renderSaved();
  _renderPreloadSaved([]);
  _renderPlanView();

  // Reset all save buttons across all views
  document.querySelectorAll('.drill-save-btn.saved').forEach(btn => {
    btn.textContent = '+ Save to Plan';
    btn.className   = 'drill-save-btn';
  });
  document.querySelectorAll('.drill-lib-save-btn.saved').forEach(btn => {
    btn.textContent = '♡';
    btn.className   = 'drill-lib-save-btn';
  });

  _toast('All saved drills cleared.');
}

/* ── Init: called once when the Drills tab is first opened ───── */
function drillsInit() {
  if (_animsLoaded) return; // already initialised
  _animsLoaded = true;

  // Show previously saved drills even before user generates new ones
  const saved = _getSaved();
  if (saved.length > 0) {
    const section = document.getElementById('drills-preload-saved');
    if (section) {
      section.style.display = 'block';
      _renderPreloadSaved(saved);
    }
  }

  // Check if AI Coach has results and show the suggestion banner
  _checkCoachSuggestions();
}

/* ── Render saved drills in the pre-generation area ─────────── */
function _renderPreloadSaved(list) {
  const count = document.getElementById('drills-preload-count');
  const ul    = document.getElementById('drills-preload-list');
  if (!count || !ul) return;

  count.textContent = `${list.length} drill${list.length !== 1 ? 's' : ''} saved`;

  if (list.length === 0) {
    const section = document.getElementById('drills-preload-saved');
    if (section) section.style.display = 'none';
    return;
  }

  ul.innerHTML = list.map(drill => {
    const icon      = _FOCUS_ICONS[drill.focus_area] || '🏀';
    const savedDate = new Date(drill.saved_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
    return `
<div class="saved-drill-row" id="preload-row-${drill.id}">
  <div class="saved-drill-icon">${icon}</div>
  <div class="saved-drill-info">
    <div class="saved-drill-name">${drill.name}</div>
    <div class="saved-drill-meta">${drill.focus_area} · ${drill.difficulty} · ${drill.duration_minutes} min · Saved ${savedDate}</div>
  </div>
  <button class="saved-drill-remove-btn" onclick="drillRemoveFromPlan('${drill.id}')">Remove</button>
</div>`;
  }).join('');
}

/* ── Tab switch hook: DrillAnimations cleanup when leaving ───── */
function drillsOnTabLeave() {
  if (typeof DrillAnimations !== 'undefined') {
    DrillAnimations.stopAll();
  }
}

/* ══════════════════════════════════════════════════════════════
   MODE SWITCHING — Generator / Library / My Plan
   ══════════════════════════════════════════════════════════════ */
function drillsShowMode(mode) {
  _currentMode = mode;

  // Update mode buttons
  document.querySelectorAll('.drills-mode-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('drills-mode-' + mode);
  if (btn) btn.classList.add('active');

  // Toggle views
  const views = { generator: 'drills-view-generator', library: 'drills-view-library', plan: 'drills-view-plan' };
  Object.entries(views).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = key === mode ? '' : 'none';
  });

  // Stop animations when leaving generator
  if (mode !== 'generator' && typeof DrillAnimations !== 'undefined') {
    DrillAnimations.stopAll();
  }

  // Render library on first open
  if (mode === 'library') {
    _renderLibrary();
  }

  // Render plan view
  if (mode === 'plan') {
    _renderPlanView();
  }
}

/* ══════════════════════════════════════════════════════════════
   DRILL LIBRARY — Browse, Filter, Search all 33 drills
   ══════════════════════════════════════════════════════════════ */

function drillsSetFocusFilter(value, btn) {
  _libFocusFilter = value;
  // Update active pill
  btn.parentElement.querySelectorAll('.drills-filter-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  _renderLibrary();
}

function drillsSetDiffFilter(value, btn) {
  _libDiffFilter = value;
  btn.parentElement.querySelectorAll('.drills-filter-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  _renderLibrary();
}

function drillsFilterLibrary() {
  _renderLibrary();
}

function _renderLibrary() {
  const grid = document.getElementById('drills-library-grid');
  if (!grid) return;

  const search = (document.getElementById('drills-lib-search')?.value || '').toLowerCase().trim();

  // Filter
  let pool = _DRILLS_DB.filter(d => {
    if (_libFocusFilter !== 'All' && d.focus_area !== _libFocusFilter) return false;
    if (_libDiffFilter !== 'All' && d.difficulty !== _libDiffFilter) return false;
    if (search && !d.name.toLowerCase().includes(search) && !d.description.toLowerCase().includes(search) && !d.focus_area.toLowerCase().includes(search)) return false;
    return true;
  });

  // Update count
  const countEl = document.getElementById('drills-lib-count');
  const infoEl  = document.getElementById('drills-lib-filter-info');
  if (countEl) countEl.textContent = `${pool.length} drill${pool.length !== 1 ? 's' : ''}`;
  if (infoEl) {
    const parts = [];
    if (_libFocusFilter !== 'All') parts.push(_libFocusFilter);
    if (_libDiffFilter !== 'All') parts.push(_libDiffFilter);
    if (search) parts.push(`"${search}"`);
    infoEl.textContent = parts.length > 0 ? `Filtered: ${parts.join(' · ')}` : 'Showing all';
  }

  // Render cards
  grid.innerHTML = pool.length === 0
    ? '<div class="drills-library-empty">No drills match your filters. Try broadening your search.</div>'
    : pool.map(drill => _buildLibraryCard(drill)).join('');
}

/* ── Focus-area color map for icon backgrounds ──────────────── */
const _FOCUS_COLORS = {
  'Shooting':      { bg: 'rgba(76,163,255,0.12)',  color: '#4ca3ff' },
  'Ball Handling':  { bg: 'rgba(245,166,35,0.12)',  color: '#f5a623' },
  'Defense':        { bg: 'rgba(232,64,64,0.12)',   color: '#e84040' },
  'Finishing':      { bg: 'rgba(168,100,255,0.12)', color: '#a864ff' },
  'Conditioning':   { bg: 'rgba(86,211,100,0.12)',  color: '#56d364' },
  'Strength':       { bg: 'rgba(255,107,107,0.12)', color: '#ff6b6b' },
  'Passing':        { bg: 'rgba(0,200,180,0.12)',   color: '#00c8b4' },
  'Footwork':       { bg: 'rgba(255,183,77,0.12)',  color: '#ffb74d' },
};

function _buildLibraryCard(drill) {
  const saved      = _isSaved(drill.id);
  const diffClass  = drill.difficulty.toLowerCase();
  const focusClass = drill.focus_area.toLowerCase().replace(' ', '-');
  const icon       = _FOCUS_ICONS[drill.focus_area] || '🏀';
  const colors     = _FOCUS_COLORS[drill.focus_area] || { bg: 'rgba(245,166,35,0.12)', color: '#f5a623' };
  const saveLbl    = saved ? '✓' : '♡';
  const saveClass  = saved ? 'drill-lib-save-btn saved' : 'drill-lib-save-btn';

  return `
<div class="drill-lib-accordion" data-drill-id="${drill.id}">
  <div class="drill-lib-row" onclick="drillLibToggleExpand('${drill.id}')">
    <div class="drill-lib-row-icon focus-${focusClass}">${icon}</div>
    <div class="drill-lib-row-name">${drill.name}</div>
    <span class="drill-lib-row-focus">${drill.focus_area}</span>
    <span class="drill-difficulty-badge ${diffClass}">${drill.difficulty}</span>
    <span class="drill-lib-row-dur">⏱ ${drill.duration_minutes}m</span>
    <span class="drill-lib-row-chevron">›</span>
  </div>
  <div class="drill-lib-body">
    <p class="drill-lib-body-desc">${drill.description}</p>
    <div class="drill-lib-body-meta">
      <span>🔁 ${drill.reps_or_sets}</span>
      <span>⏱ ${drill.duration_minutes} min</span>
      <span class="drill-difficulty-badge ${diffClass}">${drill.difficulty}</span>
    </div>
    <div class="drill-lib-body-actions">
      <button class="drill-lib-start-btn" onclick="event.stopPropagation();drillWorkoutOpen('${drill.id}')">▶ Start Drill</button>
      <button class="${saveClass}" data-save-id="${drill.id}" onclick="event.stopPropagation();drillToggleSave('${drill.id}')" aria-label="${saved ? 'Saved' : 'Save to plan'}">${saveLbl} ${saved ? 'Saved' : 'Save'}</button>
    </div>
  </div>
</div>`;
}

function drillLibToggleExpand(drillId) {
  const el = document.querySelector('.drill-lib-accordion[data-drill-id="' + drillId + '"]');
  if (!el) return;
  const isOpen = el.classList.contains('open');
  // Close all others
  document.querySelectorAll('.drill-lib-accordion.open').forEach(function(a) {
    a.classList.remove('open');
  });
  if (!isOpen) el.classList.add('open');
}

/* ══════════════════════════════════════════════════════════════
   MY PLAN VIEW — Full plan with stats + calendar export
   ══════════════════════════════════════════════════════════════ */

function _renderPlanView() {
  const list   = _getSaved();
  const countEl = document.getElementById('drills-plan-count');
  const statsEl = document.getElementById('drills-plan-stats');
  const listEl  = document.getElementById('drills-plan-list');
  if (!listEl) return;

  if (countEl) countEl.textContent = `${list.length} drill${list.length !== 1 ? 's' : ''} saved`;

  // Render stats summary
  if (statsEl) {
    if (list.length === 0) {
      statsEl.innerHTML = '';
    } else {
      const totalTime = list.reduce((s, d) => s + d.duration_minutes, 0);
      const focusCounts = {};
      list.forEach(d => { focusCounts[d.focus_area] = (focusCounts[d.focus_area] || 0) + 1; });
      const diffCounts = {};
      list.forEach(d => { diffCounts[d.difficulty] = (diffCounts[d.difficulty] || 0) + 1; });

      statsEl.innerHTML = `
        <div class="drills-plan-stat-card">
          <div class="drills-plan-stat-val">${list.length}</div>
          <div class="drills-plan-stat-label">Total Drills</div>
        </div>
        <div class="drills-plan-stat-card">
          <div class="drills-plan-stat-val">${totalTime} min</div>
          <div class="drills-plan-stat-label">Total Duration</div>
        </div>
        <div class="drills-plan-stat-card">
          <div class="drills-plan-stat-val">${Object.keys(focusCounts).length}</div>
          <div class="drills-plan-stat-label">Focus Areas</div>
        </div>
        <div class="drills-plan-stat-card">
          <div class="drills-plan-stat-val">${Object.entries(focusCounts).map(([k,v]) => `${_FOCUS_ICONS[k] || ''} ${v}`).join(', ')}</div>
          <div class="drills-plan-stat-label">Breakdown</div>
        </div>`;
    }
  }

  // Render drill list
  if (list.length === 0) {
    listEl.innerHTML = '<div class="saved-drills-empty">No drills saved yet. Generate drills or browse the library to add drills to your plan.</div>';
    return;
  }

  listEl.innerHTML = list.map(drill => {
    const icon = _FOCUS_ICONS[drill.focus_area] || '🏀';
    const savedDate = drill.saved_at ? new Date(drill.saved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const diffClass = drill.difficulty.toLowerCase();
    return `
<div class="saved-drill-row plan-row" id="plan-row-${drill.id}">
  <div class="saved-drill-icon">${icon}</div>
  <div class="saved-drill-info">
    <div class="saved-drill-name">${drill.name}</div>
    <div class="saved-drill-meta">
      ${drill.focus_area} · <span class="drill-difficulty-badge ${diffClass}" style="font-size:9px;padding:1px 6px;">${drill.difficulty}</span>
      · ${drill.duration_minutes} min · ${drill.reps_or_sets}
      ${savedDate ? ` · Saved ${savedDate}` : ''}
    </div>
  </div>
  <button class="plan-row-start-btn" onclick="drillWorkoutOpen('${drill.id}')">Start</button>
  <button class="saved-drill-remove-btn" onclick="drillRemoveFromPlan('${drill.id}')">Remove</button>
</div>`;
  }).join('');
}

/* ── Send saved drills to Weekly Calendar ─────────────────────── */
function drillsSendToCalendar() {
  const saved = _getSaved();
  if (saved.length === 0) {
    _toast('No drills saved to send to calendar.');
    return;
  }

  // Group drills into days (distribute evenly across Mon-Sat)
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const days = dayNames.map(day => ({ day, focus: '', drills: [], total_minutes: 0 }));

  saved.forEach((drill, i) => {
    const dayIdx = i % dayNames.length;
    days[dayIdx].drills.push({
      name: drill.name,
      focus_area: drill.focus_area,
      duration_minutes: drill.duration_minutes,
      reps_or_sets: drill.reps_or_sets,
      difficulty: drill.difficulty,
    });
    days[dayIdx].total_minutes += drill.duration_minutes;
  });

  // Set focus label for each day
  days.forEach(d => {
    if (d.drills.length > 0) {
      const focuses = [...new Set(d.drills.map(dr => dr.focus_area))];
      d.focus = focuses.join(' + ');
    }
  });

  // Remove empty days
  const activeDays = days.filter(d => d.drills.length > 0);

  const calendarJSON = {
    week: 'Drill Plan Week',
    generated_from: 'Personalized Drills Engine',
    days: activeDays,
  };

  // Try to populate the calendar tab's paste input
  const calInput = document.getElementById('cal-json-input');
  const calSrcPaste = document.getElementById('cal-src-paste');
  if (calInput) {
    calInput.value = JSON.stringify(calendarJSON, null, 2);
    // Switch calendar to paste mode
    if (typeof calSetSource === 'function' && calSrcPaste) {
      calSetSource('paste', calSrcPaste);
    }
  }

  // Switch to calendar tab
  const calTab = document.querySelector('.db-tab[onclick*="calendar"]');
  if (calTab && typeof dbSwitchTab === 'function') {
    dbSwitchTab('calendar', calTab);
    _toast('Drill plan loaded into Calendar! Hit "Build Calendar" to view.');
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard?.writeText(JSON.stringify(calendarJSON, null, 2));
    _toast('Drill plan JSON copied to clipboard!');
  }
}

/* ── Export saved plan as JSON ─────────────────────────────────── */
function drillsExportPlan() {
  const saved = _getSaved();
  if (saved.length === 0) {
    _toast('No drills to export.');
    return;
  }

  const exportData = {
    plan_name: 'CourtIQ Drill Plan',
    exported_at: new Date().toISOString(),
    total_drills: saved.length,
    total_minutes: saved.reduce((s, d) => s + d.duration_minutes, 0),
    drills: saved.map(d => ({
      id: d.id,
      name: d.name,
      focus_area: d.focus_area,
      difficulty: d.difficulty,
      duration_minutes: d.duration_minutes,
      reps_or_sets: d.reps_or_sets,
      equipment_needed: d.equipment_needed,
    })),
  };

  navigator.clipboard?.writeText(JSON.stringify(exportData, null, 2));
  _toast('Drill plan JSON copied to clipboard!');
}

/* ══════════════════════════════════════════════════════════════
   AI COACH INTEGRATION — Suggest drills from coach output
   ══════════════════════════════════════════════════════════════ */

function _checkCoachSuggestions() {
  // Look for AI Coach results (stored in global coachResult or dbResult)
  const coachData = window.coachResult || null;
  const aiResult  = window.dbResult || (typeof dbResult !== 'undefined' ? dbResult : null);
  const banner    = document.getElementById('drills-coach-banner');
  if (!banner) return;

  let weakAreas = [];

  // Check for AI Coach adjusted schedule result
  if (coachData && coachData.weak_areas) {
    weakAreas = coachData.weak_areas;
  }
  // Check for AI Summary focus areas
  else if (aiResult && aiResult.feedback && aiResult.feedback.focus_areas) {
    weakAreas = aiResult.feedback.focus_areas;
  }

  if (weakAreas.length > 0) {
    banner.style.display = 'flex';
    const textEl = document.getElementById('drills-coach-banner-text');
    if (textEl) {
      textEl.textContent = `Focus areas: ${weakAreas.slice(0, 3).join(', ')}. Load matching drills?`;
    }
    // Store for later use
    window._coachWeakAreas = weakAreas;
  }
}

function drillsLoadCoachSuggestions() {
  const weakAreas = window._coachWeakAreas || [];
  if (weakAreas.length === 0) {
    _toast('No coach suggestions available.');
    return;
  }

  // Map weak areas to focus areas in our DB
  const focusMapping = {
    'shooting': 'Shooting', 'shot': 'Shooting', '3-point': 'Shooting', 'free throw': 'Shooting',
    'ball handling': 'Ball Handling', 'dribbling': 'Ball Handling', 'handles': 'Ball Handling', 'crossover': 'Ball Handling',
    'defense': 'Defense', 'defensive': 'Defense', 'closeout': 'Defense', 'lateral': 'Defense',
    'finishing': 'Finishing', 'layup': 'Finishing', 'rim': 'Finishing', 'contact': 'Finishing',
    'conditioning': 'Conditioning', 'endurance': 'Conditioning', 'speed': 'Conditioning', 'agility': 'Conditioning',
    'vertical': 'Conditioning', 'sprint': 'Conditioning', 'athleticism': 'Conditioning',
    'strength': 'Strength', 'muscle': 'Strength', 'weight': 'Strength', 'power': 'Strength',
    'core': 'Strength', 'legs': 'Strength', 'upper body': 'Strength',
  };

  const matchedFocuses = new Set();
  weakAreas.forEach(area => {
    const lower = area.toLowerCase();
    Object.entries(focusMapping).forEach(([keyword, focus]) => {
      if (lower.includes(keyword)) matchedFocuses.add(focus);
    });
  });

  // If no specific matches, default to first two focus areas
  if (matchedFocuses.size === 0) {
    matchedFocuses.add('Shooting');
    matchedFocuses.add('Conditioning');
  }

  // Get position from the selector
  const posCode = document.getElementById('drill-position')?.value || 'PG';
  const skill   = document.getElementById('drill-skill')?.value || 'Intermediate';

  // Generate drills matching weak areas
  let pool = _DRILLS_DB.filter(d =>
    matchedFocuses.has(d.focus_area) && d.positions.includes(posCode)
  );

  // Sort by difficulty proximity
  const targetDiff = _DIFF_ORDER[skill] || 2;
  pool.sort((a, b) => {
    const da = Math.abs(_DIFF_ORDER[a.difficulty] - targetDiff);
    const db = Math.abs(_DIFF_ORDER[b.difficulty] - targetDiff);
    return da - db;
  });

  const drills = pool.slice(0, 4);
  if (drills.length === 0) {
    _toast('No matching drills found for coach suggestions.');
    return;
  }

  _currentDrills = drills;
  const focusList = [...matchedFocuses].join(' + ');
  _renderResults(drills, posCode, skill, focusList);

  document.getElementById('drills-empty').style.display   = 'none';
  document.getElementById('drills-results').style.display  = 'block';
  document.getElementById('drills-loading').style.display  = 'none';

  // Update header to indicate coach-suggested
  document.getElementById('drills-results-title').textContent = '🏋️ Coach-Suggested Drills';
  document.getElementById('drills-results-meta').textContent =
    `${drills.length} drills based on AI Coach focus areas`;

  // Hide the banner
  const banner = document.getElementById('drills-coach-banner');
  if (banner) banner.style.display = 'none';

  // Init animations
  requestAnimationFrame(() => _initAnimations(drills));

  _toast('Loaded drills based on AI Coach suggestions!');
}


/* ══════════════════════════════════════════════════════════════
   WORKOUT EXECUTION VIEW — Open, timer, sets tracker, complete
   ══════════════════════════════════════════════════════════════ */

let _workoutDrill     = null;
let _workoutTimerRef  = null;
let _workoutSeconds   = 0;
let _workoutRunning   = false;
let _workoutSetsTotal = 4;
let _workoutSetsDone  = 0;

/* ── Parse sets count from reps_or_sets string ────────────────── */
function _parseSetCount(str) {
  const m = str.match(/(\d+)\s*sets/i);
  if (m) return parseInt(m[1], 10);
  const m2 = str.match(/(\d+)\s*(rounds|circuits|full|rotations)/i);
  if (m2) return parseInt(m2[1], 10);
  return 4; // default
}

/* ── Open workout view for a drill ────────────────────────────── */
function drillWorkoutOpen(drillId) {
  const drill = _DRILLS_DB.find(d => d.id === drillId) || _getSaved().find(d => d.id === drillId);
  if (!drill) { _toast('Drill not found.'); return; }

  _workoutDrill     = drill;
  _workoutSeconds   = 0;
  _workoutRunning   = false;
  _workoutSetsTotal = _parseSetCount(drill.reps_or_sets);
  _workoutSetsDone  = 0;

  const icon       = _FOCUS_ICONS[drill.focus_area] || '🏀';
  const colors     = _FOCUS_COLORS[drill.focus_area] || { bg: 'rgba(245,166,35,0.12)', color: '#f5a623' };
  const focusClass = drill.focus_area.toLowerCase().replace(' ', '-');

  // Populate header
  const iconEl = document.getElementById('workout-icon');
  if (iconEl) { iconEl.textContent = icon; iconEl.style.background = colors.bg; }
  document.getElementById('workout-name').textContent = drill.name;
  document.getElementById('workout-focus').textContent = `${drill.focus_area} · ${drill.difficulty}`;

  // Timer
  document.getElementById('workout-timer').textContent = '00:00';
  document.getElementById('workout-timer-label').textContent = `Target: ${drill.duration_minutes} min`;
  const toggleBtn = document.getElementById('workout-timer-toggle');
  if (toggleBtn) toggleBtn.textContent = '▶';

  // Progress
  document.getElementById('workout-progress-fill').style.width = '0%';
  document.getElementById('workout-progress-text').textContent = '0% Complete';

  // Sets tracker
  document.getElementById('workout-sets-info').textContent = drill.reps_or_sets;
  const setsList = document.getElementById('workout-sets-list');
  setsList.innerHTML = '';
  for (let i = 1; i <= _workoutSetsTotal; i++) {
    setsList.insertAdjacentHTML('beforeend', `
      <div class="drill-workout-set-row" id="workout-set-${i}" data-set="${i}">
        <div class="drill-workout-set-checkbox" onclick="drillWorkoutToggleSet(${i})">✓</div>
        <div class="drill-workout-set-label">Set ${i}</div>
        <div class="drill-workout-set-detail">${drill.reps_or_sets.replace(/\d+\s*sets?\s*[×x]\s*/i, '')}</div>
        <div class="drill-workout-set-status">Pending</div>
      </div>
    `);
  }

  // Instructions — break description into sentences as steps
  const instrEl = document.getElementById('workout-instructions');
  const sentences = drill.description.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  instrEl.innerHTML = sentences.map((s, i) => `
    <div class="drill-workout-step" id="workout-step-${i}">
      <span class="drill-workout-step-num">${i + 1}</span>
      <span class="drill-workout-step-text">${s.trim()}</span>
    </div>
  `).join('');

  // Equipment
  const equipEl = document.getElementById('workout-equipment');
  equipEl.innerHTML = drill.equipment_needed.map(e =>
    `<span class="drill-equipment-tag">⚙ ${e}</span>`
  ).join('');

  // Show overlay, hide completion screen
  document.getElementById('workout-done-screen').style.display = 'none';

  // Show all workout sections
  document.getElementById('workout-timer-section').style.display = '';
  const progressSec = document.querySelector('.drill-workout-progress');
  if (progressSec) progressSec.style.display = '';
  document.getElementById('workout-sets-section').style.display = '';
  document.getElementById('workout-instructions-section').style.display = '';
  document.getElementById('workout-equipment-section').style.display = '';
  document.getElementById('workout-actions-section').style.display = '';

  const overlay = document.getElementById('drill-workout-overlay');
  overlay.style.display = 'flex';
  // Trigger animation
  requestAnimationFrame(() => overlay.classList.add('active'));

  // Stop any playing animations
  if (typeof DrillAnimations !== 'undefined') DrillAnimations.stopAll();
}

/* ── Close workout view ───────────────────────────────────────── */
function drillWorkoutClose() {
  _workoutRunning = false;
  if (_workoutTimerRef) { clearInterval(_workoutTimerRef); _workoutTimerRef = null; }

  const overlay = document.getElementById('drill-workout-overlay');
  overlay.classList.remove('active');
  setTimeout(() => { overlay.style.display = 'none'; }, 280);
}

/* ── Timer controls ───────────────────────────────────────────── */
function drillWorkoutToggleTimer() {
  const btn = document.getElementById('workout-timer-toggle');
  if (_workoutRunning) {
    _workoutRunning = false;
    clearInterval(_workoutTimerRef);
    _workoutTimerRef = null;
    if (btn) btn.textContent = '▶';
  } else {
    _workoutRunning = true;
    if (btn) btn.textContent = '⏸';
    _workoutTimerRef = setInterval(() => {
      _workoutSeconds++;
      _updateTimerDisplay();
    }, 1000);
  }
}

function drillWorkoutResetTimer() {
  _workoutRunning = false;
  if (_workoutTimerRef) { clearInterval(_workoutTimerRef); _workoutTimerRef = null; }
  _workoutSeconds = 0;
  _updateTimerDisplay();
  const btn = document.getElementById('workout-timer-toggle');
  if (btn) btn.textContent = '▶';
}

function _updateTimerDisplay() {
  const min = Math.floor(_workoutSeconds / 60);
  const sec = _workoutSeconds % 60;
  const display = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  document.getElementById('workout-timer').textContent = display;

  // Update progress based on time vs target duration
  if (_workoutDrill) {
    const targetSec = _workoutDrill.duration_minutes * 60;
    const pct = Math.min(100, Math.round((_workoutSeconds / targetSec) * 100));
    document.getElementById('workout-progress-fill').style.width = pct + '%';
    document.getElementById('workout-progress-text').textContent = pct + '% Complete';
  }
}

/* ── Set toggle ───────────────────────────────────────────────── */
function drillWorkoutToggleSet(setNum) {
  const row = document.getElementById(`workout-set-${setNum}`);
  if (!row) return;

  const isDone = row.classList.contains('completed');
  const checkbox = row.querySelector('.drill-workout-set-checkbox');
  if (isDone) {
    row.classList.remove('completed');
    if (checkbox) checkbox.classList.remove('checked');
    row.querySelector('.drill-workout-set-status').textContent = 'Pending';
    _workoutSetsDone = Math.max(0, _workoutSetsDone - 1);
  } else {
    row.classList.add('completed');
    if (checkbox) checkbox.classList.add('checked');
    row.querySelector('.drill-workout-set-status').textContent = '✓ Done';
    _workoutSetsDone++;
  }

  // Update progress
  const pct = Math.round((_workoutSetsDone / _workoutSetsTotal) * 100);
  document.getElementById('workout-progress-fill').style.width = pct + '%';
  document.getElementById('workout-progress-text').textContent = `${pct}% Complete (${_workoutSetsDone}/${_workoutSetsTotal} sets)`;
}

/* ── Complete workout ─────────────────────────────────────────── */
function drillWorkoutComplete() {
  _workoutRunning = false;
  if (_workoutTimerRef) { clearInterval(_workoutTimerRef); _workoutTimerRef = null; }

  // Celebration sound
  if (typeof SFX !== 'undefined') SFX.success();

  // Build stats
  const min = Math.floor(_workoutSeconds / 60);
  const sec = _workoutSeconds % 60;
  const timeStr = `${min}m ${sec}s`;

  const statsEl = document.getElementById('workout-done-stats');
  statsEl.innerHTML = `
    <div class="drill-workout-done-stat">
      <div class="drill-workout-done-stat-val">⏱ ${timeStr}</div>
      <div class="drill-workout-done-stat-label">Time Spent</div>
    </div>
    <div class="drill-workout-done-stat">
      <div class="drill-workout-done-stat-val">✓ ${_workoutSetsDone}/${_workoutSetsTotal}</div>
      <div class="drill-workout-done-stat-label">Sets Completed</div>
    </div>
    <div class="drill-workout-done-stat">
      <div class="drill-workout-done-stat-val">${_workoutDrill ? _workoutDrill.focus_area : 'N/A'}</div>
      <div class="drill-workout-done-stat-label">Focus Area</div>
    </div>
  `;

  // Hide workout sections, show completion
  document.getElementById('workout-timer-section').style.display = 'none';
  const progressSec = document.querySelector('.drill-workout-progress');
  if (progressSec) progressSec.style.display = 'none';
  document.getElementById('workout-sets-section').style.display = 'none';
  document.getElementById('workout-instructions-section').style.display = 'none';
  document.getElementById('workout-equipment-section').style.display = 'none';
  document.getElementById('workout-actions-section').style.display = 'none';
  document.getElementById('workout-done-screen').style.display = '';

  _toast('🏆 Drill completed! Great work!');
}

/* ── Also add "Start Workout" to plan view rows ───────────────── */
function _renderPlanViewV2() {
  const rows = document.querySelectorAll('.plan-row');
  rows.forEach(row => {
    const drillId = row.id.replace('plan-row-', '');
    if (!row.querySelector('.plan-row-start-btn')) {
      const removeBtn = row.querySelector('.saved-drill-remove-btn');
      if (removeBtn) {
        removeBtn.insertAdjacentHTML('beforebegin',
          `<button class="plan-row-start-btn" onclick="drillWorkoutOpen('${drillId}')">Start</button>`
        );
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   WORKOUTS DATABASE — Pre-built curated workout sessions
   Each workout maps to drill IDs from _DRILLS_DB
   ══════════════════════════════════════════════════════════════ */

const _WORKOUTS_DB = [
  {
    id: 'wkt-001',
    name: 'PG Morning Grind',
    emoji: '🎯',
    description: 'The complete point guard shooting and ball handling session. Build your lethal combination of off-the-dribble shooting and advanced handles.',
    duration_minutes: 55,
    difficulty: 'Intermediate',
    category: 'Shooting & Handles',
    positions: ['PG'],
    drill_ids: ['shoot-001', 'shoot-017', 'shoot-006', 'bh-004', 'bh-007', 'bh-008'],
    color: '#4ca3ff',
  },
  {
    id: 'wkt-002',
    name: 'Wing Scorer Package',
    emoji: '⚡',
    description: 'Designed for shooting guards and small forwards who need to score from anywhere. Three-point shooting, drives, and finishing under pressure.',
    duration_minutes: 60,
    difficulty: 'Advanced',
    category: 'Scoring',
    positions: ['SG', 'SF'],
    drill_ids: ['shoot-003', 'shoot-019', 'shoot-022', 'fin-002', 'fin-007', 'fin-015'],
    color: '#f5a623',
  },
  {
    id: 'wkt-003',
    name: 'Ball Handling Mastery',
    emoji: '🔄',
    description: 'An elite ball handling session covering all levels of dribble complexity. From foundational two-ball drills to advanced combo moves at game speed.',
    duration_minutes: 50,
    difficulty: 'Advanced',
    category: 'Ball Handling',
    positions: ['PG', 'SG'],
    drill_ids: ['bh-001', 'bh-002', 'bh-004', 'bh-010', 'bh-017', 'bh-019'],
    color: '#f5a623',
  },
  {
    id: 'wkt-004',
    name: 'Post Player Fundamentals',
    emoji: '💪',
    description: 'Everything a center or power forward needs — drop steps, baby hooks, fade-aways, and rim protection. Dominate the paint on both ends.',
    duration_minutes: 55,
    difficulty: 'Intermediate',
    category: 'Post Moves & Defense',
    positions: ['PF', 'C'],
    drill_ids: ['shoot-005', 'fin-004', 'fin-006', 'fin-013', 'def-005', 'def-013'],
    color: '#a864ff',
  },
  {
    id: 'wkt-005',
    name: 'Defensive Lockdown',
    emoji: '🛡️',
    description: 'Become an elite defender with this comprehensive defensive session. Slide series, closeouts, pick-and-roll coverage, and 1-on-1 full court guard.',
    duration_minutes: 50,
    difficulty: 'Advanced',
    category: 'Defense',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    drill_ids: ['def-001', 'def-002', 'def-007', 'def-011', 'def-015', 'def-017'],
    color: '#e84040',
  },
  {
    id: 'wkt-006',
    name: 'Explosive Conditioning',
    emoji: '🏃',
    description: 'The conditioning session that will separate you from the competition. Box jumps, wind sprints, burpees, and lateral bounds for elite athleticism.',
    duration_minutes: 45,
    difficulty: 'Advanced',
    category: 'Conditioning',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    drill_ids: ['cond-002', 'cond-005', 'cond-009', 'cond-010', 'cond-018', 'cond-021'],
    color: '#56d364',
  },
  {
    id: 'wkt-007',
    name: 'Strength & Stability',
    emoji: '🏋️',
    description: 'Build the athletic foundation that makes every basketball skill easier. Core, lower body, and upper body strength for injury prevention and dominance.',
    duration_minutes: 40,
    difficulty: 'Intermediate',
    category: 'Strength',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    drill_ids: ['str-001', 'str-004', 'str-005', 'str-006', 'str-014', 'str-016'],
    color: '#ff6b6b',
  },
  {
    id: 'wkt-008',
    name: 'Rookie Development',
    emoji: '⭐',
    description: 'Perfect for beginners building their basketball foundation. Form shooting, basic layups, fundamental ball handling, and defensive positioning.',
    duration_minutes: 45,
    difficulty: 'Beginner',
    category: 'Fundamentals',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    drill_ids: ['shoot-016', 'shoot-024', 'fin-008', 'fin-018', 'bh-015', 'def-001'],
    color: '#56d364',
  },
  {
    id: 'wkt-009',
    name: 'Three-Point Specialist',
    emoji: '🎯',
    description: 'For the shooter who wants to be a weapon from deep. Corner threes, off-screens, logo shots, and pressure free throws under fatigue.',
    duration_minutes: 55,
    difficulty: 'Advanced',
    category: 'Shooting',
    positions: ['PG', 'SG', 'SF'],
    drill_ids: ['shoot-001', 'shoot-003', 'shoot-007', 'shoot-011', 'shoot-020', 'shoot-025'],
    color: '#4ca3ff',
  },
  {
    id: 'wkt-010',
    name: 'Full-Court Conditioning',
    emoji: '⚡',
    description: 'The complete conditioning test. Suicides, 17s, hill sprints, defensive shuffle intervals, and tempo runs. Only for players ready to push their limits.',
    duration_minutes: 50,
    difficulty: 'Advanced',
    category: 'Conditioning',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    drill_ids: ['cond-001', 'cond-002', 'cond-007', 'cond-012', 'cond-016', 'cond-018'],
    color: '#56d364',
  },
  {
    id: 'wkt-011',
    name: 'Game Day Warmup',
    emoji: '🔥',
    description: 'The perfect pre-game activation routine. Light shooting, spot-up warmup, form layups, and quick handle drills to prime your body without fatigue.',
    duration_minutes: 30,
    difficulty: 'Beginner',
    category: 'Warmup',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    drill_ids: ['shoot-016', 'shoot-024', 'fin-008', 'bh-015', 'cond-019', 'str-013'],
    color: '#f5a623',
  },
  {
    id: 'wkt-012',
    name: 'Elite Full Session',
    emoji: '👑',
    description: 'The comprehensive elite player session — advanced shooting, handles, finishing, defense, and conditioning all in one complete workout for maximum development.',
    duration_minutes: 75,
    difficulty: 'Advanced',
    category: 'Complete Training',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    drill_ids: ['shoot-022', 'bh-017', 'fin-011', 'def-017', 'cond-002', 'str-018'],
    color: '#f5a623',
  },
  {
    id: 'wkt-013',
    name: 'Center Dominance',
    emoji: '🏀',
    description: 'Specialized for big men — post moves, rim protection, rebounding, baby hooks, and the footwork needed to dominate the paint on both ends.',
    duration_minutes: 55,
    difficulty: 'Intermediate',
    category: 'Post & Defense',
    positions: ['C', 'PF'],
    drill_ids: ['fin-001', 'fin-004', 'fin-013', 'fin-014', 'def-005', 'def-013'],
    color: '#a864ff',
  },
  {
    id: 'wkt-014',
    name: 'Finishing Package',
    emoji: '🏀',
    description: 'Master every finish in the modern game — floaters, euro steps, scoop layups, reverse layups, and contact finishes through the defense.',
    duration_minutes: 55,
    difficulty: 'Intermediate',
    category: 'Finishing',
    positions: ['PG', 'SG', 'SF'],
    drill_ids: ['fin-002', 'fin-005', 'fin-007', 'fin-009', 'fin-010', 'fin-015'],
    color: '#a864ff',
  },
  {
    id: 'wkt-015',
    name: 'Shooting Guard Sniper',
    emoji: '🎯',
    description: 'Built for the shooting guard who wants to be unstoppable. Off-screens, pull-up threes, mid-range precision, and contested shot finishing.',
    duration_minutes: 55,
    difficulty: 'Advanced',
    category: 'Scoring',
    positions: ['SG', 'SF'],
    drill_ids: ['shoot-002', 'shoot-007', 'shoot-012', 'shoot-021', 'bh-006', 'fin-007'],
    color: '#4ca3ff',
  },
  {
    id: 'wkt-016',
    name: 'Passing Playmaker',
    emoji: '🎯',
    description: 'Become the court vision maestro with this passing-focused workout. Develop every pass type from chest passes to no-look dimes, combined with footwork and ball handling to create a complete playmaker package.',
    duration_minutes: 55,
    difficulty: 'Intermediate',
    category: 'Playmaking',
    positions: ['PG', 'SG'],
    drill_ids: ['pass-001', 'pass-003', 'pass-006', 'pass-010', 'pass-014', 'foot-005', 'bh-027'],
    color: '#00c8b4',
  },
  {
    id: 'wkt-017',
    name: 'Footwork Foundation',
    emoji: '👟',
    description: 'Build the base that every great basketball player stands on. This workout targets pivoting, cutting, defensive stance, and finishing footwork to make your movements sharper and more efficient on both ends.',
    duration_minutes: 50,
    difficulty: 'Beginner',
    category: 'Fundamentals',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    drill_ids: ['foot-001', 'foot-002', 'foot-005', 'foot-006', 'foot-010', 'foot-015'],
    color: '#ffb74d',
  },
  {
    id: 'wkt-018',
    name: 'Quick 20-Minute Warmup',
    emoji: '⚡',
    description: 'A fast-paced pre-game or pre-practice warmup that hits ball handling, footwork, and light shooting in under 20 minutes. Perfect for getting your body and mind locked in before competition.',
    duration_minutes: 20,
    difficulty: 'Beginner',
    category: 'Warmup',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    drill_ids: ['bh-024', 'foot-006', 'shoot-034', 'pass-011'],
    color: '#f5a623',
  },
  {
    id: 'wkt-019',
    name: 'SF Two-Way Player',
    emoji: '🔥',
    description: 'The complete small forward workout — score from mid-range, finish through contact, lock down your man on defense, and run the floor in transition. This builds the versatile two-way wing that every team needs.',
    duration_minutes: 60,
    difficulty: 'Advanced',
    category: 'Position Training',
    positions: ['SF'],
    drill_ids: ['shoot-030', 'fin-024', 'def-018', 'foot-004', 'pass-007', 'cond-026', 'str-023'],
    color: '#e84040',
  },
  {
    id: 'wkt-020',
    name: 'Pick-and-Roll Master',
    emoji: '🏀',
    description: 'Master both sides of the pick-and-roll — the ball handler reads and the roller finishes. This workout combines dribble attacks, pocket passes, finishing at the rim, and the footwork to execute the most common play in basketball.',
    duration_minutes: 50,
    difficulty: 'Intermediate',
    category: 'Offense',
    positions: ['PG', 'SG', 'PF', 'C'],
    drill_ids: ['bh-028', 'pass-006', 'pass-009', 'foot-003', 'fin-020', 'shoot-035'],
    color: '#a864ff',
  },
  {
    id: 'wkt-021',
    name: 'Transition Offense',
    emoji: '🚀',
    description: 'Push the pace and punish slow defenses with this transition-focused workout. Outlet passes, full-court dribble attacks, fast-break finishing, and the conditioning to keep running all game long.',
    duration_minutes: 50,
    difficulty: 'Intermediate',
    category: 'Offense',
    positions: ['PG', 'SG', 'SF'],
    drill_ids: ['pass-005', 'pass-008', 'pass-013', 'bh-028', 'cond-025', 'fin-020'],
    color: '#56d364',
  },
  {
    id: 'wkt-022',
    name: 'PF Inside-Outside',
    emoji: '💪',
    description: 'The modern power forward must score inside and out. This workout develops post moves, mid-range touch, defensive rebounding, and the strength to hold position in the paint while also stretching the floor.',
    duration_minutes: 60,
    difficulty: 'Intermediate',
    category: 'Position Training',
    positions: ['PF', 'C'],
    drill_ids: ['foot-003', 'foot-009', 'shoot-033', 'def-019', 'def-022', 'str-020', 'str-024'],
    color: '#ff6b6b',
  },
  {
    id: 'wkt-023',
    name: 'Guard Skills Bootcamp',
    emoji: '⚡',
    description: 'An intensive guard development session covering advanced ball handling, creative passing, pull-up shooting, and the conditioning to play 35 minutes at high intensity. This is for guards who want to dominate every possession.',
    duration_minutes: 65,
    difficulty: 'Advanced',
    category: 'Position Training',
    positions: ['PG', 'SG'],
    drill_ids: ['bh-027', 'bh-030', 'pass-004', 'pass-014', 'shoot-028', 'shoot-029', 'cond-029'],
    color: '#4ca3ff',
  },
  {
    id: 'wkt-024',
    name: 'Off-Season Development',
    emoji: '📈',
    description: 'A comprehensive off-season workout that targets every weakness. Build strength, add new moves to your bag, develop your weak hand, and improve conditioning so you come back next season as a completely different player.',
    duration_minutes: 70,
    difficulty: 'Intermediate',
    category: 'Development',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    drill_ids: ['bh-029', 'foot-012', 'shoot-032', 'pass-012', 'def-025', 'str-021', 'str-025', 'cond-030'],
    color: '#a864ff',
  },
  {
    id: 'wkt-025',
    name: 'Summer League Prep',
    emoji: '☀️',
    description: 'Get ready for summer league with this game-simulation workout. High-intensity conditioning, contested shooting, defensive rotations, and finishing through contact prepare you for the competitive grind of summer basketball.',
    duration_minutes: 60,
    difficulty: 'Advanced',
    category: 'Game Prep',
    positions: ['PG', 'SG', 'SF', 'PF'],
    drill_ids: ['shoot-031', 'fin-025', 'def-024', 'foot-008', 'cond-023', 'cond-027', 'pass-015'],
    color: '#f5a623',
  },
];

/* ── WORKOUTS internal state ─────────────────────────────────── */
let _workoutsExpanded    = {};       // { wkt-id: true/false }
let _workoutsDrillChecks = {};       // { wkt-id: { drill-id: checked } }
let _workoutsFilter      = 'All';

/* ══════════════════════════════════════════════════════════════
   WORKOUTS TAB — Render, filter, expand, start
   ══════════════════════════════════════════════════════════════ */

function workoutsInit() {
  renderWorkoutsTab();
}

function workoutsSetFilter(category, btn) {
  _workoutsFilter = category;
  document.querySelectorAll('.workouts-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderWorkoutsTab();
}

function renderWorkoutsTab() {
  const grid = document.getElementById('workouts-grid');
  if (!grid) return;

  let pool = _WORKOUTS_DB;
  if (_workoutsFilter !== 'All') {
    pool = pool.filter(w => w.category === _workoutsFilter || w.positions.includes(_workoutsFilter));
  }

  grid.innerHTML = pool.map(w => _buildWorkoutCard(w)).join('');
}

function _buildWorkoutCard(wkt) {
  const drills        = wkt.drill_ids.map(id => _DRILLS_DB.find(d => d.id === id)).filter(Boolean);
  const totalMin      = drills.reduce((s, d) => s + d.duration_minutes, 0);
  const isExpanded    = _workoutsExpanded[wkt.id] || false;
  const checks        = _workoutsDrillChecks[wkt.id] || {};
  const diffClass     = wkt.difficulty.toLowerCase();

  const drillRows = drills.map(d => {
    const icon     = _FOCUS_ICONS[d.focus_area] || '🏀';
    const colors   = _FOCUS_COLORS[d.focus_area] || { bg: 'rgba(245,166,35,0.12)', color: '#f5a623' };
    const checked  = checks[d.id] !== false; // default checked
    return `
<div class="wkt-drill-row" id="wktrow-${wkt.id}-${d.id}">
  <label class="wkt-drill-check-wrap">
    <input type="checkbox" class="wkt-drill-checkbox" id="wkchk-${wkt.id}-${d.id}"
      ${checked ? 'checked' : ''}
      onchange="workoutToggleDrill('${wkt.id}','${d.id}',this.checked)">
    <span class="wkt-drill-checkmark"></span>
  </label>
  <div class="wkt-drill-icon-wrap" style="background:${colors.bg};">${icon}</div>
  <div class="wkt-drill-info">
    <div class="wkt-drill-name">${d.name}</div>
    <div class="wkt-drill-meta">${d.focus_area} · ${d.difficulty} · ${d.duration_minutes} min · ${d.reps_or_sets}</div>
  </div>
  <button class="wkt-drill-start-btn" onclick="drillWorkoutOpen('${d.id}')">Start →</button>
</div>`;
  }).join('');

  return `
<div class="wkt-card" id="wkt-card-${wkt.id}">
  <div class="wkt-card-header" onclick="workoutToggleExpand('${wkt.id}')">
    <div class="wkt-card-icon" style="background:${wkt.color}22;">${wkt.emoji}</div>
    <div class="wkt-card-info">
      <div class="wkt-card-name">${wkt.name}</div>
      <div class="wkt-card-meta">
        <span style="color:${wkt.color};">${wkt.category}</span>
        <span class="wkt-meta-dot">·</span>
        <span>${drills.length} drills</span>
        <span class="wkt-meta-dot">·</span>
        <span>~${wkt.duration_minutes} min</span>
      </div>
    </div>
    <div class="wkt-card-right">
      <span class="drill-difficulty-badge ${diffClass}">${wkt.difficulty}</span>
      <button class="wkt-start-btn" onclick="event.stopPropagation();workoutStartSelected('${wkt.id}')">Start Workout →</button>
      <span class="wkt-expand-arrow" id="wkt-arrow-${wkt.id}">${isExpanded ? '▴' : '▾'}</span>
    </div>
  </div>

  <div class="wkt-drills-panel" id="wkt-drills-${wkt.id}" style="display:${isExpanded ? 'block' : 'none'};">
    <div class="wkt-drills-header">
      <div class="wkt-drills-title">Select Drills</div>
      <div class="wkt-drills-actions">
        <button class="wkt-select-all-btn" onclick="workoutSelectAll('${wkt.id}',true)">Select All</button>
        <button class="wkt-select-all-btn" onclick="workoutSelectAll('${wkt.id}',false)">Deselect All</button>
      </div>
    </div>
    <div class="wkt-desc">${wkt.description}</div>
    <div class="wkt-drills-list">${drillRows}</div>
    <div class="wkt-footer">
      <div class="wkt-footer-stats" id="wkt-footer-stats-${wkt.id}">
        ${drills.length} drills selected · ~${totalMin} min total
      </div>
      <button class="wkt-footer-start-btn" onclick="workoutStartSelected('${wkt.id}')">
        🏀 Start Selected Drills →
      </button>
    </div>
  </div>
</div>`;
}

function workoutToggleExpand(wktId) {
  _workoutsExpanded[wktId] = !(_workoutsExpanded[wktId] || false);
  const panel = document.getElementById(`wkt-drills-${wktId}`);
  const arrow = document.getElementById(`wkt-arrow-${wktId}`);
  if (panel) panel.style.display = _workoutsExpanded[wktId] ? 'block' : 'none';
  if (arrow) arrow.textContent   = _workoutsExpanded[wktId] ? '▴' : '▾';
}

function workoutToggleDrill(wktId, drillId, checked) {
  if (!_workoutsDrillChecks[wktId]) _workoutsDrillChecks[wktId] = {};
  _workoutsDrillChecks[wktId][drillId] = checked;
  _updateWorkoutFooter(wktId);
}

function workoutSelectAll(wktId, checked) {
  const wkt = _WORKOUTS_DB.find(w => w.id === wktId);
  if (!wkt) return;
  if (!_workoutsDrillChecks[wktId]) _workoutsDrillChecks[wktId] = {};
  wkt.drill_ids.forEach(id => {
    _workoutsDrillChecks[wktId][id] = checked;
    const chk = document.getElementById(`wkchk-${wktId}-${id}`);
    if (chk) chk.checked = checked;
  });
  _updateWorkoutFooter(wktId);
}

function _updateWorkoutFooter(wktId) {
  const wkt    = _WORKOUTS_DB.find(w => w.id === wktId);
  const checks = _workoutsDrillChecks[wktId] || {};
  const drills = wkt.drill_ids.map(id => _DRILLS_DB.find(d => d.id === id)).filter(Boolean);
  const sel    = drills.filter(d => checks[d.id] !== false);
  const totMin = sel.reduce((s, d) => s + d.duration_minutes, 0);
  const el     = document.getElementById(`wkt-footer-stats-${wktId}`);
  if (el) el.textContent = `${sel.length} drills selected · ~${totMin} min total`;
}

function workoutStartSelected(wktId) {
  const wkt    = _WORKOUTS_DB.find(w => w.id === wktId);
  if (!wkt) return;
  const checks = _workoutsDrillChecks[wktId] || {};
  const drills = wkt.drill_ids.map(id => _DRILLS_DB.find(d => d.id === id)).filter(Boolean);
  const sel    = drills.filter(d => checks[d.id] !== false);

  if (sel.length === 0) { _toast('Select at least one drill.'); return; }

  // Open the first selected drill's workout view
  drillWorkoutOpen(sel[0].id);
  // Store remaining drills for a "next drill" flow
  window._workoutQueue = sel.slice(1);
  window._workoutQueueName = wkt.name;
  _toast(`Starting "${wkt.name}" — ${sel.length} drill${sel.length > 1 ? 's' : ''} queued.`);
}

/* ══════════════════════════════════════════════════════════════
   WORKOUT QUEUE — advance to next drill in the session
   ══════════════════════════════════════════════════════════════ */
function workoutNextDrill() {
  const queue = window._workoutQueue || [];
  if (queue.length === 0) {
    _toast('🏆 All drills in this session completed!');
    drillWorkoutClose();
    return;
  }
  const next = queue.shift();
  window._workoutQueue = queue;
  drillWorkoutOpen(next.id);
  _toast(`Next: ${next.name} (${queue.length} remaining)`);
}

/* ══════════════════════════════════════════════════════════════
   WORKOUTS PANEL — missing interactive handlers
   ══════════════════════════════════════════════════════════════ */

/* A) workoutsOpenDetail — referenced by workout cards but was missing */
function workoutsOpenDetail(id) {
  var workoutMap = {
    'kyrie-handles': { mode: 'library', focus: 'Ball Handling' }
  };
  var target = workoutMap[id] || { mode: 'library', focus: 'All' };
  if (typeof drillsShowMode === 'function') drillsShowMode(target.mode);
  if (target.focus !== 'All' && typeof drillsSetFocusFilter === 'function') {
    drillsSetFocusFilter(target.focus, null);
  }
  if (typeof dbSwitchTab === 'function') dbSwitchTab('drills', null);
}
window.workoutsOpenDetail = workoutsOpenDetail;

/* B–E) Wire up workout image cards, drill list items, FAB, and "View All" */
(function () {
  'use strict';

  function _switchToDrillsTab(mode, category) {
    if (typeof dbSwitchTab === 'function') dbSwitchTab('drills', null);
    if (typeof drillsShowMode === 'function') drillsShowMode(mode || 'library');
    if (category && typeof drillsSetFocusFilter === 'function') {
      drillsSetFocusFilter(category, null);
    }
  }

  function initWorkoutsPanelHandlers() {
    /* B) Workout image cards */
    document.querySelectorAll('.ks-workout-img-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var titleEl = card.querySelector('.ks-workout-img-card-title');
        var category = card.dataset.category || 'All';
        _switchToDrillsTab('library', category !== 'All' ? category : null);
      });
    });

    /* C) Popular drills list items */
    document.querySelectorAll('.ks-drill-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var category = item.dataset.category || 'All';
        _switchToDrillsTab('library', category !== 'All' ? category : null);
      });
    });

    /* D) FAB "add" button */
    document.querySelectorAll('.ks-fab').forEach(function (fab) {
      fab.addEventListener('click', function () {
        if (typeof dbSwitchTab === 'function') dbSwitchTab('drills', null);
        if (typeof drillsShowMode === 'function') drillsShowMode('generator');
      });
    });
  }

  /* E) "View All" section link — event delegation (works even on dynamic HTML) */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.ks-section-link');
    if (btn && btn.textContent.trim() === 'View All') {
      if (typeof dbSwitchTab === 'function') dbSwitchTab('drills', null);
      if (typeof drillsShowMode === 'function') drillsShowMode('library');
      if (typeof drillsSetFocusFilter === 'function') drillsSetFocusFilter('Shooting', null);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorkoutsPanelHandlers);
  } else {
    initWorkoutsPanelHandlers();
  }
})();

/* ══════════════════════════════════════════════════════════════
   WORKOUTS PANEL — dynamic hero card, weekly goal, FAB fix
   ══════════════════════════════════════════════════════════════ */
(function WorkoutsHeroSystem() {

  /* Archetype → recommended workout hero data */
  var ARCHETYPE_HERO = {
    scorer:    { title:'SCORING MACHINE',    sub:'Elite shooting & finishing drills',   badge:'Scorer Build',   wktId:'wkt-001', filter:'Shooting',     imgUrl:'https://lh3.googleusercontent.com/aida-public/AB6AXuCiE4tIGkSesA5XJv64PhXGzZYGvroR5JZs9vwMYiIl00A84C-YBWxUXsOU0eHaFfL0BGC-tiivo_lpW4s5GSTt_wCHDNRX1tJpuX4t0odZjlWuee5B1XfNRpRhPUY14nmiU4Qr5KP7mKXIjkOtUuVt2TyR3fRy5ZkPyh60jNyGaxVAyvOrZsEMP7HL6CatDz2hifdUFZ0CGPPvuQUfW8nH1kh3OrZ0riQjEPyFklSroD4NqeA0T0oqS04zDRR1zjSzJ6VZ9D6wfk0' },
    playmaker: { title:'PLAYMAKER SERIES',   sub:'Court vision & handle mastery',       badge:'Playmaker Build',wktId:'wkt-002', filter:'Ball Handling', imgUrl:'https://lh3.googleusercontent.com/aida-public/AB6AXuDcg2wT5o80WJYTotpKNQ6BAWJmjLnKJDuMPPI_uw4C_BOwU9DfsUR8T43T5ijJu54TsM00U5urf7ZFEl1edB-a7g4RrJkgx5nsBMSAdg7wYFOWopDT-WyGB3wHUlFX4DYKB_1O-q7W9_uIeZsnJk9Q-oxoloEbmdChQ6mgazNCjIQrqqaKXQtzWrv9J3LbDHaKYldTpW00t0kuEln1P7kngmsw53JFBJ98yN4fIi7x4J0_QHgu5kLh6p5ZFZKnQr7F1cyDRpt6uiw' },
    defender:  { title:'LOCKDOWN PROTOCOL',  sub:'On-ball defense & lateral speed',     badge:'Defender Build', wktId:'wkt-006', filter:'Defense',       imgUrl:'https://lh3.googleusercontent.com/aida-public/AB6AXuA32Dz89F0nXDEXjWTUiE_wggJNOY9oguXPQVGe0HAdw6nb5DRMrExG2dU2OmVCNnjvOUISzlPvIPyLEs2iSF-Jk9KurJNv5LWT7W5LxevfqSk8YhVda4FXKI_smNxXHyouxD-vPFQOW8dkI8FODNl0XBv4SMOukjZvL4qU8t4RlTuQQ4xZf5AAcmQ-Vzjz16YETVpaf5rndUvjH50dmt__1Dio4reNK0iaOySQJ18589ozv2DTmTxrSGH87JTrSONc4b-qte8WRAw' },
    'two-way': { title:'TWO-WAY ELITE',      sub:'Offense + defense complete package',  badge:'Two-Way Build',  wktId:'wkt-010', filter:'All',           imgUrl:'https://lh3.googleusercontent.com/aida-public/AB6AXuC2y0aWDM5KPkNHsalnbeMGPemY53aK_nIkbOyP3U6FRd_rgL4_DI_DWkXv3yAwcyjkV2H2z6Pqro6AMMPyIV6KEV51gl-Dryb5YHyVSFTb2he0QrzXwh1ms1iOKJvD5hZsyy4osNdxNM3p9FgE7AXAuuire0PVEmktE_QAUDDJWZ0ScCnHNBIy6rqff8o-6fH68oQ-NvZWF6amQC29b2XIw4gN4d5b96wkd5c6MDQPeGVro8x7ke4QR_hX38nqS9AutOCEYxv1c4U' },
    'rim-runner':{ title:'RIM DOMINANCE',    sub:'Post moves, finishing & athleticism', badge:'Rim Runner',     wktId:'wkt-008', filter:'Conditioning',  imgUrl:'https://lh3.googleusercontent.com/aida-public/AB6AXuCiE4tIGkSesA5XJv64PhXGzZYGvroR5JZs9vwMYiIl00A84C-YBWxUXsOU0eHaFfL0BGC-tiivo_lpW4s5GSTt_wCHDNRX1tJpuX4t0odZjlWuee5B1XfNRpRhPUY14nmiU4Qr5KP7mKXIjkOtUuVt2TyR3fRy5ZkPyh60jNyGaxVAyvOrZsEMP7HL6CatDz2hifdUFZ0CGPPvuQUfW8nH1kh3OrZ0riQjEPyFklSroD4NqeA0T0oqS04zDRR1zjSzJ6VZ9D6wfk0' },
    default:   { title:'SIGNATURE HANDLES',  sub:'Recommended for your archetype',      badge:'Elite Combo',    wktId:'wkt-002', filter:'Ball Handling', imgUrl:'https://lh3.googleusercontent.com/aida-public/AB6AXuDcg2wT5o80WJYTotpKNQ6BAWJmjLnKJDuMPPI_uw4C_BOwU9DfsUR8T43T5ijJu54TsM00U5urf7ZFEl1edB-a7g4RrJkgx5nsBMSAdg7wYFOWopDT-WyGB3wHUlFX4DYKB_1O-q7W9_uIeZsnJk9Q-oxoloEbmdChQ6mgazNCjIQrqqaKXQtzWrv9J3LbDHaKYldTpW00t0kuEln1P7kngmsw53JFBJ98yN4fIi7x4J0_QHgu5kLh6p5ZFZKnQr7F1cyDRpt6uiw' },
  };

  var _heroWktId = 'wkt-002';

  function getArchetypeHero() {
    try {
      var arc = JSON.parse(localStorage.getItem('courtiq-archetype') || '{}');
      var key = (arc.key || '').toLowerCase().replace(/\s+/g,'-');
      return ARCHETYPE_HERO[key] || ARCHETYPE_HERO['default'];
    } catch(e) { return ARCHETYPE_HERO['default']; }
  }

  function renderHero() {
    var h = getArchetypeHero();
    _heroWktId = h.wktId;
    var imgEl   = document.getElementById('wkt-hero-img');
    var titleEl = document.getElementById('wkt-hero-title');
    var subEl   = document.getElementById('wkt-hero-sub');
    var badgeEl = document.getElementById('wkt-hero-badge');
    if (imgEl)   imgEl.src         = h.imgUrl;
    if (titleEl) titleEl.textContent = h.title;
    if (subEl)   subEl.textContent  = h.sub;
    if (badgeEl) badgeEl.textContent = h.badge;
  }

  function renderWeeklyGoal() {
    var done  = (typeof dbSessions !== 'undefined') ? dbSessions.length : 0;
    var total = 5;
    var pct   = Math.min(100, Math.round((done / total) * 100));
    var doneEl = document.getElementById('wkt-goal-done');
    var barEl  = document.getElementById('wkt-goal-bar');
    if (doneEl) doneEl.textContent = done;
    if (barEl)  requestAnimationFrame(function(){ barEl.style.width = pct + '%'; });
  }

  /* Global: called by START NOW button */
  window.workoutsHeroStart = function() {
    var h = getArchetypeHero();
    if (h.filter && typeof workoutsSetFilter === 'function') {
      workoutsSetFilter(h.filter, null);
    }
    if (typeof workoutStartSelected === 'function') {
      workoutStartSelected(h.wktId);
    }
  };

  /* Fix FAB: open generator tab, not just drills */
  function fixFab() {
    document.querySelectorAll('#db-panel-workouts .ks-fab').forEach(function(fab) {
      fab.onclick = function() {
        if (typeof workoutsShowGenerator === 'function') workoutsShowGenerator();
        else if (typeof dbSwitchTab === 'function') {
          dbSwitchTab('drills');
          setTimeout(function(){
            if (typeof drillsShowMode === 'function') drillsShowMode('generator');
          }, 200);
        }
      };
    });
  }

  /* Fix "Precision Shooting > View All" */
  function fixViewAll() {
    var wktPanel = document.getElementById('db-panel-workouts');
    if (!wktPanel) return;
    var links = wktPanel.querySelectorAll('.ks-section-link');
    links.forEach(function(btn) {
      if (!btn.getAttribute('onclick')) {
        btn.onclick = function() {
          if (typeof workoutsSetFilter === 'function') workoutsSetFilter('Shooting', null);
        };
      }
    });
  }

  function init() {
    renderHero();
    renderWeeklyGoal();
    fixFab();
    fixViewAll();
  }

  /* Re-run when workouts tab is opened */
  var _origSwitch = window.dbSwitchTab;
  if (typeof _origSwitch === 'function') {
    window.dbSwitchTab = function(id, btn) {
      _origSwitch(id, btn);
      if (id === 'workouts') setTimeout(function(){ renderHero(); renderWeeklyGoal(); fixFab(); }, 100);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.WorkoutsHeroSystem = { render: renderHero, renderGoal: renderWeeklyGoal };
})();
