const STORAGE_KEY = "er-custom-match-calculator-v2";
const LEGACY_STORAGE_KEY = "er-scrim-calculator-v1";
const API_BASE = "https://open-api.bser.io";
const DEFAULT_SEASON_ID = 39;
const RANK_TEAM_MODE = 3;
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
const COBALT_POSITIONS = {
  front: "앞라인",
  skirmish: "교전",
  carry: "딜러",
  support: "서포터"
};
const OTP_COOLDOWN_MS = 60_000;
const OTP_EMAIL_KEY = "er-admin-otp-email";
const OTP_SENT_AT_KEY = "er-admin-otp-sent-at";
const TAIL_CHASE_EVENT_SLUG = "match-20260620-099ffa";
const TAIL_CHASE_EDITOR_EMAIL = "enlilblei@gmail.com";

let state = loadState();
let selectedRoles = [];
let rankCache = null;
let seasons = [];
let characterNames = koreanCharacterNameMap();
let toastTimer = null;
const initialEventSlug = new URLSearchParams(location.search).get("event")?.trim() || "";
let currentView = location.hash === "#admin"
  ? "admin"
  : initialEventSlug
    ? "apply"
    : "admin";
let runtimeConfig = { ...(window.ER_CONFIG || {}) };
let cloud = null;
let cloudSession = null;
let cloudEvent = null;
let cloudEvents = [];
let cloudOperator = null;
let cloudOperators = [];
let cloudApplicantUnsubscribe = null;
let cloudEventUnsubscribe = null;
let cloudApplicantPollTimer = null;
let cloudApplicantReloading = false;
let cloudBackups = [];
let cloudSaveTimer = null;
let cloudLoading = false;
let cloudCreateOpen = false;
let otpEmail = sessionStorage.getItem(OTP_EMAIL_KEY) || "";
let otpSentAt = Number(sessionStorage.getItem(OTP_SENT_AT_KEY) || 0);
let otpCooldownTimer = null;
let editingApplicantId = null;

const $ = (selector) => document.querySelector(selector);

