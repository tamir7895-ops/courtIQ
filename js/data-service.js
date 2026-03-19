/* ══════════════════════════════════════════════════════════════
   DATA SERVICE — Supabase CRUD for training data
   ══════════════════════════════════════════════════════════════ */

const DataService = {

  /* ── Cache helper: Supabase-first with localStorage fallback ── */
  _cache: function (key, data) {
    try { localStorage.setItem('courtiq-cache-' + key, JSON.stringify({ data: data, ts: Date.now() })); } catch (e) {}
  },
  _getCached: function (key) {
    try {
      var raw = localStorage.getItem('courtiq-cache-' + key);
      if (!raw) return null;
      return JSON.parse(raw).data;
    } catch (e) { return null; }
  },

  /* ── Profile ─────────────────────────────────────────────── */
  async getProfile() {
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', window.currentUser.id)
        .single();
      if (error) throw error;
      if (data) this._cache('profile', data);
      return data;
    } catch (e) {
      console.warn('[DataService] getProfile fallback to cache:', e);
      return this._getCached('profile');
    }
  },

  async updateProfile(updates) {
    const { error } = await sb
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', window.currentUser.id);
    if (error) throw error;
  },

  /* ── Training Weeks ──────────────────────────────────────── */
  async getWeeks() {
    try {
      const { data, error } = await sb
        .from('training_weeks')
        .select('*, training_sessions(*)')
        .eq('user_id', window.currentUser.id)
        .order('week_number', { ascending: true });
      if (error) throw error;
      var result = data || [];
      this._cache('weeks', result);
      return result;
    } catch (e) {
      console.warn('[DataService] getWeeks fallback to cache:', e);
      return this._getCached('weeks') || [];
    }
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
  _saveQueue: Promise.resolve(),

  async getUserData() {
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('user_data')
        .eq('id', window.currentUser.id)
        .single();
      if (error) throw error;
      var result = data?.user_data || {};
      this._cache('userData', result);
      return result;
    } catch (e) {
      console.warn('[DataService] getUserData fallback to cache:', e);
      return this._getCached('userData') || {};
    }
  },

  saveUserData(patch) {
    // Queue saves sequentially to prevent read-modify-write races
    this._saveQueue = this._saveQueue.then(async () => {
      const { data: current, error: fetchErr } = await sb
        .from('profiles')
        .select('user_data')
        .eq('id', window.currentUser.id)
        .single();
      if (fetchErr) throw fetchErr;
      const merged = Object.assign({}, current?.user_data || {}, patch);
      const { error } = await sb
        .from('profiles')
        .update({ user_data: merged, updated_at: new Date().toISOString() })
        .eq('id', window.currentUser.id);
      if (error) throw error;
    }).catch(function (e) {
      console.warn('[DataService] saveUserData failed:', e);
    });
    return this._saveQueue;
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
    try {
      const { data, error } = await sb
        .from('shot_sessions')
        .select('*')
        .eq('user_id', window.currentUser.id)
        .order('session_date', { ascending: false })
        .limit(limit || 50);
      if (error) throw error;
      var result = data || [];
      this._cache('shotSessions', result);
      return result;
    } catch (e) {
      console.warn('[DataService] getShotSessions fallback to cache:', e);
      return this._getCached('shotSessions') || [];
    }
  },
};
