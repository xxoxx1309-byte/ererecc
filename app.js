const STORAGE_KEY = "er-custom-match-calculator-v2";
const LEGACY_STORAGE_KEY = "er-scrim-calculator-v1";
const API_BASE = "https://open-api.bser.io";
const DEFAULT_SEASON_ID = 39;
const STATE_VERSION = 4;
const ROLES = ["스증원딜", "평원딜", "공격력브루저", "스증브루저", "암살자", "서포터", "탱커"];
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
let characterNames = new Map();
let toastTimer = null;

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
  if (renderAfter) render();
}

async function loadLocalConfig() {
  try {
    const response = await fetch("./config.local.json", { cache: "no-store" });
    if (!response.ok) return;
    const config = await response.json();
    if (!state.settings.apiKey && config.apiKey) state.settings.apiKey = config.apiKey;
  } catch {
    // Optional local-only configuration.
  }
}

function bindSettings() {
  $("#eventName").value = state.settings.eventName;
  $("#apiKey").value = state.settings.apiKey || "";
  $("#apiBase").value = API_BASE;
  $("#teamMode").value = String(state.settings.teamMode || 3);
  $("#matchCount").value = state.settings.matchCount;
  $("#desiredTeams").value = state.settings.desiredTeams || 8;
  $("#teamSize").value = state.settings.teamSize || 3;
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
    if (!state.settings.apiKey) throw new Error("API 키 미설정");
    const [seasonJson, characterJson] = await Promise.all([
      erFetch("v2/data/Season"),
      erFetch("v2/data/Character")
    ]);
    seasons = (seasonJson.data || []).filter((season) => !/pre/i.test(season.seasonName));
    characterNames = new Map((characterJson.data || []).map((character) => [Number(character.code), character.name]));
    const hasSelected = seasons.some((season) => Number(season.seasonID) === Number(state.settings.seasonId));
    if (!hasSelected) state.settings.seasonId = DEFAULT_SEASON_ID;
    populateSeasonSelect();
    setApiStatus("ok", "API 연결됨");
    if (showMessage) toast("Open API 연결을 확인했습니다.");
    return true;
  } catch (error) {
    setApiStatus("error", error.message === "API 키 미설정" ? "API 키 필요" : "API 연결 실패");
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
  if (!state.settings.apiKey) {
    $("#settingsDialog").showModal();
    return toast("먼저 Open API 키를 입력해 주세요.");
  }

  updateRankPreview(null, "loading");
  try {
    const userJson = await erFetch(`v1/user/nickname?query=${encodeURIComponent(nickname)}`);
    const user = userJson.user;
    if (!user?.userId) throw new Error("닉네임에 해당하는 계정을 찾지 못했습니다.");

    const userId = encodeURIComponent(user.userId);
    const seasonId = state.settings.seasonId;
    const teamMode = state.settings.teamMode;
    const [rankJson, statsJson] = await Promise.all([
      erFetch(`v1/rank/uid/${userId}/${seasonId}/${teamMode}`),
      erFetch(`v2/user/stats/uid/${userId}/${seasonId}/3`)
    ]);
    const stats = (statsJson.userStats || []).find((item) => Number(item.matchingTeamMode) === teamMode) || statsJson.userStats?.[0] || {};
    const mostStats = (stats.characterStats || [])
      .slice()
      .sort((a, b) => Number(b.usages || b.totalGames || 0) - Number(a.usages || a.totalGames || 0))
      .slice(0, 3)
      .map((item) => ({
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

function submitApplicant(event) {
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
  $("#rankPreview").innerHTML = `<i data-lucide="scan-search"></i><strong>닉네임을 조회해 주세요</strong><p>현재 선택한 시즌의 ${teamModeLabel()} 랭크를 불러옵니다.</p>`;
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
  $("#eventTitle").textContent = state.settings.eventName;
  document.title = `${state.settings.eventName} · 내전 계산기`;
  $("#matchCountStat").textContent = state.settings.matchCount;
  $("#savedAt").textContent = state.updatedAt ? new Date(state.updatedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "저장 대기";
  updateSeasonLabel();
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

function render() {
  renderOverview();
  renderNotice();
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
    if (event.key === "Enter") {
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
  $("#desiredTeams").addEventListener("change", readTeamControls);
  $("#teamSize").addEventListener("change", readTeamControls);
  $("#clearApplicants").addEventListener("click", () => {
    if (!confirm("참가자와 편성 팀을 모두 삭제할까요?")) return;
    state.applicants = [];
    state.teams = [];
    state.captains = {};
    normalizeScores();
    saveState();
  });
  $("#applicantRows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    const id = button.dataset.remove;
    state.applicants = state.applicants.filter((player) => player.id !== id);
    state.teams.forEach((team) => team.members = team.members.filter((memberId) => memberId !== id));
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

function renderMostStats(data) {
  const stats = Array.isArray(data.mostStats) ? data.mostStats : [];
  if (stats.length) {
    return stats.map((item, index) => `
      <article class="most-stat">
        <span class="most-rank">${index + 1}</span>
        <div>
          <strong>${escapeHtml(item.name)}</strong>
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
      `<span><strong>${escapeHtml(item.name)}</strong> ${formatWinRate(item.wins, item.totalGames)}</span>`
    ).join("");
  }
  return escapeHtml(player.most?.join(" / ") || "-");
}

async function bootstrap() {
  await loadLocalConfig();
  bindSettings();
  bindEvents();
  render();
  await refreshApiMetadata();
}

bootstrap();
