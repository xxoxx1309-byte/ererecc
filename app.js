const STORAGE_KEY = "er-custom-match-calculator-v2";
const LEGACY_STORAGE_KEY = "er-scrim-calculator-v1";
const API_BASE = "https://open-api.bser.io";
const DEFAULT_SEASON_ID = 39;
const STATE_VERSION = 5;
const ROLES = ["스증원딜", "평원딜", "공격력브루저", "스증브루저", "암살자", "서포터", "탱커"];
const KOREAN_CHARACTER_NAMES = {
  1: "재키",
  2: "아야",
  3: "피오라",
  4: "매그너스",
  5: "자히르",
  6: "나딘",
  7: "현우",
  8: "하트",
  9: "아이솔",
  10: "리 다이린",
  11: "유키",
  12: "혜진",
  13: "쇼우",
  14: "키아라",
  15: "시셀라",
  16: "실비아",
  17: "아드리아나",
  18: "쇼이치",
  19: "엠마",
  20: "레녹스",
  21: "로지",
  22: "루크",
  23: "캐시",
  24: "아델라",
  25: "버니스",
  26: "바바라",
  27: "알렉스",
  28: "수아",
  29: "레온",
  30: "일레븐",
  31: "리오",
  32: "윌리엄",
  33: "니키",
  34: "나타폰",
  35: "얀",
  36: "이바",
  37: "다니엘",
  38: "제니",
  39: "카밀로",
  40: "클로에",
  41: "요한",
  42: "비앙카",
  43: "셀린",
  44: "에키온",
  45: "마이",
  46: "에이든",
  47: "라우라",
  48: "띠아",
  49: "펠릭스",
  50: "엘레나",
  51: "프리야",
  52: "아디나",
  53: "마커스",
  54: "칼라",
  55: "에스텔",
  56: "피올로",
  57: "마르티나",
  58: "헤이즈",
  59: "아이작",
  60: "타지아",
  61: "이렘",
  62: "테오도르",
  63: "이안",
  64: "바냐",
  65: "데비&마를렌",
  66: "아르다",
  67: "아비게일",
  68: "알론소",
  69: "레니",
  70: "츠바메",
  71: "케네스",
  72: "카티야",
  73: "샬럿",
  74: "다르코",
  75: "르노어",
  76: "가넷",
  77: "유민",
  78: "히스이",
  79: "유스티나",
  80: "이슈트반",
  81: "니아",
  82: "슈린",
  83: "헨리",
  84: "블레어",
  85: "미르카",
  86: "펜리르",
  87: "코렐라인",
  88: "비형",
  89: "크레이버"
};
const WEAPON_GROUPS = [
  {
    id: "A",
    weapons: ["글러브", "망치", "채찍", "카메라", "석궁"],
    choiceWeight: 20,
    profile: "근접 압박·제어·원거리 유틸"
  },
  {
    id: "B",
    weapons: ["톤파", "양손검", "쌍절곤", "아르카나", "활"],
    choiceWeight: 26,
    profile: "방어·결투·지속 원거리"
  },
  {
    id: "C",
    weapons: ["단검", "도끼", "VF의수", "암기", "돌격 소총"],
    choiceWeight: 24,
    profile: "암살·브루저·집중 화력"
  },
  {
    id: "D",
    weapons: ["방망이", "창", "권총", "기타"],
    choiceWeight: 25,
    profile: "교전 개시·기동·지원"
  },
  {
    id: "E",
    weapons: ["쌍검", "레이피어", "투척", "저격총"],
    choiceWeight: 22,
    profile: "근접 지속딜·포킹·장거리"
  }
];
const DEFAULT_SCORE_RULE = {
  placement: [10, 7, 5, 4, 3, 2, 1, 0],
  day1Kill: 0.5,
  lateKill: 1,
  penaltyDeath: 1
};

let state = loadState();
let selectedRoles = [];
let rankCache = null;
let seasons = [];
let characterNames = koreanCharacterNameMap();
let toastTimer = null;
let currentView = location.hash === "#admin" ? "admin" : "apply";
let runtimeConfig = { ...(window.ER_CONFIG || {}) };
let cloud = null;
let cloudSession = null;
let cloudEvent = null;
let cloudEvents = [];
let cloudApplicantUnsubscribe = null;
let cloudSaveTimer = null;
let cloudLoading = false;

const $ = (selector) => document.querySelector(selector);

function defaultState() {
  return {
    version: STATE_VERSION,
    settings: {
      eventName: "이터널 리턴 내전",
      apiKey: "",
      apiBase: API_BASE,
      seasonId: DEFAULT_SEASON_ID,
      teamMode: 3,
      matchCount: 4,
      desiredTeams: 8,
      teamSize: 3,
      tailChaseEnabled: false,
      weaponGroupEnabled: false,
      tournamentScoring: true,
      scoreRule: structuredClone(DEFAULT_SCORE_RULE)
    },
    eventInfo: {
      date: "",
      host: "",
      time: "",
      tierLimit: "",
      teamFormat: "",
      capacity: "",
      rules: ""
    },
    applicants: [],
    teams: [],
    captains: {},
    draft: {
      captainMode: "high",
      picked: []
    },
    weaponAssignments: {},
    replayCodes: ["", "", "", ""],
    scores: Array.from({ length: 4 }, () => ({})),
    updatedAt: null
  };
}

function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    return normalizeState(JSON.parse(current || legacy || "{}"), !current && Boolean(legacy));
  } catch {
    return defaultState();
  }
}

function normalizeState(saved, isLegacy = false) {
  const base = defaultState();
  const needsSeasonMigration = Number(saved.version || 0) < STATE_VERSION
    && Number(saved.settings?.seasonId) === 19;
  const settings = {
    ...base.settings,
    ...(saved.settings || {}),
    eventName: saved.settings?.eventName || base.settings.eventName,
    seasonId: isLegacy || needsSeasonMigration
      ? DEFAULT_SEASON_ID
      : Number(saved.settings?.seasonId || DEFAULT_SEASON_ID),
    matchCount: Number(saved.settings?.matchCount || saved.scores?.length || base.settings.matchCount),
    scoreRule: {
      ...DEFAULT_SCORE_RULE,
      ...(saved.settings?.scoreRule || {})
    }
  };
  const normalized = { ...base, ...saved, version: STATE_VERSION, settings };
  normalized.applicants = Array.isArray(saved.applicants) ? saved.applicants : [];
  normalized.eventInfo = { ...base.eventInfo, ...(saved.eventInfo || {}) };
  normalized.teams = Array.isArray(saved.teams) ? saved.teams : [];
  normalized.captains = saved.captains || {};
  normalized.draft = {
    ...base.draft,
    ...(saved.draft || {}),
    picked: Array.isArray(saved.draft?.picked) ? saved.draft.picked : []
  };
  normalized.weaponAssignments = saved.weaponAssignments || {};
  normalized.replayCodes = Array.isArray(saved.replayCodes) ? saved.replayCodes : [];
  normalized.scores = Array.isArray(saved.scores) ? saved.scores : [];
  syncMatchArrays(normalized);
  return normalized;
}

function syncMatchArrays(target = state) {
  const count = Math.min(12, Math.max(1, Number(target.settings.matchCount || 4)));
  target.settings.matchCount = count;
  while (target.replayCodes.length < count) target.replayCodes.push("");
  target.replayCodes.length = count;
  while (target.scores.length < count) target.scores.push({});
  target.scores.length = count;
}

function saveState(renderAfter = true) {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleCloudSave();
  if (renderAfter) render();
}

async function loadLocalConfig() {
  try {
    const response = await fetch("./config.local.json", { cache: "no-store" });
    if (!response.ok) return;
    const config = await response.json();
    runtimeConfig = { ...runtimeConfig, ...config };
    if (!state.settings.apiKey && config.apiKey) state.settings.apiKey = config.apiKey;
  } catch {
    // Optional local-only configuration.
  }
}

