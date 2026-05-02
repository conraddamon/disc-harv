const renderPlayerPage = async (tournamentId, division, playerId) => {

  $(`#${ID.HOME}`).hide();
  $(`#${ID.TOURNAMENT}`).show();
  $('#pool-select-container').hide();

  const tournamentData = await getTournament({ tournamentId });
  if (!tournamentData) {
    showError(`Failed to fetch data for tournament ${tournamentId}`);
    return;
  }
  displayTournamentInfo(tournamentData);

  await getPlayers({ tournamentId, getName: true });
  const player = GLOBAL.playerById[playerId];
  if (!player) {
    showError(`Could not find player with ID ${playerId}`);
    return;
  }
  setContent(ID.SUBTITLE, player.name);
  if (!division) {
    // default to class
    const playerDivision = player.division;
    division = isJuniorDivision(playerDivision) ? playerDivision : playerDivision.substring(0, 1);
  }

  const eventData = await getEvents({ tournamentId });
  if (!eventData) {
    showError(`Failed to fetch event data for tournament ${tournamentId}`);
    return;
  }
  await getTeamInfoByEvent(tournamentId);

  setContent(ID.PLAYER_PAGE_NAME, player.name);
  clearPageContent();

  setContent(ID.TOURNAMENT_NAV_TOP, '');
  setContent(ID.TOURNAMENT_NAV_BOTTOM, '');
  addPageLink('tournament-player', ID.TOURNAMENT_NAV_TOP, 'Tournament', () => updateQueryParams({ playerId: '' }));
  addPageLink('harv', ID.TOURNAMENT_NAV_TOP, 'HARV', () => updateQueryParams({}, true));
  addPageLink('refresh', ID.TOURNAMENT_NAV_TOP, 'Refresh', () => {
    const { id: curId, div: curDivision, playerId: curPlayerId } = parseQueryString();
    clearCacheForPage(curId, 'player');
    renderPlayerPage(curId, curDivision, curPlayerId);
  });
  addPageLink('export', ID.TOURNAMENT_NAV_TOP);

  const divsToShow = getImpliedDivisions(player.division);
  populateDivisionSelect(ID.DIVISION_SELECT, divsToShow.join(','), undefined, division, true);
  showElement('#division-select-container', divsToShow.length > 1);

  setContent(ID.TOURNAMENT_RESULTS, `<div id="${ID.PLAYER_RESULTS}"></div>`);

  await showPlayerOverallResults(tournamentId, division, playerId);
  await showPlayerEventResults(tournamentId, division, playerId);
};

const showPlayerOverallResults = async (tournamentId, division, playerId) => {
  const { overallPointsByPlayer, overallPointsByEvent } = await getOverallResults(tournamentId, division);
  if (!overallPointsByPlayer[playerId]) {
    return;
  }

  const resultsTableId = `${ID.RESULTS_TABLE}-overall`;
  appendContent(ID.PLAYER_RESULTS,
    `<div id="player-overall">
       <a class="player-event" onClick="updateQueryParams({ page: 'overall', playerId: '' });">Overall</a>
       <table class="results-table" id="${resultsTableId}"></table></div>`);
  const events = normalizeOverallEvents(Object.keys(GLOBAL.eventByName));
  appendContent(resultsTableId, getPlayerOverallResultsHeader(events));
  displayPlayerOverallResults(playerId, overallPointsByPlayer, overallPointsByEvent);
};

const getPlayerOverallResultsHeader = (events) => {
  let html = `<tr><th id="overall-place"><span class="player-header">Place</span></th>`;

  events.forEach((event) => {
    html += `<th id="player-overall-${event}"><span class="player-header">${capitalizeEvent(event)}</span></th>`;
  });
  if (events.length > 0) {
    html += '<th id="player-overall-total"><span class="player-header">Total</span></th></tr>';
  }

  return html;
};

