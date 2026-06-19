(function () {
  const EVENT_COLUMNS = "id,owner_id,slug,name,published,registration_open,settings,event_info,teams,captains,draft,weapon_assignments,replay_codes,scores,created_at,updated_at";

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
      replay_codes: state.replayCodes || [],
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
      replayCodes: event.replay_codes || [],
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
      rank: Number(applicant.rank || 0),
      total_games: Number(applicant.totalGames || 0),
      total_wins: Number(applicant.totalWins || 0),
      most: applicant.most || [],
      most_stats: applicant.mostStats || [],
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
      rank: Number(row.rank || 0),
      totalGames: Number(row.total_games || 0),
      totalWins: Number(row.total_wins || 0),
      most: row.most || [],
      mostStats: row.most_stats || [],
      memo: row.memo || "",
      createdAt: row.created_at
    };
  }

  function create(config) {
    const client = createClient(config);
    let applicantChannel = null;
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

      async sendMagicLink(email) {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}${location.pathname}#admin` }
        });
        if (error) throw error;
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

      async updateEvent(eventId, state, extras = {}) {
        const { data, error } = await client.from("events").update({ ...eventPayload(state), ...extras }).eq("id", eventId).select(EVENT_COLUMNS).single();
        if (error) throw error;
        return data;
      },

      async deleteEvent(eventId) {
        const { error } = await client.from("events").delete().eq("id", eventId);
        if (error) throw error;
      },

      async eventBySlug(slug) {
        const { data, error } = await client.rpc("get_public_event", { event_slug: slug });
        if (error) throw error;
        return data?.[0] || null;
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

      async deleteApplicant(applicantId) {
        const { error } = await client.from("applicants").delete().eq("id", applicantId);
        if (error) throw error;
      },

      async clearApplicants(eventId) {
        const { error } = await client.from("applicants").delete().eq("event_id", eventId);
        if (error) throw error;
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