function cloudEventSlug() {
  return new URLSearchParams(location.search).get("event")?.trim() || "";
}

function isCloudOwner() {
  return Boolean(cloudEvent && cloudSession?.user?.id === cloudEvent.owner_id);
}

function cloudApplyUrl(event = cloudEvent) {
  if (!event) return "";
  const url = new URL(location.href);
  url.search = "";
  url.hash = "apply";
  url.searchParams.set("event", event.slug);
  return url.toString();
}

function setCloudStatus(text, type = "") {
  const status = $("#cloudStatus");
  status.textContent = text;
  status.className = `cloud-status ${type}`.trim();
}

function renderCloudControls() {
  const configured = Boolean(cloud?.configured);
  $("#cloudUnavailable").hidden = configured;
  $("#adminLoginForm").hidden = !configured || Boolean(cloudSession);
  $("#cloudWorkspace").hidden = !configured || !cloudSession;
  if (!configured) {
    setCloudStatus("브라우저 저장 모드", "manual");
    updateApplicationAvailability();
    return refreshIcons();
  }
  if (!cloudSession) {
    setCloudStatus("관리자 로그인 필요", "manual");
    updateApplicationAvailability();
    return refreshIcons();
  }

  setCloudStatus(cloudEvent ? "실시간 연결됨" : "내전을 선택하세요", cloudEvent ? "ok" : "manual");
  $("#adminAccount").textContent = cloudSession.user.email || "관리자";
  const select = $("#cloudEventSelect");
  select.innerHTML = cloudEvents.length
    ? cloudEvents.map((event) => `<option value="${event.id}" ${event.id === cloudEvent?.id ? "selected" : ""}>${escapeHtml(event.name)} · ${escapeHtml(event.slug)}</option>`).join("")
    : `<option value="">생성된 내전이 없습니다</option>`;
  select.disabled = !cloudEvents.length;
  $("#deleteCloudEvent").disabled = !cloudEvent || !isCloudOwner();
  $("#currentCloudEvent").hidden = !cloudEvent || !isCloudOwner();
  if (cloudEvent && isCloudOwner()) {
    $("#registrationOpen").checked = cloudEvent.registration_open !== false;
    $("#cloudApplyLink").value = cloudApplyUrl();
  }
  updateApplicationAvailability();
  refreshIcons();
}

function updateApplicationAvailability() {
  const status = $("#cloudApplyStatus");
  const submit = $("#submitApplicant");
  if (!cloud?.configured) {
    status.hidden = true;
    submit.disabled = false;
    return;
  }
  status.hidden = false;
  if (!cloudEvent) {
    status.className = "cloud-apply-status error";
    status.textContent = "온라인 신청 링크가 올바르지 않습니다. 관리자에게 받은 내전별 링크로 접속해 주세요.";
    submit.disabled = true;
    return;
  }
  const open = cloudEvent.registration_open !== false;
  status.className = `cloud-apply-status ${open ? "ok" : "closed"}`;
  status.textContent = open
    ? `${cloudEvent.name} · 실시간 신청 접수 중`
    : `${cloudEvent.name} · 신청이 마감되었습니다.`;
  submit.disabled = !open;
}

function applyCloudState(event, applicants = []) {
  const localApiKey = state.settings.apiKey || runtimeConfig.apiKey || "";
  cloudLoading = true;
  state = normalizeState(cloud.stateFromEvent(event, applicants));
  state.settings.apiKey = localApiKey;
  cloudEvent = event;
  bindSettings();
  render();
  cloudLoading = false;
  renderCloudControls();
}

async function reloadCloudApplicants() {
  if (!cloudEvent || !isCloudOwner()) return;
  state.applicants = await cloud.applicants(cloudEvent.id);
  render();
}

function subscribeCloudApplicants() {
  if (cloudApplicantUnsubscribe) cloudApplicantUnsubscribe();
  cloudApplicantUnsubscribe = null;
  if (!cloudEvent || !isCloudOwner()) return;
  cloudApplicantUnsubscribe = cloud.subscribeApplicants(cloudEvent.id, () => {
    clearTimeout(subscribeCloudApplicants.timer);
    subscribeCloudApplicants.timer = setTimeout(() => reloadCloudApplicants().catch((error) => toast(error.message)), 180);
  });
}

async function loadAdminCloudEvent(eventId) {
  if (!eventId || !cloudSession) return;
  cloudLoading = true;
  try {
    const event = await cloud.eventById(eventId);
    const applicants = await cloud.applicants(event.id);
    applyCloudState(event, applicants);
    subscribeCloudApplicants();
    const url = new URL(location.href);
    url.searchParams.set("event", event.slug);
    url.hash = "admin";
    history.replaceState(null, "", url);
    setView("admin", false);
  } finally {
    cloudLoading = false;
  }
}

async function loadPublicCloudEvent(slug) {
  if (!slug || !cloud?.configured) return;
  const event = await cloud.eventBySlug(slug);
  if (!event) {
    cloudEvent = null;
    renderCloudControls();
    return toast("해당 신청 내전을 찾지 못했습니다.");
  }
  const applicants = cloudSession?.user?.id === event.owner_id ? await cloud.applicants(event.id) : [];
  applyCloudState(event, applicants);
  if (isCloudOwner()) subscribeCloudApplicants();
}

async function refreshCloudEvents(preferredId = "") {
  if (!cloudSession) return;
  cloudEvents = await cloud.listEvents(cloudSession.user.id);
  const selected = preferredId || cloudEvent?.id || cloudEvents[0]?.id || "";
  renderCloudControls();
  if (selected) await loadAdminCloudEvent(selected);
  if (!cloudEvents.length) $("#createEventForm").hidden = false;
}

async function handleCloudSession(session) {
  cloudSession = session;
  if (!session) {
    cloudEvents = [];
    if (cloudApplicantUnsubscribe) cloudApplicantUnsubscribe();
    cloudApplicantUnsubscribe = null;
    renderCloudControls();
    return;
  }
  await refreshCloudEvents();
  const slug = cloudEventSlug();
  if (slug && cloudEvent?.slug !== slug) await loadPublicCloudEvent(slug);
  renderCloudControls();
}

async function initializeCloud() {
  cloud = window.ERCloud?.create(runtimeConfig) || { configured: false };
  renderCloudControls();
  if (!cloud.configured) return;
  cloudSession = await cloud.session();
  cloud.onAuthChange((session) => {
    if ((session?.user?.id || "") === (cloudSession?.user?.id || "")) return;
    handleCloudSession(session).catch((error) => toast(error.message));
  });
  const slug = cloudEventSlug();
  if (slug) await loadPublicCloudEvent(slug);
  if (cloudSession) await refreshCloudEvents(cloudEvent?.id);
  renderCloudControls();
}

function scheduleCloudSave() {
  if (cloudLoading || !cloud?.configured || !cloudEvent || !isCloudOwner()) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    try {
      setCloudStatus("저장 중");
      cloudEvent = await cloud.updateEvent(cloudEvent.id, state);
      setCloudStatus("실시간 저장됨", "ok");
      const index = cloudEvents.findIndex((event) => event.id === cloudEvent.id);
      if (index >= 0) cloudEvents[index] = cloudEvent;
    } catch (error) {
      setCloudStatus("저장 실패", "error");
      toast(error.message);
    }
  }, 500);
}

