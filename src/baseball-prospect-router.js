import express from 'express';
import {renderBaseballPlayerPage, playerSlug} from './baseball-player-page.js';

const BASE = 'https://statsapi.mlb.com/api/v1';

export const PROFESSIONAL_SPORTS = [
  {id: 1, level: 'Major League Baseball', short: 'MLB'},
  {id: 11, level: 'Triple-A', short: 'AAA'},
  {id: 12, level: 'Double-A', short: 'AA'},
  {id: 13, level: 'High-A', short: 'High-A'},
  {id: 14, level: 'Low-A', short: 'Low-A'}
];

const SPORT_IDS = PROFESSIONAL_SPORTS.map((item) => item.id);
const season = () => new Date().getUTCFullYear();
const dateOnly = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
const teamCache = new Map();
const prospectCache = new Map();
const ORG_SLUGS = {
  108: 'angels',
  109: 'd-backs',
  110: 'orioles',
  111: 'red-sox',
  112: 'cubs',
  113: 'reds',
  114: 'guardians',
  115: 'rockies',
  116: 'tigers',
  117: 'astros',
  118: 'royals',
  119: 'dodgers',
  120: 'nationals',
  121: 'mets',
  133: 'athletics',
  134: 'pirates',
  135: 'padres',
  136: 'mariners',
  137: 'giants',
  138: 'cardinals',
  139: 'rays',
  140: 'rangers',
  141: 'blue-jays',
  142: 'twins',
  143: 'phillies',
  144: 'braves',
  145: 'white-sox',
  146: 'marlins',
  147: 'yankees',
  158: 'brewers'
};

