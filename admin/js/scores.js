const setupScoresPage = (tournamentId) => {
  if (PAGE_INITIALIZED['scores']) {
    return;
  }
  const event = GLOBAL.curEvent;

  $('#delete-mode-scores').off('change').on('change', handleScoreDeleteModeChange);
  $('#add-playoff').off('click').on('click', () => addPlayoff(tournamentId));

  // events nav bar
  const events = Object.keys(GLOBAL.eventByName);
  events.forEach((eventName) => {
    if (eventName !== 'scf') {
      addPageLink(eventName, ID.TOURNAMENT_NAV_EVENTS, capitalizeEvent(eventName), () => updateQueryParams({ event: eventName }));
    }
  });
  $('#add-score').off('click').on('click', () => addScore(tournamentId, event));
  $('#admin-score-value').on('keydown', (ev) => {
    if (ev.key === 'Enter') {
      console.log('*** add score Enter');
      addScore(tournamentId, event);
    }
  });

  PAGE_INITIALIZED['scores'] = true;
};

const resetScoresPage = (tournamentId) => {
  const event = GLOBAL.curEvent;
  const division = GLOBAL.curDivision;
  const round = GLOBAL.curRound;

  const numRounds = getRoundsByDivision(event, division);
  const hasPlayoff = GLOBAL.eventByName[event] && GLOBAL.eventByName[event].has_playoff && GLOBAL.eventByName[event].has_playoff.split(',').includes(division);
  if (round > numRounds && !hasPlayoff) {
    return navigateTo('', { id: tournamentId, page: 'scores', div: division, event, round: numRounds });
  }
  
  populateRoundSelect(event, division, round);
  $('#round-select').val(round);
  $('#tournament-nav-events .page-link').removeClass('current');
  $(`#${event}`).addClass('current');
  
  const showPools = !!GLOBAL.tournament.pools && round === 1 && !isTeamEvent(event);
  showElement('#pool-select-scores-container', showPools);
  const pool = showPools ? getPool('scores') : '';
  const poolText = pool ? `, Pool ${pool}` : '';
  $('#admin-score-player').focus();

  return `Scores for ${DIV_NAME[division]} ${capitalizeEvent(event)} ${getRoundName(event, round, division)}${poolText}`;
};

const handleScoreDeleteModeChange = () => {
  const isDeleteMode = $('#delete-mode-scores').is(':checked');
  $('#add-score').text(isDeleteMode ? 'Remove Score' : 'Add Score');
  setContent(ID.PAGE_DESCRIPTION, ADMIN_DESCRIPTION[isDeleteMode ? 'scoresDelete' : 'scores']);
  $('#admin-score-value').prop('disabled', isDeleteMode);
  $('#admin-score-player').focus();
};

const setupScoreAutocomplete = async () => {
  const event = GLOBAL.curEvent;
  $('#admin-score-player').autocomplete({
    autoFocus: true,
    source: function(request, response) {
      const isDeleteMode = $('#delete-mode-scores').is(':checked');
      const names = isDeleteMode ? GLOBAL.autocomplete.result : GLOBAL.autocomplete.score;
      const matches = names.filter((name) => isTeamEvent(event) ? matchTeamName(name, request.term) : matchName(name, request.term));
      response(matches.slice(0, AUTOCOMPLETE_MATCHES));
    }
  });
};

const getFilteredEventResults = async (tournamentId) => {
  const event = GLOBAL.curEvent;
  const division = getDivision('scores');
  const round = getRound();
  const pool = round === 1 ? getPool('scores') : '';
  const results = await getEventResults(tournamentId, event, division, pool, undefined);

  // last round: check for ties for podium (up to third place)
  let showPlayoff = false;
  const alreadyHasPlayoff = GLOBAL.eventByName[event] && GLOBAL.eventByName[event].has_playoff && GLOBAL.eventByName[event].has_playoff.split(',').includes(division);
  if (!alreadyHasPlayoff && Number(round) === getRoundsByDivision(event, division)) {
    const resultInfo = getSortedResults(results, event, division);
    for (let rank = 1; rank <= 3; rank++) {
      const rankNum = resultInfo.playerIds.filter((playerId) => resultInfo.scoreData[playerId].rank === rank).length;
      if (rankNum > 1) {
	console.log('Found a tie at rank ' + rank);
	showPlayoff = true;
      }
    }
  }
  showElement('#add-playoff-container', showPlayoff);
  
  const eventResults = results.filter((result) => Number(result.round) === round);

  // set up autocomplete for adding scores
  if (isTeamEvent(event)) {
    GLOBAL.autocomplete.score = Object.values(GLOBAL.teamInfo[event])
      .filter((teamObj) => teamObj && !eventResults.find((result) => result.player_id === teamObj.id) && divisionMatch(teamObj.id, division, true))
      .map((teamObj) => teamObj.name)
      .sort(compareNames);
  } else {
    GLOBAL.autocomplete.score = Object.keys(GLOBAL.playerByName)
      .filter((player) => {
	const playerObj = GLOBAL.playerByName[player];
	return playerObj && !eventResults.find((result) => result.player_id === playerObj.id) && divisionMatch(playerObj.id, division, false) && poolMatch(playerObj, pool);
      })
      .sort(compareNames);
  }
  
  // set up autocomplete for removing scores
  GLOBAL.autocomplete.result = eventResults
    .map((result) => {
      let playerObj = GLOBAL.playerById[result.player_id];
      if (isTeamEvent(event)) {
	playerObj = Object.values(GLOBAL.teamInfo[event]).find((teamObj) => teamObj.id === result.player_id);
      }
      return playerObj && playerObj.name;
    })
    .filter(Boolean)
    .sort(compareNames);

  return eventResults;
};

