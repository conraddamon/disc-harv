/*** Globals ***/

const GLOBAL_DEFAULT = {
  // Data
  tournament: {},
  playerById: {},
  playerByName: {},
  eventById: {},
  eventByName: {},
  teamInfo: {},
  teamById: {},
  // Autocomplete
  autocomplete: {
    player: [], // player registration
    score: [], // enter score
    result: [], // remove score
  },
  // Other
  curPage: '',
  sortColumn: '',
  reverseSort: false,
  availablePlayers: {
    ddc: [],
    freestyle: [],
  },
  messageTimerId: 0,
};

let GLOBAL = GLOBAL_DEFAULT;

const clearGlobals = () => {
  GLOBAL = $.extend(true, {}, GLOBAL_DEFAULT);
  DATA = {};
  LAST_ACCESS = {};
};

/*** JS language utilities ***/

const uniquify = (list) => [...new Set(list)];

const formatDate = (date) => date ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';

const quote = (value) => value == null || value === '' ? "''" : value.includes("'") ? `"${value}"` : `'${value}'`;

const unquote = (value) => ["'", '"'].includes(value[0]) ? value.substring(1, value.length - 1) : value;

const isPositiveInteger = (str) => {
  const number = Number(str);
  return Number.isInteger(number) && number > 0;
};

/*** Browser utilities ***/

const scrollToTop = () => setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }), 1000);

const showElement = (selector, condition) => {
  if (condition) {
    $(selector).show();
  } else {
    $(selector).hide();
  }
};

const getCookie = async (name) => {
  const cookie = await cookieStore.get(name);
  return cookie ? cookie.value : '';
};

const isBrowserCompatible = () => {
  const isCompatible = !!window.navigation;
  if (!isCompatible) {
    let msg = 'Your browser is not supported. Chrome is recommended.';
    const ua = navigator.userAgent;
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    if (isSafari) {
      const versionMatch = ua.match(/Version\/(\d+(\.\d+)?)/);
      const version = versionMatch && parseFloat(versionMatch[1]);
      if (version && version < 26.2) {
	msg = 'Safari before version 26.2 is not supported. Please update Safari/IOS, or try another browser such as Chrome.';
      }
    }
    showError(msg);
  }

  return isCompatible;
};

/*** Query param utilities ***/

// Parses the URL's query string into key/value pairs. A key without a value gets a value of true.
const parseQueryString = () => {

  const qs = {};
  const s = window.location.search;
  const pairs = s ? s.substr(1).split('&') : [];

  pairs.forEach((pair) => {
    const [key, value] = pair.split('=');
    qs[key] = value != null ? value : true;
  });

  return qs;
};

const navigateTo = (path, params) => {
  const url = new URL(path || window.location.pathname, window.location.origin);
  for (const key in params) {
    url.searchParams.set(key, params[key]);
  }
  const qs = parseQueryString();
  if ('test' in qs) {
    url.searchParams.set('test', qs.test);
  }
  window.location.href = url.toString();
};

// Updates or replaces URL params
const updateQueryParams = (params, clear = false) => {
  console.log('*** update query params: ' + JSON.stringify(params));
  const url = new URL(window.location.href);
  const isEmpty = (val) => val == undefined || val === '';
  const qs = parseQueryString();
  if ('test' in qs) {
    params.test = qs.test || 1;
  }
  if (clear) {
    const nonEmptyParams = Object.fromEntries(Object.entries(params).filter(([_, value]) => !isEmpty(value)));
    const newParams = new URLSearchParams(nonEmptyParams);
    url.search = newParams.toString();
  } else {
    Object.keys(params).forEach((key) => {
      const value = params[key];
      if (isEmpty(value)) {
	url.searchParams.delete(key);
      } else {
	url.searchParams.set(key, value);
      }
    });
  }

  history.pushState({}, '', url);
};

// Listen for navigation events and pass them to the registered handler
let oldParams = new URLSearchParams(window.location.search);
let paramChangeHandler;
const registerParamChangeHandler = (handler) => paramChangeHandler = handler;

