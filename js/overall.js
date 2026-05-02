const getOverallResults = async (tournamentId, division) => {

  let resultData = await getResults({ tournamentId, sort: 'round' });

  // remove scratches
  resultData = resultData ? resultData.filter((result) => result.score != -2) : [];
  
  if (resultData.length === 0) {
    setContent(ID.TOURNAMENT_RESULTS, 'No results have been recorded yet.');
    return {};
  }

  // get divisional results
  resultData = resultData
    .filter((result) => divisionMatch(result.player_id, division, isTeamEvent(GLOBAL.eventById[result.event_id].name), false));

  /*
  const isVirginiaStates = GLOBAL.tournament.name.includes('Virginia');
  if (isVirginiaStates && isJuniorDivision(division)) {
    const ddcEventId = getEventId('ddc');
    const freestyleEventId = getEventId('freestyle');
    resultData = resultData.filter((result) => ![ddcEventId, freestyleEventId].includes(result.event_id));
  }
*/

  // mark non-qualifying teams (at least one team member doesn't fit division)
  resultData = resultData
    .map((result) => {
      const teamEvent = isTeamEvent(GLOBAL.eventById[result.event_id].name);
      result.nonQualified = isTeamEvent && !divisionMatch(result.player_id, division, teamEvent, true);
      return result;
    });

  // transform results so each result is individual
  resultData = flattenResults(resultData, division);

  // calculate SCF results if needed, replace MTA/TRC results with those
  if (hasEvent('scf')) {
    const getScfResults = (scfEvent) => {
      const scfEventId = GLOBAL.eventByName[scfEvent].id;
      const scfEventData = resultData.filter((result) => result.event_id === scfEventId); // pull out SCF event data
      resultData = resultData.filter((result) => result.event_id !== scfEventId); // remove that data from the main list
      return scfEventData;
    };
    const mtaResults = getScfResults('mta');
    const trcResults = getScfResults('trc');
    $.merge(resultData, getScfData(mtaResults, trcResults));
  }

  // get a list of players who have played enough events to qualify for overall points
  const playerEvents = {};
  resultData.forEach((result) => {
    const set = playerEvents[result.player_id] = playerEvents[result.player_id] || new Set();
    set.add(result.event_id);
  });
  const overallPlayerIds = Object.keys(playerEvents).filter((playerId) => playerEvents[playerId].size >= GLOBAL.tournament.min_events);
  console.log(`${overallPlayerIds.length} overall players`);
  resultData = resultData.filter((result) => overallPlayerIds.includes(result.player_id));

  const overallPointsByEvent = {};
  const overallPointsByPlayer = {};
  const events = getOverallEvents(division);

  events.forEach((event) => {
    overallPointsByEvent[event] = {};
    const eventResults = resultData.filter((result) => result.event_id === GLOBAL.eventByName[event].id);
    const eventResultInfo = getSortedResults(eventResults, event, division);
    if (eventResultInfo && eventResultInfo.playerIds && eventResultInfo.playerIds.length > 0) {
      overallPointsByEvent[event] = getOverallPoints(eventResultInfo, event, division);
      for (let playerId in overallPointsByEvent[event]) {
	overallPointsByPlayer[playerId] = overallPointsByPlayer[playerId] || 0;
	overallPointsByPlayer[playerId] += overallPointsByEvent[event][playerId];
      }
    }
  });

  return { overallPointsByPlayer, overallPointsByEvent };
};

// VA States omits team events from Junior overall
const getOverallEvents = (division) => {
  const events = normalizeOverallEvents(Object.keys(GLOBAL.eventByName));
  return events.filter((event) => !(isVirginiaStates() && isJuniorDivision(division) && ['ddc', 'freestyle'].includes(event)));
};

const showOverallResults = async (tournamentId) => {
  const division = getDivision();
  if (isRankScoring('overall')) {
    showOverallPlaces(division);
    return;
  }
  
  const { overallPointsByPlayer, overallPointsByEvent } = await getOverallResults(tournamentId, division);
  if (!overallPointsByPlayer) {
    return;
  }

  const events = getOverallEvents(division);
  const resultsTableId = ID.RESULTS_TABLE;
  setContent(ID.TOURNAMENT_RESULTS, `<table class="results-table" id="${resultsTableId}"></table>`);
  appendContent(resultsTableId, getOverallResultsHeader(events));

  displayOverallResults(overallPointsByPlayer, overallPointsByEvent);
  $(`#${resultsTableId} th span`).on('click', sortOverallResults.bind(null, overallPointsByPlayer, overallPointsByEvent));
};

const getOverallPoints = (resultInfo, event, division) => {

  const ranks = {};
  const points = {};
  const overallPoints = {};

  resultInfo.playerIds.forEach((playerId) => {
    const rank = resultInfo.scoreData[playerId].rank;
    ranks[rank] = ranks[rank] || 0;
    ranks[rank]++;
  });

  let base;
  const rankNums = Object.keys(ranks).map((rank) => Number(rank));
  const scoringMethod = GLOBAL.tournament.scoring;
  const numPlayers = resultInfo.playerIds.length;

  if (scoringMethod === 'countdown') {
    base = getCountdownBaseByDivision(division);
  }

  if (isTeamEvent(event)) {
    const fullTeamSize = Object.keys(resultInfo.scoreData).filter((playerId) => resultInfo.scoreData[playerId].rank == 1).length;
    base += 0.5 * (fullTeamSize - 1);
  }

  rankNums.forEach((rank) => {
    let pts = 0;
    const num = ranks[rank];
    if (num > 0) {
      for (let i = 0; i < num; i++) {
	pts += Math.max((base - (Number(rank) + i - 1)), 0);
      }
      points[rank] = parseFloat((pts / num).toFixed(2));
    }
  });

  resultInfo.playerIds.forEach((playerId) => {
    const score = resultInfo.scoreData[playerId];
    overallPoints[playerId] = Math.max(points[score.rank], 0);
  });

  return overallPoints;
};