function bindSettings() {
  $("#eventName").value = state.settings.eventName;
  $("#apiKey").value = state.settings.apiKey || "";
  $("#apiBase").value = API_BASE;
  $("#teamMode").value = String(state.settings.teamMode || 3);
  $("#matchCount").value = state.settings.matchCount;
  $("#desiredTeams").value = state.settings.desiredTeams || 8;
  $("#teamSize").value = state.settings.teamSize || 3;
  $("#draftCaptainMode").value = state.draft?.captainMode || "high";
  $("#tailChaseEnabled").checked = state.settings.tailChaseEnabled === true;
  $("#weaponGroupEnabled").checked = state.settings.weaponGroupEnabled === true;
  $("#tournamentScoring").checked = state.settings.tournamentScoring !== false;
  $("#placementPoints").value = currentScoreRule().placement.join(",");
  $("#day1KillPoint").value = currentScoreRule().day1Kill;
  $("#lateKillPoint").value = currentScoreRule().lateKill;
  $("#penaltyDeathPoint").value = currentScoreRule().penaltyDeath;
  $("#eventDate").value = state.eventInfo.date || "";
  $("#eventHost").value = state.eventInfo.host || "";
  $("#eventTime").value = state.eventInfo.time || "";
  $("#tierLimit").value = state.eventInfo.tierLimit || "";
  $("#teamFormat").value = state.eventInfo.teamFormat || "";
  $("#capacity").value = state.eventInfo.capacity || "";
  $("#eventRules").value = state.eventInfo.rules || "";
  populateSeasonSelect();
}

function readSettings() {
  const placement = $("#placementPoints").value
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite)
    .slice(0, 8);

  state.settings = {
    ...state.settings,
    eventName: $("#eventName").value.trim() || "이터널 리턴 내전",
    apiKey: $("#apiKey").value.trim(),
    apiBase: API_BASE,
    seasonId: Number($("#seasonId").value || state.settings.seasonId || DEFAULT_SEASON_ID),
    teamMode: Number($("#teamMode").value || 3),
    matchCount: Math.min(12, Math.max(1, Number($("#matchCount").value || 4))),
    desiredTeams: Math.min(12, Math.max(2, Number($("#desiredTeams").value || 8))),
    teamSize: Math.min(4, Math.max(1, Number($("#teamSize").value || 3))),
    tailChaseEnabled: $("#tailChaseEnabled").checked,
    weaponGroupEnabled: $("#weaponGroupEnabled").checked,
    tournamentScoring: $("#tournamentScoring").checked,
    scoreRule: {
      placement: placement.length === 8 ? placement : [...DEFAULT_SCORE_RULE.placement],
      day1Kill: Number($("#day1KillPoint").value || DEFAULT_SCORE_RULE.day1Kill),
      lateKill: Number($("#lateKillPoint").value || DEFAULT_SCORE_RULE.lateKill),
      penaltyDeath: Number($("#penaltyDeathPoint").value || DEFAULT_SCORE_RULE.penaltyDeath)
    }
  };
  state.eventInfo = {
    date: $("#eventDate").value.trim(),
    host: $("#eventHost").value.trim(),
    time: $("#eventTime").value.trim(),
    tierLimit: $("#tierLimit").value.trim(),
    teamFormat: $("#teamFormat").value.trim(),
    capacity: $("#capacity").value.trim(),
    rules: $("#eventRules").value.trim()
  };
  syncMatchArrays();
}

function currentScoreRule() {
  return { ...DEFAULT_SCORE_RULE, ...(state.settings.scoreRule || {}) };
}

function placementPoints() {
  return Object.fromEntries(currentScoreRule().placement.map((point, index) => [index + 1, point]));
}