const showAdminEventResults = async (tournamentId) => {
  const event = GLOBAL.curEvent;
  const division = getDivision('scores');
  const round = getRound();
  const eventResults = await getFilteredEventResults(tournamentId);
  displayResults(eventResults, event, division, undefined, undefined, { noHeaders: true, round });
};

const addScore = async (tournamentId) => {
  const event = GLOBAL.curEvent;
  const division = getDivision('scores');
  const round = getRound();

  const player = $('#admin-score-player').val();
  if ($('#delete-mode-scores').is(':checked')) {
    handleScoreDelete(tournamentId, player);
    $('#admin-score-player').val('').focus();
    return;
  }
  
  let score = $('#admin-score-value').val();
  if (!player || !score) {
    return;
  }
  if (score === 'SCR') {
    score = '-2';
  } else if (score === 'DNF') {
    score = '-1';
  }

  let playerObj = GLOBAL.playerByName[player];
  if (isTeamEvent(event)) {
    playerObj = Object.values(GLOBAL.teamInfo[event]).find((teamObj) => teamObj.name === player);
  }
  const playerId = playerObj && playerObj.id;
  if (!playerId) {
    return showError(`Unknown player ${player}`);
  }
  const eventId = GLOBAL.eventByName[event].id;
  const result = await addResult(eventId, playerId, round, score);
  if (result) {
    showInfo(`Added score ${score} for ${player} in ${getRoundName(event, round, division)} of ${capitalizeEvent(event)}`);
    $('#admin-score-player').val('').focus();
    $('#admin-score-value').val('');
  } else {
    showError(`Failed to add score for ${player}`);
  }

  showAdminEventResults(tournamentId);
};

const handleScoreDelete = async (tournamentId, player) => {
  const event = GLOBAL.curEvent;
  let playerObj = GLOBAL.playerByName[player];
  if (isTeamEvent(event)) {
    playerObj = Object.values(GLOBAL.teamInfo[event]).find((teamObj) => teamObj.name === player);
  }
  const eventResults = await getFilteredEventResults(tournamentId, event);
  const resultObj = eventResults.find((result) => playerObj && result.player_id === playerObj.id);
  if (!playerObj || !resultObj) {
    return showError(`Could not find score for ${player}`);
  }
  const result = await removeResult(resultObj.id);
  if (result) {
    const useDecimal = shouldUseDecimal(event, eventResults);
    showInfo(`Removed score ${formatScore(resultObj.score, event, { useDecimal })} for ${player}`);
  } else {
    return showError(`Failed to remove score ${resultObj.score} for ${player}`);
  }

  showAdminEventResults(tournamentId);
};

const addPlayoff = async (tournamentId) => {
  const event = GLOBAL.curEvent;
  const division = GLOBAL.curDivision;
  const curValue = GLOBAL.eventByName[event].has_playoff;
  const divs = curValue ? curValue.split(',') : [];
  divs.push(division);
  const newValue = quote(divs.join(','));
  const result = await updateEvent(GLOBAL.eventByName[event].id, [`has_playoff=${newValue}`]);
  showInfo(`Playoff round added for ${DIV_NAME[division]} ${capitalizeEvent(event)}`);
  $('#add-playoff-container').hide();
  navigateTo('', { id: tournamentId, page: 'scores', div: division, event, round: GLOBAL.curRound + 1 });
};