async function requestJson(fetchImpl, path, timeout = 20000) {
  const response = await fetchImpl(`${BASE}${path}`, {
    headers: {Accept: 'application/json', 'User-Agent': 'AtlasHarbor/1.0'},
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`MLB Stats API ${response.status}`);
  return response.json();
}

async function optional(fetchImpl, path, timeout) {
  try {
    return await requestJson(fetchImpl, path, timeout);
  } catch {
    return null;
  }
}

const sportFor = (id) =>
  PROFESSIONAL_SPORTS.find((item) => item.id === Number(id)) || {
    id: Number(id),
    level: 'Professional baseball',
    short: 'Pro'
  };

const hasStat = (stat) =>
  stat &&
  typeof stat === 'object' &&
  Object.keys(stat).some(
    (key) =>
      stat[key] !== null &&
      stat[key] !== undefined &&
      stat[key] !== '' &&
      key !== 'note'
  );

const bracket = (items) => (items.length > 1 ? `[${items.join(',')}]` : items[0]);

export function buildPlayerStatsPath(
  id,
  {types, groups, sportId, year = season(), hydrate = 'team,league'} = {}
) {
  const params = new URLSearchParams();
  params.set('stats', bracket(types));
  params.set('group', bracket(groups));
  if (types.some((type) => /season|gameLog/i.test(type))) {
    params.set('season', String(year));
  }
  params.set('sportId', String(sportId));
  if (hydrate) params.set('hydrate', hydrate);
  return `/people/${id}/stats?${params.toString()}`;
}

function inningsToOuts(value) {
  const [whole = '0', partial = '0'] = String(value ?? 0).split('.');
  return (
    Math.max(0, Number(whole) || 0) * 3 +
    Math.max(0, Math.min(2, Number(partial) || 0))
  );
}

function outsToInnings(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

const sum = (rows, key) =>
  rows.reduce((total, row) => total + (Number(row?.[key]) || 0), 0);

const rate = (numerator, denominator, digits = 3) =>
  denominator
    ? Number(numerator / denominator).toFixed(digits).replace(/^0/, '')
    : null;

export function aggregateHittingStats(rows = []) {
  const valid = rows.filter(hasStat);
  if (!valid.length) return {};

  const stat = {
    gamesPlayed: sum(valid, 'gamesPlayed'),
    plateAppearances: sum(valid, 'plateAppearances'),
    atBats: sum(valid, 'atBats'),
    runs: sum(valid, 'runs'),
    hits: sum(valid, 'hits'),
    doubles: sum(valid, 'doubles'),
    triples: sum(valid, 'triples'),
    homeRuns: sum(valid, 'homeRuns'),
    rbi: sum(valid, 'rbi'),
    stolenBases: sum(valid, 'stolenBases'),
    caughtStealing: sum(valid, 'caughtStealing'),
    baseOnBalls: sum(valid, 'baseOnBalls'),
    strikeOuts: sum(valid, 'strikeOuts'),
    hitByPitch: sum(valid, 'hitByPitch'),
    sacFlies: sum(valid, 'sacFlies'),
    totalBases: sum(valid, 'totalBases')
  };

  if (!stat.totalBases) {
    const singles = Math.max(
      0,
      stat.hits - stat.doubles - stat.triples - stat.homeRuns
    );
    stat.totalBases =
      singles + stat.doubles * 2 + stat.triples * 3 + stat.homeRuns * 4;
  }

  stat.avg = rate(stat.hits, stat.atBats);
  stat.obp = rate(
    stat.hits + stat.baseOnBalls + stat.hitByPitch,
    stat.atBats + stat.baseOnBalls + stat.hitByPitch + stat.sacFlies
  );
  stat.slg = rate(stat.totalBases, stat.atBats);
  stat.ops =
    stat.obp && stat.slg
      ? Number(Number(stat.obp) + Number(stat.slg)).toFixed(3).replace(/^0/, '')
      : null;

  return stat;
}

export function aggregatePitchingStats(rows = []) {
  const valid = rows.filter(hasStat);
  if (!valid.length) return {};

  const outs = valid.reduce(
    (total, row) => total + inningsToOuts(row.inningsPitched),
    0
  );
  const innings = outs / 3;
  const stat = {
    gamesPlayed: sum(valid, 'gamesPlayed'),
    gamesStarted: sum(valid, 'gamesStarted'),
    wins: sum(valid, 'wins'),
    losses: sum(valid, 'losses'),
    saves: sum(valid, 'saves'),
    hits: sum(valid, 'hits'),
    runs: sum(valid, 'runs'),
    earnedRuns: sum(valid, 'earnedRuns'),
    homeRuns: sum(valid, 'homeRuns'),
    baseOnBalls: sum(valid, 'baseOnBalls'),
    strikeOuts: sum(valid, 'strikeOuts'),
    hitBatsmen: sum(valid, 'hitBatsmen'),
    numberOfPitches: sum(valid, 'numberOfPitches'),
    battersFaced: sum(valid, 'battersFaced'),
    inningsPitched: outsToInnings(outs)
  };

  stat.era = innings ? Number((stat.earnedRuns * 9) / innings).toFixed(2) : null;
  stat.whip = innings
    ? Number((stat.baseOnBalls + stat.hits) / innings).toFixed(2)
    : null;
  stat.strikeoutsPer9Inn = innings
    ? Number((stat.strikeOuts * 9) / innings).toFixed(2)
    : null;
  stat.walksPer9Inn = innings
    ? Number((stat.baseOnBalls * 9) / innings).toFixed(2)
    : null;
  stat.homeRunsPer9 = innings
    ? Number((stat.homeRuns * 9) / innings).toFixed(2)
    : null;

  return stat;
}

export function aggregateStats(group, rows) {
  return group === 'pitching'
    ? aggregatePitchingStats(rows)
    : aggregateHittingStats(rows);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'");
}

function plainHtml(value) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const escaped = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function fetchText(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, {
      headers: {Accept: 'text/html', 'User-Agent': 'AtlasHarbor/1.0'},
      signal: AbortSignal.timeout(10000)
    });
    return response.ok ? response.text() : null;
  } catch {
    return null;
  }
}

function parseRank(textValue, name) {
  if (!textValue) return null;
  const namePattern = escaped(name).replace(/\s+/g, '\\s+');
  const matches = [
    ...textValue.matchAll(
      new RegExp(`(?:^|\\s)(\\d{1,3})\\s+${namePattern}(?:\\s|$)`, 'gi')
    )
  ]
    .map((match) => Number(match[1]))
    .filter((rank) => rank > 0 && rank <= 100);
  return matches[0] || null;
}

function parseProspectDetail(textValue) {
  if (!textValue) return {};
  const grades = textValue.match(
    /Scouting grades:\s*Hit:\s*(\d+)\s*\|\s*Power:\s*(\d+)\s*\|\s*Run:\s*(\d+)\s*\|\s*Arm:\s*(\d+)\s*\|\s*Field:\s*(\d+)\s*\|\s*Overall:\s*(\d+)/i
  );
  const eta = textValue.match(/\bETA\s*(20\d{2})\b/i);
  return {
    eta: eta?.[1] || null,
    hit: grades?.[1] || null,
    power: grades?.[2] || null,
    run: grades?.[3] || null,
    arm: grades?.[4] || null,
    field: grades?.[5] || null,
    overallGrade: grades?.[6] || null
  };
}