async function erFetch(path) {
  if (!state.settings.apiKey) throw new Error("설정에서 Open API 키를 입력해 주세요.");
  const response = await fetch(`${API_BASE}/${path.replace(/^\/+/, "")}`, {
    headers: { accept: "application/json", "x-api-key": state.settings.apiKey }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || Number(json.code) >= 400) {
    if (response.status === 429) throw new Error("API 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
    throw new Error(json.message || `API 요청 실패 (${response.status})`);
  }
  return json;
}

async function refreshApiMetadata(showMessage = false) {
  setApiStatus("loading", "API 확인 중");
  try {
    if (!state.settings.apiKey) {
      if (cloud?.configured) {
        setApiStatus("ok", "온라인 조회 가능");
        if (showMessage) toast("온라인 랭크 조회 기능을 사용합니다.");
        return true;
      }
      setApiStatus("manual", "수동 신청 가능");
      if (showMessage) toast("API 키 없이도 참가자 등록은 가능합니다.");
      return false;
    }
    const [seasonJson, characterJson] = await Promise.all([
      erFetch("v2/data/Season"),
      erFetch("v2/data/Character")
    ]);
    seasons = (seasonJson.data || []).filter((season) => !/pre/i.test(season.seasonName));
    characterNames = koreanCharacterNameMap();
    (characterJson.data || []).forEach((character) => {
      const code = Number(character.code);
      if (!characterNames.has(code)) characterNames.set(code, character.name || character.resource || `실험체 #${character.code}`);
    });
    const koreanNames = await loadKoreanCharacterNames();
    koreanNames.forEach((name, code) => characterNames.set(code, name));
    const hasSelected = seasons.some((season) => Number(season.seasonID) === Number(state.settings.seasonId));
    if (!hasSelected) state.settings.seasonId = DEFAULT_SEASON_ID;
    populateSeasonSelect();
    setApiStatus("ok", "API 연결됨");
    if (showMessage) toast("Open API 연결을 확인했습니다.");
    return true;
  } catch (error) {
    setApiStatus("error", "API 연결 실패");
    if (showMessage) toast(error.message);
    return false;
  }
}

function populateSeasonSelect() {
  const select = $("#seasonId");
  if (!select) return;
  const list = seasons.length
    ? seasons
    : [{ seasonID: state.settings.seasonId, seasonName: `Season ${Math.ceil(Number(state.settings.seasonId) / 2)}` }];
  select.innerHTML = list
    .slice()
    .sort((a, b) => Number(b.seasonID) - Number(a.seasonID))
    .map((season) => `<option value="${season.seasonID}" ${Number(season.seasonID) === Number(state.settings.seasonId) ? "selected" : ""}>${escapeHtml(displaySeasonName(season))} · API ${season.seasonID}${Number(season.isCurrent) === 1 ? " · 현재" : ""}</option>`)
    .join("");
  updateSeasonLabel();
}

function updateSeasonLabel() {
  const season = seasons.find((item) => Number(item.seasonID) === Number(state.settings.seasonId));
  $("#seasonLabel").textContent = season
    ? `${displaySeasonName(season)} · API ID ${season.seasonID}`
    : `정출 시즌 11 · API ID ${state.settings.seasonId}`;
}

function displaySeasonName(season) {
  const apiSeason = Number(String(season.seasonName || "").match(/\d+/)?.[0]);
  if (apiSeason >= 10) return `정출 시즌 ${apiSeason - 9}`;
  return season.seasonName || `API 시즌 ${season.seasonID}`;
}

function setApiStatus(type, text) {
  const chip = $("#apiStatus");
  const dot = $("#rankApiDot");
  chip.textContent = text;
  chip.className = `status-chip ${type === "loading" ? "" : type}`;
  dot.className = `api-dot ${type === "loading" ? "" : type}`;
}

function renderRoles() {
  const wrap = $("#roleButtons");
  wrap.innerHTML = "";
  ROLES.forEach((role) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = role;
    button.className = selectedRoles.includes(role) ? "active" : "";
    button.addEventListener("click", () => toggleRole(role));
    wrap.appendChild(button);
  });
  $("#roleOrder").innerHTML = selectedRoles.length
    ? selectedRoles.map((role, index) => `<span>${index + 1}. ${role}</span>`).join("")
    : "<span>3개를 순서대로 선택하세요</span>";
}

function toggleRole(role) {
  if (selectedRoles.includes(role)) selectedRoles = selectedRoles.filter((item) => item !== role);
  else if (selectedRoles.length < 3) selectedRoles.push(role);
  else toast("역할군은 3개까지 선택할 수 있습니다.");
  renderRoles();
}

async function lookupRank() {
  const nickname = $("#nickname").value.trim();
  if (!nickname) return toast("닉네임을 입력해 주세요.");
  const useCloudLookup = Boolean(cloud?.configured && cloudEvent);
  if (!useCloudLookup && !state.settings.apiKey) {
    rankCache = null;
    updateRankPreview({ message: "API 키가 없어 랭크 조회를 건너뜁니다. 닉네임과 역할군만으로 바로 신청할 수 있습니다." }, "manual");
    return toast("API 키 없이 수동 신청으로 진행할 수 있습니다.");
  }

  updateRankPreview(null, "loading");
  try {
    const seasonId = state.settings.seasonId;
    const teamMode = state.settings.teamMode;
    let user;
    let rankJson;
    let statsJson;
    if (useCloudLookup) {
      const result = await cloud.rankLookup({ nickname, seasonId, teamMode });
      user = result.user;
      rankJson = { userRank: result.rank || {} };
      statsJson = { userStats: [result.stats || {}] };
    } else {
      const userJson = await erFetch(`v1/user/nickname?query=${encodeURIComponent(nickname)}`);
      user = userJson.user;
      if (!user?.userId) throw new Error("닉네임에 해당하는 계정을 찾지 못했습니다.");
      const userId = encodeURIComponent(user.userId);
      [rankJson, statsJson] = await Promise.all([
        erFetch(`v1/rank/uid/${userId}/${seasonId}/${teamMode}`),
        erFetch(`v2/user/stats/uid/${userId}/${seasonId}/3`)
      ]);
    }
    const stats = (statsJson.userStats || []).find((item) => Number(item.matchingTeamMode) === teamMode) || statsJson.userStats?.[0] || {};
    const mostStats = (stats.characterStats || [])
      .slice()
      .sort((a, b) => Number(b.usages || b.totalGames || 0) - Number(a.usages || a.totalGames || 0))
      .slice(0, 3)
      .map((item) => ({
        characterCode: Number(item.characterCode),
        name: characterNames.get(Number(item.characterCode)) || `실험체 #${item.characterCode}`,
        totalGames: Number(item.totalGames || item.usages || 0),
        wins: Number(item.wins || 0)
      }));

    rankCache = {
      userId: user.userId,
      nickname,
      mmr: rankJson.userRank?.mmr ?? stats.mmr ?? null,
      rank: rankJson.userRank?.rank ?? stats.rank ?? null,
      totalGames: stats.totalGames ?? 0,
      totalWins: stats.totalWins ?? 0,
      averageRank: stats.averageRank ?? null,
      averageKills: stats.averageKills ?? null,
      top3: stats.top3 ?? null,
      rankPercent: stats.rankPercent ?? null,
      most: mostStats.map((item) => item.name),
      mostStats
    };
    $("#manualMmr").value = rankCache.mmr || "";
    $("#manualRank").value = rankCache.rank || "";
    updateRankPreview(rankCache);
  } catch (error) {
    rankCache = null;
    updateRankPreview({ message: error.message }, "error");
  }
}

function updateRankPreview(data, stateName = "success") {
  const wrap = $("#rankPreview");
  if (stateName === "loading") {
    wrap.className = "rank-empty";
    wrap.innerHTML = `<i data-lucide="loader-circle"></i><strong>랭크 조회 중</strong><p>공식 Open API에서 시즌 기록을 확인하고 있습니다.</p>`;
  } else if (stateName === "error") {
    wrap.className = "rank-empty";
    wrap.innerHTML = `<i data-lucide="circle-alert"></i><strong>조회하지 못했습니다</strong><p>${escapeHtml(data.message)}</p>`;
  } else if (stateName === "manual") {
    wrap.className = "rank-empty";
    wrap.innerHTML = `<i data-lucide="clipboard-pen-line"></i><strong>수동 신청 가능</strong><p>${escapeHtml(data.message)}</p>`;
  } else {
    const winRate = formatWinRate(data.totalWins, data.totalGames);
    const winRecord = data.totalGames
      ? `${formatNumber(data.totalWins, true)}승 / ${formatNumber(data.totalGames, true)}경기`
      : "기록 없음";
    wrap.className = "rank-result";
    wrap.innerHTML = `
      <div class="rank-identity">
        <strong>${escapeHtml(data.nickname)}</strong>
        <span>${escapeHtml($("#seasonId").selectedOptions[0]?.textContent || "")} · ${teamModeLabel()}</span>
      </div>
      <div class="rank-metrics">
        <div><span>MMR</span><strong>${formatNumber(data.mmr)}</strong></div>
        <div><span>랭킹</span><strong>${data.rank ? `${formatNumber(data.rank)}위` : "-"}</strong></div>
        <div><span>랭크 게임</span><strong>${formatNumber(data.totalGames)}</strong></div>
        <div><span>승률</span><strong>${winRate}</strong><small>${winRecord}</small></div>
        <div><span>평균 순위</span><strong>${formatDecimal(data.averageRank)}</strong></div>
        <div><span>평균 킬</span><strong>${formatDecimal(data.averageKills)}</strong></div>
      </div>
      <div>
        <p class="field-title">모스트 실험체</p>
        <div class="most-list">${renderMostStats(data)}</div>
      </div>
    `;
  }
  refreshIcons();
}

function teamModeLabel() {
  return ({ 1: "솔로", 2: "듀오", 3: "스쿼드" })[state.settings.teamMode] || "스쿼드";
}

async function submitApplicant(event) {
  event.preventDefault();
  const nickname = $("#nickname").value.trim();
  if (!nickname || selectedRoles.length !== 3) return toast("닉네임과 역할군 3개를 모두 입력해 주세요.");
  const applicant = {
    id: crypto.randomUUID(),
    nickname,
    discordName: $("#discordName").value.trim(),
    roles: [...selectedRoles],
    userId: rankCache?.userId || null,
    mmr: Number($("#manualMmr").value || rankCache?.mmr || 0),
    rank: Number($("#manualRank").value || rankCache?.rank || 0),
    totalGames: rankCache?.totalGames || 0,
    totalWins: rankCache?.totalWins || 0,
    most: rankCache?.most || [],
    mostStats: rankCache?.mostStats || [],
    memo: $("#memo").value.trim(),
    createdAt: new Date().toISOString()
  };
  if (cloud?.configured) {
    if (!cloudEvent) return toast("올바른 내전 신청 링크로 접속해 주세요.");
    if (cloudEvent.registration_open === false) return toast("참가 신청이 마감되었습니다.");
    try {
      $("#submitApplicant").disabled = true;
      await cloud.submitApplicant(cloudEvent.id, applicant);
      resetForm();
      updateApplicationAvailability();
      toast("참가 신청이 실시간으로 등록되었습니다.");
    } catch (error) {
      const duplicate = error.code === "23505" || /duplicate|unique/i.test(error.message);
      toast(duplicate ? "이미 신청된 인게임 닉네임입니다." : error.message);
      updateApplicationAvailability();
    }
    return;
  }
  const index = state.applicants.findIndex((item) => item.nickname.toLowerCase() === nickname.toLowerCase());
  if (index >= 0) state.applicants[index] = { ...state.applicants[index], ...applicant, id: state.applicants[index].id };
  else state.applicants.push(applicant);
  resetForm();
  saveState();
  toast(index >= 0 ? "참가자 정보를 갱신했습니다." : "참가자를 등록했습니다.");
}

function resetForm() {
  $("#applicantForm").reset();
  selectedRoles = [];
  rankCache = null;
  $("#rankPreview").className = "rank-empty";
  $("#rankPreview").innerHTML = `<i data-lucide="scan-search"></i><strong>랭크 조회는 선택입니다</strong><p>API 키가 없어도 닉네임과 역할군만으로 신청할 수 있습니다.</p>`;
  renderRoles();
  refreshIcons();
}

function makeTeams() {
  readTeamControls();
  const { desiredTeams, teamSize } = state.settings;
  if (state.applicants.length < desiredTeams) return toast("팀 수보다 참가자가 적습니다.");
  const maxPlayers = desiredTeams * teamSize;
  const sorted = state.applicants
    .slice()
    .sort((a, b) => Number(b.mmr || 0) - Number(a.mmr || 0))
    .slice(0, maxPlayers);
  const teams = Array.from({ length: desiredTeams }, (_, index) => ({
    id: crypto.randomUUID(),
    name: `${index + 1}팀`,
    members: []
  }));
  sorted.forEach((applicant, index) => {
    const round = Math.floor(index / desiredTeams);
    const offset = index % desiredTeams;
    const teamIndex = round % 2 === 0 ? offset : desiredTeams - 1 - offset;
    teams[teamIndex].members.push(applicant.id);
  });
  state.teams = teams.filter((team) => team.members.length);
  state.captains = {};
  normalizeScores();
  saveState();
  toast(`${state.teams.length}개 팀을 편성했습니다.`);
}

function readTeamControls() {
  state.settings.desiredTeams = Math.min(12, Math.max(2, Number($("#desiredTeams").value || 8)));
  state.settings.teamSize = Math.min(4, Math.max(1, Number($("#teamSize").value || 3)));
}

function normalizeScores() {
  syncMatchArrays();
  state.scores = state.scores.map((match) => {
    const next = {};
    state.teams.forEach((team) => {
      next[team.id] = match[team.id] || { place: "", day1Kills: 0, lateKills: 0, penaltyDeaths: 0, bans: "" };
    });
    return next;
  });
}

function getApplicant(id) {
  return state.applicants.find((item) => item.id === id);
}

function scoreFor(entry = {}) {
  const rule = currentScoreRule();
  const placeScore = placementPoints()[Number(entry.place || 0)] ?? 0;
  return placeScore
    + Number(entry.day1Kills || 0) * rule.day1Kill
    + Number(entry.lateKills || 0) * rule.lateKill
    - Number(entry.penaltyDeaths || 0) * rule.penaltyDeath;
}

function teamTotal(teamId) {
  return state.scores.reduce((sum, match) => sum + scoreFor(match[teamId]), 0);
}

function renderTeams() {
  $("#teamCount").textContent = state.teams.length;
  renderDraftBoard();
  renderTailRuleBoard();
  renderWeaponRuleBoard();
  $("#teamsBoard").innerHTML = state.teams.map((team) => {
    const totalMmr = team.members.reduce((sum, id) => sum + Number(getApplicant(id)?.mmr || 0), 0);
    const members = team.members.map((id, index) => {
      const player = getApplicant(id);
      if (!player) return "";
      const captain = state.captains[team.id] === player.id;
      const name = player.discordName ? `${player.discordName} (${player.nickname})` : player.nickname;
      const roleOrder = (player.roles || []).map((role, roleIndex) => `${roleIndex + 1}. ${role}`).join(" / ");
      return `<li>${captain ? "팀장 · " : ""}${escapeHtml(name)}<span class="role-tag">${escapeHtml(player.roles?.[0] || "-")}</span><br><small>MMR ${formatNumber(player.mmr)} · ${escapeHtml(roleOrder || "역할군 미지정")}</small></li>`;
    }).join("");
    return `<article class="team-card"><header><span>${team.name}</span><span>합계 ${formatNumber(totalMmr)}</span></header><ol>${members}</ol></article>`;
  }).join("") || `<p class="note">참가자를 등록한 뒤 자동 편성을 실행하세요.</p>`;
  renderCaptains();
}

function tailRuleTeams() {
  if (state.teams.length) return state.teams.map((team) => team.name);
  const count = Math.min(12, Math.max(2, Number(state.settings.desiredTeams || 8)));
  return Array.from({ length: count }, (_, index) => `${index + 1}팀`);
}

function renderTailRuleBoard() {
  const box = $("#tailRuleBox");
  const board = $("#tailRuleBoard");
  if (!box || !board) return;
  box.hidden = state.settings.tailChaseEnabled !== true;
  if (box.hidden) return void (board.innerHTML = "");
  const teams = tailRuleTeams();
  board.innerHTML = teams.map((team, index) => {
    const blocked = teams[(index + 1) % teams.length];
    return `
      <article class="tail-rule-card">
        <span>${escapeHtml(team)}</span>
        <i data-lucide="arrow-right"></i>
        <strong>${escapeHtml(blocked)}</strong>
        <small>공격 금지</small>
      </article>`;
  }).join("");
}

function renderWeaponRuleBoard() {
  const box = $("#weaponRuleBox");
  if (!box) return;
  box.hidden = state.settings.weaponGroupEnabled !== true;
  if (box.hidden) return;
  $("#weaponGroupBoard").innerHTML = WEAPON_GROUPS.map((group) => `
    <article class="weapon-group-row">
      <span class="weapon-group-name">${group.id}</span>
      <div>
        <strong>${group.id} 무기군</strong>
        <p>${group.weapons.map((weapon) => `<span>${escapeHtml(weapon)}</span>`).join("")}</p>
      </div>
      <small>${escapeHtml(group.profile)}<br>선택 폭 지수 ${group.choiceWeight}</small>
    </article>`).join("");

  const teams = tailRuleTeams();
  const validNames = new Set(teams);
  Object.keys(state.weaponAssignments).forEach((name) => {
    if (!validNames.has(name)) delete state.weaponAssignments[name];
  });
  $("#weaponAssignmentBoard").innerHTML = teams.map((team, index) => {
    const selected = state.weaponAssignments[team] || WEAPON_GROUPS[index % WEAPON_GROUPS.length].id;
    return `<label>${escapeHtml(team)}
      <select data-weapon-assignment="${escapeHtml(team)}">
        ${WEAPON_GROUPS.map((group) => `<option value="${group.id}" ${group.id === selected ? "selected" : ""}>${group.id} 무기군 · ${group.weapons.join(" / ")}</option>`).join("")}
      </select>
    </label>`;
  }).join("");
}

function sortedApplicantsByMmr(ascending = false) {
  return state.applicants
    .slice()
    .sort((a, b) => ascending
      ? Number(a.mmr || 0) - Number(b.mmr || 0)
      : Number(b.mmr || 0) - Number(a.mmr || 0));
}

function draftCaptainIds() {
  const count = Math.min(Number(state.settings.desiredTeams || 8), state.applicants.length);
  return sortedApplicantsByMmr(state.draft?.captainMode === "low").slice(0, count).map((player) => player.id);
}

function renderDraftBoard() {
  const board = $("#draftBoard");
  if (!board) return;
  if ($("#draftCaptainMode")) $("#draftCaptainMode").value = state.draft?.captainMode || "high";
  const validIds = new Set(state.applicants.map((player) => player.id));
  state.draft.picked = (state.draft.picked || []).filter((id) => validIds.has(id));
  if (!state.applicants.length) {
    board.innerHTML = `<p class="note">참가자를 등록하면 팀장 후보와 남은 인원이 표시됩니다.</p>`;
    return;
  }
  const captainIds = new Set(draftCaptainIds());
  const pickedIds = new Set(state.draft.picked || []);
  const captains = sortedApplicantsByMmr(state.draft?.captainMode === "low").filter((player) => captainIds.has(player.id));
  const remaining = sortedApplicantsByMmr().filter((player) => !captainIds.has(player.id) && !pickedIds.has(player.id));
  const picked = sortedApplicantsByMmr().filter((player) => pickedIds.has(player.id));
  board.innerHTML = `
    <div class="draft-column captains">
      <h3>팀장 후보 <span>${captains.length}</span></h3>
      <div class="draft-list">${captains.map((player, index) => draftPlayerButton(player, index + 1, "captain")).join("") || "<p class=\"empty\">없음</p>"}</div>
    </div>
    <div class="draft-column">
      <h3>남은 인원 <span>${remaining.length}</span></h3>
      <div class="draft-list">${remaining.map((player, index) => draftPlayerButton(player, index + 1, "pick")).join("") || "<p class=\"empty\">남은 인원이 없습니다.</p>"}</div>
    </div>
    <div class="draft-column picked">
      <h3>뽑힘 <span>${picked.length}</span></h3>
      <div class="draft-list">${picked.map((player, index) => draftPlayerButton(player, index + 1, "unpick")).join("") || "<p class=\"empty\">아직 체크된 인원이 없습니다.</p>"}</div>
    </div>`;
}

function draftPlayerButton(player, index, action) {
  const name = player.discordName ? `${player.discordName} (${player.nickname})` : player.nickname;
  const role = player.roles?.[0] || "-";
  const disabled = action === "captain" ? " disabled" : "";
  const token = action === "captain" ? "" : ` data-draft-${action}="${player.id}"`;
  return `<button class="draft-player ${action}" type="button"${token}${disabled}>
    <span>${index}</span>
    <strong>${escapeHtml(name)}</strong>
    <small>MMR ${formatNumber(player.mmr)} · ${escapeHtml(role)}</small>
  </button>`;
}

function renderCaptains() {
  const board = $("#captainBoard");
  if (!state.teams.length) return void (board.innerHTML = "");
  board.innerHTML = `
    <p class="field-title">팀장 지정</p>
    <div class="captain-grid">
      ${state.teams.map((team) => `
        <label class="captain-item">${team.name}
          <select data-captain="${team.id}">
            <option value="">팀장 미정</option>
            ${team.members.map((id) => {
              const player = getApplicant(id);
              return player ? `<option value="${id}" ${state.captains[team.id] === id ? "selected" : ""}>${escapeHtml(player.discordName || player.nickname)} · ${escapeHtml(player.roles[0])}</option>` : "";
            }).join("")}
          </select>
        </label>`).join("")}
    </div>`;
}

function renderScores() {
  normalizeScores();
  renderReplayCodes();
  renderScoreSummary();
  renderMatchCards();
  renderBanBoard();
  renderRoundBanSummary();
  renderBanSummary();
  renderScoreRules();
}

function renderReplayCodes() {
  $("#replayBoard").innerHTML = `
    <p class="field-title">리플레이 코드</p>
    <div class="replay-grid">
      ${state.replayCodes.map((code, index) => `<label>${index + 1}경기<input data-replay="${index}" value="${escapeHtml(code)}" placeholder="코드 입력"></label>`).join("")}
    </div>`;
}

function renderScoreSummary() {
  if (!state.teams.length) return void ($("#scoreSummary").innerHTML = "");
  const headers = state.teams.map((team) => `<th>${team.name}</th>`).join("");
  const rows = state.scores.map((match, index) => `<tr><th>${index + 1}경기</th>${state.teams.map((team) => `<td>${scoreFor(match[team.id])}</td>`).join("")}</tr>`).join("");
  const total = `<tr><th>총점</th>${state.teams.map((team) => `<td><strong>${teamTotal(team.id)}</strong></td>`).join("")}</tr>`;
  $("#scoreSummary").innerHTML = `<table class="sheet-table"><thead><tr><th></th>${headers}</tr></thead><tbody>${rows}${total}</tbody></table>`;
}

function renderMatchCards() {
  const board = $("#scoreBoard");
  board.innerHTML = "";
  state.scores.forEach((match, matchIndex) => {
    const template = $("#matchTemplate").content.cloneNode(true);
    template.querySelector("h3").textContent = `${matchIndex + 1}경기`;
    const grid = template.querySelector(".match-grid");
    grid.innerHTML = "<b>팀 / 점수</b><b>등수</b><b>1일차 킬</b><b>이후 킬</b><b>금구사</b>";
    state.teams.forEach((team) => {
      const entry = match[team.id] || {};
      grid.insertAdjacentHTML("beforeend", `
        <span>${team.name} · <strong>${scoreFor(entry)}점</strong></span>
        <select data-score="${matchIndex}:${team.id}:place">
          <option value="">-</option>
          ${Object.keys(placementPoints()).map((place) => `<option value="${place}" ${String(entry.place) === place ? "selected" : ""}>${place}등</option>`).join("")}
        </select>
        <input data-score="${matchIndex}:${team.id}:day1Kills" type="number" min="0" value="${entry.day1Kills || 0}">
        <input data-score="${matchIndex}:${team.id}:lateKills" type="number" min="0" value="${entry.lateKills || 0}">
        <input data-score="${matchIndex}:${team.id}:penaltyDeaths" type="number" min="0" value="${entry.penaltyDeaths || 0}">`);
    });
    board.appendChild(template);
  });
}

function renderBanBoard() {
  const headers = state.teams.map((team) => `<th>${team.name}</th>`).join("");
  const rows = state.scores.map((match, matchIndex) => `
    <tr><th>${matchIndex + 1}경기</th>${state.teams.map((team) => `<td><input data-ban="${matchIndex}:${team.id}" value="${escapeHtml(match[team.id]?.bans || "")}" placeholder="실험체"></td>`).join("")}</tr>`).join("");
  $("#banBoard").innerHTML = state.teams.length
    ? `<table class="sheet-table"><caption>Ban Phase</caption><thead><tr><th></th>${headers}</tr></thead><tbody>${rows}</tbody></table>`
    : `<p class="note">팀 편성 후 밴 기록을 입력할 수 있습니다.</p>`;
}

function banCountsForMatch(match) {
  const counts = new Map();
  Object.values(match).forEach((entry) => {
    String(entry.bans || "").split(/[,\s/]+/).map((name) => name.trim()).filter(Boolean)
      .forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
  });
  return counts;
}

function renderRoundBanSummary() {
  const rounds = state.scores.map((match, index) => {
    const names = [...banCountsForMatch(match).entries()].filter(([, count]) => count >= 3).map(([name]) => name).join(", ");
    return `<span>${index + 1}R<br>${escapeHtml(names || "-")}</span>`;
  }).join("");
  $("#roundBanSummary").innerHTML = `<h3>라운드 3회 이상 밴</h3><div class="pill-list">${rounds}</div>`;
}

function renderBanSummary() {
  const counts = new Map();
  state.scores.forEach((match) => {
    [...banCountsForMatch(match).keys()].forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
  });
  const repeated = [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]);
  $("#banSummary").innerHTML = repeated.length
    ? `<h3>2경기 이상 밴</h3><div class="pill-list">${repeated.map(([name, count]) => `<span>${escapeHtml(name)}<br>${count}경기</span>`).join("")}</div>`
    : `<h3>2경기 이상 밴</h3><p class="empty">없음</p>`;
}