const handleNavigationEvent = (event) => {
  const newUrl = new URL(event.destination.url);
  console.log('Location changed via navigation API to:', newUrl.toString());
  const newParams = newUrl.searchParams;
  if (newParams.toString() !== oldParams.toString()) {
    if (paramChangeHandler) {
      const oldArgs = Object.fromEntries(oldParams);
      const newArgs = Object.fromEntries(newParams);
      delete oldArgs.test;
      delete newArgs.test;
      paramChangeHandler(oldArgs, newArgs);
    }
    oldParams = newParams;
  }
};

window.navigation.addEventListener("navigate", handleNavigationEvent);

/*** String utilities ***/

const capitalize = (str) => {
  const words = (str || '').split(/\s+/);
  return (words.map((w) => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase())).join(' ');
};

// Returns the result of comparing two names. Last name is the primary key. Handles team names if it sees a slash.
// In that case the first team member is used for comparison.
const compareNames = (a, b) => {
  if (a == null || b == null) {
    return a == b ? 0 : a == null ? -1 : 1;
  }

  if (a.includes('/')) {
    a = a.split(/\s*\/\s*/)[0];
  }
  if (b.includes('/')) {
    b = b.split(/\s*\/\s*/)[0];
  }

  const { first: aFirst, last: aLast } = splitName(a);
  const { first: bFirst, last: bLast } = splitName(b);
    
  return aLast !== bLast ? aLast.localeCompare(bLast) : aFirst.localeCompare(bFirst);
};

// figures out where the last name starts
const splitName = (name) => {
  const lcName = name.toLowerCase();
  let idx = regexIndexOf(lcName, /\s+(van|von|de|da)\s+/);

  const m = idx === -1 && lcName.match(/(,? jr| sr| ii| iii)$/);
  const start = m ? name.length - m[1].length : name.length;

  idx = name.lastIndexOf(' ', start - 1);
  return { first: idx !== -1 ? name.substring(0, idx) : '', last: idx !== -1 ? name.substring(idx + 1) : name };
};

// http://stackoverflow.com/questions/273789/is-there-a-version-of-javascripts-string-indexof-that-allows-for-regular-expr
const regexIndexOf = (str, regex, startpos) => {
  const idx = str.substring(startpos || 0).search(regex);
  return idx >= 0 ? idx + (startpos || 0) : idx;
};

// match a full name against a string by checking for the string at the beginning of the first or last name
const matchName = (name, str) => {
  const lcName = name.toLowerCase();
  const lcStr = str.toLowerCase();
  const { first, last } = splitName(lcName);

  return lcName.indexOf(lcStr) === 0 || first.indexOf(lcStr) === 0 || last.indexOf(lcStr) === 0;
};

const matchTeamName = (teamName, str) => {
  const names = teamName.split(/\s*\/\s*/);
  return names.some((name) => matchName(name, str));
};

// Convert an event code to its display version.
const capitalizeEvent = (event) => event.length === 3 ? event.toUpperCase() : capitalize(event);

// Return the name of the round based on tournament setups, eg Round 1, Round 2, Semi, Final
const getRoundName = (event, round, division) => {
  const numRounds = getRoundsByDivision(event, division);
  const numCumulativeRounds = getRoundsByDivision(event, division, true);
  const numRoundsRemaining = numRounds - round;

  if (round <= numCumulativeRounds) {
    return `Round ${round}`;
  }
  if (round === numRounds + 1) {
    return 'Playoff';
  }
  if (numRoundsRemaining === 0) {
    return 'Final';
  }
  if (numRoundsRemaining === 1) {
    return 'Semi';
  }

  return `Round ${round}`;
};

/*** Team utilities ***/

// Returns an array of the populated members of a team (up to three players)
const getTeamMembers = (team) => team ? [team.player1, team.player2, team.player3].filter((playerId) => playerId && Number(playerId) > 0) : [];

