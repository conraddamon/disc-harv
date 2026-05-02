/*** Data storage and caching ***/

// raw data from fetch requests
let DATA = {};

let LAST_ACCESS = {};

// in minutes
const DEFAULT_TIME_TO_LIVE = 5;
const TIME_TO_LIVE = {
  tournaments: 30,
  tournament: 10,
  players: 5,
  events: 10,
  teams: 5,
  results: 1,
};

// returns true if the cache entry is stale or empty
const needsFetch = (key) => {
  // in admin app, don't cache data between requests since it's frequently changing
  if (window.location.pathname.includes('/admin')) {
    return true;
  }
  const ttlKey = key.includes('-') ? (key.split('-'))[0] : key;
  const curTime = (new Date()).getTime();
  const lastAccess = LAST_ACCESS[key];
  let ttl = (TIME_TO_LIVE[ttlKey] || DEFAULT_TIME_TO_LIVE) * 60000;
  const result = !lastAccess || curTime - lastAccess > ttl;
  LAST_ACCESS[key] = curTime;

  return result;
};

/**
 * Sends an async request to the server via a REST call to a PHP endpoint. Calling functions should declare
 * themselves async and await the response, which is parsed into a JS value.
 */
const sendRequestAsync = async (op, args = {}) => {

  const qs = parseQueryString();
  const cleanedArgs = Object.fromEntries(Object.entries(args).filter(([key, value]) => value !== undefined));
  const endpoint = '/data/harv.php';

  cleanedArgs.op = op;
  if ('test' in qs) {
    cleanedArgs.test = true;
  }
  if ('log' in qs) {
    cleanedArgs.log = true;
  }

  const data = await $.get(endpoint, cleanedArgs);
  return JSON.parse(data);
};

/**
 * Generic function that checks the cache for data and fetches the data if needed. The arg 'type' is a key
 * used to cache results. A callback may be provided for when new data has been fetched.
 */
const getData = async (type, op, args, postFetchCallback) => {
  let data;
  args = args || {};
  if (needsFetch(type) || args.force) {
    console.log(`*** fetching ${type}`);
    data = await sendRequestAsync(op, args);
    DATA[type] = data;
  } else {
    console.log(`*** cache hit for ${type}`);
    data = DATA[type];
  }

  if (postFetchCallback) {
    data = postFetchCallback(data);
  }

  return data;
};

const getTournaments = async (args) => getData('tournaments', 'get-tournaments', args);
const getTournament = async (args) => getData(`tournament-${args.tournamentId}`, 'get-tournament', args, handleTournament);
const getPlayers = async (args) => getData(`players-${args.tournamentId}`, 'load-player', args, handlePlayers);
const getEvents = async (args) => getData(`events-${args.tournamentId}`, 'get-events', args, handleEvents);
const getTeams = async (args) => getData(`teams-${args.eventId}`, 'get-teams', args);
const getResults = async (args) => getData(args.eventId ? `results-${args.eventId}` : `results-${args.tournamentId}`, 'get-results', args);

const getEventResults = async (tournamentId, event, division, pool, eventData) => {
  const eventObj = GLOBAL.eventByName[event];
  const resultData = eventData ? eventData : await getResults({ event, eventId: eventObj.id, sort: 'round' });
  const results = filterResultsByDivision(resultData, division, isTeamEvent(event), false);
  return filterResultsByPool(results, pool);
};

const handleTournament = (tournamentData) => {
  if (tournamentData) {
//    tournamentData.mixed_team_scoring = ['full', 'any'].includes(tournamentData.mixed_team_scoring) ? 'any': 'all';
  }
  GLOBAL.tournament = tournamentData;
  return tournamentData;
};

// save useful lookup maps so that player data is always available
const handlePlayers = (playerData) => {
  GLOBAL.playerById = {};
  GLOBAL.playerByName = {};
  if (playerData && playerData.length > 0) {
    playerData.forEach(player => {
      GLOBAL.playerById[player.id] = player;
      GLOBAL.playerByName[player.name] = player;
    });
  }
  return playerData;
};

// save useful lookup maps so that event data is always available
const handleEvents = (eventData) => {
  GLOBAL.eventById = {};
  GLOBAL.eventByName = {};
  (eventData || []).forEach(event => {
    GLOBAL.eventById[event.id] = event;
    GLOBAL.eventByName[event.name] = event;
  });
  return eventData;
};