function renderScoreRules() {
  const rule = currentScoreRule();
  $("#scoreRuleBox").innerHTML = `<h3>점수룰</h3><p>1일차 킬 ${rule.day1Kill}점</p><p>이후 킬 ${rule.lateKill}점</p><p>금구사 -${rule.penaltyDeath}점</p>`;
  $("#rankRuleBox").innerHTML = `<h3>등수 점수</h3>${rule.placement.map((point, index) => `<div><span>${index + 1}등</span><strong>${point}</strong></div>`).join("")}`;
}

function renderApplicants() {
  $("#applicantCount").textContent = state.applicants.length;
  $("#applicantRows").innerHTML = state.applicants.map((player) => `
    <tr>
      <td><strong>${escapeHtml(player.nickname)}</strong></td>
      <td>${escapeHtml(player.discordName || "-")}</td>
      <td><span class="role-tag">${escapeHtml(player.roles?.[0] || "-")}</span></td>
      <td>${escapeHtml(player.roles?.slice(1).join(" / ") || "-")}</td>
      <td>${formatNumber(player.mmr)}</td>
      <td>${player.rank ? `${formatNumber(player.rank)}위` : "-"}</td>
      <td>${formatWinRate(player.totalWins, player.totalGames)}</td>
      <td><div class="roster-most">${renderRosterMost(player)}</div></td>
      <td><button class="danger" data-remove="${player.id}" type="button" aria-label="${escapeHtml(player.nickname)} 삭제"><i data-lucide="trash-2"></i></button></td>
    </tr>`).join("") || `<tr><td colspan="9">등록된 참가자가 없습니다.</td></tr>`;
}

