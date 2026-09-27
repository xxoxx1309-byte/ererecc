const API_BASE = "https://open-api.bser.io";
const cache = new Map();
let queue = Promise.resolve();
let nextRequestAt = 0;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSlot() {
  const turn = queue.then(async () => {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay) await wait(delay);
    nextRequestAt = Date.now() + 350;
  });
  queue = turn.catch(() => undefined);
  await turn;
}

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

async function erFetch(path, optional = false) {
  const normalized = path.replace(/^\/+/, "");
  const cached = cache.get(normalized);
  if (cached?.expiresAt > Date.now()) return cached.data;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await waitForSlot();
    const response = await fetch(`${API_BASE}/${normalized}`, {
      headers: { accept: "application/json", "x-api-key": process.env.ER_API_KEY }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 429 && attempt < 4) {
      await wait(Math.max(Number(response.headers.get("retry-after") || 0) * 1000, 1000 * (attempt + 1)));
      continue;
    }
    if (optional && (response.status === 404 || Number(data.code) === 404)) return {};
    if (!response.ok || Number(data.code) >= 400) {
      throw new Error(data.message || `이터널 리턴 API 오류 (${response.status})`);
    }
    const ttl = normalized.startsWith("v2/data/Season") ? 5 * 60_000
      : normalized.startsWith("v1/user/nickname") ? 10 * 60_000
        : 30_000;
    if (cache.size > 500) cache.clear();
    cache.set(normalized, { data, expiresAt: Date.now() + ttl });
    return data;
  }
  throw new Error("공식 API 요청이 많습니다. 잠시 후 다시 시도해 주세요.");
}

async function currentSeason() {
  const seasonJson = await erFetch("v2/data/Season");
  const season = (seasonJson.data || [])
    .filter((item) => Number(item.isCurrent) === 1)
    .sort((a, b) => Number(b.seasonID) - Number(a.seasonID))[0];
  if (!season) throw new Error("공식 현재 시즌을 확인하지 못했습니다.");
  return { season, allSeasons: seasonJson.data || [] };
}

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ error: "POST 요청만 지원합니다." });

  try {
    if (!process.env.ER_API_KEY) throw new Error("서버 API 키가 설정되지 않았습니다.");
    const body = request.body || {};
    const { season, allSeasons } = await currentSeason();
    if (body.action === "currentSeason") return response.status(200).json({ season });

    const nickname = String(body.nickname || "").trim();
    const teamMode = Number(body.teamMode || 3);
    if (!nickname) throw new Error("닉네임을 입력해 주세요.");

    const userJson = await erFetch(`v1/user/nickname?query=${encodeURIComponent(nickname)}`);
    const user = userJson.user;
    if (!user?.userId) throw new Error("닉네임에 해당하는 계정을 찾지 못했습니다.");

    const seasonId = Number(season.seasonID);
    const userId = encodeURIComponent(user.userId);
    const [rankJson, statsJson] = await Promise.all([
      erFetch(`v1/rank/uid/${userId}/${seasonId}/${teamMode}`, true),
      erFetch(`v2/user/stats/uid/${userId}/${seasonId}/3`, true)
    ]);
    const stats = (statsJson.userStats || []).find((item) => Number(item.matchingTeamMode) === teamMode)
      || statsJson.userStats?.[0]
      || {};

    let peak = rankJson.userRank || {};
    let peakSeasonId = seasonId;
    const recentSeasons = allSeasons
      .filter((item) => !/pre/i.test(String(item.seasonName || "")) && Number(item.seasonID) <= seasonId)
      .sort((a, b) => Number(b.seasonID) - Number(a.seasonID))
      .slice(0, 3);
    for (const item of recentSeasons) {
      const historical = await erFetch(`v1/rank/uid/${userId}/${Number(item.seasonID)}/${teamMode}`, true);
      if (Number(historical.userRank?.mmr || 0) > Number(peak.mmr || 0)) {
        peak = historical.userRank;
        peakSeasonId = Number(item.seasonID);
      }
    }

    return response.status(200).json({
      seasonId,
      user: { userId: user.userId, nickname: String(user.nickname || nickname).trim() },
      rank: rankJson.userRank || {},
      peak: { ...peak, seasonId: peakSeasonId },
      stats
    });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "랭크 조회에 실패했습니다." });
  }
};