/**
 * Creates a team name from a list of players. They're put in alphabetical order by last name and connected with a slash.
 * If there are more than two players, last names are used.
 */
const getTeamName = (players) => {
  let sortedPlayers = players.filter((name) => name && name !== DUMMY_PLAYER_NAME).sort(compareNames);
  if (sortedPlayers.length > 2) {
    sortedPlayers = sortedPlayers.map(name => {
      const { first, last } = splitName(name);
      return last;
    });
  }
  return sortedPlayers.join(' / ');
};

// Returns either a player or a team name, depending on the event.
const getName = (id, event) => {
  event = event || GLOBAL.curPage;
  const player = isTeamEvent(event) ? GLOBAL.teamById[id] : GLOBAL.playerById[id];

  return player ? player.name : '';
};

/*** Division utilities ***/

/**
 * There are two layers to divisions. The broader layer is classes, of which there are four: O W OJ WJ.
 * Within the O and W there are optional age-related divisions: OGM WM etc.
 */

// get the value from a division select
const getDivision = (page) => {
  const selectId = page ? `${ID.DIVISION_SELECT}-${page}` : ID.DIVISION_SELECT;
  return $(`#${selectId}`).val();
};

const getDefaultDivision = (page) => page === 'players' ? 'ALL' : 'O';

/**
 * Returns true if the player/team division matches the given division. For an individual player, it's
 * pretty simple: a player matches with their own division and the more restrictive age divisions in
 * that class.
 *
 * For teams, it's way more complex. There are two places where we want to know if a team matches a division:
 * when displaying results, and when awarding overall points. Surprisingly, they have different requirements.
 * When we're displaying results, we want to show teams with at least one member who matches the class (O, W, OJ, WJ).
 * For awarding overall points, we add the condition that all members must be eligible for the division, which
 * includes going across classes. For example, a WJ is also an O player.
 */
const divisionMatch = (id, division, isTeamEvent, options = {}) => {
  if (division === 'ALL') {
    return true;
  }

  const playerMatch = (player, division, matchingMap) => {
    const playerDiv = player && player.division;
    return !!(playerDiv && matchingMap[division].includes(playerDiv));
  };

  // player matching
  if (!isTeamEvent) {
    const player = typeof id !== 'string' && typeof id !== 'number' ? id : GLOBAL.playerById[id];
    return playerMatch(player, division, DIV_LIST);
  }

  // team matching
  const team = typeof id !== 'string' && typeof id !== 'number' ? id : GLOBAL.teamById[id];
  if (team) {
    const teamMembers = getTeamMembers(team);
    if (options.looseMatching) {
      return teamMembers.some(memberId => playerMatch(GLOBAL.playerById[memberId], division, DIV_LIST_OVERALL_TEAM));
    }
    if (options.scoringMode) {
      return teamMembers.some(memberId => playerMatch(GLOBAL.playerById[memberId], division, DIV_LIST)) &&
	teamMembers.every(memberId => playerMatch(GLOBAL.playerById[memberId], division, DIV_LIST_OVERALL_TEAM));
    }
    return teamMembers.some(memberId => playerMatch(GLOBAL.playerById[memberId], division, DIV_LIST));
  }

  console.log(`divisionMatch failed to find ID: ${id}`);
  return false;
};

const isOpenDivision = (division) => division.startsWith('O');
const isWomenDivision = (division) => division.startsWith('W');
const isJuniorDivision = (division) => division.includes('J');

// Say "Women's Golf" instead of "Women Golf".
const getDivisionAdjective = (division) => {
  const divAdj = DIV_NAME[division] || capitalize(division);;
  return isWomenDivision(division) ? divAdj.replace("Women", "Women's") : divAdj;
};

// Filters out results that don't match the given division and returns the resulting list.
const filterResultsByDivision = (results, division, isTeamEvent) => (results || []).filter(result => divisionMatch(result.player_id, division, isTeamEvent, { looseMatching: isVirginiaStates() && GLOBAL.curPage === 'freestyle' }));