function renderOverview() {
  $("#eventTitle").textContent = "내전 계산기";
  document.title = "내전 계산기";
  $("#matchCountStat").textContent = state.settings.matchCount;
  $("#savedAt").textContent = state.updatedAt ? new Date(state.updatedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "저장 대기";
  updateSeasonLabel();
}

function setView(view, updateHash = true) {
  currentView = view === "admin" ? "admin" : "apply";
  document.body.dataset.view = currentView;
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTarget === currentView);
  });
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== currentView;
  });
  if (updateHash) history.replaceState(null, "", currentView === "admin" ? "#admin" : "#apply");
}

function renderNotice() {
  const facts = [
    ["일정", state.eventInfo.date],
    ["진행", state.eventInfo.host],
    ["시간", state.eventInfo.time],
    ["티어 제한", state.eventInfo.tierLimit],
    ["팀 방식", state.eventInfo.teamFormat],
    ["인원", state.eventInfo.capacity]
  ];
  const hasFact = facts.some(([, value]) => value);
  $("#eventFacts").innerHTML = hasFact
    ? facts.map(([label, value]) => `<div class="event-fact"><span>${label}</span><strong>${escapeHtml(value || "-")}</strong></div>`).join("")
    : "";
  const rules = $("#rulesDisplay");
  rules.className = `rules-display${state.eventInfo.rules ? "" : " empty"}`;
  rules.textContent = state.eventInfo.rules || "설정에서 일정과 내전 규칙을 작성해 주세요.";
}

