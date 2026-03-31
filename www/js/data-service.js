/* ══════════════════════════════════════════════════════════════
   DATA SERVICE — Supabase CRUD for training data
   ══════════════════════════════════════════════════════════════ */

const DataService = {

  /* ── Profile ─────────────────────────────────────────────── */
  async getProfile() {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', window.currentUser.id)
      .single();
    if (error) throw error;
    return data;
  },

  async updateProfile(updates) {
    const { error } = await sb
      .from('profiles')
      .upsert(
        { id: window.currentUser.id, ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    if (error) throw error;
  },

  /* ── Training Weeks ──────────────────────────────────────── */
  async getWeeks() {
    const { data, error } = await sb
      .from('training_weeks')
      .select('*, training_sessions(*)')
      .eq('user_id', window.currentUser.id)
      .order('week_number', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createWeek(weekNumber, label) {
    const { data, error } = await sb
      .from('training_weeks')
      .insert({
        user_id: window.currentUser.id,
        week_number: weekNumber,
        label: label,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async saveWeekSummary(weekId, summaryJson) {
    const { error } = await sb
      .from('training_weeks')
      .update({ summary_json: summaryJson })
      .eq('id', weekId);
    if (error) throw error;
  },

  /* ── Training Sessions ───────────────────────────────────── */
  async addSession(weekId, sessionData) {
    const { data, error } = await sb
      .from('training_sessions')
      .insert({
        user_id: window.currentUser.id,
        week_id: weekId,
        day: sessionData.day,
        shots_made: sessionData.shots_made,
        shots_attempted: sessionData.shots_attempted,
        dribbling_min: sessionData.dribbling_min,
        vertical_in: sessionData.vertical_in,
        sprint_sec: sessionData.sprint_sec,
        notes: sessionData.notes || '',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getSessionsForWeek(weekId) {
    const { data, error } = await sb
      .from('training_sessions')
      .select('*')
      .eq('week_id', weekId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /* ── User Data (JSONB blob — XP, archetype, onboarding) ── */
  async getUserData() {
    const { data, error } = await sb
      .from('profiles')
      .select('user_data')
      .eq('id', window.currentUser.id)
      .single();
    if (error) throw error;
    return data?.user_data || {};
  },

  async saveUserData(patch) {
    // Read current user_data from localStorage for merge — no extra round-trip
    var existing = {};
    try {
      var raw = localStorage.getItem('_sb_user_data_cache');
      if (raw) existing = JSON.parse(raw);
    } catch(e) {}
    var merged = Object.assign({}, existing, patch);

    const { error } = await sb.from('profiles')
      .upsert(
        { id: window.currentUser.id, user_data: merged, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    if (error) throw error;

    // Update local cache for next merge
    try { localStorage.setItem('_sb_user_data_cache', JSON.stringify(merged)); } catch(e) {}
  },

  /* ── Shot Sessions ─────────────────────────────────────── */
  async addShotSession(session) {
    const { data, error } = await sb
      .from('shot_sessions')
      .insert({
        user_id:      window.currentUser.id,
        session_date: session.date || new Date().toISOString(),
        fg_made:      session.fg_made      || 0,
        fg_missed:    session.fg_missed    || 0,
        three_made:   session.three_made   || 0,
        three_missed: session.three_missed || 0,
        ft_made:      session.ft_made      || 0,
        ft_missed:    session.ft_missed    || 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getShotSessions(limit) {
    const { data, error } = await sb
      .from('shot_sessions')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('session_date', { ascending: false })
      .limit(limit || 50);
    if (error) throw error;
    return data || [];
  },
};
