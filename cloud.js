(function () {
  const EVENT_COLUMNS = "id,owner_id,slug,name,published,registration_open,settings,event_info,teams,captains,draft,weapon_assignments,room_codes,replay_codes,match_records,scores,created_at,updated_at";

  function createClient(config = {}) {
    const supabaseUrl = String(config.supabaseUrl || "").trim();
    const supabaseAnonKey = String(config.supabaseAnonKey || "").trim();
    if (!supabaseUrl || !supabaseAnonKey || !window.supabase?.createClient) return null;
    return window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  function eventPayload(state) {
    const settings = { ...(state.settings || {}) };
    delete settings.apiKey;
    delete settings.apiBase;
    return {
      name: settings.eventName || "이터널 리턴 내전",
      settings,
      event_info: state.eventInfo || {},
      teams: state.teams || [],
      captains: state.captains || {},
      draft: state.draft || {},
      weapon_assignments: state.weaponAssignments || {},
      room_codes: state.roomCodes || [],
      replay_codes: state.replayCodes || [],
      match_records: state.matchRecords || [],
      scores: state.scores || []
    };
  }

  function stateFromEvent(event, applicants = []) {
    return {
      version: 5,
      settings: { ...(event.settings || {}), eventName: event.name },
      eventInfo: event.event_info || {},
      applicants,
      teams: event.teams || [],
      captains: event.captains || {},
      draft: event.draft || {},
      weaponAssignments: event.weapon_assignments || {},
      roomCodes: event.room_codes || [],
      replayCodes: event.replay_codes || [],
      matchRecords: event.match_records || [],
      scores: event.scores || [],
      updatedAt: event.updated_at || null
    };
  }

  function applicantToRow(eventId, applicant) {
    return {
      id: applicant.id,
      event_id: eventId,
      nickname: applicant.nickname,
      discord_name: applicant.discordName || "",
      roles: applicant.roles || [],
      game_user_id: applicant.userId || null,
      mmr: Number(applicant.mmr || 0),
      current_mmr: Number(applicant.currentMmr ?? applicant.mmr ?? 0),
      peak_mmr: Number(applicant.peakMmr ?? applicant.mmr ?? 0),
      peak_season_id: applicant.peakSeasonId || null,
      rank: Number(applicant.rank || 0),
      total_games: Number(applicant.totalGames || 0),
      total_wins: Number(applicant.totalWins || 0),
      most: applicant.most || [],
      most_stats: applicant.mostStats || [],
      cobalt_rating: Number(applicant.cobaltRating || 0),
      cobalt_position: applicant.cobaltPosition || "",
      cobalt_picks: applicant.cobaltPicks || "",
      memo: applicant.memo || ""
    };
  }

  function applicantFromRow(row) {
    return {
      id: row.id,
      nickname: row.nickname,
      discordName: row.discord_name || "",
      roles: row.roles || [],
      userId: row.game_user_id || null,
      mmr: Number(row.mmr || 0),
      currentMmr: Number(row.current_mmr ?? row.mmr ?? 0),
      peakMmr: Number(row.peak_mmr ?? row.mmr ?? 0),
      peakSeasonId: row.peak_season_id || null,
      rank: Number(row.rank || 0),
      totalGames: Number(row.total_games || 0),
      totalWins: Number(row.total_wins || 0),
      most: row.most || [],
      mostStats: row.most_stats || [],
      cobaltRating: Number(row.cobalt_rating || 0),
      cobaltPosition: row.cobalt_position || "",
      cobaltPicks: row.cobalt_picks || "",
      memo: row.memo || "",
      createdAt: row.created_at
    };
  }

  function create(config) {
    const client = createClient(config);
    let applicantChannel = null;
    let eventChannel = null;
    return {
      configured: Boolean(client),
      client,
      eventPayload,
      stateFromEvent,
      applicantFromRow,

      async session() {
        if (!client) return null;
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data.session;
      },

      onAuthChange(callback) {
        if (!client) return () => {};
        const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
        return () => data.subscription.unsubscribe();
      },

      async sendOtp(email) {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true }
        });
        if (error) throw error;
      },

      async verifyOtp(email, token) {
        const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
        if (error) throw error;
        return data.session;
      },

      async signInWithGoogle() {
        const redirectUrl = new URL(window.location.href);
        redirectUrl.hash = "";
        const { data, error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: redirectUrl.toString() }
        });
        if (error) throw error;
        return data;
      },

      async signOut() {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      },

      async listEvents() {
        const { data, error } = await client.from("events").select(EVENT_COLUMNS).order("updated_at", { ascending: false });
        if (error) throw error;
        return data || [];
      },

      async operatorProfile(email) {
        const { data, error } = await client.from("site_operators").select("id,email,is_owner,created_at").eq("email", email.trim().toLowerCase()).maybeSingle();
        if (error) throw error;
        return data || null;
      },

      async listOperators() {
        const { data, error } = await client.from("site_operators").select("id,email,is_owner,created_at").order("is_owner", { ascending: false }).order("created_at", { ascending: true });
        if (error) throw error;
        return data || [];
      },

      async addOperator(email) {
        const { data, error } = await client.from("site_operators").insert({ email: email.trim().toLowerCase(), is_owner: false }).select("id,email,is_owner,created_at").single();
        if (error) throw error;
        return data;
      },

      async removeOperator(operatorId) {
        const { error } = await client.from("site_operators").delete().eq("id", operatorId);
        if (error) throw error;
      },

      async createEvent({ ownerId, name, slug, state }) {
        const payload = { ...eventPayload(state), owner_id: ownerId, name, slug, published: true, registration_open: true };
        const { data, error } = await client.from("events").insert(payload).select(EVENT_COLUMNS).single();
        if (error) throw error;
        return data;
      },

      async updateEvent(eventId, state, extras = {}, expectedUpdatedAt = "") {
        let query = client.from("events").update({ ...eventPayload(state), ...extras }).eq("id", eventId);
        if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
        const { data, error } = await query.select(EVENT_COLUMNS).maybeSingle();
        if (error) throw error;
        if (!data) {
          const conflict = new Error("다른 운영자가 먼저 수정했습니다. 최신 상태를 다시 불러왔습니다.");
          conflict.code = "EVENT_CONFLICT";
          throw conflict;
        }
        return data;
      },

      async deleteEvent(eventId) {
        const { error } = await client.from("events").delete().eq("id", eventId);
        if (error) throw error;
      },

      async eventBySlug(slug) {
        const { data, error } = await client.rpc("get_public_event", { event_slug: slug });
        if (error) throw error;
        const event = data?.[0] || null;
        if (event) event.public_applicants = (event.public_applicants || []).map(applicantFromRow);
        return event;
      },

      async eventById(eventId) {
        const { data, error } = await client.from("events").select(EVENT_COLUMNS).eq("id", eventId).single();
        if (error) throw error;
        return data;
      },

      async applicants(eventId) {
        const { data, error } = await client.from("applicants").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []).map(applicantFromRow);
      },

      async submitApplicant(eventId, applicant) {
        const { error } = await client.from("applicants").insert(applicantToRow(eventId, applicant));
        if (error) throw error;
      },

      async updateApplicant(eventId, applicant) {
        const row = applicantToRow(eventId, applicant);
        delete row.id;
        delete row.event_id;
        const { error } = await client.from("applicants").update(row).eq("id", applicant.id).eq("event_id", eventId);
        if (error) throw error;
      },

      async deleteApplicant(applicantId) {
        const { error } = await client.from("applicants").delete().eq("id", applicantId);
        if (error) throw error;
      },

      async clearApplicants(eventId) {
        const { error } = await client.from("applicants").delete().eq("event_id", eventId);
        if (error) throw error;
      },

      async replaceApplicants(eventId, applicants) {
        const { error: deleteError } = await client.from("applicants").delete().eq("event_id", eventId);
        if (deleteError) throw deleteError;
        if (!applicants.length) return;
        const { error: insertError } = await client.from("applicants").insert(applicants.map((applicant) => applicantToRow(eventId, applicant)));
        if (insertError) throw insertError;
      },

      async listBackups(eventId) {
        const { data, error } = await client.from("event_backups").select("id,event_id,label,snapshot,created_at").eq("event_id", eventId).order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      },

      async createBackup(eventId, label, snapshot) {
        const { data, error } = await client.from("event_backups").insert({ event_id: eventId, label, snapshot }).select("id,event_id,label,snapshot,created_at").single();
        if (error) throw error;
        return data;
      },

      async deleteBackup(backupId) {
        const { error } = await client.from("event_backups").delete().eq("id", backupId);
        if (error) throw error;
      },

      subscribeEvent(eventId, callback) {
        if (eventChannel) client.removeChannel(eventChannel);
        eventChannel = client.channel(`event:${eventId}`)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${eventId}` }, callback)
          .subscribe();
        return () => {
          if (eventChannel) client.removeChannel(eventChannel);
          eventChannel = null;
        };
      },

      subscribePublicEvent(eventId, callback) {
        if (eventChannel) client.removeChannel(eventChannel);
        eventChannel = client.channel(`public-event:${eventId}`)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "public_event_updates", filter: `event_id=eq.${eventId}` }, callback)
          .subscribe();
        return () => {
          if (eventChannel) client.removeChannel(eventChannel);
          eventChannel = null;
        };
      },

      subscribeApplicants(eventId, callback) {
        if (applicantChannel) client.removeChannel(applicantChannel);
        applicantChannel = client.channel(`applicants:${eventId}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "applicants", filter: `event_id=eq.${eventId}` }, callback)
          .subscribe();
        return () => {
          if (applicantChannel) client.removeChannel(applicantChannel);
          applicantChannel = null;
        };
      },

      async rankLookup(payload) {
        const { data, error } = await client.functions.invoke("rank-lookup", { body: payload });
        if (error) throw new Error(error.context?.body?.error || error.message);
        if (data?.error) throw new Error(data.error);
        return data;
      }
    };
  }

  window.ERCloud = { create };
})();