async function prospectFor(fetchImpl, person, team) {
  const cacheKey = `${season()}:${person.id}`;
  const cached = prospectCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 12 * 3600000) return cached.value;

  const slug = playerSlug({name: person.fullName});
  const topUrl = `https://www.mlb.com/milb/prospects/${season()}/top100/${slug}-${person.id}/`;
  const orgSlug = ORG_SLUGS[team?.parentOrgId];
  const orgUrl = orgSlug
    ? `https://www.mlb.com/milb/prospects/${season()}/${orgSlug}/${slug}-${person.id}`
    : null;
  const [topHtml, orgHtml] = await Promise.all([
    fetchText(fetchImpl, topUrl),
    orgUrl ? fetchText(fetchImpl, orgUrl) : null
  ]);
  const topText = plainHtml(topHtml);
  const orgText = plainHtml(orgHtml);
  const overallRank = parseRank(topText, person.fullName);
  const organizationRank = parseRank(orgText, person.fullName);
  const detail = parseProspectDetail(`${topText} ${orgText}`);
  const value =
    overallRank || organizationRank || Object.values(detail).some(Boolean)
      ? {
          overallRank: overallRank ? `No. ${overallRank}` : null,
          organizationRank: organizationRank ? `No. ${organizationRank}` : null,
          ...detail,
          sourceUrl: overallRank ? topUrl : orgUrl,
          sourceName: 'MLB Pipeline'
        }
      : null;
  prospectCache.set(cacheKey, {at: Date.now(), value});
  return value;
}

async function teamsForSport(fetchImpl, sportId) {
  const key = `${season()}:${sportId}`;
  const cached = teamCache.get(key);
  if (cached && Date.now() - cached.at < 15 * 60000) return cached.value;
  const data = await optional(
    fetchImpl,
    `/teams?sportId=${sportId}&season=${season()}&hydrate=roster`
  );
  const value = data?.teams || [];
  teamCache.set(key, {at: Date.now(), value});
  return value;
}

async function currentTeamFor(fetchImpl, id, person) {
  if (person?.currentTeam?.id) {
    const detail = await optional(
      fetchImpl,
      `/teams/${person.currentTeam.id}?season=${season()}`
    );
    const team = detail?.teams?.[0];
    if (team) return team;
    if (person.currentTeam.name && person.currentTeam.sport?.id) {
      return person.currentTeam;
    }
  }

  for (const sportId of SPORT_IDS) {
    for (const team of await teamsForSport(fetchImpl, sportId)) {
      const roster = team.roster?.roster || team.roster || [];
      if (roster.some((entry) => Number(entry.person?.id) === Number(id))) {
        return team;
      }
    }
  }
  return person?.currentTeam || null;
}

function addBlocks(target, response, sport) {
  for (const block of response?.stats || []) {
    const group = block.group?.displayName || block.group?.name || '';
    const type = block.type?.displayName || block.type?.name || '';
    if (!group || !type) continue;
    const key = `${group}:${type}:${sport.id}`;
    const rows = (block.splits || []).map((split) => ({
      ...split,
      __sportId: sport.id,
      __level: sport.level,
      __shortLevel: sport.short
    }));
    target[key] = (target[key] || []).concat(rows);
  }
}

async function statsForSport(fetchImpl, id, sport, groups) {
  const standardTypes = ['season', 'career', 'yearByYear', 'seasonAdvanced'];
  let standard = await optional(
    fetchImpl,
    buildPlayerStatsPath(id, {
      types: standardTypes,
      groups,
      sportId: sport.id
    })
  );

  if (!standard?.stats?.length) {
    const requests = standardTypes.flatMap((type) =>
      groups.map((group) =>
        optional(
          fetchImpl,
          buildPlayerStatsPath(id, {
            types: [type],
            groups: [group],
            sportId: sport.id
          })
        )
      )
    );
    const responses = await Promise.all(requests);
    standard = {
      stats: responses.flatMap((response) => response?.stats || [])
    };
  }

  const primaryGroups = groups.filter((group) => group !== 'fielding');
  const logs = await optional(
    fetchImpl,
    buildPlayerStatsPath(id, {
      types: ['gameLog'],
      groups: primaryGroups,
      sportId: sport.id,
      hydrate: 'team,opponent'
    })
  );

  return {standard, logs};
}