// Parses an encoded string with numerical values that can vary by division using the HARV encoding method.
const getValueByDivision = (codeStr, division) => {

  const codes = codeStr.split(/\s*;\s*/);

  let defaultValue;
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const [ div, value ] = code.split(':');
    if (div === division) {
      return Number(value);
    }
    if (!value) {
      defaultValue = div;
    }
  }

  return Number(defaultValue);
};

const getRoundsByDivision = (event, division, getCumulative = false) => {
  const eventObj = GLOBAL.eventByName[event];
  const roundInfo = getCumulative ? eventObj.cumulative_rounds : eventObj.rounds;
  return getValueByDivision(roundInfo, division);
};

const getCountdownBaseByDivision = (division) => getValueByDivision(GLOBAL.tournament.countdown_base, division);

const compareByDivision = (playerA, playerB) => DIV_ORDER.indexOf(playerA.division) - DIV_ORDER.indexOf(playerB.division);

const getImpliedDivisions = (division) => Object.keys(DIV_LIST).filter((div) => DIV_LIST[div].includes(division));

/*** Pool utilities ***/

// get the value from a pool select
const getPool = (page) => {
  if (!GLOBAL.tournament.pools) {
    return;
  }
  const selectId = page ? `${ID.POOL_SELECT}-${page}` : ID.POOL_SELECT;
  return $(`#${selectId}`).val();
};

// Filters out results that don't match the given pool and returns the resulting list.
const filterResultsByPool = (results, pool) => {
  if (!pool || pool === 'ALL') {
    return results || [];
  }

  return (results || []).filter(result => {
    // ignore pools for team events
    const event = GLOBAL.eventById[result.event_id].name;
    if (isTeamEvent(event)) {
      return true;
    }
    else {
      const player = GLOBAL.playerById[result.player_id];
      return player && player.pool === pool;
    }
  });
};

const poolMatch = (player, pool) => !pool || pool === 'ALL' || player.pool === pool;

/*** Round utilities ***/

// get the value from the round select
const getRound = () => Number($(`#${ID.ROUND_SELECT}`).val());

/*** Event utilities ***/

const hasEvent = (eventName) => !!GLOBAL.eventByName[eventName];

const getEventId = (eventName) => hasEvent(eventName) ? GLOBAL.eventByName[eventName].id : -1;

// may need to check tournament config to see if event has teams of one
const isTeamEvent = (event) => event === 'ddc' || event === 'freestyle';

const isRankScoring = (event) => GLOBAL.eventByName[event] && GLOBAL.eventByName[event].rank_scoring === '1';

const shouldUseDecimal = (event, results) => {
  if (['scf', 'mta'].includes(event)) {
    return true;
  }
  const eventId = getEventId(event);
  return (['distance', 'trc'].includes(event) && results.some(r => r.event_id === eventId && r.score % 1 !== 0));
};

// returns a sorted list of the actual overall events, removing MTA and TRC if SCF is being played
const normalizeOverallEvents = (events) => {
  events.sort((a, b) => EVENT_ORDER.indexOf(a) - EVENT_ORDER.indexOf(b));
  if (events.includes('scf')) {
    events = events.filter(event => !SCF_EVENTS.includes(event));
  }
  return events;
};

/*** Results utilities ***/

/**
 * This function is super-important.
 *
 * Analyzes a set of results and returns data about it. The primary task is to determine the order in
 * which to rank players based on scores. A score in a later round is better than any score in an
 * earlier round. We also need to handle events that have cumulative rounds. If we have scores for
 * all an event's cumulative rounds, calculate an additional result with the total score. Note that
 * the results are ordered by round.
 */