// create the results table and its header row
const getOverallResultsHeader = (events) => {
  const playerHeader = '<th id="overall-player"><span class="page-link">Player</span></th>';
  const divHeader = '<th id="overall-div"><span class="page-link">Div</span></th>';
  let html = `<tr><th id="overall-place"><span class="page-link">Place</span></th>${playerHeader}${divHeader}`;

  events.forEach((event) => {
    html += `<th id="overall-${event}"><span class="page-link">${capitalizeEvent(event)}</span></th>`;
  });
  if (events.length > 0) {
    html += '<th id="overall-total"><span class="page-link">Total</span></th></tr>';
  }

  return html;
};

// Displays overall results sorted by the given column.
const displayOverallResults = (overallPointsByPlayer, overallPointsByEvent, column = 'place') => {

  // internal compare function that uses place as secondary sort key
  const compareByDivisionThenPlace = (a, b) => {
    const result = compareByDivision(GLOBAL.playerById[a], GLOBAL.playerById[b]);
    return result !== 0 ? result : overallPointsByPlayer[b] - overallPointsByPlayer[a];
  };

  // current sort header is underlined
  $('#results-table span.current').removeClass('current');
  $(`#overall-${column} span`).addClass('current');

  const playerIds = Object.keys(overallPointsByPlayer);

  // store overall ranks
  const overallRank = {};
  let curPlace = 1;
  let curPoints = -1;

  playerIds.sort((a, b) => overallPointsByPlayer[b] - overallPointsByPlayer[a]);
  playerIds.forEach((playerId, index) => {
    const points = overallPointsByPlayer[playerId];
    if (points !== curPoints) {
      curPlace = index + 1;
    }
    overallRank[playerId] = curPlace;
    curPoints = points;
  });

  // sort players based on column
  if (column === 'place' || column === 'total') {
    playerIds.sort((a, b) => overallPointsByPlayer[b] - overallPointsByPlayer[a]);
  } else if (column === 'player') {
    playerIds.sort((a, b) => compareNames(GLOBAL.playerById[a].name, GLOBAL.playerById[b].name));
  } else if (column === 'div') {
    playerIds.sort(compareByDivisionThenPlace);
  } else {
    playerIds.sort((a, b) => (overallPointsByEvent[column][b] || 0) - (overallPointsByEvent[column][a] || 0));
  }

  if (GLOBAL.reverseSort) {
    playerIds.reverse();
  }
  GLOBAL.sortColumn = column;

  const division = getDivision();
  const events = getOverallEvents(division);
  const table = $('#results-table').get(0);

  // create a result row for each overall player
  playerIds.forEach((playerId, index) => {

    let html = '';
    const name = GLOBAL.playerById[playerId].name;
    const row = table.rows[index + 1] || table.insertRow();
    const points = overallPointsByEvent[column] ? overallPointsByEvent[column][playerId] || 0 : overallPointsByPlayer[playerId];

    html += `<td>${overallRank[playerId]}</td>`;
    html += `<td>${name}</td>`;
    html += `<td>${GLOBAL.playerById[playerId].division}</td>`;

    events.forEach((event) => {
      html += '<td>' + (overallPointsByEvent[event][playerId] || '0') + '</td>';
    });

    html += '<td>' + overallPointsByPlayer[playerId].toFixed(2) + '</td>';
    row.innerHTML = html;
  });
};

const sortOverallResults = (overallPointsByPlayer, overallPointsByEvent, ev) => {
  const id = $(ev.currentTarget).closest('th').prop('id');
  const column = id.replace('overall-', '');
  if (column) {
    if (column === GLOBAL.sortColumn) {
      GLOBAL.reverseSort = !GLOBAL.reverseSort;
    }
    displayOverallResults(overallPointsByPlayer, overallPointsByEvent, column);
  }
};

const showOverallPlaces = async (division) => {
  let resultData = await getResults({ eventId: GLOBAL.eventByName['overall'].id });
  resultData = resultData.filter((result) => divisionMatch(result.player_id, division, isTeamEvent(GLOBAL.eventById[result.event_id].name, false)));
  if (resultData.length === 0) {
    setContent(ID.TOURNAMENT_RESULTS, 'No results have been recorded yet.');
    return;
  }

  const resultInfo = getSortedResults(resultData, 'overall');
  const resultsTableId = ID.RESULTS_TABLE;

  setContent(ID.TOURNAMENT_RESULTS, `<table class="results-table" id="${resultsTableId}"></table>`);
  appendContent(resultsTableId, getOverallResultsHeader([]));
  const table = $('#results-table').get(0);

  resultInfo.playerIds.forEach((playerId, index) => {
    const player = GLOBAL.playerById[playerId];
    const row = table.rows[index + 1] || table.insertRow();
    let html = `<td>${resultInfo.scoreData[playerId].rank}</td>`;
    html += `<td>${player.name}</td>`;
    html += `<td>${player.division}</td>`;
    row.innerHTML = html;
  });
};