function renderHouseRulesSummary() {
  const section = $("#houseRulesSummary");
  const blocks = [];
  if (state.settings.tailChaseEnabled) {
    blocks.push(`
      <article class="house-rule-summary-row">
        <strong>꼬리잡기</strong>
        <p>각 팀의 금지 대상은 시작할 때 고정되며, 대상 팀이 탈락해도 다음 팀으로 넘어가지 않습니다.</p>
      </article>`);
  }
  if (state.settings.weaponGroupEnabled) {
    blocks.push(`
      <article class="house-rule-summary-row weapon-summary">
        <strong>무기군 내전</strong>
        <div>${WEAPON_GROUPS.map((group) => `<p><b>${group.id}</b>${group.weapons.map((weapon) => `<span>${escapeHtml(weapon)}</span>`).join("")}</p>`).join("")}</div>
      </article>`);
  }
  section.classList.toggle("empty-house-rules", !blocks.length);
  $("#houseRulesDisplay").innerHTML = blocks.join("");
}

function render() {
  renderOverview();
  renderNotice();
  renderHouseRulesSummary();
  renderRoles();
  renderTeams();
  renderScores();
  renderApplicants();
  refreshIcons();
}

function exportJson() {
  downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }), `er-custom-match-${new Date().toISOString().slice(0, 10)}.json`);
}

function exportCsv() {
  const rows = [
    ["event", state.settings.eventName],
    ["seasonId", state.settings.seasonId],
    ["tailChaseEnabled", state.settings.tailChaseEnabled ? "yes" : "no"],
    ["weaponGroupEnabled", state.settings.weaponGroupEnabled ? "yes" : "no"],
    ["weaponAssignments", Object.entries(state.weaponAssignments).map(([team, group]) => `${team}:${group}`).join(" / ")],
    ["placementPoints", currentScoreRule().placement.join("/")],
    [],
    ["team", "captain", "members", "total", "match", "replayCode", "place", "day1Kills", "lateKills", "penaltyDeaths", "score", "bans"]
  ];
  state.teams.forEach((team) => {
    const members = team.members.map((id) => getApplicant(id)?.nickname).filter(Boolean).join(" / ");
    const captain = getApplicant(state.captains[team.id])?.nickname || "";
    state.scores.forEach((match, index) => {
      const entry = match[team.id] || {};
      rows.push([team.name, captain, members, teamTotal(team.id), index + 1, state.replayCodes[index] || "", entry.place || "", entry.day1Kills || 0, entry.lateKills || 0, entry.penaltyDeaths || 0, scoreFor(entry), entry.bans || ""]);
    });
  });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
  downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), "er-custom-match-score.csv");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    state = normalizeState(JSON.parse(await file.text()));
    bindSettings();
    saveState();
    toast("백업을 복원했습니다.");
  } catch {
    toast("올바른 백업 파일이 아닙니다.");
  }
  event.target.value = "";
}