const getSortedResults = (data, event, division) => {
  if (!data || data.length === 0) {
    return { playerIds: [], scoreData: {} };
  }

  data = isRankScoring(event) ? data : data.filter(result => Number(result.round) > 0);

  // figure out how many rounds we have results for, and get a list of player IDs that have results
  const numRounds = getRoundsByDivision(event, division);
  const numCumulativeRounds = getRoundsByDivision(event, division, true);
  const playerIds = uniquify(data.map(result => result.player_id));
  const scoreData = {};

  // generate score data: number of rounds per player, latest round, and total if event is cumulative
  data.forEach((result) => {

    const p = result.player_id;
    const round = Number(result.round);
    const score = Number(result.score || 0);

    scoreData[p] = scoreData[p] || {};
    scoreData[p][round] = score;
    scoreData[p].nonQualified = result.nonQualified;

    if (round > numRounds) {
      scoreData[p].playoff = score;
      return;
    }

    if (score > -2) {
      scoreData[p].latest = Math.max(scoreData[p].latest || 0, round, numCumulativeRounds < numRounds ? numCumulativeRounds : -1);
    }

    let adjScore = score;
    const lowerIsBetter = LOWER_IS_BETTER[event] || isRankScoring(event);
    if (score < 0) {
      adjScore = lowerIsBetter ? score * -1000 : score * 1000;
    }

    if (round <= numCumulativeRounds) {
      scoreData[p].total = (scoreData[p].total || 0) + Math.max(adjScore, 0);
      scoreData[p].sort = (scoreData[p].sort || 0) + adjScore;
    } else {
      scoreData[p].sort = adjScore;
    }
  });

  // sort by score; a score in a later round beats any score from a previous round
  playerIds.sort((a, b) => {

    // make sure that non-qualified teams finish behind qualified teams in their division
    const nonQualifiedA = scoreData[a].nonQualified;
    const nonQualifiedB = scoreData[b].nonQualified;
    if (nonQualifiedA !== nonQualifiedB) {
      return nonQualifiedA ? 1 : -1;
    }

    const latestA = scoreData[a].latest || 0;
    const latestB = scoreData[b].latest || 0;

    // latest round played is primary sort key, except for cumulative rounds where higher scores are better
    const isCumulative = !LOWER_IS_BETTER[event] && latestA <= numCumulativeRounds && latestB <= numCumulativeRounds;
    if (!isCumulative && latestA !== latestB) {
      return latestB - latestA;
    }

    // score is secondary sort key
    const scoreA = (!latestA || (latestA <= numCumulativeRounds)) ? scoreData[a].sort :  scoreData[a][latestA];
    const scoreB = (!latestB || (latestB <= numCumulativeRounds)) ? scoreData[b].sort :  scoreData[b][latestB];

    let result = compareScores(scoreA, scoreB, event);

    if (result !== 0) {
      return result;
    }
    result = compareScores(scoreData[a].playoff, scoreData[b].playoff, event);

    return result === 0 ? compareNames(getName(a), getName(b)) : result;
  });

  // assign ranks
  let curRound;
  let curScore;
  let curPlayoff;
  let curRank;

  playerIds.forEach((playerId, index) => {
	    
    const latest = scoreData[playerId].latest;
    const score = scoreData[playerId].sort;
    const playoff = scoreData[playerId].playoff;

    const isCumulative = !LOWER_IS_BETTER[event] && latest <= numCumulativeRounds;
    if ((!isCumulative && latest && (latest !== curRound)) || score !== curScore || playoff !== curPlayoff) {
      curRank = index + 1;
    }
    scoreData[playerId].rank = curRank;
    curRound = latest;
    curScore = score;
    curPlayoff = playoff;
  });

  return { numRounds, playerIds, scoreData };
};

/**
 * Compares two event scores. The possible values for a score, from worst to best, are:
 *
 *     -2 (SCR), -1 (DNF or NC), 0, any positive number
 *
 * Note: GLOBAL.curPage must be set for this to work correctly for rank scoring
 */
