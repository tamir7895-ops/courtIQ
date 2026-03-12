  /* ══════════════════════════════════════════════════════════════
     SIDEBAR
  ══════════════════════════════════════════════════════════════ */
  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
    if (!document.getElementById('authOverlay').classList.contains('active')) {
      document.body.style.overflow = '';
    }
  }
  document.addEventListener('click', e => {
    const sidebar = document.getElementById('sidebar');
    const trigger = document.getElementById('sidebarTrigger');
    if (sidebar && sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) && !trigger.contains(e.target) &&
        !e.target.closest('.sidebar-overlay')) {
      // handled by overlay onclick
    }
  });

  /* ══════════════════════════════════════════════════════════════
