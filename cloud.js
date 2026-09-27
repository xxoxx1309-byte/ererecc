(function () {
  function hasFirebaseConfig(config = {}) {
    const firebaseConfig = config.firebaseConfig || {};
    return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && window.firebase?.initializeApp);
  }

  function toIso(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  function nowField(firebase) {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function eventPayload(state, firebase) {
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
      scores: state.scores || [],
      updated_at: nowField(firebase)
    };
  }

  function eventFromDoc(doc) {
    const data = doc.data() || {};
    return {
      id: doc.id,
      owner_id: data.owner_id || "",
      slug: data.slug || "",
      name: data.name || data.settings?.eventName || "이터널 리턴 내전",
      published: data.published !== false,
      registration_open: data.registration_open !== false,
      settings: data.settings || {},
      event_info: data.event_info || {},
      teams: data.teams || [],
      captains: data.captains || {},
      draft: data.draft || {},
      weapon_assignments: data.weapon_assignments || {},
      room_codes: data.room_codes || [],
      replay_codes: data.replay_codes || [],
      match_records: data.match_records || [],
      scores: data.scores || [],
      created_at: toIso(data.created_at),
      updated_at: toIso(data.updated_at)
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

  function applicantToDoc(applicant) {
    return {
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
      playable_characters: applicant.playableCharacters || [],
      cobalt_rating: Number(applicant.cobaltRating || 0),
      cobalt_position: applicant.cobaltPosition || "",
      cobalt_picks: applicant.cobaltPicks || "",
      memo: applicant.memo || ""
    };
  }

  function applicantFromDoc(doc) {
    const row = doc.data ? doc.data() : doc;
    return {
      id: row.id || doc.id,
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
      playableCharacters: row.playable_characters || [],
      cobaltRating: Number(row.cobalt_rating || 0),
      cobaltPosition: row.cobalt_position || "",
      cobaltPicks: row.cobalt_picks || "",
      memo: row.memo || "",
      createdAt: toIso(row.created_at)
    };
  }

  function applicantId(applicant) {
    return String(applicant.nickname || applicant.id || crypto.randomUUID())
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      || crypto.randomUUID();
  }

  function operatorFromDoc(doc, fallbackEmail = "") {
    if (!doc?.exists) return null;
    const data = doc.data() || {};
    return {
      id: doc.id,
      email: data.email || fallbackEmail || doc.id,
      is_owner: data.is_owner === true,
      created_at: toIso(data.created_at)
    };
  }

  function create(config = {}) {
    if (!hasFirebaseConfig(config)) return { configured: false };
    const firebase = window.firebase;
    if (!firebase.apps?.length) firebase.initializeApp(config.firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    let applicantUnsubscribe = null;
    let eventUnsubscribe = null;
    let activeEventId = "";

    const events = () => db.collection("events");
    const operators = () => db.collection("siteOperators");
    const applicants = (eventId) => events().doc(eventId).collection("applicants");
    const backups = (eventId) => events().doc(eventId).collection("backups");

    return {
      configured: true,
      client: { auth, db },
      eventPayload,
      stateFromEvent,
      applicantFromRow: applicantFromDoc,

      async session() {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        if (!auth.currentUser) await auth.signInAnonymously();
        return auth.currentUser ? { user: auth.currentUser } : null;
      },

      onAuthChange(callback) {
        return auth.onAuthStateChanged((user) => callback(user ? { user } : null));
      },

      async signInWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const result = await auth.signInWithPopup(provider);
        return { session: { user: result.user } };
      },

      async signOut() {
        await auth.signOut();
      },

      async operatorProfile(email) {
        if (auth.currentUser?.isAnonymous) {
          return { id: auth.currentUser.uid, email: "", is_owner: false, is_guest: true, created_at: null };
        }
        const normalized = normalizeEmail(email);
        if (!normalized) return null;
        const doc = await operators().doc(normalized).get();
        const saved = operatorFromDoc(doc, normalized);
        if (saved) return saved;
        if ((config.ownerEmails || []).map(normalizeEmail).includes(normalized)) {
          return { id: normalized, email: normalized, is_owner: true, created_at: null };
        }
        return null;
      },

      async listOperators() {
        const snapshot = await operators().get();
        const rows = snapshot.docs
          .map((doc) => operatorFromDoc(doc))
          .filter(Boolean)
          .sort((a, b) => {
            if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1;
            return String(a.created_at || "").localeCompare(String(b.created_at || ""));
          });
        (config.ownerEmails || []).map(normalizeEmail).forEach((email) => {
          if (email && !rows.some((row) => normalizeEmail(row.email) === email)) {
            rows.unshift({ id: email, email, is_owner: true, created_at: null });
          }
        });
        return rows;
      },

      async addOperator(email) {
        const normalized = normalizeEmail(email);
        if (!normalized) throw new Error("운영자 이메일을 입력해 주세요.");
        const ref = operators().doc(normalized);
        if ((await ref.get()).exists) {
          const duplicate = new Error("이미 등록된 운영자 이메일입니다.");
          duplicate.code = "23505";
          throw duplicate;
        }
        await ref.set({
          email: normalized,
          is_owner: false,
          created_at: nowField(firebase)
        }, { merge: false });
        const doc = await ref.get();
        return operatorFromDoc(doc, normalized);
      },

      async removeOperator(operatorId) {
        await operators().doc(normalizeEmail(operatorId)).delete();
      },

      async listEvents() {
        if (!auth.currentUser) return [];
        const snapshot = await events().where("owner_id", "==", auth.currentUser.uid).get();
        return snapshot.docs.map(eventFromDoc);
      },

      async createEvent({ ownerId, name, slug, state }) {
        const ref = events().doc();
        await ref.set({
          ...eventPayload(state, firebase),
          owner_id: ownerId,
          slug,
          name,
          published: true,
          registration_open: true,
          created_at: nowField(firebase)
        });
        activeEventId = ref.id;
        return eventFromDoc(await ref.get());
      },

      async updateEvent(eventId, state, extras = {}) {
        const ref = events().doc(eventId);
        await ref.update({ ...eventPayload(state, firebase), ...extras, updated_at: nowField(firebase) });
        activeEventId = eventId;
        return eventFromDoc(await ref.get());
      },

      async deleteEvent(eventId) {
        await this.clearApplicants(eventId);
        const backupSnapshot = await backups(eventId).get();
        const batch = db.batch();
        backupSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        await events().doc(eventId).delete();
      },

      async eventBySlug(slug) {
        const snapshot = await events().where("slug", "==", slug).limit(1).get();
        if (snapshot.empty) return null;
        const event = eventFromDoc(snapshot.docs[0]);
        if (event.published === false) return null;
        activeEventId = event.id;
        event.public_applicants = await this.applicants(event.id);
        return event;
      },

      async eventById(eventId) {
        activeEventId = eventId;
        return eventFromDoc(await events().doc(eventId).get());
      },

      async applicants(eventId) {
        activeEventId = eventId;
        const snapshot = await applicants(eventId).orderBy("created_at", "asc").get();
        return snapshot.docs.map(applicantFromDoc);
      },

      async submitApplicant(eventId, applicant) {
        const ref = applicants(eventId).doc(applicantId(applicant));
        const saved = await ref.get();
        if (saved.exists) {
          const duplicate = new Error("이미 신청된 인게임 닉네임입니다.");
          duplicate.code = "23505";
          throw duplicate;
        }
        await ref.set({ ...applicantToDoc(applicant), created_at: nowField(firebase), updated_at: nowField(firebase) });
      },

      async updateApplicant(eventId, applicant) {
        await applicants(eventId).doc(applicant.id).set({ ...applicantToDoc(applicant), updated_at: nowField(firebase) }, { merge: true });
      },

      async deleteApplicant(applicantIdValue) {
        if (!activeEventId) throw new Error("삭제할 내전이 선택되지 않았습니다.");
        await applicants(activeEventId).doc(applicantIdValue).delete();
      },

      async clearApplicants(eventId) {
        const snapshot = await applicants(eventId).get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      },

      async replaceApplicants(eventId, rows) {
        await this.clearApplicants(eventId);
        const batch = db.batch();
        rows.forEach((applicant) => {
          batch.set(applicants(eventId).doc(applicantId(applicant)), {
            ...applicantToDoc(applicant),
            created_at: nowField(firebase),
            updated_at: nowField(firebase)
          });
        });
        await batch.commit();
      },

      async listBackups(eventId) {
        const snapshot = await backups(eventId).orderBy("created_at", "desc").get();
        return snapshot.docs.map((doc) => ({ id: doc.id, event_id: eventId, ...(doc.data() || {}), created_at: toIso(doc.data()?.created_at) }));
      },

      async createBackup(eventId, label, snapshot) {
        const ref = backups(eventId).doc();
        await ref.set({ event_id: eventId, label, snapshot, created_at: nowField(firebase) });
        const doc = await ref.get();
        return { id: doc.id, event_id: eventId, ...(doc.data() || {}), created_at: toIso(doc.data()?.created_at) };
      },

      async deleteBackup(backupId) {
        if (!activeEventId) throw new Error("삭제할 내전이 선택되지 않았습니다.");
        await backups(activeEventId).doc(backupId).delete();
      },

      subscribeEvent(eventId, callback) {
        if (eventUnsubscribe) eventUnsubscribe();
        eventUnsubscribe = events().doc(eventId).onSnapshot(() => callback());
        return () => {
          if (eventUnsubscribe) eventUnsubscribe();
          eventUnsubscribe = null;
        };
      },

      subscribePublicEvent(eventId, callback) {
        return this.subscribeEvent(eventId, callback);
      },

      subscribeApplicants(eventId, callback) {
        if (applicantUnsubscribe) applicantUnsubscribe();
        applicantUnsubscribe = applicants(eventId).onSnapshot(() => callback());
        return () => {
          if (applicantUnsubscribe) applicantUnsubscribe();
          applicantUnsubscribe = null;
        };
      },

      async rankLookup(payload) {
        if (!config.rankLookupUrl) throw new Error("Firebase Functions rankLookup URL을 config.js에 설정해 주세요.");
        const response = await fetch(config.rankLookupUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.error) throw new Error(data.error || "랭크 조회에 실패했습니다.");
        return data;
      }
    };
  }

  window.ERCloud = { create };
})();