const compareScores = (scoreA, scoreB, event) => {

  // absence of a score is always worse
  if (scoreA == null || scoreB == null) {
    return scoreA == scoreB ? 0 : scoreA == null ? 1 : -1;
  }

  // check for SCR/DNF/NC; we can't just use math because lower might be better

  // -2 is SCR (scratch)
  if (scoreA === -2 || scoreB === -2) {
    return scoreA === scoreB ? 0 : scoreA === -2 ? 1 : -1;
  }

  // -1 is DNF (did not finish) or NC (no catch)
  if (scoreA === -1 || scoreB === -1) {
    return scoreA === scoreB ? 0 : scoreA === -1 ? 1 : -1;
  }

  return LOWER_IS_BETTER[event] || isRankScoring(event) ? scoreA - scoreB : scoreB - scoreA;
};

const formatScore = (score, event, options) => {

  const { useDecimal, isPlayerPage } = options;
  
  if (score == null) {
    return isPlayerPage ? '' : '-';
  }

  if (isRankScoring(event)) {
    return parseInt(score);
  }

  score = Number(score)
  if (event === 'discathon' && score > 0) {
    const min = Math.floor(score / 60);
    let sec = score % 60;
    sec = sec < 10 ? '0' + sec : sec;
    return [ min, sec ].join(":");
  } else if (score == -2) { // SCR
    return '-';
  } else if (score == -1) {
    return ['scf', 'mta', 'trc'].includes(event) ? 'NC' : 'DNF';
  } else if (score == 0) {
    return '0';
  } else if (useDecimal) {
    return String(Number(score).toFixed(2));
  }
  
  return String(Number(score));
};

/*** SCF utilities ***/

// Creates SCF result objects by combining MTA and TRC scores.
const getScfData = (mtaData, trcData) => {

  const scfData = [];

  // figure how how many rounds' worth of data we have
  const numRounds = Math.max(Math.max.apply(Math, mtaData.map(result => result.round)),
			     Math.max.apply(Math, trcData.map(result => result.round)));

  // get a list of all the players with an SCF result
  let playerIds = mtaData.map((result) => result.player_id);
  const trcPlayerIds = trcData.map((result) => result.player_id);

  $.merge(playerIds, trcPlayerIds);
  playerIds = uniquify(playerIds).sort((a, b) => Number(a) - Number(b));

  // calculate the SCF result for each player in each round
  for (let round = 1; round <= numRounds; round++) {
    playerIds.forEach((playerId) => {
      const mtaResult = mtaData.find((result) => result.round == round && result.player_id == playerId);
      const trcResult = trcData.find((result) => result.round == round && result.player_id == playerId);
      const mtaScore = mtaResult && mtaResult.score > 0 ? Number(mtaResult.score) : 0;
      const trcScore = trcResult && trcResult.score > 0 ? Number(trcResult.score) : 0;
      let scfScore = (mtaScore * 5.5) + trcScore;

      if (mtaResult || trcResult) {
	// take best of SCR/NC
	if (scfScore === 0) {
	  scfScore = Math.max(mtaResult ? mtaResult.score : -2, trcResult ? trcResult.score : -2);
	}
	const scfResult = {
	  event_id: getEventId('scf'),
	  player_id: playerId,
	  round,
	  score: scfScore.toFixed(2)
	}
	scfData.push(scfResult);
      }
    });
  }

  return scfData;
};

/*** Miscellaneous utilitiess ***/

// Converts each of the team results into a set of individual results.
const flattenResults = (results, division) => {

  results = results || [];

  const flattened = [];

  results.forEach((result) => {
    const event = GLOBAL.eventById[result.event_id].name;
    if (isTeamEvent(event)) {
      const team = GLOBAL.teamById[result.player_id];
      getTeamMembers(team).forEach((playerId) => {
	if (divisionMatch(playerId, division, false)) {
	  const clone = Object.assign({}, result);
	  clone.player_id = playerId;
	  flattened.push(clone);
	}
      });
    } else {
      flattened.push(result);
    }
  });

  return flattened;
};

const isVirginiaStates = () => GLOBAL.tournament.name.includes('Virginia');