function bindEvents() {
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewTarget));
  });
  $("#adminLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await cloud.sendMagicLink($("#adminEmail").value.trim());
      toast("이메일로 로그인 링크를 보냈습니다.");
    } catch (error) {
      toast(error.message);
    }
  });
  $("#adminSignOut").addEventListener("click", async () => {
    try {
      await cloud.signOut();
      cloudEvent = null;
      state = defaultState();
      bindSettings();
      render();
      renderCloudControls();
    } catch (error) {
      toast(error.message);
    }
  });
  $("#newCloudEvent").addEventListener("click", () => {
    $("#createEventForm").hidden = false;
    $("#newEventName").focus();
  });
  $("#cancelCreateEvent").addEventListener("click", () => {
    $("#createEventForm").reset();
    $("#createEventForm").hidden = true;
  });
  $("#createEventForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#newEventName").value.trim();
    const slug = $("#newEventSlug").value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)) return toast("신청 주소 코드는 영문 소문자, 숫자, 하이픈으로 입력해 주세요.");
    try {
      const seed = defaultState();
      seed.settings.eventName = name;
      const created = await cloud.createEvent({ ownerId: cloudSession.user.id, name, slug, state: seed });
      $("#createEventForm").reset();
      $("#createEventForm").hidden = true;
      await refreshCloudEvents(created.id);
      toast("새 내전을 만들었습니다.");
    } catch (error) {
      const duplicate = error.code === "23505" || /duplicate|unique/i.test(error.message);
      toast(duplicate ? "이미 사용 중인 신청 주소 코드입니다." : error.message);
    }
  });
  $("#cloudEventSelect").addEventListener("change", (event) => {
    loadAdminCloudEvent(event.target.value).catch((error) => toast(error.message));
  });
  $("#deleteCloudEvent").addEventListener("click", async () => {
    if (!cloudEvent || !confirm(`'${cloudEvent.name}' 내전과 신청 명단을 모두 삭제할까요?`)) return;
    try {
      await cloud.deleteEvent(cloudEvent.id);
      cloudEvent = null;
      state = defaultState();
      bindSettings();
      render();
      await refreshCloudEvents();
      toast("내전을 삭제했습니다.");
    } catch (error) {
      toast(error.message);
    }
  });
  $("#registrationOpen").addEventListener("change", async (event) => {
    if (!cloudEvent) return;
    try {
      cloudEvent = await cloud.updateEvent(cloudEvent.id, state, { registration_open: event.target.checked });
      renderCloudControls();
      toast(event.target.checked ? "참가 신청을 열었습니다." : "참가 신청을 마감했습니다.");
    } catch (error) {
      event.target.checked = !event.target.checked;
      toast(error.message);
    }
  });
  $("#copyApplyLink").addEventListener("click", async () => {
    const link = $("#cloudApplyLink").value;
    try {
      await navigator.clipboard.writeText(link);
      toast("신청 링크를 복사했습니다.");
    } catch {
      $("#cloudApplyLink").select();
      document.execCommand("copy");
      toast("신청 링크를 복사했습니다.");
    }
  });
  $("#openSettings").addEventListener("click", () => $("#settingsDialog").showModal());
  $("#editNotice").addEventListener("click", () => $("#settingsDialog").showModal());
  $("#testApi").addEventListener("click", async () => {
    readSettings();
    await refreshApiMetadata(true);
  });
  $("#saveSettings").addEventListener("click", async () => {
    readSettings();
    bindSettings();
    saveState();
    $("#settingsDialog").close();
    await refreshApiMetadata();
    toast("설정을 저장했습니다.");
  });
  $("#lookupRank").addEventListener("click", lookupRank);
  $("#nickname").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (state.settings.apiKey || (cloud?.configured && cloudEvent))) {
      event.preventDefault();
      lookupRank();
    }
  });
  $("#applicantForm").addEventListener("submit", submitApplicant);
  $("#resetForm").addEventListener("click", resetForm);
  $("#makeTeams").addEventListener("click", makeTeams);
  $("#clearTeams").addEventListener("click", () => {
    state.teams = [];
    state.captains = {};
    normalizeScores();
    saveState();
  });
  $("#desiredTeams").addEventListener("change", () => {
    readTeamControls();
    state.draft.picked = [];
    saveState();
  });
  $("#teamSize").addEventListener("change", () => {
    readTeamControls();
    saveState();
  });
  $("#draftCaptainMode").addEventListener("change", (event) => {
    state.draft.captainMode = event.target.value;
    state.draft.picked = [];
    saveState();
  });
  $("#resetDraft").addEventListener("click", () => {
    state.draft.picked = [];
    saveState();
    toast("팀원 뽑기 체크를 초기화했습니다.");
  });
  $("#draftBoard").addEventListener("click", (event) => {
    const pick = event.target.closest("[data-draft-pick]");
    const unpick = event.target.closest("[data-draft-unpick]");
    if (pick) {
      const id = pick.dataset.draftPick;
      if (!state.draft.picked.includes(id)) state.draft.picked.push(id);
      saveState();
    } else if (unpick) {
      const id = unpick.dataset.draftUnpick;
      state.draft.picked = state.draft.picked.filter((item) => item !== id);
      saveState();
    }
  });
  $("#weaponAssignmentBoard").addEventListener("change", (event) => {
    const team = event.target.dataset.weaponAssignment;
    if (!team) return;
    state.weaponAssignments[team] = event.target.value;
    saveState();
  });
  $("#autoAssignWeaponGroups").addEventListener("click", () => {
    tailRuleTeams().forEach((team, index) => {
      state.weaponAssignments[team] = WEAPON_GROUPS[index % WEAPON_GROUPS.length].id;
    });
    saveState();
    toast("무기군을 A부터 순서대로 균등 배정했습니다.");
  });
  $("#clearApplicants").addEventListener("click", async () => {
    if (!confirm("참가자와 편성 팀을 모두 삭제할까요?")) return;
    if (cloud?.configured && !isCloudOwner()) return toast("관리자 로그인 후 삭제할 수 있습니다.");
    try {
      if (cloud?.configured && cloudEvent) await cloud.clearApplicants(cloudEvent.id);
    } catch (error) {
      return toast(error.message);
    }
    state.applicants = [];
    state.teams = [];
    state.captains = {};
    state.draft.picked = [];
    normalizeScores();
    saveState();
  });
  $("#applicantRows").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    const id = button.dataset.remove;
    if (cloud?.configured && !isCloudOwner()) return toast("관리자 로그인 후 삭제할 수 있습니다.");
    try {
      if (cloud?.configured && cloudEvent) await cloud.deleteApplicant(id);
    } catch (error) {
      return toast(error.message);
    }
    state.applicants = state.applicants.filter((player) => player.id !== id);
    state.teams.forEach((team) => team.members = team.members.filter((memberId) => memberId !== id));
    state.draft.picked = state.draft.picked.filter((playerId) => playerId !== id);
    saveState();
  });
  $("#scoreBoard").addEventListener("change", updateScore);
  $("#banBoard").addEventListener("change", updateBan);
  $("#replayBoard").addEventListener("change", updateReplay);
  $("#captainBoard").addEventListener("change", updateCaptain);
  $("#exportJson").addEventListener("click", exportJson);
  $("#exportCsv").addEventListener("click", exportCsv);
  $("#importJson").addEventListener("change", importJson);
}

function updateScore(event) {
  const token = event.target.dataset.score;
  if (!token) return;
  const [matchIndex, teamId, field] = token.split(":");
  state.scores[Number(matchIndex)][teamId][field] = event.target.value;
  saveState();
}

function updateReplay(event) {
  const index = event.target.dataset.replay;
  if (index === undefined) return;
  state.replayCodes[Number(index)] = event.target.value.trim();
  saveState();
}

function updateBan(event) {
  const token = event.target.dataset.ban;
  if (!token) return;
  const [matchIndex, teamId] = token.split(":");
  state.scores[Number(matchIndex)][teamId].bans = event.target.value.trim();
  saveState();
}

function updateCaptain(event) {
  const teamId = event.target.dataset.captain;
  if (!teamId) return;
  if (event.target.value) state.captains[teamId] = event.target.value;
  else delete state.captains[teamId];
  saveState();
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]);
}

function formatNumber(value, showZero = false) {
  return Number.isFinite(Number(value)) && (showZero || Number(value) !== 0) ? Number(value).toLocaleString("ko-KR") : "-";
}

function formatDecimal(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "-";
}

function formatWinRate(totalWins, totalGames) {
  const games = Number(totalGames);
  const wins = Number(totalWins);
  if (!Number.isFinite(games) || games <= 0 || !Number.isFinite(wins)) return "-";
  return `${((wins / games) * 100).toFixed(1)}%`;
}

async function fetchKoreanCharacterNames(l10nPath) {
  const names = new Map();
  if (!l10nPath) return names;
  try {
    const response = await fetch(l10nPath, { cache: "no-store" });
    if (!response.ok) return names;
    const text = await response.text();
    text.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^Character\/Name\/(\d+)┃(.+)$/);
      if (match) names.set(Number(match[1]), match[2].trim());
    });
  } catch {
    // If the localization file is unavailable, keep API default names.
  }
  return names;
}

async function loadKoreanCharacterNames() {
  try {
    const l10nJson = await erFetch("v1/l10n/Korean");
    return fetchKoreanCharacterNames(l10nJson.data?.l10Path);
  } catch {
    return new Map();
  }
}

function koreanCharacterNameMap() {
  return new Map(Object.entries(KOREAN_CHARACTER_NAMES).map(([code, name]) => [Number(code), name]));
}

function renderMostStats(data) {
  const stats = Array.isArray(data.mostStats) ? data.mostStats : [];
  if (stats.length) {
    return stats.map((item, index) => `
      <article class="most-stat">
        <span class="most-rank">${index + 1}</span>
        <div>
          <strong>${escapeHtml(characterNameForStat(item))}</strong>
          <small>${formatNumber(item.wins, true)}승 / ${formatNumber(item.totalGames, true)}경기</small>
        </div>
        <b>${formatWinRate(item.wins, item.totalGames)}</b>
      </article>`).join("");
  }
  if (Array.isArray(data.most) && data.most.length) {
    return data.most.map((name, index) => `
      <article class="most-stat">
        <span class="most-rank">${index + 1}</span>
        <div><strong>${escapeHtml(name)}</strong><small>상세 기록 없음</small></div>
        <b>-</b>
      </article>`).join("");
  }
  return `<span class="rank-tag">기록 없음</span>`;
}

function renderRosterMost(player) {
  if (Array.isArray(player.mostStats) && player.mostStats.length) {
    return player.mostStats.map((item) =>
      `<span><strong>${escapeHtml(characterNameForStat(item))}</strong> ${formatWinRate(item.wins, item.totalGames)}</span>`
    ).join("");
  }
  return escapeHtml(player.most?.join(" / ") || "-");
}

function characterNameForStat(item) {
  const code = Number(item.characterCode);
  if (Number.isFinite(code) && characterNames.has(code)) return characterNames.get(code);
  return item.name || (Number.isFinite(code) ? `실험체 #${code}` : "실험체");
}

async function bootstrap() {
  await loadLocalConfig();
  bindSettings();
  bindEvents();
  render();
  setView(currentView, false);
  await initializeCloud();
  await refreshApiMetadata();
}

bootstrap();
