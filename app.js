const STORAGE_KEY = "er-scrim-calculator-v1";
const ROLES = ["스증원딜", "평원딜", "공격력브루저", "스증브루저", "암살자", "서포터", "탱커"];
const PLACE_POINTS = { 1: 10, 2: 7, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 0 };

const state = loadState();
let selectedRoles = [];
let rankCache = null;

const $ = (selector) => document.querySelector(selector);

function defaultState() {
  return {
    settings: {
      apiKey: "",
      apiBase: "https://open-api.bser.io/v1",
      seasonId: 10,
      teamMode: 3
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
    return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return defaultState();
  }
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function bindSettings() {
  $("#apiKey").value = state.settings.apiKey || "";
  $("#apiBase").value = state.settings.apiBase || "https://open-api.bser.io/v1";
  $("#seasonId").value = state.settings.seasonId || 10;
  $("#teamMode").value = state.settings.teamMode || 3;
}

function readSettings() {
  state.settings = {
    apiKey: $("#apiKey").value.trim(),
    apiBase: $("#apiBase").value.trim().replace(/\/$/, ""),
    seasonId: Number($("#seasonId").value || 10),
    teamMode: Number($("#teamMode").value || 3)
  };
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
    : "<span>왼쪽부터 공개 우선순위로 3개를 선택합니다.</span>";
}

function toggleRole(role) {
  if (selectedRoles.includes(role)) {
    selectedRoles = selectedRoles.filter((item) => item !== role);
  } else if (selectedRoles.length < 3) {
    selectedRoles.push(role);
  }
  renderRoles();
}

function updateRankPreview(data, message = "") {
  const mmr = data?.mmr ?? "-";
  const rank = data?.rank ?? "-";
  const games = data?.totalGames ?? "-";
  const userNum = data?.userNum ?? "-";
  $("#rankPreview").innerHTML = `
    <span>${message || "조회 완료"}</span>
    <span>User ${userNum}</span>
    <span>MMR ${mmr}</span>
    <span>랭킹 ${rank}</span>
    <span>랭크 게임 ${games}</span>
  `;
}

async function erFetch(path) {
  readSettings();
  if (!state.settings.apiKey) {
    throw new Error("API 키가 없어 수동 입력으로 등록해야 합니다.");
  }
  const response = await fetch(`${state.settings.apiBase}/${path}`, {
    headers: {
      "accept": "application/json",
      "x-api-key": state.settings.apiKey
    }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.code >= 400) {
    throw new Error(json.message || `API 요청 실패 (${response.status})`);
  }
  return json;
}

async function lookupRank() {
  const nickname = $("#nickname").value.trim();
  if (!nickname) return;
  updateRankPreview(null, "조회 중");
  try {
    const userJson = await erFetch(`user/nickname?query=${encodeURIComponent(nickname)}`);
    const user = userJson.user;
    if (!user?.userNum) throw new Error("닉네임에 해당하는 계정을 찾지 못했습니다.");

    const [rankJson, statsJson] = await Promise.all([
      erFetch(`rank/${user.userNum}/${state.settings.seasonId}/${state.settings.teamMode}`),
      erFetch(`v2/user/stats/${user.userNum}/${state.settings.seasonId}/3`).catch(() => null)
    ]);
    const stats = (statsJson?.userStats || []).find((item) => item.matchingTeamMode === state.settings.teamMode) || {};
    rankCache = {
      userNum: user.userNum,
      nickname: user.nickname || nickname,
      mmr: rankJson.userRank?.mmr ?? stats.mmr ?? null,
      rank: rankJson.userRank?.rank ?? stats.rank ?? null,
      serverRank: rankJson.userRank?.serverRank ?? null,
      serverCode: rankJson.userRank?.serverCode ?? null,
      totalGames: stats.totalGames ?? null,
      totalWins: stats.totalWins ?? stats.toatlWins ?? null,
      rankPercent: stats.rankPercent ?? null
    };
    $("#manualMmr").value = rankCache.mmr || "";
    $("#manualRank").value = rankCache.rank || "";
    updateRankPreview(rankCache);
  } catch (error) {
    rankCache = null;
    updateRankPreview(null, error.message);
  }
}

function submitApplicant(event) {
  event.preventDefault();
  const nickname = $("#nickname").value.trim();
  if (!nickname || selectedRoles.length !== 3) {
    alert("닉네임과 역할군 3개를 모두 입력해 주세요.");
    return;
  }
  const applicant = {
    id: crypto.randomUUID(),
    nickname,
    discordName: $("#discordName").value.trim(),
    roles: [...selectedRoles],
    userNum: rankCache?.userNum || null,
    mmr: Number($("#manualMmr").value || rankCache?.mmr || 0),
    rank: Number($("#manualRank").value || rankCache?.rank || 0),
    totalGames: rankCache?.totalGames || null,
    most: [$("#most1").value.trim(), $("#most2").value.trim(), $("#most3").value.trim()].filter(Boolean),
    isCaptain: false,
    memo: $("#memo").value.trim(),
    createdAt: new Date().toISOString()
  };
  const existingIndex = state.applicants.findIndex((item) => item.nickname === nickname);
  if (existingIndex >= 0) state.applicants[existingIndex] = applicant;
  else state.applicants.push(applicant);
  resetForm();
  saveState();
}

function resetForm() {
  $("#applicantForm").reset();
  bindSettings();
  selectedRoles = [];
  rankCache = null;
  updateRankPreview(null, "조회 전");
  renderRoles();
}

function makeTeams() {
  const desiredTeams = Number($("#desiredTeams").value || 8);
  const teamSize = Number($("#teamSize").value || 3);
  const maxPlayers = desiredTeams * teamSize;
  const sorted = [...state.applicants]
    .sort((a, b) => (b.mmr || 0) - (a.mmr || 0))
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
}

function normalizeScores() {
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
  const place = Number(entry.place || 0);
  const placeScore = PLACE_POINTS[place] ?? 0;
  return placeScore + Number(entry.day1Kills || 0) * 0.5 + Number(entry.lateKills || 0) - Number(entry.penaltyDeaths || 0);
}

function teamTotal(teamId) {
  return state.scores.reduce((sum, match) => sum + scoreFor(match[teamId]), 0);
}

function renderTeams() {
  const blind = $("#blindMode").checked;
  $("#teamCount").textContent = state.teams.length;
  $("#teamsBoard").innerHTML = state.teams.map((team) => {
    const totalMmr = team.members.reduce((sum, id) => sum + (getApplicant(id)?.mmr || 0), 0);
    const members = team.members.map((id, index) => {
      const player = getApplicant(id);
      if (!player) return "";
      const isCaptain = state.captains[team.id] === player.id;
      const name = blind ? `픽 ${index + 1}` : `${player.discordName || player.nickname} (${player.nickname})`;
      return `<li>${isCaptain ? "팀장 " : ""}${name}<span class="role-tag">${player.roles[0]}</span><br><small>MMR ${player.mmr || "-"} · ${player.roles.slice(1).join(" / ")} · ${player.most?.join(", ") || "모스트 -"}</small></li>`;
    }).join("");
    return `
      <article class="team-card">
        <header><span>${team.name}</span><span>${teamTotal(team.id)}점 · ${totalMmr}</span></header>
        <ol>${members}</ol>
      </article>
    `;
  }).join("") || "<p class=\"note\">참가자 등록 후 자동 편성을 누르면 팀 보드가 생성됩니다.</p>";
  renderCaptains();
}

function renderCaptains() {
  const board = $("#captainBoard");
  if (!state.teams.length) {
    board.innerHTML = "";
    return;
  }
  board.innerHTML = `
    <p class="field-title">팀장 지정</p>
    <div class="captain-grid">
      ${state.teams.map((team) => `
        <label class="captain-item">${team.name}
          <select data-captain="${team.id}">
            <option value="">팀장 미정</option>
            ${team.members.map((id) => {
              const player = getApplicant(id);
              return player ? `<option value="${id}" ${state.captains[team.id] === id ? "selected" : ""}>${player.discordName || player.nickname} / ${player.roles[0]} / ${player.mmr || "-"}</option>` : "";
            }).join("")}
          </select>
        </label>
      `).join("")}
    </div>
  `;
}

function renderScores() {
  normalizeScores();
  renderReplayCodes();
  renderBanSummary();
  const board = $("#scoreBoard");
  board.innerHTML = "";
  state.scores.forEach((match, matchIndex) => {
    const template = $("#matchTemplate").content.cloneNode(true);
    template.querySelector("h3").textContent = `${matchIndex + 1}경기`;
    const grid = template.querySelector(".match-grid");
    grid.innerHTML = "<b>팀</b><b>등수</b><b>1일차 킬</b><b>2일차 이후 킬</b><b>금구사</b><b>밴 실험체</b>";
    state.teams.forEach((team) => {
      const entry = match[team.id] || {};
      grid.insertAdjacentHTML("beforeend", `
        <span>${team.name} <small>${scoreFor(entry)}점</small></span>
        <select data-score="${matchIndex}:${team.id}:place">
          <option value="">-</option>
          ${Object.keys(PLACE_POINTS).map((place) => `<option value="${place}" ${String(entry.place) === place ? "selected" : ""}>${place}등</option>`).join("")}
        </select>
        <input data-score="${matchIndex}:${team.id}:day1Kills" type="number" min="0" step="1" value="${entry.day1Kills || 0}">
        <input data-score="${matchIndex}:${team.id}:lateKills" type="number" min="0" step="1" value="${entry.lateKills || 0}">
        <input data-score="${matchIndex}:${team.id}:penaltyDeaths" type="number" min="0" step="1" value="${entry.penaltyDeaths || 0}">
        <input data-score="${matchIndex}:${team.id}:bans" value="${escapeHtml(entry.bans || "")}" placeholder="니키">
      `);
    });
    board.appendChild(template);
  });
}

function renderBanSummary() {
  const counts = new Map();
  state.scores.forEach((match) => {
    Object.values(match).forEach((entry) => {
      String(entry.bans || "")
        .split(/[,\s/]+/)
        .map((name) => name.trim())
        .filter(Boolean)
        .forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
    });
  });
  const repeated = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
  $("#banSummary").innerHTML = repeated.length
    ? repeated.map(([name, count]) => `<span>${escapeHtml(name)} ${count}회 밴</span>`).join("")
    : "<span>2회 이상 밴 실험체 없음</span>";
}

function renderReplayCodes() {
  $("#replayBoard").innerHTML = `
    <p class="field-title">리플레이 코드</p>
    <div class="replay-grid">
      ${state.replayCodes.map((code, index) => `
        <label>${index + 1}경기
          <input data-replay="${index}" value="${escapeHtml(code)}" placeholder="리플코드 입력">
        </label>
      `).join("")}
    </div>
  `;
}

function renderApplicants() {
  $("#applicantCount").textContent = state.applicants.length;
  $("#savedAt").textContent = state.updatedAt ? new Date(state.updatedAt).toLocaleString("ko-KR") : "저장 대기";
  $("#applicantRows").innerHTML = state.applicants.map((player) => `
    <tr>
      <td>${escapeHtml(player.nickname)}</td>
      <td>${player.roles[0]}</td>
      <td>${player.roles[1]}</td>
      <td>${player.roles[2]}</td>
      <td>${escapeHtml(player.discordName || "-")}</td>
      <td>${escapeHtml(player.most?.join(" / ") || "-")}</td>
      <td>${player.mmr || "-"}</td>
      <td>${player.rank || "-"}</td>
      <td>${Object.values(state.captains).includes(player.id) ? "팀장" : "팀원"}</td>
      <td><button class="danger" data-remove="${player.id}" type="button">삭제</button></td>
    </tr>
  `).join("") || "<tr><td colspan=\"10\">아직 신청자가 없습니다.</td></tr>";
}

function render() {
  renderRoles();
  renderTeams();
  renderScores();
  renderApplicants();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  downloadBlob(blob, `er-scrim-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

function exportCsv() {
  const rows = [["team", "captain", "members", "total", "match", "replayCode", "place", "day1Kills", "lateKills", "penaltyDeaths", "score", "bans"]];
  state.teams.forEach((team) => {
    const members = team.members.map((id) => getApplicant(id)?.nickname).filter(Boolean).join(" / ");
    const captain = getApplicant(state.captains[team.id])?.nickname || "";
    state.scores.forEach((match, index) => {
      const entry = match[team.id] || {};
      rows.push([team.name, captain, members, teamTotal(team.id), index + 1, state.replayCodes[index] || "", entry.place || "", entry.day1Kills || 0, entry.lateKills || 0, entry.penaltyDeaths || 0, scoreFor(entry), entry.bans || ""]);
    });
  });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
  downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), "er-scrim-score.csv");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function bindEvents() {
  $("#saveSettings").addEventListener("click", () => {
    readSettings();
    saveState();
  });
  $("#lookupRank").addEventListener("click", lookupRank);
  $("#nickname").addEventListener("change", lookupRank);
  $("#applicantForm").addEventListener("submit", submitApplicant);
  $("#resetForm").addEventListener("click", resetForm);
  $("#makeTeams").addEventListener("click", makeTeams);
  $("#clearTeams").addEventListener("click", () => {
    state.teams = [];
    state.captains = {};
    saveState();
  });
  $("#blindMode").addEventListener("change", renderTeams);
  $("#clearApplicants").addEventListener("click", () => {
    if (confirm("참가자 명단을 모두 비울까요?")) {
      state.applicants = [];
      state.teams = [];
      saveState();
    }
  });
  $("#applicantRows").addEventListener("click", (event) => {
    const id = event.target.dataset.remove;
    if (!id) return;
    state.applicants = state.applicants.filter((player) => player.id !== id);
    state.teams.forEach((team) => {
      team.members = team.members.filter((memberId) => memberId !== id);
    });
    saveState();
  });
  $("#scoreBoard").addEventListener("change", updateScore);
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

function updateCaptain(event) {
  const teamId = event.target.dataset.captain;
  if (!teamId) return;
  if (event.target.value) state.captains[teamId] = event.target.value;
  else delete state.captains[teamId];
  saveState();
}

async function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const imported = JSON.parse(await file.text());
  Object.assign(state, defaultState(), imported);
  bindSettings();
  saveState();
  event.target.value = "";
}

bindSettings();
bindEvents();
render();