// Create and return an object that consolidates info about team events
const getTeamInfoByEvent = async (tournamentId) => {
  GLOBAL.teamById = {};
  const teamInfoByEvent = {};
  for (let e = 0; e < TEAM_EVENTS.length; e++) {
    const eventName = TEAM_EVENTS[e];
    teamInfoByEvent[eventName] = {};
    const eventData = await getEvents({ tournamentId });
    const event = (eventData || []).find(event => event.name === eventName);
    if (!event) {
      continue;
    }
    const teams = await getTeams({ eventId: event.id }) || [];
    for (let t = 0; t < teams.length; t++) {
      const team = teams[t];
      const teamInfo = { ...team, event: event.name };
      const teamPlayers = getTeamMembers(team).map(playerId => {
	const player = GLOBAL.playerById[playerId];
	return player ? player.name : '[unknown]';
      });
      teamInfo.name = getTeamName(teamPlayers);
      teamInfoByEvent[eventName][team.id] = teamInfo;
      GLOBAL.teamById[team.id] = teamInfo;
    }
  }
  GLOBAL.teamInfo = teamInfoByEvent;

  return teamInfoByEvent;
};

// Clear cached data related to the particular page (by clearing its last access time,
// which will force a network fetch).
const clearCacheForPage = (id, page) => {
  let cacheIds = [];
  switch (page) {
    case 'players': {
      // players page clears all tournament data
      const ddcEventId = getEventId('ddc');
      const freestyleEventId = getEventId('freestyle');
      cacheIds = [`tournament-${id}`, `players-${id}`, `events-${id}`, `teams-${ddcEventId}`, `teams-${freestyleEventId}`];
      break;
    }

    case 'golf':
    case 'distance':
    case 'accuracy':
    case 'discathon':
    case 'mta':
    case 'trc':
    case 'ddc':
    case 'freestyle': {
      const eventId = getEventId(page);
      cacheIds = [`results-${eventId}`];
      break;
    }
    case 'scf': {
      const mtaEventId = getEventId('mta');
      const trcEventId = getEventId('trc');
      cacheIds = [`results-${mtaEventId}`, `results-${trcEventId}`];
      break;
    }

    case 'overall':
    case 'player': {
      cacheIds = [`results-${id}`];
      break;
    }
  }

  console.log('*** clear cache: ' + cacheIds);
  cacheIds.forEach((cacheId) => delete LAST_ACCESS[cacheId]);
};

// Admin auth functions
const getPasswordHash = (pw) => sendRequestAsync('get-password-hash', { pw });
const getToken = (tournamentId) => sendRequestAsync('get-token', { tournamentId });

// Admin data query functions
const getRecentPlayers = async (args) => getData(`recent-players-${args.date}`, 'get-recent-players', args);
const getPersons = async (args) => getData(`persons`, 'load-person', args, handlePersons);

// Admin data mutation functions
const addTournament = (keys, values) => sendRequestAsync('add-tournament', { keyList: keys.join(','), valueList: values.join(',') });
const updateTournament = (tournamentId, updates) => sendRequestAsync('update-tournament', { tournamentId, updates: updates.join(',') });
const addEvent = (keys, values) => sendRequestAsync('add-event', { keyList: keys.join(','), valueList: values.join(',') });
const updateEvent = (eventId, updates) => sendRequestAsync('update-event', { eventId, updates: updates.join(',') });
const addPerson = (name, sex) => sendRequestAsync('add-person', { name, sex });
const addPlayer = (tournamentId, personId, division, pool) => sendRequestAsync('add-player', { tournamentId, personId, division, pool }).then((result) => {
  console.log('*** added player');
  console.dir(result);
  return result;
});
const removePlayer = (playerId) => sendRequestAsync('remove-player', { playerId });
const addTeam = (args) => {
  if (!args.player3) {
    args.player3 = '0';
  }
  return sendRequestAsync('add-team', args);
};
const removeTeam = (teamId) => sendRequestAsync('remove-team', { teamId });
const addResult = (eventId, playerId, round, score) => sendRequestAsync('add-result', { eventId, playerId, round, score});
const removeResult = (resultId) => sendRequestAsync('remove-result', { resultId });

// save useful lookup maps so that player data is always available
const handlePersons = (personData) => {
  GLOBAL.personById = {};
  GLOBAL.personByName = {};
  if (personData && personData.length > 0) {
    personData.forEach((person) => {
      GLOBAL.personById[person.id] = person;
      GLOBAL.personByName[person.name] = person;
    });
  }
  return personData;
};