function defaultState() {
  return {
    version: STATE_VERSION,
    settings: {
      eventName: "이터널 리턴 내전",
      eventType: "normal",
      apiKey: "",
      apiBase: API_BASE,
      seasonId: DEFAULT_SEASON_ID,
      teamMode: 3,
      matchCount: 4,
      desiredTeams: 8,
      teamSize: 3,
      mmrBasis: "current",
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
      captains: [],
      picked: []
    },
    weaponAssignments: {},
    roomCodes: ["", "", "", ""],
    replayCodes: ["", "", "", ""],
    matchRecords: Array.from({ length: 4 }, () => ({})),
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
  settings.eventType = settings.eventType === "cobalt" ? "cobalt" : "normal";
  const normalized = { ...base, ...saved, version: STATE_VERSION, settings };
  normalized.applicants = Array.isArray(saved.applicants) ? saved.applicants : [];
  normalized.eventInfo = { ...base.eventInfo, ...(saved.eventInfo || {}) };
  normalized.teams = Array.isArray(saved.teams) ? saved.teams : [];
  normalized.captains = saved.captains || {};
  normalized.draft = {
    ...base.draft,
    ...(saved.draft || {}),
    captains: Array.isArray(saved.draft?.captains) ? saved.draft.captains : [],
    picked: Array.isArray(saved.draft?.picked) ? saved.draft.picked : []
  };
  normalized.weaponAssignments = saved.weaponAssignments || {};
  normalized.roomCodes = Array.isArray(saved.roomCodes) ? saved.roomCodes : [];
  normalized.replayCodes = Array.isArray(saved.replayCodes) ? saved.replayCodes : [];
  normalized.matchRecords = Array.isArray(saved.matchRecords) ? saved.matchRecords : [];
  normalized.scores = Array.isArray(saved.scores) ? saved.scores : [];
  sanitizeStateRelations(normalized);
  syncMatchArrays(normalized);
  return normalized;
}

function sanitizeStateRelations(target) {
  const seenApplicantIds = new Set();
  const seenNicknames = new Set();
  target.applicants = target.applicants.filter((applicant) => {
    const id = String(applicant?.id || "").trim();
    const nickname = String(applicant?.nickname || "").trim().toLowerCase();
    if (!id || !nickname || seenApplicantIds.has(id) || seenNicknames.has(nickname)) return false;
    seenApplicantIds.add(id);
    seenNicknames.add(nickname);
    applicant.id = id;
    applicant.nickname = String(applicant.nickname).trim();
    applicant.currentMmr = Number(applicant.currentMmr ?? applicant.mmr ?? 0);
    applicant.peakMmr = Number(applicant.peakMmr ?? applicant.mmr ?? 0);
    applicant.cobaltRating = Number(applicant.cobaltRating || 0);
    applicant.cobaltPosition = COBALT_POSITIONS[applicant.cobaltPosition] ? applicant.cobaltPosition : "";
    applicant.cobaltPicks = String(applicant.cobaltPicks || "").trim();
    applicant.roles = [...new Set(Array.isArray(applicant.roles) ? applicant.roles.filter((role) => ROLES.includes(role)) : [])].slice(0, 3);
    return true;
  });

  const validApplicantIds = new Set(target.applicants.map((applicant) => applicant.id));
  const seenTeamIds = new Set();
  const assignedApplicantIds = new Set();
  target.teams = target.teams.filter((team) => {
    const id = String(team?.id || "").trim();
    if (!id || seenTeamIds.has(id)) return false;
    seenTeamIds.add(id);
    team.id = id;
    team.members = [...new Set((Array.isArray(team.members) ? team.members : []).map(String))].filter((memberId) => {
      if (!validApplicantIds.has(memberId) || assignedApplicantIds.has(memberId)) return false;
      assignedApplicantIds.add(memberId);
      return true;
    });
    return true;
  });

  const validTeamIds = new Set(target.teams.map((team) => team.id));
  const validTeamNames = new Set(target.teams.map((team) => team.name));
  target.captains = Object.fromEntries(Object.entries(target.captains).filter(([teamId, applicantId]) => {
    const team = target.teams.find((item) => item.id === teamId);
    return team && team.members.includes(applicantId);
  }));
  target.draft.picked = [...new Set(target.draft.picked.map(String))].filter((id) => validApplicantIds.has(id));
  target.draft.captains = [...new Set(target.draft.captains.map(String))].filter((id) => validApplicantIds.has(id));
  target.weaponAssignments = Object.fromEntries(Object.entries(target.weaponAssignments).filter(([teamName, groupId]) => (
    validTeamNames.has(teamName) && WEAPON_GROUPS.some((group) => group.id === groupId)
  )));
  target.scores = target.scores.map((match) => Object.fromEntries(Object.entries(match || {}).filter(([teamId]) => validTeamIds.has(teamId))));
}

function syncMatchArrays(target = state) {
  const count = Math.min(12, Math.max(1, Number(target.settings.matchCount || 4)));
  target.settings.matchCount = count;
  while (target.replayCodes.length < count) target.replayCodes.push("");
  target.replayCodes.length = count;
  while (target.roomCodes.length < count) target.roomCodes.push("");
  target.roomCodes.length = count;
  while (target.matchRecords.length < count) target.matchRecords.push({});
  target.matchRecords.length = count;
  while (target.scores.length < count) target.scores.push({});
  target.scores.length = count;
}

function saveState(renderAfter = true) {
  state.updatedAt = new Date().toISOString();
  if (!cloud?.configured) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function isSiteOwner() {
  return cloudOperator?.is_owner === true;
}

function canViewCloudEvent() {
  return Boolean(cloudEvent && cloudEvents.some((event) => event.id === cloudEvent.id));
}

function canManageCloudEvent() {
  if (!canViewCloudEvent()) return false;
  if (isSiteOwner()) return true;
  if (cloudEvent.slug !== TAIL_CHASE_EVENT_SLUG) return true;
  return String(cloudSession?.user?.email || "").trim().toLowerCase() === TAIL_CHASE_EDITOR_EMAIL;
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

function updateViewAvailability() {
  const applyTab = document.querySelector('[data-view-target="apply"]');
  const canApply = !cloud?.configured || Boolean(cloudEvent || cloudEventSlug());
  applyTab.disabled = !canApply;
  applyTab.title = canApply ? "" : "내전을 만든 뒤 참가 신청 화면을 열 수 있습니다.";
  if (!canApply && currentView === "apply") setView("admin", false);
}

function resetCloudLandingState() {
  const apiKey = state.settings.apiKey || runtimeConfig.apiKey || "";
  cloudLoading = true;
  state = defaultState();
  state.settings.apiKey = apiKey;
  bindSettings();
  render();
  cloudLoading = false;
}

function setCloudCreateError(message = "") {
  const error = $("#cloudCreateError");
  error.textContent = message;
  error.hidden = !message;
}

function setOperatorError(message = "") {
  const error = $("#operatorError");
  error.textContent = message;
  error.hidden = !message;
}

function setOtpError(message = "") {
  const error = $("#otpError");
  error.textContent = message;
  error.hidden = !message;
}

function otpCooldownSeconds() {
  return Math.max(0, Math.ceil((OTP_COOLDOWN_MS - (Date.now() - otpSentAt)) / 1000));
}

function renderOtpCooldown() {
  const button = $("#resendOtp");
  const seconds = otpCooldownSeconds();
  button.disabled = seconds > 0;
  button.textContent = seconds > 0 ? `재전송 (${seconds}초)` : "재전송";
  if (!seconds && otpCooldownTimer) {
    clearInterval(otpCooldownTimer);
    otpCooldownTimer = null;
  }
}

function startOtpCooldown() {
  clearInterval(otpCooldownTimer);
  renderOtpCooldown();
  if (otpCooldownSeconds() > 0) otpCooldownTimer = setInterval(renderOtpCooldown, 1000);
}

function showOtpStep(email, sentNow = false) {
  otpEmail = email.trim().toLowerCase();
  sessionStorage.setItem(OTP_EMAIL_KEY, otpEmail);
  if (sentNow) {
    otpSentAt = Date.now();
    sessionStorage.setItem(OTP_SENT_AT_KEY, String(otpSentAt));
  }
  setOtpError();
  renderCloudControls();
  startOtpCooldown();
  $("#adminOtp").focus();
}

function clearOtpStep(renderAfter = true) {
  otpEmail = "";
  otpSentAt = 0;
  sessionStorage.removeItem(OTP_EMAIL_KEY);
  sessionStorage.removeItem(OTP_SENT_AT_KEY);
  clearInterval(otpCooldownTimer);
  otpCooldownTimer = null;
  $("#adminOtpForm").reset();
  setOtpError();
  if (renderAfter) renderCloudControls();
}

function friendlyAuthError(error) {
  const message = String(error?.message || "");
  if (/rate limit|security purposes|after \d+ seconds/i.test(message)) return "인증번호는 60초 후 다시 요청할 수 있습니다.";
  if (/expired|invalid|token/i.test(message)) return "인증번호가 틀렸거나 만료되었습니다. 새 번호를 요청해 주세요.";
  return message || "인증 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

function friendlyCloudError(error) {
  const message = String(error?.message || "");
  if (/row-level security|permission denied|jwt|session/i.test(message)) return "관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.";
  if (/duplicate|unique/i.test(message) || error?.code === "23505") return "신청 주소가 겹쳤습니다. 새 내전을 한 번 더 생성해 주세요.";
  if (/failed to fetch|network/i.test(message)) return "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return message || "내전을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function renderOperatorList() {
  $("#operatorList").innerHTML = cloudOperators.map((operator) => `
    <div class="operator-row">
      <span>${escapeHtml(operator.email)}${operator.is_owner ? `<small>소유자</small>` : ""}</span>
      ${operator.is_owner ? "" : `<button class="danger" type="button" data-remove-operator="${operator.id}"><i data-lucide="user-minus"></i> 해제</button>`}
    </div>
  `).join("");
}

function renderBackupControls() {
  const select = $("#cloudBackupSelect");
  if (!select) return;
  select.innerHTML = cloudBackups.length
    ? cloudBackups.map((backup) => `<option value="${backup.id}">${escapeHtml(backup.label)} · ${new Date(backup.created_at).toLocaleString("ko-KR")}</option>`).join("")
    : `<option value="">백업 없음</option>`;
  const disabled = !cloudBackups.length || !canManageCloudEvent();
  select.disabled = !cloudBackups.length;
  $("#restoreCloudBackup").disabled = disabled;
  $("#deleteCloudBackup").disabled = disabled;
  $("#createCloudBackup").disabled = !canManageCloudEvent();
}

function renderCloudControls() {
  const configured = Boolean(cloud?.configured);
  const awaitingOtp = configured && !cloudSession && Boolean(otpEmail);
  const eventReadOnly = Boolean(configured && cloudOperator && cloudEvent && !canManageCloudEvent());
  document.body.classList.toggle("cloud-readonly-admin", configured && !cloudOperator);
  document.body.classList.toggle("cloud-viewonly-admin", eventReadOnly);
  document.querySelectorAll('main > [data-view-panel="admin"]:not(#cloudAdminPanel)').forEach((panel) => {
    panel.toggleAttribute("inert", eventReadOnly);
  });
  $("#localApiSettings").hidden = configured;
  $("#cloudUnavailable").hidden = configured;
  $("#adminLoginForm").hidden = !configured || Boolean(cloudSession) || awaitingOtp;
  $("#adminOtpForm").hidden = !awaitingOtp;
  $("#cloudWorkspace").hidden = !configured || !cloudSession;
  if (awaitingOtp) {
    $("#otpSentTo").textContent = `${otpEmail}로 인증번호를 보냈습니다.`;
    startOtpCooldown();
  }
  updateViewAvailability();
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

  $("#adminAccount").textContent = cloudSession.user.email || "관리자";
  const authorized = Boolean(cloudOperator);
  $("#cloudUnauthorized").hidden = authorized;
  $("#eventManagementTools").hidden = !authorized;
  $("#operatorTools").hidden = !isSiteOwner();
  if (!authorized) {
    setCloudStatus("운영자 승인 필요", "error");
    updateApplicationAvailability();
    return refreshIcons();
  }

  const hasEvents = cloudEvents.length > 0;
  setCloudStatus(cloudEvent ? "실시간 연결됨" : hasEvents ? "내전을 선택하세요" : "첫 내전을 만들어 주세요", cloudEvent ? "ok" : "manual");
  if (isSiteOwner()) renderOperatorList();
  const select = $("#cloudEventSelect");
  select.innerHTML = hasEvents
    ? cloudEvents.map((event) => `<option value="${event.id}" ${event.id === cloudEvent?.id ? "selected" : ""}>${escapeHtml(event.name)} · ${escapeHtml(event.slug)}</option>`).join("")
    : `<option value="">생성된 내전이 없습니다</option>`;
  select.disabled = !hasEvents;
  $("#newCloudEvent").hidden = !hasEvents;
  $("#deleteCloudEvent").hidden = !hasEvents;
  $("#cloudNoEvents").hidden = hasEvents;
  $("#createEventForm").hidden = hasEvents && !cloudCreateOpen;
  $("#cancelCreateEvent").hidden = !hasEvents;
  $("#deleteCloudEvent").disabled = !canManageCloudEvent();
  $("#currentCloudEvent").hidden = !canManageCloudEvent();
  if (canManageCloudEvent()) {
    $("#registrationOpen").checked = cloudEvent.registration_open !== false;
    const applyUrl = cloudApplyUrl();
    $("#currentCloudEventName").textContent = cloudEvent.name;
    $("#cloudApplyLink").value = applyUrl;
    $("#openApplyLink").href = applyUrl;
  }
  renderBackupControls();
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
    status.hidden = true;
    status.textContent = "";
    submit.disabled = true;
    return;
  }
  const open = cloudEvent.registration_open !== false;
  status.className = `cloud-apply-status ${open ? "ok" : "closed"}`;
  status.textContent = open
    ? `${cloudEvent.name} · ${isCobaltEvent() ? "코발트 신청" : "실시간 신청"} 접수 중`
    : `${cloudEvent.name} · 신청이 마감되었습니다.`;
  submit.disabled = !open;
}

function isCobaltEvent() {
  return state.settings.eventType === "cobalt";
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
  if (!canViewCloudEvent() || cloudApplicantReloading) return;
  cloudApplicantReloading = true;
  try {
    state.applicants = await cloud.applicants(cloudEvent.id);
    render();
  } finally {
    cloudApplicantReloading = false;
  }
}

function stopCloudApplicantPolling() {
  clearInterval(cloudApplicantPollTimer);
  cloudApplicantPollTimer = null;
}

function startCloudApplicantPolling() {
  stopCloudApplicantPolling();
  if (!canViewCloudEvent()) return;
  cloudApplicantPollTimer = setInterval(() => {
    if (!document.hidden) reloadCloudApplicants().catch((error) => console.warn("Applicant refresh failed", error));
  }, 5000);
}

async function reloadCloudEventState() {
  if (!cloudEvent) return;
  if (cloudSession && canViewCloudEvent()) {
    const [event, applicants] = await Promise.all([cloud.eventById(cloudEvent.id), cloud.applicants(cloudEvent.id)]);
    applyCloudState(event, applicants);
  } else {
    const event = await cloud.eventBySlug(cloudEvent.slug);
    if (event) applyCloudState(event, event.public_applicants || []);
  }
}

function subscribeCloudEvent() {
  if (cloudEventUnsubscribe) cloudEventUnsubscribe();
  cloudEventUnsubscribe = null;
  if (!cloudEvent?.id) return;
  const subscribe = cloudSession && canViewCloudEvent() ? cloud.subscribeEvent : cloud.subscribePublicEvent;
  cloudEventUnsubscribe = subscribe(cloudEvent.id, () => {
    clearTimeout(subscribeCloudEvent.timer);
    subscribeCloudEvent.timer = setTimeout(() => reloadCloudEventState().catch((error) => toast(error.message)), 250);
  });
}

function subscribeCloudApplicants() {
  if (cloudApplicantUnsubscribe) cloudApplicantUnsubscribe();
  cloudApplicantUnsubscribe = null;
  if (!canViewCloudEvent()) return;
  cloudApplicantUnsubscribe = cloud.subscribeApplicants(cloudEvent.id, () => {
    clearTimeout(subscribeCloudApplicants.timer);
    subscribeCloudApplicants.timer = setTimeout(() => reloadCloudApplicants().catch((error) => toast(error.message)), 180);
  });
  startCloudApplicantPolling();
}

async function loadAdminCloudEvent(eventId) {
  if (!eventId || !cloudSession) return;
  cloudLoading = true;
  try {
    const event = await cloud.eventById(eventId);
    const applicants = await cloud.applicants(event.id);
    applyCloudState(event, applicants);
    subscribeCloudApplicants();
    subscribeCloudEvent();
    cloudBackups = await cloud.listBackups(event.id);
    renderBackupControls();
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
    const url = new URL(location.href);
    url.searchParams.delete("event");
    url.hash = "admin";
    history.replaceState(null, "", url);
    setView("admin", false);
    renderCloudControls();
    return toast("해당 신청 내전을 찾지 못했습니다.");
  }
  const applicants = cloudEvents.some((item) => item.id === event.id)
    ? await cloud.applicants(event.id)
    : (event.public_applicants || []);
  applyCloudState(event, applicants);
  if (canViewCloudEvent()) subscribeCloudApplicants();
  subscribeCloudEvent();
}

async function refreshCloudEvents(preferredId = "", openSelected = true) {
  if (!cloudSession || !cloudOperator) return;
  cloudEvents = await cloud.listEvents();
  const validIds = new Set(cloudEvents.map((event) => event.id));
  const selected = validIds.has(preferredId)
    ? preferredId
    : validIds.has(cloudEvent?.id)
      ? cloudEvent.id
      : cloudEvents[0]?.id || "";
  if (!selected) {
    cloudEvent = null;
    cloudCreateOpen = true;
    resetCloudLandingState();
  }
  renderCloudControls();
  if (selected && openSelected) await loadAdminCloudEvent(selected);
}

async function handleCloudSession(session, preserveApplyView = false) {
  cloudSession = session;
  if (!session) {
    cloudEvents = [];
    cloudOperator = null;
    cloudOperators = [];
    if (cloudApplicantUnsubscribe) cloudApplicantUnsubscribe();
    cloudApplicantUnsubscribe = null;
    stopCloudApplicantPolling();
    if (cloudEventUnsubscribe) cloudEventUnsubscribe();
    cloudEventUnsubscribe = null;
    cloudBackups = [];
    renderCloudControls();
    return;
  }
  clearOtpStep(false);
  cloudOperator = await cloud.operatorProfile(session.user.email || "");
  cloudOperators = isSiteOwner() ? await cloud.listOperators() : [];
  if (cloudOperator) await refreshCloudEvents(cloudEvent?.id || "", !preserveApplyView);
  else cloudEvents = [];
  const slug = cloudEventSlug();
  if (slug && cloudEvent?.slug !== slug) await loadPublicCloudEvent(slug);
  renderCloudControls();
}

async function initializeCloud() {
  if (location.hash.includes("error_code=")) {
    const url = new URL(location.href);
    url.hash = "admin";
    history.replaceState(null, "", url);
    toast("이전 이메일 링크는 사용하지 않습니다. 새 인증번호를 요청해 주세요.");
  }
  cloud = window.ERCloud?.create(runtimeConfig) || { configured: false };
  renderCloudControls();
  if (!cloud.configured) return;
  if (!cloudEventSlug()) resetCloudLandingState();
  cloudSession = await cloud.session();
  cloud.onAuthChange((session) => {
    if ((session?.user?.id || "") === (cloudSession?.user?.id || "")) return;
    handleCloudSession(session).catch((error) => toast(error.message));
  });
  const slug = cloudEventSlug();
  if (slug) await loadPublicCloudEvent(slug);
  const preserveApplyView = Boolean(slug && location.hash === "#apply");
  if (cloudSession) await handleCloudSession(cloudSession, preserveApplyView);
  renderCloudControls();
}

function scheduleCloudSave() {
  if (cloudLoading || !cloud?.configured || !canManageCloudEvent()) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    cloudSaveTimer = null;
    try {
      setCloudStatus("저장 중");
      const expectedUpdatedAt = cloudEvent.updated_at || "";
      cloudEvent = await cloud.updateEvent(cloudEvent.id, state, {}, expectedUpdatedAt);
      setCloudStatus("실시간 저장됨", "ok");
      const index = cloudEvents.findIndex((event) => event.id === cloudEvent.id);
      if (index >= 0) cloudEvents[index] = cloudEvent;
    } catch (error) {
      setCloudStatus("저장 실패", "error");
      toast(error.message);
      if (error.code === "EVENT_CONFLICT") await reloadCloudEventState();
    }
  }, 500);
}

function bindSettings() {
  $("#eventName").value = state.settings.eventName;
  $("#apiKey").value = state.settings.apiKey || "";
  $("#teamMode").value = String(isCobaltEvent() ? 4 : state.settings.teamMode || 3);
  $("#matchCount").value = state.settings.matchCount;
  $("#desiredTeams").value = state.settings.desiredTeams || 8;
  $("#teamSize").value = state.settings.teamSize || 3;
  $("#mmrBasis").value = state.settings.mmrBasis || "current";
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

  const selectedTeamMode = Number($("#teamMode").value || 3);
  const cobaltMode = selectedTeamMode === 4;

  state.settings = {
    ...state.settings,
    eventName: $("#eventName").value.trim() || "이터널 리턴 내전",
    apiKey: $("#apiKey").value.trim(),
    apiBase: API_BASE,
    seasonId: Number($("#seasonId").value || state.settings.seasonId || DEFAULT_SEASON_ID),
    eventType: cobaltMode ? "cobalt" : "normal",
    teamMode: selectedTeamMode,
    matchCount: Math.min(12, Math.max(1, Number($("#matchCount").value || 4))),
    desiredTeams: cobaltMode ? 2 : Math.min(12, Math.max(2, Number($("#desiredTeams").value || 8))),
    teamSize: cobaltMode ? 4 : Math.min(4, Math.max(1, Number($("#teamSize").value || 3))),
    mmrBasis: $("#mmrBasis").value === "peak" ? "peak" : "current",
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
    teamFormat: cobaltMode ? ($("#teamFormat").value.trim() || "코발트 4v4") : $("#teamFormat").value.trim(),
    capacity: cobaltMode ? ($("#capacity").value.trim() || "8명") : $("#capacity").value.trim(),
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

function renderApplyMode() {
  const cobalt = isCobaltEvent();
  $("#lookupRank").hidden = cobalt;
  $("#roleApplyBlock").hidden = cobalt;
  $("#manualApplyBlock").hidden = cobalt;
  $("#cobaltApplyBox").hidden = true;
  $("#rankApplyPanel").hidden = cobalt;
  $(".registration-panel .section-number").textContent = cobalt ? "COBALT" : "01";
  $(".registration-panel h2").textContent = cobalt ? "코발트 참가 등록" : "참가자 등록";
  $("#nickname").placeholder = cobalt ? "인게임 닉네임" : "닉네임을 정확히 입력";
  $("#discordName").placeholder = cobalt ? "디스코드 닉네임" : "선택 입력";
  $("#submitApplicant").innerHTML = `<i data-lucide="user-plus"></i> ${cobalt ? "코발트 참가 등록" : "참가자 등록"}`;
}

function toggleRole(role) {
  if (selectedRoles.includes(role)) selectedRoles = selectedRoles.filter((item) => item !== role);
  else if (selectedRoles.length < 3) selectedRoles.push(role);
  else toast("역할군은 3개까지 선택할 수 있습니다.");
  renderRoles();
}

async function lookupRank() {
  const nickname = $("#nickname").value.trim();
  if (!nickname) {
    toast("닉네임을 입력해 주세요.");
    return null;
  }
  const useCloudLookup = Boolean(cloud?.configured && cloudEvent);
  if (!useCloudLookup && !state.settings.apiKey) {
    rankCache = null;
    updateRankPreview({ message: "API 키가 없어 랭크 조회를 건너뜁니다. 닉네임과 역할군만으로 바로 신청할 수 있습니다." }, "manual");
    toast("API 키 없이 수동 신청으로 진행할 수 있습니다.");
    return null;
  }

  updateRankPreview(null, "loading");
  try {
    const seasonId = state.settings.seasonId;
    const teamMode = RANK_TEAM_MODE;
    let user;
    let rankJson;
    let peakJson;
    let statsJson;
    if (useCloudLookup) {
      const result = await cloud.rankLookup({ nickname, seasonId, teamMode });
      user = result.user;
      rankJson = { userRank: result.rank || {} };
      peakJson = result.peak || result.rank || {};
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
      peakJson = rankJson.userRank || {};
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
      mmr: rankJson.userRank?.mmr ?? stats.mmr ?? 0,
      currentMmr: rankJson.userRank?.mmr ?? stats.mmr ?? 0,
      peakMmr: peakJson?.mmr ?? rankJson.userRank?.mmr ?? stats.mmr ?? 0,
      peakSeasonId: peakJson?.seasonId ?? seasonId,
      rank: rankJson.userRank?.rank ?? stats.rank ?? 0,
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
    return rankCache;
  } catch (error) {
    rankCache = null;
    updateRankPreview({ message: error.message }, "error");
    return null;
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
        <div><span>현재 MMR</span><strong>${formatNumber(data.currentMmr ?? data.mmr)}</strong></div>
        <div><span>최근 3시즌 최고</span><strong>${formatNumber(data.peakMmr ?? data.mmr)}</strong></div>
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
  return "스쿼드 랭크";
}

async function syncMissingApplicantRanks() {
  if (!canManageCloudEvent()) return toast("이 내전의 참가자 정보를 수정할 권한이 없습니다.");
  const targets = state.applicants.filter((player) => !player.currentMmr && !player.rank);
  if (!targets.length) return toast("랭크 정보가 누락된 참가자가 없습니다.");

  const button = $("#syncApplicantRanks");
  button.disabled = true;
  let updated = 0;
  let failed = 0;
  try {
    for (const player of targets) {
      button.innerHTML = `<i data-lucide="loader-circle"></i> ${updated + failed + 1}/${targets.length} 조회 중`;
      refreshIcons();
      try {
        const result = await cloud.rankLookup({
          nickname: player.nickname,
          seasonId: state.settings.seasonId,
          teamMode: RANK_TEAM_MODE
        });
        const stats = result.stats || {};
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
        const rank = result.rank || {};
        const peak = result.peak || rank;
        const refreshed = {
          ...player,
          userId: result.user?.userId || player.userId,
          nickname: result.user?.nickname || player.nickname,
          mmr: Number(rank.mmr || stats.mmr || 0),
          currentMmr: Number(rank.mmr || stats.mmr || 0),
          peakMmr: Number(peak.mmr || rank.mmr || stats.mmr || 0),
          peakSeasonId: peak.seasonId || state.settings.seasonId,
          rank: Number(rank.rank || stats.rank || 0),
          totalGames: Number(stats.totalGames || 0),
          totalWins: Number(stats.totalWins || 0),
          most: mostStats.map((item) => item.name),
          mostStats
        };
        await cloud.updateApplicant(cloudEvent.id, refreshed);
        Object.assign(player, refreshed);
        updated += 1;
      } catch (error) {
        console.warn(`Rank refresh failed: ${player.nickname}`, error);
        failed += 1;
      }
    }
    render();
    toast(`랭크 ${updated}명 갱신${failed ? ` · ${failed}명 실패` : ""}`);
  } finally {
    button.disabled = false;
    button.innerHTML = `<i data-lucide="scan-search"></i> 누락 랭크 조회`;
    refreshIcons();
  }
}

async function submitApplicant(event) {
  event.preventDefault();
  const nickname = $("#nickname").value.trim();
  const cobalt = isCobaltEvent();
  if (!nickname) return toast("인게임 닉네임을 입력해 주세요.");
  if (!cobalt && selectedRoles.length !== 3) return toast("닉네임과 역할군 3개를 모두 입력해 주세요.");
  const canLookup = !cobalt && Boolean((cloud?.configured && cloudEvent) || state.settings.apiKey);
  const cachedNickname = String(rankCache?.nickname || "").trim().toLowerCase();
  if (canLookup && cachedNickname !== nickname.toLowerCase()) {
    const submitButton = $("#submitApplicant");
    submitButton.disabled = true;
    const lookup = await lookupRank();
    submitButton.disabled = false;
    if (!lookup) return toast("전적 조회에 실패해 신청을 멈췄습니다. 잠시 후 다시 시도해 주세요.");
  }
  const applicant = {
    id: crypto.randomUUID(),
    nickname,
    discordName: $("#discordName").value.trim(),
    roles: cobalt ? [] : [...selectedRoles],
    userId: rankCache?.userId || null,
    mmr: Number($("#manualMmr").value || rankCache?.mmr || 0),
    currentMmr: Number($("#manualMmr").value || rankCache?.currentMmr || rankCache?.mmr || 0),
    peakMmr: Number(rankCache?.peakMmr || $("#manualMmr").value || rankCache?.mmr || 0),
    peakSeasonId: rankCache?.peakSeasonId || state.settings.seasonId,
    rank: Number($("#manualRank").value || rankCache?.rank || 0),
    totalGames: rankCache?.totalGames || 0,
    totalWins: rankCache?.totalWins || 0,
    most: rankCache?.most || [],
    mostStats: rankCache?.mostStats || [],
    cobaltRating: 0,
    cobaltPosition: "",
    cobaltPicks: "",
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
  renderApplyMode();
  refreshIcons();
}

function makeTeams() {
  makeRankTeams();
}

function makeRankTeams() {
  readTeamControls();
  const { desiredTeams, teamSize } = state.settings;
  if (state.applicants.length < desiredTeams) return toast("팀 수보다 참가자가 적습니다.");
  const maxPlayers = desiredTeams * teamSize;
  const sorted = state.applicants
    .slice()
    .sort((a, b) => applicantMmr(b) - applicantMmr(a))
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

function cobaltScore(player) {
  return Number(player?.cobaltRating || 0) || applicantMmr(player);
}

function cobaltPosition(player) {
  if (COBALT_POSITIONS[player?.cobaltPosition]) return player.cobaltPosition;
  const primary = player?.roles?.[0] || "";
  if (primary.includes("탱커")) return "front";
  if (primary.includes("서포터")) return "support";
  if (primary.includes("원딜")) return "carry";
  return "skirmish";
}

function teamCobaltScore(team) {
  return team.members.reduce((sum, id) => sum + cobaltScore(getApplicant(id)), 0);
}

function makeCobaltTeams() {
  state.settings.desiredTeams = 2;
  state.settings.teamSize = 4;
  $("#desiredTeams").value = 2;
  $("#teamSize").value = 4;
  readTeamControls();
  if (state.applicants.length < 8) return toast("코발트 편성은 최소 8명이 필요합니다.");

  const sorted = state.applicants
    .slice()
    .sort((a, b) => cobaltScore(b) - cobaltScore(a))
    .slice(0, 8);
  const teams = [0, 1].map((index) => ({
    id: crypto.randomUUID(),
    name: `${index + 1}팀`,
    members: [],
    cobaltPositions: { front: 0, skirmish: 0, carry: 0, support: 0 }
  }));

  sorted.forEach((player) => {
    const position = cobaltPosition(player);
    const candidates = teams
      .filter((team) => team.members.length < 4)
      .map((team) => {
        const nextScore = teamCobaltScore(team) + cobaltScore(player);
        const positionPenalty = (team.cobaltPositions[position] || 0) * 220;
        const sizePenalty = team.members.length * 30;
        return { team, value: nextScore + positionPenalty + sizePenalty };
      })
      .sort((a, b) => a.value - b.value);
    const target = candidates[0]?.team || teams[0];
    target.members.push(player.id);
    target.cobaltPositions[position] = (target.cobaltPositions[position] || 0) + 1;
  });

  state.teams = teams.map(({ cobaltPositions, ...team }) => team);
  state.captains = {};
  normalizeScores();
  saveState();
  toast("코발트 4v4 기준으로 2개 팀을 편성했습니다.");
}

function readTeamControls() {
  state.settings.desiredTeams = Math.min(12, Math.max(2, Number($("#desiredTeams").value || 8)));
  state.settings.teamSize = Math.min(4, Math.max(1, Number($("#teamSize").value || 3)));
  state.settings.mmrBasis = $("#mmrBasis").value === "peak" ? "peak" : "current";
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

function applicantMmr(player) {
  if (!player) return 0;
  return Number(state.settings.mmrBasis === "peak"
    ? (player.peakMmr ?? player.mmr ?? 0)
    : (player.currentMmr ?? player.mmr ?? 0));
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
  renderTeamMakerGuide();
  renderDraftBoard();
  renderTailRuleBoard();
  renderWeaponRuleBoard();
  const assignedIds = new Set(state.teams.flatMap((team) => team.members));
  const unassigned = sortedApplicantsByMmr().filter((player) => !assignedIds.has(player.id));
  $("#teamsBoard").innerHTML = state.teams.map((team) => {
    const totalMmr = team.members.reduce((sum, id) => sum + applicantMmr(getApplicant(id)), 0);
    const members = team.members.map((id, index) => {
      const player = getApplicant(id);
      if (!player) return "";
      const captain = state.captains[team.id] === player.id;
      const name = player.discordName ? `${player.discordName} (${player.nickname})` : player.nickname;
      const roleOrder = (player.roles || []).map((role, roleIndex) => `${roleIndex + 1}. ${role}`).join(" / ");
      const cobaltInfo = player.cobaltRating || player.cobaltPosition
        ? ` · 코발트 ${player.cobaltRating ? formatNumber(player.cobaltRating) : formatNumber(cobaltScore(player))}${player.cobaltPosition ? ` · ${COBALT_POSITIONS[player.cobaltPosition]}` : ""}`
        : "";
      return `<li class="team-member-row${captain ? " captain" : " draggable"}" data-team-member="${team.id}|${player.id}" draggable="${captain ? "false" : "true"}">
        <div>${captain ? "팀장 · " : ""}${escapeHtml(name)}<span class="role-tag">${escapeHtml(player.roles?.[0] || "-")}</span></div>
        <small>${state.settings.mmrBasis === "peak" ? "최고" : "현재"} MMR ${formatNumber(applicantMmr(player))} · ${escapeHtml(roleOrder || "역할군 미지정")}${cobaltInfo}</small>
      </li>`;
    }).join("");
    return `<article class="team-card" data-drop-team="${team.id}"><header><span>${team.name}</span><span>합계 ${formatNumber(totalMmr)}</span></header><ol>${members}</ol></article>`;
  }).join("");
  const cards = $("#teamsBoard").innerHTML;
  const unassignedPool = state.teams.length ? `<section class="unassigned-team-pool" data-drop-unassigned>
    <div class="unassigned-head"><strong>미배정 인원</strong><span>${unassigned.length}</span></div>
    <div class="unassigned-list">${unassigned.map((player) => {
      const name = player.discordName ? `${player.discordName} (${player.nickname})` : player.nickname;
      return `<div class="unassigned-player" data-team-member="unassigned|${player.id}" draggable="true">
        <strong>${escapeHtml(name)}</strong><small>MMR ${formatNumber(applicantMmr(player))} · ${escapeHtml(player.roles?.[0] || "-")}</small>
      </div>`;
    }).join("") || `<span class="empty">모두 배정됐습니다.</span>`}</div>
  </section>` : "";
  $("#teamsBoard").innerHTML = cards
    ? `<p class="team-drag-help">미배정 인원을 팀 카드로 드래그해 직접 구성하세요. 팀원끼리 놓으면 교체되고, 미배정 칸으로 되돌릴 수도 있습니다. 팀장은 고정됩니다.</p>${unassignedPool}${cards}`
    : `<p class="note">참가자를 등록한 뒤 자동 편성을 실행하세요.</p>`;
  renderCaptains();
}

function renderTeamMakerGuide() {
  const guide = $("#teamMakerGuide");
  if (!guide) return;
  const cobaltReady = state.applicants.filter((player) => Number(player.cobaltRating || 0) || player.cobaltPosition || player.cobaltPicks).length;
  const missingMmr = state.applicants.filter((player) => !applicantMmr(player)).length;
  guide.innerHTML = `
    <div>
      <strong>랭크 기준</strong>
      <span>${state.settings.mmrBasis === "peak" ? "최근 최고 MMR" : "현재 시즌 MMR"} · ${missingMmr ? `MMR 미입력 ${missingMmr}명` : "MMR 준비됨"}</span>
    </div>
    <div>
      <strong>코발트 기준</strong>
      <span>총 8명 4v4 · 코발트 양식 입력 ${cobaltReady}/${state.applicants.length}명 · 미입력자는 MMR로 보정</span>
    </div>`;
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
      ? applicantMmr(a) - applicantMmr(b)
      : applicantMmr(b) - applicantMmr(a));
}

function draftCaptainIds() {
  const count = Math.min(Number(state.settings.desiredTeams || 8), state.applicants.length);
  if (state.draft?.captainMode === "manual") return (state.draft.captains || []).slice(0, count);
  return sortedApplicantsByMmr(state.draft?.captainMode === "low").slice(0, count).map((player) => player.id);
}

function renderManualCaptainSelects() {
  if (state.draft?.captainMode !== "manual") return "";
  const count = Math.min(Number(state.settings.desiredTeams || 8), state.applicants.length);
  const selected = state.draft.captains || [];
  const applicants = sortedApplicantsByMmr();
  return `<div class="manual-captain-box">
    <p class="field-title">팀장 미리 지정</p>
    <p class="field-help">팀장으로 참가할 사람을 팀 수만큼 선택하세요. 선택된 사람은 남은 인원에서 제외됩니다.</p>
    <div class="manual-captain-grid">
      ${Array.from({ length: count }, (_, index) => `<label>팀장 ${index + 1}
        <select data-draft-captain-slot="${index}">
          <option value="">미정</option>
          ${applicants.map((player) => {
            const usedElsewhere = selected.includes(player.id) && selected[index] !== player.id;
            const name = player.discordName || player.nickname;
            return `<option value="${player.id}" ${selected[index] === player.id ? "selected" : ""} ${usedElsewhere ? "disabled" : ""}>${escapeHtml(name)} · MMR ${formatNumber(applicantMmr(player))}</option>`;
          }).join("")}
        </select>
      </label>`).join("")}
    </div>
  </div>`;
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
  if (state.teams.length && Object.keys(state.captains).length) {
    const assignedIds = new Set(state.teams.flatMap((team) => team.members));
    const remaining = sortedApplicantsByMmr().filter((player) => !assignedIds.has(player.id));
    board.innerHTML = `<div class="draft-team-status">
      ${state.teams.map((team) => {
        const captain = getApplicant(state.captains[team.id]);
        const picked = team.members.filter((id) => id !== captain?.id).map(getApplicant).filter(Boolean);
        return `<article><h3>${escapeHtml(team.name)} <span>${picked.length}/${Math.max(0, Number(state.settings.teamSize || 3) - 1)}픽</span></h3>
          <strong>팀장 · ${escapeHtml(captain?.discordName || captain?.nickname || "미정")}</strong>
          <div>${picked.map((player, index) => `<p>${index + 1}픽 · ${escapeHtml(player.discordName || player.nickname)} <small>MMR ${formatNumber(applicantMmr(player))}</small></p>`).join("") || `<p class="empty">아직 뽑은 팀원이 없습니다.</p>`}</div>
        </article>`;
      }).join("")}
      <article class="remaining"><h3>남은 인원 <span>${remaining.length}</span></h3>
        <div>${remaining.map((player) => `<p>${escapeHtml(player.discordName || player.nickname)} <small>MMR ${formatNumber(applicantMmr(player))}</small></p>`).join("") || `<p class="empty">남은 인원이 없습니다.</p>`}</div>
      </article>
    </div>`;
    return;
  }
  const captainIds = new Set(draftCaptainIds());
  const pickedIds = new Set(state.draft.picked || []);
  const captains = sortedApplicantsByMmr(state.draft?.captainMode === "low").filter((player) => captainIds.has(player.id));
  const remaining = sortedApplicantsByMmr().filter((player) => !captainIds.has(player.id) && !pickedIds.has(player.id));
  const picked = sortedApplicantsByMmr().filter((player) => pickedIds.has(player.id));
  board.innerHTML = `
    ${renderManualCaptainSelects()}
    <div class="draft-columns">
    <div class="draft-column captains">
      <h3>${state.draft?.captainMode === "manual" ? "지정된 팀장" : "팀장 후보"} <span>${captains.length}</span></h3>
      <div class="draft-list">${captains.map((player, index) => draftPlayerButton(player, index + 1, "captain")).join("") || "<p class=\"empty\">없음</p>"}</div>
    </div>
    <div class="draft-column">
      <h3>남은 인원 <span>${remaining.length}</span></h3>
      <div class="draft-list">${remaining.map((player, index) => draftPlayerButton(player, index + 1, "pick")).join("") || "<p class=\"empty\">남은 인원이 없습니다.</p>"}</div>
    </div>
    <div class="draft-column picked">
      <h3>뽑힘 <span>${picked.length}</span></h3>
      <div class="draft-list">${picked.map((player, index) => draftPlayerButton(player, index + 1, "unpick")).join("") || "<p class=\"empty\">아직 체크된 인원이 없습니다.</p>"}</div>
    </div>
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
    <small>MMR ${formatNumber(applicantMmr(player))} · ${escapeHtml(role)}</small>
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
    <div class="match-record-head"><div><p class="field-title">방·리플레이 기록</p><p class="field-help">경기별 코드를 한곳에서 관리하고 결과 CSV의 게임 ID를 함께 보관합니다.</p></div></div>
    <div class="match-record-grid">
      ${state.replayCodes.map((code, index) => {
        const record = state.matchRecords[index] || {};
        return `<article class="match-record-card">
          <header><strong>${index + 1}경기</strong><span>${record.gameId ? `게임 ${escapeHtml(String(record.gameId))}` : "결과 대기"}</span></header>
          <label>방 코드<input data-room="${index}" value="${escapeHtml(state.roomCodes[index] || "")}" placeholder="방 코드"></label>
          <label>리플레이 코드<input data-replay="${index}" value="${escapeHtml(code)}" placeholder="리플레이 코드"></label>
          <small>${record.sourceFile ? `${escapeHtml(record.sourceFile)} · ${new Date(record.importedAt).toLocaleString("ko-KR")}` : "CSV 미등록"}</small>
        </article>`;
      }).join("")}
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
      <td>${formatNumber(applicantMmr(player))}<br><small>${state.settings.mmrBasis === "peak" ? "최고" : "현재"} 기준</small></td>
      <td>${player.rank ? `${formatNumber(player.rank)}위` : "-"}</td>
      <td>${formatWinRate(player.totalWins, player.totalGames)}</td>
      <td><div class="roster-most">${renderRosterMost(player)}</div></td>
      <td>${renderCobaltApplicantSummary(player)}</td>
      <td><div class="roster-actions">
        <button class="secondary" data-edit-applicant="${player.id}" type="button" aria-label="${escapeHtml(player.nickname)} 수정"><i data-lucide="pencil"></i></button>
        <button class="danger" data-remove="${player.id}" type="button" aria-label="${escapeHtml(player.nickname)} 삭제"><i data-lucide="trash-2"></i></button>
      </div></td>
    </tr>`).join("") || `<tr><td colspan="10">등록된 참가자가 없습니다.</td></tr>`;
}

function renderCobaltApplicantSummary(player) {
  const parts = [
    player.cobaltRating ? `점수 ${formatNumber(player.cobaltRating)}` : "",
    player.cobaltPosition ? COBALT_POSITIONS[player.cobaltPosition] : "",
    player.cobaltPicks ? escapeHtml(player.cobaltPicks) : ""
  ].filter(Boolean);
  return parts.length ? `<small>${parts.join("<br>")}</small>` : "-";
}

function renderPublicRoster() {
  const board = $("#publicRosterBoard");
  if (!board) return;
  const teamByPlayer = new Map();
  state.teams.forEach((team) => team.members.forEach((playerId) => teamByPlayer.set(playerId, team.name)));
  const players = state.applicants.slice().sort((a, b) => {
    const teamCompare = String(teamByPlayer.get(a.id) || "미배정").localeCompare(String(teamByPlayer.get(b.id) || "미배정"), "ko");
    return teamCompare || a.nickname.localeCompare(b.nickname, "ko");
  });
  board.innerHTML = players.map((player) => `
    <article class="public-roster-card">
      <div><strong>${escapeHtml(player.nickname)}</strong><span>${escapeHtml(teamByPlayer.get(player.id) || "미배정")}</span></div>
      <p>${state.settings.mmrBasis === "peak" ? "최고" : "현재"} MMR ${formatNumber(applicantMmr(player))} · ${escapeHtml(player.roles?.[0] || "역할 미지정")}</p>
      <small>${escapeHtml((player.mostStats || []).map(characterNameForStat).join(" / ") || player.most?.join(" / ") || "모스트 기록 없음")}</small>
    </article>`).join("") || `<p class="note">아직 등록된 참가자가 없습니다.</p>`;
}

function openApplicantEditor(applicantId) {
  if (cloud?.configured && !canManageCloudEvent()) return toast("이 내전의 운영자만 수정할 수 있습니다.");
  const player = getApplicant(applicantId);
  if (!player) return;
  editingApplicantId = applicantId;
  $("#editNickname").value = player.nickname || "";
  $("#editDiscordName").value = player.discordName || "";
  $("#editMmr").value = Number(player.currentMmr ?? player.mmr ?? 0);
  $("#editPeakMmr").value = Number(player.peakMmr ?? player.mmr ?? 0);
  $("#editRank").value = Number(player.rank || 0);
  $("#editTotalGames").value = Number(player.totalGames || 0);
  $("#editTotalWins").value = Number(player.totalWins || 0);
  $("#editCobaltRating").value = Number(player.cobaltRating || 0) || "";
  $("#editCobaltPosition").value = player.cobaltPosition || "";
  $("#editCobaltPicks").value = player.cobaltPicks || "";
  $("#editMemo").value = player.memo || "";
  const displayedMost = (player.mostStats || []).length
    ? player.mostStats.map(characterNameForStat)
    : (player.most || []);
  $("#editMost").value = displayedMost.join(", ");
  ["editRole1", "editRole2", "editRole3"].forEach((id, index) => {
    const select = $(`#${id}`);
    select.innerHTML = `<option value="">미지정</option>${ROLES.map((role) => `<option value="${role}">${role}</option>`).join("")}`;
    select.value = player.roles?.[index] || "";
  });
  $("#applicantEditDialog").showModal();
  refreshIcons();
}

async function saveApplicantEdit(event) {
  event.preventDefault();
  const player = getApplicant(editingApplicantId);
  if (!player) return $("#applicantEditDialog").close();
  const roles = [$("#editRole1").value, $("#editRole2").value, $("#editRole3").value].filter(Boolean);
  if (roles.length !== 3 || new Set(roles).size !== 3) return toast("역할군 3개를 서로 다르게 지정해 주세요.");
  const totalGames = Math.max(0, Number($("#editTotalGames").value || 0));
  const totalWins = Math.max(0, Number($("#editTotalWins").value || 0));
  if (totalWins > totalGames) return toast("승리 수는 전체 경기 수보다 클 수 없습니다.");
  const most = $("#editMost").value.split(",").map((name) => name.trim()).filter(Boolean).slice(0, 3);
  const previousMost = (player.mostStats || []).length ? player.mostStats.map(characterNameForStat) : (player.most || []);
  const updated = {
    ...player,
    nickname: $("#editNickname").value.trim(),
    discordName: $("#editDiscordName").value.trim(),
    mmr: Math.max(0, Number($("#editMmr").value || 0)),
    currentMmr: Math.max(0, Number($("#editMmr").value || 0)),
    peakMmr: Math.max(0, Number($("#editPeakMmr").value || 0)),
    rank: Math.max(0, Number($("#editRank").value || 0)),
    totalGames,
    totalWins,
    cobaltRating: Math.max(0, Number($("#editCobaltRating").value || 0)),
    cobaltPosition: $("#editCobaltPosition").value,
    cobaltPicks: $("#editCobaltPicks").value.trim(),
    roles,
    most,
    mostStats: most.join("|") === previousMost.join("|") ? (player.mostStats || []) : [],
    memo: $("#editMemo").value.trim()
  };
  if (!updated.nickname) return toast("인게임 닉네임을 입력해 주세요.");
  try {
    if (cloud?.configured && cloudEvent) await cloud.updateApplicant(cloudEvent.id, updated);
    state.applicants[state.applicants.findIndex((item) => item.id === player.id)] = updated;
    $("#applicantEditDialog").close();
    editingApplicantId = null;
    saveState();
    toast("참가자 정보를 수정했습니다.");
  } catch (error) {
    const duplicate = error.code === "23505" || /duplicate|unique/i.test(error.message);
    toast(duplicate ? "이미 등록된 인게임 닉네임입니다." : error.message);
  }
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
  renderApplyMode();
  renderTeams();
  renderScores();
  renderApplicants();
  renderPublicRoster();
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
    ["team", "captain", "members", "total", "match", "roomCode", "replayCode", "gameId", "place", "day1Kills", "lateKills", "penaltyDeaths", "score", "bans"]
  ];
  state.teams.forEach((team) => {
    const members = team.members.map((id) => getApplicant(id)?.nickname).filter(Boolean).join(" / ");
    const captain = getApplicant(state.captains[team.id])?.nickname || "";
    state.scores.forEach((match, index) => {
      const entry = match[team.id] || {};
      rows.push([team.name, captain, members, teamTotal(team.id), index + 1, state.roomCodes[index] || "", state.replayCodes[index] || "", state.matchRecords[index]?.gameId || "", entry.place || "", entry.day1Kills || 0, entry.lateKills || 0, entry.penaltyDeaths || 0, scoreFor(entry), entry.bans || ""]);
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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim()); cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

async function importGameResultCsv(event) {
  const file = event.target.files[0];
  if (!file) return;
  const status = $("#gameResultImportStatus");
  try {
    if (cloud?.configured && !canManageCloudEvent()) throw new Error("이 내전의 편집 권한이 필요합니다.");
    const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
    const headers = rows.shift().map((header) => header.trim().toLowerCase());
    const required = ["rank", "team kill", "gameid", "teamname"];
    if (required.some((header) => !headers.includes(header))) throw new Error("지원하지 않는 결과 CSV 형식입니다.");
    const objects = rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
    const gameId = String(objects[0]?.gameid || "").trim();
    if (!gameId) throw new Error("게임 ID가 없습니다.");
    let matchIndex = state.matchRecords.findIndex((record) => String(record?.gameId || "") === gameId);
    if (matchIndex < 0) matchIndex = state.matchRecords.findIndex((record) => !record?.gameId);
    if (matchIndex < 0) {
      if (state.settings.matchCount >= 12) throw new Error("경기는 최대 12개까지 기록할 수 있습니다.");
      state.settings.matchCount += 1;
      syncMatchArrays();
      matchIndex = state.settings.matchCount - 1;
      bindSettings();
    }
    const csvTeams = new Map();
    objects.forEach((record) => {
      const rank = String(record.rank || "").trim();
      if (!rank) return;
      if (!csvTeams.has(rank)) csvTeams.set(rank, []);
      csvTeams.get(rank).push(record);
    });
    let applied = 0;
    const assignedTeamIds = new Set();
    csvTeams.forEach((records) => {
      const record = records[0];
      const csvNicknames = new Set(records.map((item) => String(item.nickname || "").trim().toLowerCase()).filter(Boolean));
      let team = state.teams
        .filter((item) => !assignedTeamIds.has(item.id))
        .map((item) => ({
          item,
          matches: item.members.filter((id) => csvNicknames.has(String(getApplicant(id)?.nickname || "").trim().toLowerCase())).length
        }))
        .sort((a, b) => b.matches - a.matches)[0];
      team = team?.matches > 0 ? team.item : null;

      if (!team) {
        const memberIds = records
          .map((item) => state.applicants.find((player) => player.nickname.toLowerCase() === String(item.nickname || "").trim().toLowerCase())?.id)
          .filter(Boolean);
        if (memberIds.length === csvNicknames.size && memberIds.length) {
          team = { id: crypto.randomUUID(), name: `${state.teams.length + 1}팀`, members: memberIds };
          state.teams.push(team);
        }
      }
      if (!team) return;
      assignedTeamIds.add(team.id);
      const teamKills = Number(record["team kill"] || 0);
      const day1Kills = Number(record["down can not eliminate"] || 0);
      state.scores[matchIndex][team.id] = {
        ...(state.scores[matchIndex][team.id] || {}),
        place: Number(record.rank || 0) || "",
        day1Kills,
        lateKills: Math.max(0, teamKills - day1Kills),
        penaltyDeaths: Number(state.scores[matchIndex][team.id]?.penaltyDeaths || 0),
        bans: state.scores[matchIndex][team.id]?.bans || ""
      };
      applied += 1;
    });
    state.matchRecords[matchIndex] = { gameId, sourceFile: file.name, importedAt: new Date().toISOString(), teamCount: applied };
    saveState();
    status.hidden = false;
    status.className = "import-status ok";
    status.textContent = `${matchIndex + 1}경기 · 게임 ${gameId} · ${applied}개 팀의 등수와 팀킬을 자동 반영했습니다.`;
    toast("게임 결과 CSV를 점수에 반영했습니다.");
  } catch (error) {
    status.hidden = false;
    status.className = "import-status error";
    status.textContent = error.message;
  }
  event.target.value = "";
}

async function createCloudBackup() {
  if (!cloudEvent || !canManageCloudEvent()) return;
  const now = new Date();
  const label = `${cloudEvent.name} · ${now.toLocaleString("ko-KR")}`;
  try {
    const snapshot = JSON.parse(JSON.stringify(state));
    delete snapshot.settings?.apiKey;
    delete snapshot.settings?.apiBase;
    const backup = await cloud.createBackup(cloudEvent.id, label, snapshot);
    cloudBackups.unshift(backup);
    renderBackupControls();
    toast("현재 내전을 서버에 백업했습니다.");
  } catch (error) { toast(error.message); }
}

async function restoreCloudBackup() {
  const backup = cloudBackups.find((item) => item.id === $("#cloudBackupSelect").value);
  if (!backup || !canManageCloudEvent() || !confirm(`'${backup.label}' 상태로 복원할까요? 현재 상태는 덮어씁니다.`)) return;
  try {
    cloudLoading = true;
    const restored = normalizeState(backup.snapshot || {});
    await cloud.replaceApplicants(cloudEvent.id, restored.applicants);
    const event = await cloud.updateEvent(cloudEvent.id, restored);
    applyCloudState(event, restored.applicants);
    toast("내전 백업을 복원했습니다.");
  } catch (error) { toast(error.message); }
  finally { cloudLoading = false; }
}

async function deleteCloudBackup() {
  const backup = cloudBackups.find((item) => item.id === $("#cloudBackupSelect").value);
  if (!backup || !canManageCloudEvent() || !confirm("선택한 서버 백업을 삭제할까요?")) return;
  try {
    await cloud.deleteBackup(backup.id);
    cloudBackups = cloudBackups.filter((item) => item.id !== backup.id);
    renderBackupControls();
    toast("백업을 삭제했습니다.");
  } catch (error) { toast(error.message); }
}

function bindEvents() {
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.viewTarget === "apply" && cloud?.configured && !cloudEvent) {
        setView("admin");
        return toast("먼저 내전을 만들거나 관리할 내전을 선택해 주세요.");
      }
      setView(button.dataset.viewTarget);
    });
  });
  $("#googleLoginButton").addEventListener("click", async () => {
    const button = $("#googleLoginButton");
    button.disabled = true;
    try {
      await cloud.signInWithGoogle();
    } catch (error) {
      button.disabled = false;
      toast(friendlyAuthError(error));
    }
  });
  $("#adminLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#adminEmail").value.trim().toLowerCase();
    const button = $("#sendOtpButton");
    button.disabled = true;
    try {
      await cloud.sendOtp(email);
      showOtpStep(email, true);
      toast("6자리 인증번호를 보냈습니다.");
    } catch (error) {
      toast(friendlyAuthError(error));
    } finally {
      button.disabled = false;
    }
  });
  $("#adminOtpForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = $("#adminOtp").value.replace(/\D/g, "");
    if (token.length !== 6) return setOtpError("6자리 인증번호를 입력해 주세요.");
    const button = $("#verifyOtpButton");
    button.disabled = true;
    setOtpError();
    try {
      const session = await cloud.verifyOtp(otpEmail, token);
      clearOtpStep(false);
      if (session && session.user.id !== cloudSession?.user?.id) await handleCloudSession(session);
      renderCloudControls();
      toast("운영자 인증이 완료되었습니다.");
    } catch (error) {
      const message = friendlyAuthError(error);
      setOtpError(message);
      toast(message);
    } finally {
      button.disabled = false;
    }
  });
  $("#resendOtp").addEventListener("click", async () => {
    if (!otpEmail || otpCooldownSeconds() > 0) return;
    const button = $("#resendOtp");
    button.disabled = true;
    setOtpError();
    try {
      await cloud.sendOtp(otpEmail);
      showOtpStep(otpEmail, true);
      toast("새 인증번호를 보냈습니다.");
    } catch (error) {
      const message = friendlyAuthError(error);
      setOtpError(message);
      toast(message);
    } finally {
      renderOtpCooldown();
    }
  });
  $("#changeOtpEmail").addEventListener("click", () => {
    const previousEmail = otpEmail;
    clearOtpStep();
    $("#adminEmail").value = previousEmail;
    $("#adminEmail").focus();
  });
  $("#adminSignOut").addEventListener("click", async () => {
    try {
      await cloud.signOut();
      cloudEvent = null;
      cloudOperator = null;
      cloudOperators = [];
      state = defaultState();
      bindSettings();
      render();
      renderCloudControls();
    } catch (error) {
      toast(error.message);
    }
  });
  $("#operatorForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isSiteOwner()) return;
    const email = $("#operatorEmail").value.trim().toLowerCase();
    const button = $("#addOperator");
    setOperatorError();
    button.disabled = true;
    try {
      await cloud.addOperator(email);
      cloudOperators = await cloud.listOperators();
      $("#operatorForm").reset();
      renderCloudControls();
      toast("운영자를 등록했습니다.");
    } catch (error) {
      const duplicate = error.code === "23505" || /duplicate|unique/i.test(error.message);
      const message = duplicate ? "이미 등록된 운영자 이메일입니다." : friendlyCloudError(error);
      setOperatorError(message);
      toast(message);
    } finally {
      button.disabled = false;
    }
  });
  $("#operatorList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-operator]");
    if (!button || !isSiteOwner()) return;
    const operator = cloudOperators.find((item) => item.id === button.dataset.removeOperator);
    if (!operator || !confirm(`${operator.email} 운영자 권한을 해제할까요?`)) return;
    try {
      await cloud.removeOperator(operator.id);
      cloudOperators = await cloud.listOperators();
      renderCloudControls();
      toast("운영자 권한을 해제했습니다.");
    } catch (error) {
      toast(friendlyCloudError(error));
    }
  });
  $("#newCloudEvent").addEventListener("click", () => {
    cloudCreateOpen = true;
    setCloudCreateError();
    renderCloudControls();
    $("#newEventName").focus();
  });
  $("#cancelCreateEvent").addEventListener("click", () => {
    $("#createEventForm").reset();
    cloudCreateOpen = false;
    setCloudCreateError();
    renderCloudControls();
  });
  $("#createEventForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!cloudOperator) return toast("등록된 운영자만 내전을 만들 수 있습니다.");
    const name = $("#newEventName").value.trim();
    const eventType = $("#newEventType").value === "cobalt" ? "cobalt" : "normal";
    const slug = `match-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6)}`;
    const button = $("#createCloudEventButton");
    setCloudCreateError();
    button.disabled = true;
    button.innerHTML = `<i data-lucide="loader-circle"></i> 생성 중`;
    refreshIcons();
    try {
      const seed = defaultState();
      seed.settings.eventName = name;
      seed.settings.eventType = eventType;
      if (eventType === "cobalt") {
        seed.settings.teamMode = 4;
        seed.settings.desiredTeams = 2;
        seed.settings.teamSize = 4;
        seed.eventInfo.teamFormat = "코발트 4v4";
        seed.eventInfo.capacity = "8명";
      }
      const created = await cloud.createEvent({ ownerId: cloudSession.user.id, name, slug, state: seed });
      $("#createEventForm").reset();
      cloudCreateOpen = false;
      await refreshCloudEvents(created.id);
      toast("새 내전을 만들었습니다.");
    } catch (error) {
      const message = friendlyCloudError(error);
      setCloudCreateError(message);
      toast(message);
    } finally {
      button.disabled = false;
      button.innerHTML = `<i data-lucide="check"></i> 생성`;
      refreshIcons();
    }
  });
  $("#cloudEventSelect").addEventListener("change", (event) => {
    loadAdminCloudEvent(event.target.value).catch((error) => toast(error.message));
  });
  $("#deleteCloudEvent").addEventListener("click", async () => {
    if (!canManageCloudEvent() || !confirm(`'${cloudEvent.name}' 내전과 신청 명단을 모두 삭제할까요?`)) return;
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
    if (!canManageCloudEvent()) return;
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
  $("#syncApplicantRanks").addEventListener("click", syncMissingApplicantRanks);
  $("#refreshApplicants").addEventListener("click", async () => {
    const button = $("#refreshApplicants");
    button.disabled = true;
    try {
      await reloadCloudApplicants();
      toast(`참가자 ${state.applicants.length}명을 불러왔습니다.`);
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  });
  $("#resetForm").addEventListener("click", resetForm);
  $("#makeTeams").addEventListener("click", makeTeams);
  $("#makeRankTeams").addEventListener("click", makeRankTeams);
  $("#makeCobaltTeams").addEventListener("click", makeCobaltTeams);
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
  $("#mmrBasis").addEventListener("change", () => {
    readTeamControls();
    saveState();
    toast(state.settings.mmrBasis === "peak" ? "최근 3시즌 최고 MMR 기준을 적용했습니다." : "현재 시즌 MMR 기준을 적용했습니다.");
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
  $("#createCaptainTeams").addEventListener("click", createTeamsFromCaptains);
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
  $("#draftBoard").addEventListener("change", (event) => {
    const slot = event.target.dataset.draftCaptainSlot;
    if (slot === undefined) return;
    const index = Number(slot);
    const captains = [...(state.draft.captains || [])];
    captains[index] = event.target.value;
    state.draft.captains = captains.filter(Boolean);
    state.draft.picked = state.draft.picked.filter((id) => !state.draft.captains.includes(id));
    saveState();
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
    if (cloud?.configured && !canManageCloudEvent()) return toast("이 내전의 운영자만 삭제할 수 있습니다.");
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
    const editButton = event.target.closest("[data-edit-applicant]");
    if (editButton) return openApplicantEditor(editButton.dataset.editApplicant);
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    const id = button.dataset.remove;
    if (cloud?.configured && !canManageCloudEvent()) return toast("이 내전의 운영자만 삭제할 수 있습니다.");
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
  $("#cancelApplicantEdit").addEventListener("click", () => $("#applicantEditDialog").close());
  $("#applicantEditForm").addEventListener("submit", saveApplicantEdit);
  $("#scoreBoard").addEventListener("change", updateScore);
  $("#banBoard").addEventListener("change", updateBan);
  $("#replayBoard").addEventListener("change", updateReplay);
  $("#replayBoard").addEventListener("change", updateRoom);
  $("#captainBoard").addEventListener("change", updateCaptain);
  $("#teamsBoard").addEventListener("dragstart", startTeamMemberDrag);
  $("#teamsBoard").addEventListener("dragover", handleTeamMemberDragOver);
  $("#teamsBoard").addEventListener("dragleave", clearTeamDropTarget);
  $("#teamsBoard").addEventListener("drop", dropTeamMember);
  $("#teamsBoard").addEventListener("dragend", clearTeamDragState);
  $("#createCloudBackup").addEventListener("click", createCloudBackup);
  $("#restoreCloudBackup").addEventListener("click", restoreCloudBackup);
  $("#deleteCloudBackup").addEventListener("click", deleteCloudBackup);
  $("#exportJson").addEventListener("click", exportJson);
  $("#exportCsv").addEventListener("click", exportCsv);
  $("#importJson").addEventListener("change", importJson);
  $("#importGameResult").addEventListener("change", importGameResultCsv);
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

function updateRoom(event) {
  const index = event.target.dataset.room;
  if (index === undefined) return;
  state.roomCodes[Number(index)] = event.target.value.trim();
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

function startTeamMemberDrag(event) {
  const row = event.target.closest("[data-team-member]");
  if (!row || row.classList.contains("captain")) return event.preventDefault();
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", row.dataset.teamMember);
  row.classList.add("dragging");
}

function handleTeamMemberDragOver(event) {
  const source = $("#teamsBoard [data-team-member].dragging");
  if (!source) return;
  const targetRow = event.target.closest(".team-member-row:not(.captain)");
  const targetCard = event.target.closest("[data-drop-team]");
  const targetPool = event.target.closest("[data-drop-unassigned]");
  const sourceTeamId = source.dataset.teamMember.split("|")[0];
  if (!targetPool && (!targetCard || targetCard.dataset.dropTeam === sourceTeamId)) return;
  if (targetPool && sourceTeamId === "unassigned") return;
  event.preventDefault();
  clearTeamDropTarget();
  (targetRow || targetPool || targetCard).classList.add("drag-over");
}

function clearTeamDropTarget() {
  document.querySelectorAll("#teamsBoard .drag-over").forEach((element) => element.classList.remove("drag-over"));
}

function clearTeamDragState() {
  clearTeamDropTarget();
  document.querySelectorAll("#teamsBoard .dragging").forEach((element) => element.classList.remove("dragging"));
}

function dropTeamMember(event) {
  event.preventDefault();
  const sourceToken = event.dataTransfer.getData("text/plain");
  const targetRow = event.target.closest(".team-member-row");
  const targetCard = event.target.closest("[data-drop-team]");
  const targetPool = event.target.closest("[data-drop-unassigned]");
  clearTeamDragState();
  if (!sourceToken || (!targetCard && !targetPool)) return;
  const [sourceTeamId, playerId] = sourceToken.split("|");
  const targetTeamId = targetCard?.dataset.dropTeam;
  const sourceTeam = state.teams.find((team) => team.id === sourceTeamId);
  const targetTeam = state.teams.find((team) => team.id === targetTeamId);
  if (sourceTeam && state.captains[sourceTeam.id] === playerId) return;
  const sourceIndex = sourceTeam?.members.indexOf(playerId) ?? -1;
  if (sourceTeam && sourceIndex < 0) return;

  if (targetPool) {
    if (!sourceTeam) return;
    sourceTeam.members.splice(sourceIndex, 1);
    state.draft.picked = (state.draft.picked || []).filter((id) => id !== playerId);
    saveState();
    return toast(`${sourceTeam.name}에서 미배정 인원으로 이동했습니다.`);
  }

  if (!targetTeam || sourceTeam === targetTeam) return;

  if (targetRow) {
    const [, targetPlayerId] = targetRow.dataset.teamMember.split("|");
    if (state.captains[targetTeam.id] === targetPlayerId) return toast("팀장은 교체할 수 없습니다.");
    const targetIndex = targetTeam.members.indexOf(targetPlayerId);
    if (targetIndex < 0) return;
    if (sourceTeam) sourceTeam.members[sourceIndex] = targetPlayerId;
    else state.draft.picked = (state.draft.picked || []).filter((id) => id !== targetPlayerId);
    targetTeam.members[targetIndex] = playerId;
    if (!sourceTeam) state.draft.picked.push(playerId);
    saveState();
    toast(sourceTeam ? `${sourceTeam.name}과 ${targetTeam.name}의 팀원을 교체했습니다.` : `${targetTeam.name}의 팀원을 교체했습니다.`);
    return;
  }

  if (targetTeam.members.length >= Number(state.settings.teamSize || 3)) return toast(`${targetTeam.name}에 빈자리가 없습니다.`);
  if (sourceTeam) sourceTeam.members.splice(sourceIndex, 1);
  targetTeam.members.push(playerId);
  if (!(state.draft.picked || []).includes(playerId)) state.draft.picked.push(playerId);
  saveState();
  toast(sourceTeam ? `${sourceTeam.name}에서 ${targetTeam.name}으로 이동했습니다.` : `${targetTeam.name}에 배정했습니다.`);
}

function createTeamsFromCaptains() {
  readTeamControls();
  const captainIds = draftCaptainIds();
  const teamCount = Number(state.settings.desiredTeams || 8);
  if (captainIds.length !== teamCount) return toast(`팀장 ${teamCount}명을 먼저 지정해 주세요.`);
  if (state.teams.length && !confirm("현재 팀 구성을 지우고 지정한 팀장으로 새 팀을 만들까요?")) return;
  state.teams = captainIds.map((captainId, index) => ({ id: crypto.randomUUID(), name: `${index + 1}팀`, members: [captainId] }));
  state.captains = Object.fromEntries(state.teams.map((team, index) => [team.id, captainIds[index]]));
  state.draft.picked = [];
  normalizeScores();
  saveState();
  toast("팀장별 빈 팀을 만들었습니다. 미배정 인원을 드래그해 넣어 주세요.");
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

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && canViewCloudEvent()) {
    reloadCloudApplicants().catch((error) => console.warn("Applicant refresh failed", error));
  }
});

bootstrap();
