const MLB_BASE_URL = "https://statsapi.mlb.com/api/v1";
const season = () => new Date().getUTCFullYear();
const dateOnly = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86_400_000);
const splitsToObject = (entries = []) => Object.fromEntries(entries.map((entry) => [`${entry.group?.displayName}:${entry.type?.displayName}`, entry.splits ?? []]));

export function createMlbClient(fetchImpl = globalThis.fetch) {
  async function request(path) {
    const response = await fetchImpl(`${MLB_BASE_URL}${path}`, { headers: { Accept: "application/json", "User-Agent": "AtlasHarbor/0.4" }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`MLB Stats API responded with ${response.status}`);
    return response.json();
  }
  async function optionalRequest(path) { try { return await request(path); } catch (error) { console.warn(`Optional MLB request failed: ${path}`, error.message); return null; } }
  async function getStats(path) { const data = await request(path); return data.stats?.flatMap((entry) => entry.splits ?? []) ?? []; }

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
      const games = (schedule.dates ?? []).flatMap((day) => day.games ?? []).filter((game) => `${game.teams?.away?.team?.name} ${game.teams?.home?.team?.name} ${game.venue?.name}`.toLowerCase().includes(needle)).map(normalizeGame).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
      return [...matchingTeams, ...games, ...players];
    },

    async getUpcomingGames(days = 14) {
      const data = await request(`/schedule?sportId=1&startDate=${dateOnly(new Date())}&endDate=${dateOnly(addDays(new Date(), days))}&hydrate=team,probablePitcher,venue,weather`);
      return (data.dates ?? []).flatMap((day) => day.games ?? []).map(normalizeGame).sort((a, b) => a.date.localeCompare(b.date));
    },

    async getGame(id) {
      const schedule = await request(`/schedule?sportId=1&gamePk=${id}&hydrate=team,probablePitcher,venue,weather,linescore`);
      const game = schedule.dates?.[0]?.games?.[0];
      if (!game) return null;
      const normalized = normalizeGame(game);
      const [boxscore, feed] = await Promise.all([optionalRequest(`/game/${id}/boxscore`), optionalRequest(`/game/${id}/feed/live`)]);
      const teams = {};
      for (const side of ["away", "home"]) {
        const teamBox = boxscore?.teams?.[side] ?? {};
        const players = teamBox.players ?? {};
        teams[side] = {
          team: normalized[side],
          battingOrder: (teamBox.battingOrder ?? []).map((pid) => normalizeBoxPlayer(players[`ID${pid}`])).filter(Boolean),
          bench: (teamBox.bench ?? []).map((pid) => normalizeBoxPlayer(players[`ID${pid}`])).filter(Boolean),
          bullpen: (teamBox.bullpen ?? []).map((pid) => normalizeBoxPlayer(players[`ID${pid}`])).filter(Boolean),
          pitchers: (teamBox.pitchers ?? []).map((pid) => normalizeBoxPlayer(players[`ID${pid}`])).filter(Boolean),
          totals: teamBox.teamStats ?? {},
        };
      }
      const probable = feed?.gameData?.probablePitchers ?? {};
      return {
        ...normalized,
        teams,
        probablePitchers: { away: probable.away?.fullName ?? normalized.awayPitcher, home: probable.home?.fullName ?? normalized.homePitcher },
        probablePitcherIds: { away: probable.away?.id ?? normalized.awayPitcherId, home: probable.home?.id ?? normalized.homePitcherId },
        venueDetails: feed?.gameData?.venue ?? {}, officials: boxscore?.officials ?? [],
        linescore: feed?.liveData?.linescore ?? game.linescore ?? null, decisions: feed?.liveData?.decisions ?? null,
        broadcasts: feed?.gameData?.broadcasts ?? [], gameInfo: feed?.gameData?.gameInfo ?? {}, flags: feed?.gameData?.flags ?? {}, review: feed?.gameData?.review ?? {},
        availability: { schedule: true, boxscore: Boolean(boxscore), liveFeed: Boolean(feed) },
      };
    },

    async getTeam(id) {
      const [teamData, hitting, pitching, fielding, active, injured, nextGames, pinch] = await Promise.all([
        request(`/teams/${id}?hydrate=league,division,venue`), getStats(`/teams/${id}/stats?stats=season&group=hitting&season=${season()}`),
        getStats(`/teams/${id}/stats?stats=season&group=pitching&season=${season()}`), getStats(`/teams/${id}/stats?stats=season&group=fielding&season=${season()}`),
        request(`/teams/${id}/roster?rosterType=active&hydrate=person(stats(group=[hitting,pitching],type=[season]))`), request(`/teams/${id}/roster?rosterType=injuredList&hydrate=person`),
        request(`/schedule?sportId=1&teamId=${id}&startDate=${dateOnly(new Date())}&endDate=${dateOnly(addDays(new Date(), 7))}&hydrate=team,probablePitcher,venue,weather`),
        getStats(`/teams/${id}/stats?stats=statSplits&group=hitting&season=${season()}&sitCodes=ph`),
      ]);
      const team = teamData.teams?.[0]; if (!team) return null;
      const roster = (active.roster ?? []).map(normalizeRosterPlayer); const nextGame = nextGames.dates?.flatMap((d) => d.games ?? [])[0]; let lineup = [], bench = [];
      if (nextGame) { try { const box = await request(`/game/${nextGame.gamePk}/boxscore`); const side = Number(nextGame.teams?.home?.team?.id) === Number(id) ? "home" : "away"; const teamBox = box.teams?.[side] ?? {}; lineup = (teamBox.battingOrder ?? []).map((pid) => normalizeBoxPlayer(teamBox.players?.[`ID${pid}`])).filter(Boolean); bench = (teamBox.bench ?? []).map((pid) => normalizeBoxPlayer(teamBox.players?.[`ID${pid}`])).filter(Boolean); } catch {} }
      const pinchById = new Map(pinch.map((split) => [split.player?.id, split.stat ?? {}]));
      return { id: team.id, name: team.name, abbreviation: team.abbreviation, league: team.league?.name, division: team.division?.name, venue: team.venue?.name, firstYear: team.firstYearOfPlay,
        stats: { hitting: hitting[0]?.stat ?? {}, pitching: pitching[0]?.stat ?? {}, fielding: fielding[0]?.stat ?? {} }, roster,
        lineup: { status: lineup.length ? "confirmed" : "projected-unavailable", players: lineup },
        bench: (bench.length ? bench : roster.filter((p) => !lineup.some((l) => l.id === p.id) && !/Pitcher/i.test(p.position))).map((player) => ({ ...player, pinchHitting: pinchById.get(player.id) ?? {} })),
        injuredList: (injured.roster ?? []).map((entry) => ({ ...normalizeRosterPlayer(entry), status: entry.status?.description ?? entry.status?.code ?? "Injured list" })), nextGame: nextGame ? normalizeGame(nextGame) : null };
    },

    async getPlayer(id) {
      const hydrate = "currentTeam,team,stats(group=[hitting,pitching,fielding],type=[season,career,yearByYear,seasonAdvanced,careerAdvanced])";
      const [data, gameLog, splits, transactions] = await Promise.all([
        request(`/people/${id}?hydrate=${encodeURIComponent(hydrate)}`), request(`/people/${id}/stats?stats=gameLog&group=hitting,pitching,fielding&season=${season()}&hydrate=team,opponent`),
        request(`/people/${id}/stats?stats=statSplits&group=hitting,pitching&season=${season()}&sitCodes=vl,vr,home,away`), request(`/transactions?playerId=${id}&startDate=${season()}-01-01&endDate=${dateOnly(new Date())}`),
      ]);
      const player = data.people?.[0]; if (!player) return null; const logs = gameLog.stats?.flatMap((entry) => entry.splits ?? []) ?? [];
      return { id: player.id, name: player.fullName, team: player.currentTeam?.name ?? "Free agent / team unavailable", position: player.primaryPosition?.name ?? "Player",
        number: player.primaryNumber ?? null, bats: player.batSide?.description ?? null, throws: player.pitchHand?.description ?? null, age: player.currentAge ?? null, birthDate: player.birthDate ?? null,
        birthCity: player.birthCity ?? null, birthCountry: player.birthCountry ?? null, height: player.height ?? null, weight: player.weight ?? null, debut: player.mlbDebutDate ?? null, active: player.active ?? null,
        stats: splitsToObject(player.stats), situationalSplits: splitsToObject(splits.stats),
        recentGames: logs.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8).map((split) => ({ date: split.date, opponent: split.opponent?.name ?? split.team?.name ?? "Opponent", isHome: split.isHome, stat: split.stat ?? {} })),
        transactions: (transactions.transactions ?? []).slice(-12).reverse().map((tx) => ({ date: tx.date, type: tx.typeDesc, description: tx.description, effectiveDate: tx.effectiveDate })) };
    },
  };
}

