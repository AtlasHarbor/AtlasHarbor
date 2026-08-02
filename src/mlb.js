const MLB_BASE_URL = "https://statsapi.mlb.com/api/v1";

const season = () => new Date().getUTCFullYear();
const dateOnly = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86_400_000);

export function createMlbClient(fetchImpl = globalThis.fetch) {
  async function request(path) {
    const response = await fetchImpl(`${MLB_BASE_URL}${path}`, {
      headers: { Accept: "application/json", "User-Agent": "AtlasHarbor/0.2" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`MLB Stats API responded with ${response.status}`);
    return response.json();
  }

  async function getStats(path) {
    const data = await request(path);
    return data.stats?.flatMap((entry) => entry.splits ?? []) ?? [];
  }

  return {
    async search(query) {
      const [people, teams, schedule] = await Promise.all([
        request(`/people/search?names=${encodeURIComponent(query)}`),
        request(`/teams?sportId=1&season=${season()}`),
        request(`/schedule?sportId=1&startDate=${dateOnly(new Date())}&endDate=${dateOnly(addDays(new Date(), 14))}&hydrate=team,probablePitcher,venue,weather`),
      ]);
      const needle = query.toLowerCase();
      const players = (people.people ?? []).slice(0, 8).map((player) => ({ type: "player", id: player.id, name: player.fullName, subtitle: `${player.currentTeam?.name ?? "Team unavailable"} · ${player.primaryPosition?.name ?? "Player"}` }));
      const matchingTeams = (teams.teams ?? []).filter((team) => [team.name, team.teamName, team.clubName, team.abbreviation].some((value) => value?.toLowerCase().includes(needle))).slice(0, 8).map((team) => ({ type: "team", id: team.id, name: team.name, subtitle: `${team.league?.name ?? "MLB"} · ${team.division?.name ?? ""}`.replace(/ · $/, "") }));
      const games = (schedule.dates ?? []).flatMap((day) => day.games ?? []).filter((game) => {
        const haystack = `${game.teams?.away?.team?.name} ${game.teams?.home?.team?.name} ${game.venue?.name}`.toLowerCase();
        return haystack.includes(needle);
      }).map((game) => normalizeGame(game)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
      return [...matchingTeams, ...games, ...players];
    },

    async getUpcomingGames(days = 14) {
      const data = await request(`/schedule?sportId=1&startDate=${dateOnly(new Date())}&endDate=${dateOnly(addDays(new Date(), days))}&hydrate=team,probablePitcher,venue,weather`);
      return (data.dates ?? []).flatMap((day) => day.games ?? []).map(normalizeGame).sort((a, b) => a.date.localeCompare(b.date));
    },

    async getTeam(id) {
      const [teamData, hitting, pitching, fielding, roster] = await Promise.all([
        request(`/teams/${id}?hydrate=league,division,venue`),
        getStats(`/teams/${id}/stats?stats=season&group=hitting&season=${season()}`),
        getStats(`/teams/${id}/stats?stats=season&group=pitching&season=${season()}`),
        getStats(`/teams/${id}/stats?stats=season&group=fielding&season=${season()}`),
        request(`/teams/${id}/roster?rosterType=active`),
      ]);
      const team = teamData.teams?.[0];
      if (!team) return null;
      return {
        id: team.id, name: team.name, abbreviation: team.abbreviation, league: team.league?.name, division: team.division?.name,
        venue: team.venue?.name, firstYear: team.firstYearOfPlay,
        stats: { hitting: hitting[0]?.stat ?? {}, pitching: pitching[0]?.stat ?? {}, fielding: fielding[0]?.stat ?? {} },
        roster: (roster.roster ?? []).map((entry) => ({ id: entry.person.id, name: entry.person.fullName, position: entry.position?.name, number: entry.jerseyNumber })),
      };
    },

    async getPlayer(id) {
      const hydrate = "currentTeam,team,stats(group=[hitting,pitching,fielding],type=[season,career])";
      const [data, gameLog] = await Promise.all([
        request(`/people/${id}?hydrate=${encodeURIComponent(hydrate)}`),
        getStats(`/people/${id}/stats?stats=gameLog&group=hitting,pitching&season=${season()}&hydrate=team,opponent`),
      ]);
      const player = data.people?.[0];
      if (!player) return null;
      const stats = Object.fromEntries((player.stats ?? []).map((entry) => [`${entry.group?.displayName}:${entry.type?.displayName}`, entry.splits?.[0]?.stat ?? {}]));
      return {
        id: player.id, name: player.fullName, team: player.currentTeam?.name ?? "Free agent / team unavailable", position: player.primaryPosition?.name ?? "Player",
        number: player.primaryNumber ?? null, bats: player.batSide?.description ?? null, throws: player.pitchHand?.description ?? null, age: player.currentAge ?? null, debut: player.mlbDebutDate ?? null,
        stats,
        recentGames: gameLog.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8).map((split) => ({ date: split.date, opponent: split.opponent?.name ?? split.team?.name ?? "Opponent", isHome: split.isHome, stat: split.stat ?? {} })),
      };
    },
  };
}

function normalizeGame(game) {
  return {
    type: "game", id: game.gamePk, name: `${game.teams?.away?.team?.name ?? "Away"} at ${game.teams?.home?.team?.name ?? "Home"}`,
    subtitle: `${game.officialDate ?? game.gameDate?.slice(0, 10)} · ${game.venue?.name ?? "Venue TBD"}`,
    date: game.gameDate ?? game.officialDate, venue: game.venue?.name ?? null,
    away: game.teams?.away?.team ?? null, home: game.teams?.home?.team ?? null,
    awayPitcher: game.teams?.away?.probablePitcher?.fullName ?? "TBD", homePitcher: game.teams?.home?.probablePitcher?.fullName ?? "TBD",
    weather: game.weather ? { condition: game.weather.condition ?? null, temperature: game.weather.temp ?? null, wind: game.weather.wind ?? null } : null,
    status: game.status?.detailedState ?? null,
  };
}
