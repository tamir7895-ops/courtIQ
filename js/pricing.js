  /* ══════════════════════════════════════════════════════════════
     PRICING — billing toggle
  ══════════════════════════════════════════════════════════════ */
  const prices = {
    monthly: { starter: 9,  pro: 24, elite: 59  },
    yearly:  { starter: 6,  pro: 17, elite: 41  },
  };
  let billingMode = 'monthly';

  function setBilling(mode) {
    billingMode = mode;
    const toggle = document.getElementById('billingToggle');
    const mLabel = document.getElementById('toggle-monthly');
    const yLabel = document.getElementById('toggle-yearly');

    toggle.classList.toggle('yearly', mode === 'yearly');
    toggle.setAttribute('aria-checked', mode === 'yearly');
    mLabel.classList.toggle('active', mode === 'monthly');
    yLabel.classList.toggle('active', mode === 'yearly');

    const p = prices[mode];

    // Animate price change
    animatePrice('price-starter', p.starter);
    animatePrice('price-pro',     p.pro);
    animatePrice('price-elite',   p.elite);

    // Annual notes
    document.getElementById('note-starter').innerHTML = mode === 'yearly'
      ? `Billed $${p.starter * 12}/yr &nbsp;<span class="saving">Save $${(prices.monthly.starter - p.starter) * 12}</span>`
      : '&nbsp;';
    document.getElementById('note-pro').innerHTML = mode === 'yearly'
      ? `Billed $${p.pro * 12}/yr &nbsp;<span class="saving">Save $${(prices.monthly.pro - p.pro) * 12}</span>`
      : '&nbsp;';
    document.getElementById('note-elite').innerHTML = mode === 'yearly'
      ? `Billed $${p.elite * 12}/yr &nbsp;<span class="saving">Save $${(prices.monthly.elite - p.elite) * 12}</span>`
      : '&nbsp;';
  }

  function animatePrice(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent);
    const diff  = target - start;
    const steps = 20;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      el.textContent = Math.round(start + diff * (i / steps));
      if (i >= steps) { el.textContent = target; clearInterval(iv); }
    }, 18);
  }

  function toggleBilling() {
    setBilling(billingMode === 'monthly' ? 'yearly' : 'monthly');
  }

  /* ══════════════════════════════════════════════════════════════
