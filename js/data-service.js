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
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', window.currentUser.id);
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
};
