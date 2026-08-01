const MLB_BASE_URL = "https://statsapi.mlb.com/api/v1";

export function createMlbClient(fetchImpl = globalThis.fetch) {
  async function request(path) {
    const response = await fetchImpl(`${MLB_BASE_URL}${path}`, {
      headers: { Accept: "application/json", "User-Agent": "AtlasHarbor/0.1" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) throw new Error(`MLB Stats API responded with ${response.status}`);
    return response.json();
  }

  return {
    async searchPlayers(query) {
      const data = await request(`/people/search?names=${encodeURIComponent(query)}`);
      return (data.people ?? []).slice(0, 10).map((player) => ({
        id: player.id,
        name: player.fullName,
        team: player.currentTeam?.name ?? "Free agent / team unavailable",
        position: player.primaryPosition?.name ?? "Player",
      }));
    },

    async getPlayer(id) {
      const hydrate = "currentTeam,team,stats(group=[hitting,pitching,fielding],type=[season,career])";
      const data = await request(`/people/${id}?hydrate=${encodeURIComponent(hydrate)}`);
      const player = data.people?.[0];
      if (!player) return null;

      const stats = Object.fromEntries(
        (player.stats ?? []).map((entry) => [
          `${entry.group?.displayName}:${entry.type?.displayName}`,
          entry.splits?.[0]?.stat ?? {},
        ]),
      );

      return {
        id: player.id,
        name: player.fullName,
        team: player.currentTeam?.name ?? "Free agent / team unavailable",
        position: player.primaryPosition?.name ?? "Player",
        number: player.primaryNumber ?? null,
        bats: player.batSide?.description ?? null,
        throws: player.pitchHand?.description ?? null,
        age: player.currentAge ?? null,
        debut: player.mlbDebutDate ?? null,
        stats,
      };
    },
  };
}
