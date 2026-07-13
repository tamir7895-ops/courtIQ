/* app-v10/screens/notifications.js
   NOTIFICATIONS — message inbox screen. Accent: cream / ME.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;

  // Notification list — order: newest first.
  // `dest` is a registered v10 screen the row deep-links into when tapped.
  var NOTES = [
    { type: 'COACH',  icon: 'ph-brain',  title: 'SCOUTING REPORT READY',   body: 'Your weekly breakdown just landed. Open Coach to read.', when: '2H AGO',   dest: 'coach' },
    { type: 'ALERTS', icon: 'ph-bell',   title: 'STREAK AT RISK',          body: 'You’ve still got time to hit today’s session goal.',   when: '3H AGO',   dest: 'track' },
    { type: 'SOCIAL', icon: 'ph-user',   title: 'JORDAN BEAT YOUR SCORE',  body: 'They put up 84% on the right wing. Time to answer.',   when: '5H AGO',   dest: 'track' },
    { type: 'ALERTS', icon: 'ph-trophy', title: 'NEW BADGE: SNIPER II',    body: 'Three sessions above 70% three-point clip.',           when: 'YESTERDAY', dest: 'me' }
  ];

  function heroInbox(unread) {
    return h('section', {
      class: 'v10-hero',
      style: {
        background: 'var(--cream)', color: 'var(--ink)',
        border: '2px solid var(--ink)', boxShadow: 'var(--sh-ink)'
      }
    }, [
      h('div', { class: 'v10-hero__main' }, [
        h('div', { class: 'v10-hero__eyebrow', style: { color: 'var(--orange)' } }, [
          icon('ph-bell'),
          h('span', { text: 'INBOX · ' + unread + ' NEW' })
        ]),
        h('div', { class: 'v10-hero__headline', text: 'MESSAGES' }),
        h('div', { class: 'v10-hero__sub', style: { color: 'var(--muted)' },
          text: 'Coach, alerts, and social — all in one place.' })
      ])
    ]);
  }

  function noteIconColor(type) {
    if (type === 'COACH')  return 'var(--ink)';
    if (type === 'ALERTS') return 'var(--orange)';
    if (type === 'SOCIAL') return 'var(--sage)';
    return 'var(--muted)';
  }

  function noteRow(n, ctx) {
    return h('div', {
      class: 'v10-row',
      style: { cursor: 'pointer' },
      onclick: function () { if (n.dest && ctx && ctx.go) ctx.go(n.dest); }
    }, [
      h('div', {
        style: {
          width: '32px', height: '32px', flexShrink: '0',
          border: '1.5px solid var(--ink)', background: 'var(--cream-deep)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }
      }, [
        h('i', { class: 'ph-bold ' + n.icon, style: { fontSize: '16px', color: noteIconColor(n.type) } })
      ]),
      h('div', { class: 'v10-row__main' }, [
        h('div', { class: 'v10-row__title', text: n.title }),
        h('div', {
          class: 'v10-row__sub',
          style: { fontStyle: 'italic' },
          text: n.body
        })
      ]),
      h('div', {
        class: 'v10-row__right',
        style: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)',
          fontWeight: '700', letterSpacing: '0.06em' },
        text: n.when
      })
    ]);
  }

  function render(args) {
    var host = args.host;
    var ctx = args.ctx;

    function paint(profile) {
      while (host.firstChild) host.removeChild(host.firstChild);
      host.appendChild(ctx.ui.headerPill({ profile: profile }));

      // Derive bento counts from the actual NOTES array so the numbers
      // can never drift from the rendered list.
      var counts = { COACH: 0, ALERTS: 0, SOCIAL: 0, SYSTEM: 0 };
      NOTES.forEach(function (n) { if (counts[n.type] != null) counts[n.type]++; });
      var unread = NOTES.length;

      host.appendChild(heroInbox(unread));

      host.appendChild(ctx.ui.bento([
        { variant: 'orange', icon: 'ph-bell',  value: counts.ALERTS, label: 'ALERTS' },
        { variant: 'ink',    icon: 'ph-brain', value: counts.COACH,  label: 'COACH' },
        { variant: 'sage',   icon: 'ph-user',  value: counts.SOCIAL, label: 'SOCIAL' },
        { variant: null,     icon: 'ph-info',  value: counts.SYSTEM, label: 'SYSTEM' }
      ]));

      host.appendChild(ctx.ui.ribbon({ icon: 'ph-stopwatch', title: 'TODAY', meta: NOTES.length + ' MSGS' }));

      var list = h('div', null, NOTES.map(function (n) { return noteRow(n, ctx); }));
      host.appendChild(list);

      // Pin card — wrap so the whole card deep-links to Coach.
      var pin = ctx.ui.pinCard({
        tab: 'COACH MESSAGE',
        body: 'Your scouting report is ready. Open Coach to read.',
        highlight: 'scouting report is ready',
        sig: 'AI COACH'
      });
      pin.style.cursor = 'pointer';
      pin.addEventListener('click', function () { ctx.go('coach'); });
      host.appendChild(pin);

      // Flex spacer — pushes the CTA to the bottom of the viewport when
      // the list is short, while keeping content packed at top.
      host.appendChild(h('div', { style: { flex: '1 1 auto', minHeight: '8px' } }));

      host.appendChild(ctx.ui.cta({
        variant: null,            // navy (default v10-cta)
        icon: 'ph-arrow-right',
        label: 'OPEN COACH BRIEFING',
        onClick: function () { ctx.go('coach'); }
      }));
    }

    ctx.data.getProfile().then(paint, function () { paint({}); });
  }

  window.app.register('notifications', render);
})();