const displayPlayerOverallResults = (playerId, overallPointsByPlayer, overallPointsByEvent) => {
  const playerIds = Object.keys(overallPointsByPlayer);

  // store overall ranks
  const overallRank = {};
  let curPlace = 1;
  let curPoints = -1;

  playerIds.sort((a, b) => overallPointsByPlayer[b] - overallPointsByPlayer[a]);
  playerIds.forEach((id, index) => {
    const points = overallPointsByPlayer[id];
    if (points !== curPoints) {
      curPlace = index + 1;
    }
    overallRank[id] = curPlace;
    curPoints = points;
  });
  
  const events = normalizeOverallEvents(Object.keys(GLOBAL.eventByName));
  const table = $(`#${ID.RESULTS_TABLE}-overall`).get(0);
  let html = '';
  const row = table.insertRow();
  const points = overallPointsByPlayer[playerId];
  
  html += `<td>${overallRank[playerId]}</td>`;
  events.forEach((event) => {
    html += '<td>' + (overallPointsByEvent[event][playerId] || '0') + '</td>';
  });
  html += '<td>' + overallPointsByPlayer[playerId].toFixed(2) + '</td>';
  row.innerHTML = html;
};

const showPlayerEventResults = async (tournamentId, division, playerId) => {

  // TODO: figure out why using resultData produces inconsistent sorted results
  const resultData = await getResults({ tournamentId, sort: 'round' });

  const events = normalizeOverallEvents(Object.keys(GLOBAL.eventByName));
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventId = getEventId(event);
    if (event === 'scf') {
      // const mtaEventId = getEventId('mta');
      // const mtaData = resultData.filter((result) => result.event_id === mtaEventId);
      // const trcEventId = getEventId('trc');
      // const trcData = resultData.filter((result) => result.event_id === trcEventId);
      const mtaData = await getEventResults(tournamentId, 'mta', division);
      const trcData = await getEventResults(tournamentId, 'trc', division);
      const { mta: mtaResults, trc: trcResults, scf: scfResults } = await getScfResults(tournamentId, division, undefined, { mta: mtaData, trc: trcData });
      displayPlayerEventResults(playerId, scfResults, event, division, { mta: mtaResults, trc: trcResults });
    } else {
      // const eventData = resultData.filter((result) => result.event_id === eventId);
      // const eventResults = await getEventResults(tournamentId, event, division, undefined, eventData);
      const eventResults = await getEventResults(tournamentId, event, division);
      console.log(eventResults.length + ' results for ' + event);
      if (isTeamEvent(event)) {
	const team = Object.values(GLOBAL.teamInfo[event]).find((t) => [t.player1, t.player2, t.player3].includes(playerId));
	if (team) {
	  playerId = team.id;
	}
      }
      displayPlayerEventResults(playerId, eventResults, event, division);
    }
  }
};

const displayPlayerEventResults = (playerId, results, event, division, otherResults) => {
  if (!results.find((result) => result.player_id === playerId)) {
    return;
  }
  const resultInfo = getSortedResults(results, event, division);
  if (!resultInfo || !resultInfo.scoreData) {
    return;
  }
  const resultsTableId = `${ID.RESULTS_TABLE}-${event}`;
  appendContent(ID.PLAYER_RESULTS,
    `<div id="player-${event}">
       <a class="player-event" onClick="updateQueryParams({ page: '${event}', playerId: '' });">${capitalizeEvent(event)}</a>
       <table class="results-table" id="${resultsTableId}"></table></div>`);
  appendContent(resultsTableId, getPlayerResultsHeader(event, division, resultInfo.scoreData[playerId]));

  const options = { useDecimal: shouldUseDecimal(event, results), showDivision: false, showName: false, isPlayerPage: true };
  addResultRows(resultsTableId, [playerId], resultInfo.scoreData, event, division, otherResults, options);
};

// Returns HTML for the player results table header
const getPlayerResultsHeader = (event, division, playerScoreData) => {
  const numRounds = getRoundsByDivision(event, division);
  const numCumulativeRounds = getRoundsByDivision(event, division, true);

  let html = `<tr><th id="result-place"><span class="player-header">Place</span></th>`;

  if (!isRankScoring(event)) {
    for (let round = 1; round <= Math.min(numRounds, playerScoreData.latest); round++) {
      if (event === 'scf') {
	html += `<th id="result-mta-round${round}"><span class="player-header">MTA</span></th>`;
	html += `<th id="result-trc-round${round}"><span class="player-header">TRC</span></th>`;
      }
      html += `<th id="result-round${round}"><span class="player-header">${getRoundName(event, round, division)}</span></th>`;
      if (round === numCumulativeRounds) {
	html += '<th id="result-total"><span class="player-header">Total</span></th>';
      }
    }
  }
  html += '</tr>';

  return html;
};