function normalizeRosterPlayer(entry) { const p = entry.person ?? {}; return { id: p.id, name: p.fullName, position: entry.position?.name ?? p.primaryPosition?.name, number: entry.jerseyNumber ?? p.primaryNumber, status: entry.status?.description ?? null, stats: splitsToObject(p.stats ?? []) }; }
function normalizeBoxPlayer(player) { if (!player?.person) return null; return { id: player.person.id, name: player.person.fullName, position: player.position?.name, battingOrder: player.battingOrder ?? null, stats: player.stats ?? {}, seasonStats: player.seasonStats ?? {}, gameStatus: player.gameStatus ?? {} }; }
function normalizeGame(game) { const awayProbable=game.teams?.away?.probablePitcher,homeProbable=game.teams?.home?.probablePitcher; return { type:"game",id:game.gamePk,name:`${game.teams?.away?.team?.name??"Away"} at ${game.teams?.home?.team?.name??"Home"}`,subtitle:`${game.officialDate??game.gameDate?.slice(0,10)} · ${game.venue?.name??"Venue TBD"}`,date:game.gameDate??game.officialDate,officialDate:game.officialDate,venue:game.venue?.name??null,away:game.teams?.away?.team??null,home:game.teams?.home?.team??null,awayPitcher:awayProbable?.fullName??"TBD",homePitcher:homeProbable?.fullName??"TBD",awayPitcherId:awayProbable?.id??null,homePitcherId:homeProbable?.id??null,weather:game.weather?{condition:game.weather.condition??null,temperature:game.weather.temp??null,wind:game.weather.wind??null}:null,status:game.status?.detailedState??null,gameType:game.gameType??null,seriesDescription:game.seriesDescription??null,seriesGameNumber:game.seriesGameNumber??null,doubleHeader:game.doubleHeader??null,dayNight:game.dayNight??null,scheduledInnings:game.scheduledInnings??null,gamesInSeries:game.gamesInSeries??null,recordSource:"MLB Stats API"}; }