function rowsFor(stats, group, type, sportId) {
  return stats[`${group}:${type}:${sportId}`] || [];
}

function lineFor(stats, group, type, sport) {
  const rows = rowsFor(stats, group, type, sport.id);
  const stat = aggregateStats(
    group,
    rows.map((row) => row.stat)
  );
  if (!hasStat(stat)) return null;
  const teams = [...new Set(rows.map((row) => row.team?.name).filter(Boolean))];
  return {
    sportId: sport.id,
    level: sport.level,
    shortLevel: sport.short,
    team: teams.join(' / ') || null,
    stat
  };
}

function rawPreferred(stats, group, type, sports) {
  for (const sport of sports) {
    const rows = rowsFor(stats, group, type, sport.id);
    for (const row of rows) if (hasStat(row.stat)) return row.stat;
  }
  return {};
}

async function getPlayer(fetchImpl, id) {
  const personData = await requestJson(
    fetchImpl,
    `/people/${id}?hydrate=${encodeURIComponent('currentTeam,team,draft')}`
  );
  const person = personData.people?.[0];
  if (!person) return null;

  const team = await currentTeamFor(fetchImpl, id, person);
  const currentSportId = Number(
    team?.sport?.id || person.currentTeam?.sport?.id || 1
  );
  const sports = [
    sportFor(currentSportId),
    ...PROFESSIONAL_SPORTS.filter((item) => item.id !== currentSportId)
  ];
  const pitcher = /pitcher/i.test(person.primaryPosition?.name || '');
  const twoWay =
    /two-way/i.test(person.primaryPosition?.name || '') ||
    person.primaryPosition?.code === 'Y';
  const primaryGroup = pitcher ? 'pitching' : 'hitting';
  const groups = twoWay
    ? ['hitting', 'pitching', 'fielding']
    : [primaryGroup, 'fielding'];
  const results = await Promise.all(
    sports.map((sport) => statsForSport(fetchImpl, id, sport, groups))
  );
  const stats = {};

  for (let index = 0; index < sports.length; index += 1) {
    addBlocks(stats, results[index].standard, sports[index]);
    addBlocks(stats, results[index].logs, sports[index]);
  }

  const seasonLines = sports
    .map((sport) => lineFor(stats, primaryGroup, 'season', sport))
    .filter(Boolean);
  const careerLines = sports
    .map((sport) => lineFor(stats, primaryGroup, 'career', sport))
    .filter(Boolean);
  const professionalCareer = aggregateStats(
    primaryGroup,
    careerLines.map((line) => line.stat)
  );
  const professionalSeason = aggregateStats(
    primaryGroup,
    seasonLines.map((line) => line.stat)
  );
  const recentGames = [];

  for (const sport of sports) {
    for (const split of rowsFor(stats, primaryGroup, 'gameLog', sport.id)) {
      if (!hasStat(split.stat)) continue;
      recentGames.push({
        date: split.date,
        opponent: split.opponent?.name || 'Opponent',
        team: split.team?.name || null,
        isHome: split.isHome,
        stat: split.stat || {},
        sportId: sport.id,
        level: sport.level,
        shortLevel: sport.short
      });
    }
  }
  recentGames.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const [transactions, prospect] = await Promise.all([
    optional(
      fetchImpl,
      `/transactions?playerId=${id}&startDate=${season()}-01-01&endDate=${dateOnly(new Date())}`
    ),
    prospectFor(fetchImpl, person, team)
  ]);

  return {
    id: person.id,
    name: person.fullName,
    team: team?.name || person.currentTeam?.name || 'Team unavailable',
    teamId: team?.id || person.currentTeam?.id || null,
    parentOrgId: team?.parentOrgId || null,
    parentOrgName: team?.parentOrgName || null,
    position: person.primaryPosition?.name || 'Player',
    number: person.primaryNumber || null,
    bats: person.batSide?.description || null,
    throws: person.pitchHand?.description || null,
    age: person.currentAge || null,
    birthDate: person.birthDate || null,
    birthCity: person.birthCity || null,
    birthCountry: person.birthCountry || null,
    height: person.height || null,
    weight: person.weight || null,
    debut: person.mlbDebutDate || null,
    active: person.active ?? null,
    draft: person.draftYear ? `${person.draftYear}` : null,
    level: sportFor(currentSportId).level,
    sportId: currentSportId,
    primaryStatGroup: primaryGroup,
    stats,
    seasonLines,
    careerLines,
    professionalSeason,
    professionalCareer,
    recentGames: recentGames.slice(0, 40),
    prospect,
    transactions: (transactions?.transactions || [])
      .slice(-12)
      .reverse()
      .map((item) => ({
        date: item.date,
        type: item.typeDesc,
        description: item.description,
        effectiveDate: item.effectiveDate
      })),
    legacySeason: rawPreferred(stats, primaryGroup, 'season', sports),
    legacyCareer: rawPreferred(stats, primaryGroup, 'career', sports)
  };
}

