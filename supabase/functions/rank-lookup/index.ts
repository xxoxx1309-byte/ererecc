const API_BASE = "https://open-api.bser.io";
const API_INTERVAL_MS = 350;
const responseCache = new Map<string, { expiresAt: number; data: Record<string, unknown> }>();
let apiQueue = Promise.resolve();
let nextApiRequestAt = 0;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApiSlot() {
  const turn = apiQueue.then(async () => {
    const waitMs = Math.max(0, nextApiRequestAt - Date.now());
    if (waitMs) await delay(waitMs);
    nextApiRequestAt = Date.now() + API_INTERVAL_MS;
  });
  apiQueue = turn.catch(() => undefined);
  await turn;
}

function corsHeaders(origin: string | null) {
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
  return {
    "access-control-allow-origin": allowedOrigin === "*" ? "*" : (origin === allowedOrigin ? origin : allowedOrigin),
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "content-type": "application/json; charset=utf-8"
  };
}

async function erFetch(path: string, apiKey: string, optional = false) {
  const normalizedPath = path.replace(/^\/+/, "");
  const cached = responseCache.get(normalizedPath);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await waitForApiSlot();
    const response = await fetch(`${API_BASE}/${normalizedPath}`, {
      headers: { accept: "application/json", "x-api-key": apiKey }
    });
    const json = await response.json().catch(() => ({}));
    if (response.status === 429 && attempt < 5) {
      const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
      await delay(Math.max(retryAfter, 1200 * (attempt + 1)));
      continue;
    }
    if (optional && (response.status === 404 || Number(json.code) === 404)) return {};
    if (!response.ok || Number(json.code) >= 400) {
      if (response.status === 429) throw new Error("공식 API 요청이 많습니다. 잠시 후 다시 조회해 주세요.");
      throw new Error(json.message || `이터널 리턴 API 오류 (${response.status})`);
    }
    const ttl = normalizedPath.startsWith("v1/user/nickname") ? 10 * 60_000 : 30_000;
    if (responseCache.size > 500) responseCache.clear();
    responseCache.set(normalizedPath, { expiresAt: Date.now() + ttl, data: json });
    return json;
  }
  throw new Error("공식 API 요청이 많습니다. 잠시 후 다시 조회해 주세요.");
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "POST 요청만 지원합니다." }), { status: 405, headers });

  try {
    const apiKey = Deno.env.get("ER_API_KEY");
    if (!apiKey) throw new Error("ER_API_KEY 비밀값이 설정되지 않았습니다.");
    const { nickname, seasonId, teamMode, includePeak = true } = await request.json();
    if (!nickname || !seasonId || !teamMode) throw new Error("닉네임, 시즌, 팀 모드가 필요합니다.");

    const userJson = await erFetch(`v1/user/nickname?query=${encodeURIComponent(String(nickname).trim())}`, apiKey);
    const user = userJson.user;
    if (!user?.userId) throw new Error("닉네임에 해당하는 계정을 찾지 못했습니다.");

    const userId = encodeURIComponent(user.userId);
    const [rankJson, statsJson] = await Promise.all([
      erFetch(`v1/rank/uid/${userId}/${Number(seasonId)}/${Number(teamMode)}`, apiKey, true),
      erFetch(`v2/user/stats/uid/${userId}/${Number(seasonId)}/3`, apiKey, true)
    ]);
    const stats = (statsJson.userStats || []).find((item: Record<string, unknown>) => Number(item.matchingTeamMode) === Number(teamMode))
      || statsJson.userStats?.[0]
      || {};
    let peak = rankJson.userRank || {};
    let peakSeasonId = Number(seasonId);
    if (includePeak) {
      const seasonJson = await erFetch("v2/data/Season", apiKey);
      const rankedSeasons = (seasonJson.data || [])
        .filter((season: Record<string, unknown>) => !/pre/i.test(String(season.seasonName || "")) && Number(season.seasonID) <= Number(seasonId))
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.seasonID) - Number(a.seasonID))
        .slice(0, 3);
      for (const season of rankedSeasons) {
        const historical = await erFetch(`v1/rank/uid/${userId}/${Number(season.seasonID)}/${Number(teamMode)}`, apiKey, true);
        if (Number(historical.userRank?.mmr || 0) > Number(peak.mmr || 0)) {
          peak = historical.userRank;
          peakSeasonId = Number(season.seasonID);
        }
      }
    }

    return new Response(JSON.stringify({
      user: { userId: user.userId, nickname: String(user.nickname || nickname).trim() },
      rank: rankJson.userRank || {},
      peak: { ...peak, seasonId: peakSeasonId },
      stats
    }), { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "랭크 조회에 실패했습니다.";
    return new Response(JSON.stringify({ error: message }), { status: 400, headers });
  }
});
