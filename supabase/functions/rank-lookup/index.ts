const API_BASE = "https://open-api.bser.io";

function corsHeaders(origin: string | null) {
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
  return {
    "access-control-allow-origin": allowedOrigin === "*" ? "*" : (origin === allowedOrigin ? origin : allowedOrigin),
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "content-type": "application/json; charset=utf-8"
  };
}

async function erFetch(path: string, apiKey: string) {
  const response = await fetch(`${API_BASE}/${path.replace(/^\/+/, "")}`, {
    headers: { accept: "application/json", "x-api-key": apiKey }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || Number(json.code) >= 400) {
    throw new Error(json.message || `이터널 리턴 API 오류 (${response.status})`);
  }
  return json;
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "POST 요청만 지원합니다." }), { status: 405, headers });

  try {
    const apiKey = Deno.env.get("ER_API_KEY");
    if (!apiKey) throw new Error("ER_API_KEY 비밀값이 설정되지 않았습니다.");
    const { nickname, seasonId, teamMode } = await request.json();
    if (!nickname || !seasonId || !teamMode) throw new Error("닉네임, 시즌, 팀 모드가 필요합니다.");

    const userJson = await erFetch(`v1/user/nickname?query=${encodeURIComponent(String(nickname).trim())}`, apiKey);
    const user = userJson.user;
    if (!user?.userId) throw new Error("닉네임에 해당하는 계정을 찾지 못했습니다.");

    const userId = encodeURIComponent(user.userId);
    const [rankJson, statsJson] = await Promise.all([
      erFetch(`v1/rank/uid/${userId}/${Number(seasonId)}/${Number(teamMode)}`, apiKey),
      erFetch(`v2/user/stats/uid/${userId}/${Number(seasonId)}/3`, apiKey)
    ]);
    const stats = (statsJson.userStats || []).find((item: Record<string, unknown>) => Number(item.matchingTeamMode) === Number(teamMode))
      || statsJson.userStats?.[0]
      || {};

    return new Response(JSON.stringify({
      user: { userId: user.userId, nickname: String(nickname).trim() },
      rank: rankJson.userRank || {},
      stats
    }), { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "랭크 조회에 실패했습니다.";
    return new Response(JSON.stringify({ error: message }), { status: 400, headers });
  }
});