async function searchPeople(fetchImpl, query, levels) {
  const selected = levels.includes('all')
    ? SPORT_IDS
    : levels
        .map(
          (value) =>
            ({mlb: 1, aaa: 11, aa: 12, higha: 13, lowa: 14})[value]
        )
        .filter(Boolean);
  const people = await requestJson(
    fetchImpl,
    `/people/search?names=${encodeURIComponent(query)}`
  );
  const results = [];

  for (const person of (people.people || []).slice(0, 18)) {
    const team = await currentTeamFor(fetchImpl, person.id, person);
    const sportId = Number(team?.sport?.id || person.currentTeam?.sport?.id || 1);
    if (!selected.includes(sportId)) continue;
    results.push({
      type: 'player',
      id: person.id,
      name: person.fullName,
      subtitle: `${team?.name || person.currentTeam?.name || 'Team unavailable'} · ${person.primaryPosition?.name || 'Player'}`,
      level: sportFor(sportId).short
    });
  }
  return results;
}

export function createBaseballProspectRouter({legal, fetchImpl = globalThis.fetch} = {}) {
  const router = express.Router();

  router.get('/api/baseball/prospect-search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    const levels = String(req.query.levels || 'mlb').split(',');
    if (query.length < 2) return res.json({results: []});
    try {
      return res.json({results: await searchPeople(fetchImpl, query, levels)});
    } catch (error) {
      return res.status(502).json({error: error.message});
    }
  });

  router.get('/api/baseball/prospect-players/:id', async (req, res) => {
    try {
      const player = await getPlayer(fetchImpl, req.params.id);
      return player
        ? res.json({player})
        : res.status(404).json({error: 'Player not found'});
    } catch (error) {
      console.error(error);
      return res.status(502).json({error: error.message});
    }
  });

  router.get(
    ['/baseball/players/:id', '/baseball/players/:id/:slug'],
    async (req, res, next) => {
      if (!/^\d+$/.test(req.params.id)) return next();
      try {
        const player = await getPlayer(fetchImpl, req.params.id);
        if (!player) return next();
        const canonicalPath = `/baseball/players/${player.id}/${playerSlug(player)}`;
        const base = (
          process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`
        ).replace(/\/$/, '');
        if (req.path !== canonicalPath) return res.redirect(301, canonicalPath);
        res.set('Cache-Control', 'public,max-age=60,stale-while-revalidate=300');
        return res
          .type('html')
          .send(renderBaseballPlayerPage(player, `${base}${canonicalPath}`));
      } catch (error) {
        console.error(error);
        return next();
      }
    }
  );

  router.get('/sitemap.xml', async (req, res) => {
    const base = (
      process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`
    ).replace(/\/$/, '');
    const urls = [
      '/',
      '/baseball',
      '/legal',
      '/food',
      '/economics',
      '/game',
      '/published',
      '/problems'
    ];

    try {
      const games = await optional(
        fetchImpl,
        `/schedule?sportId=1&startDate=${dateOnly(new Date())}&endDate=${dateOnly(addDays(new Date(), 14))}`
      );
      for (const game of (games?.dates || []).flatMap((date) => date.games || [])) {
        urls.push(`/baseball/games/${game.gamePk}`);
      }
      if (legal) {
        for (const item of await legal.listCases()) urls.push(`/legal/${item.slug}`);
      }
    } catch {
      // A partial sitemap is still valid when an upstream feed is unavailable.
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
      ...new Set(urls)
    ]
      .map(
        (url) =>
          `<url><loc>${base}${url}</loc><changefreq>${
            url.startsWith('/baseball/games/')
              ? 'hourly'
              : url.startsWith('/legal/')
                ? 'daily'
                : 'weekly'
          }</changefreq></url>`
      )
      .join('')}</urlset>`;
    res.type('application/xml').send(xml);
  });

  return router;
}
