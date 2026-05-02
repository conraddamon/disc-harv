// load HARV and render based on URL
const launchHarv = () => {
  if (!isBrowserCompatible()) {
    return;
  }
  
  const { id: tournamentId, page, div, pool, playerId } = parseQueryString();

  if (playerId) {
    renderPlayerPage(tournamentId, div, playerId);
  } else if (tournamentId) {
    renderTournament(tournamentId, page, div, pool);
  } else {
    renderHome();
  }
  registerParamChangeHandler(render);
  scrollToTop();
};

// render the appropriate component when a query param changes
const render = async (oldParams, newParams) => {
  if (JSON.stringify(oldParams) === JSON.stringify(newParams)) {
    return;
  }
  hideMessage();

  if (Object.keys(newParams).length === 0) {
    renderHome();
  } else if (newParams.playerId) {
    renderPlayerPage(newParams.id, newParams.div, newParams.playerId);
  } else if (oldParams.playerId && !newParams.playerId) {
    renderTournament(newParams.id, newParams.page, newParams.div);
  } else if (newParams.id && newParams.id !== oldParams.id) {
    renderTournament(newParams.id);
  } else {
    // page, div, or pool changed on tournament page
    renderPage(newParams.id, newParams.page, newParams.div, newParams.pool);
  }
  scrollToTop();
};

// the home page lists overall tournaments
const renderHome = async () => {
  console.log('*** render home');
  clearTournamentContent();
  $(`#${ID.TOURNAMENT}`).hide();
  $(`#${ID.HOME}`).show();

  setContent(ID.PAGE_TITLE, APP_TITLE);
  setContent(ID.TITLE, APP_TITLE);
  const tournamentList = await getTournaments();
  if (tournamentList && tournamentList.length > 0) {
    setContent(ID.TOURNAMENT_LIST, '');
    let curYear;
    tournamentList.forEach(tournament => {
      if (tournament.name.length > 0) {
	const year = tournament.start.split('-')[0];
	appendContent(ID.TOURNAMENT_LIST, getTournamentHtml(tournament, curYear && year !== curYear));
	curYear = year;
      }
    });
  } else {
    setContent(ID.TOURNAMENT_LIST, 'Loading tournaments ...');
  }
};

// renders the tournament header then calls renderPage()
const renderTournament = async (tournamentId, page = DEFAULT_PAGE, division, pool) => {
  console.log('*** render tournament ' + tournamentId);

  division = division || getDefaultDivision(page);

  $(`#${ID.HOME}`).hide();
  clearTournamentContent();
  $(`#${ID.TOURNAMENT}`).show();

  const tournamentData = await getTournament({ tournamentId });
  if (!tournamentData) {
    showError(`Failed to fetch data for tournament ${tournamentId}`);
    return;
  }
  displayTournamentInfo(tournamentData);

  await getPlayers({ tournamentId, getName: true });

  const eventData = await getEvents({ tournamentId });
  if (!eventData) {
    showError(`Failed to fetch event data for tournament ${tournamentId}`);
    return;
  }
  setContent(ID.TOURNAMENT_NAV_TOP, '');
  setContent(ID.TOURNAMENT_NAV_BOTTOM, '');

  // top nav bar
  addPageLink('players', ID.TOURNAMENT_NAV_TOP);
  addPageLink('overall', ID.TOURNAMENT_NAV_TOP);
  addPageLink('harv', ID.TOURNAMENT_NAV_TOP, 'HARV', () => updateQueryParams({}, true));
  addPageLink('refresh', ID.TOURNAMENT_NAV_TOP, 'Refresh', () => {
    const { id: curId, page: curPage, div: curDivision, pool: curPool } = parseQueryString();
    clearCacheForPage(curId, curPage);
    renderPage(curId, curPage, curDivision, curPool);
  });
  // addPageLink('export', ID.TOURNAMENT_NAV_TOP);

  // bottom nav bar
  eventData.forEach((eventObj) => {
    const skip = eventObj.name === 'overall' || (['mta', 'trc'].includes(eventObj.name) && hasEvent('scf'));
    if (!skip) {
      const eventName = eventObj.name.length > 3 ? undefined : eventObj.name.toUpperCase();
      addPageLink(eventObj.name, ID.TOURNAMENT_NAV_BOTTOM, eventName)
    }
  });

  renderPage(tournamentId, page, division, pool);
};

// renders content for the given page
const renderPage = async (tournamentId, page = DEFAULT_PAGE, division, pool) => {
  console.log('*** render page ' + page);

  GLOBAL.curPage = page;
  GLOBAL.sortColumn = '';
  GLOBAL.reverseSort = false;
  division = division || getDefaultDivision(page);

  $('.page-link').removeClass('current');
  $(`#${page}`).addClass('current');
  let divisions = GLOBAL.tournament.divisions.split(',');
  if (GLOBAL.tournament.age_divisions === '1') {
    // expand to include age divisions
    if (divisions.includes('O')) {
      divisions = [...divisions, ...DIV_LIST['O']];
    }
    if (divisions.includes('W')) {
      divisions = [...divisions, ...DIV_LIST['W']];
    }
  }
//  populateDivisionSelect(ID.DIVISION_SELECT, uniquify(divisions), page, division, page === 'overall' || isTeamEvent(page));
  populateDivisionSelect(ID.DIVISION_SELECT, uniquify(divisions), page, division, page !== 'players');

  if (GLOBAL.tournament.pools && !['ddc', 'freestyle', 'overall'].includes(page)) {
    $(`#${ID.POOL_SELECT_CONTAINER}`).show();
    $(`#${ID.POOL_SELECT}`).val(pool);
    populatePoolSelect(ID.POOL_SELECT, GLOBAL.tournament.pools, page, pool);
  } else {
    $(`#${ID.POOL_SELECT_CONTAINER}`).hide();
  }

  let numPlayers = 0;
  let subtitle = `${DIV_NAME[division]} ${capitalizeEvent(page)}`;

  clearPageContent();

  if (['players', 'ddc', 'freestyle', 'overall'].includes(page)) {
    await getTeamInfoByEvent(tournamentId);
  }

  switch (page) {
    case 'players': {
      const { allPlayers, numPlayers } = await showRegisteredPlayers(tournamentId);
      const poolText = pool ? `, Pool ${pool}` : '';
      const count = division === 'ALL' ? numPlayers : `${numPlayers} / ${allPlayers}`;
      subtitle = `${getDivisionAdjective(division)} Players${poolText} (${count})`;
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
      showEventResults(tournamentId, page);
      break;
    }
    case 'scf': {
      showScfResults(tournamentId);
      break;
    }

    case 'overall': {
      showOverallResults(tournamentId);
      break;
    }

    default: {
      console.log('Error: Unknown page ' + page);
    }
  }

  setContent(ID.SUBTITLE, subtitle);
};

// list players and teams
const showRegisteredPlayers = async (tournamentId) => {

  const division = getDivision();
  const pool = getPool();
  const containerId = ID.TOURNAMENT_PLAYERS;
  const allPlayers = await getPlayers({ tournamentId, getName: true, force: true }) || [];
  let players = allPlayers.filter((player) => divisionMatch(player.id, division, false));
  players = players.filter((player) => poolMatch(player, pool));
  console.log('Players: ' + players.length);

  if (players.length === 0) {
    let msg = "There are no players registered in the " + getDivisionAdjective(division) + " division";
    if (pool && pool !== 'ALL') {
      msg += " and in the " + pool + " pool";
    }
    setContent(containerId, msg);
    return { allPlayers: 0, numPlayers: 0 };
  }

  const handlePlayerClick = (ev) => {
    const playerId = $(ev.currentTarget).closest('[data-id]').data('id');
    if (playerId) {
      updateQueryParams({ playerId });
    }
  };
  
  setContent(containerId, showPlayers(players, { showIndexes: true, showDivisions: false }));
  $('.player-list-table .player-name').on('click', handlePlayerClick);

  TEAM_EVENTS.forEach(event => {
    const allTeams = Object.values(GLOBAL.teamInfo[event]);
    const teams = allTeams.filter((team) => divisionMatch(team.id, division, true));
    if (teams.length > 0) {
      const content = showPlayers(teams, { numCols: 3, showIndexes: true, showDivisions: false, nameClass: 'team-name' });
      appendContent(containerId, `<div class="header">${capitalizeEvent(event)} Teams</div>`);
      appendContent(containerId, `<div>${content}</div>`);
    }
  });

  return { allPlayers: allPlayers.length, numPlayers: players.length };
};

// fetch and display results for an event
const showEventResults = async (tournamentId, event) => {
  const division = getDivision();
  const pool = getPool();
  let results = await getEventResults(tournamentId, event, division, pool) || [];

  // HACK for 2026 VA states
//  results = results.filter((result) => !(division === 'O' && result.player_id === '1510'));

  results = results
    .map((result) => {
      const teamEvent = isTeamEvent(GLOBAL.eventById[result.event_id].name);
      result.nonQualified = isTeamEvent && !divisionMatch(result.player_id, division, teamEvent, { scoringMode: true, looseMatching: isVirginiaStates() });
      return result;
    });

  if (results.length > 0) {
    console.log(results.length + ' results for ' + event + ' in showEventResults');
    displayResults(results, event, division);
  } else {
    setContent(ID.TOURNAMENT_RESULTS, 'No results have been recorded yet.');
  }
};

const getScfResults = async (tournamentId, division, pool, scfData) => {
  scfData = scfData || {};
  const getScfResults = async (event) => {
    const eventId = getEventId(event);
    const resultData = scfData[event] ? scfData[event] : await getResults({ event, eventId, sort: 'round' });
    return resultData ? filterResultsByDivision(resultData, division, false, false) : [];
  };

  const mtaResults = await getScfResults('mta');
  const trcResults = await getScfResults('trc');
  const scfResults =  getScfData(mtaResults, trcResults);

  return { mta: mtaResults, trc: trcResults, scf: scfResults };
};

// fetch and display results for SCF
const showScfResults = async (tournamentId) => {
  const division = getDivision();
  const pool = getPool();
  const { mta: mtaResults, trc: trcResults, scf: scfResults } = await getScfResults(tournamentId, division, pool);
  if (scfResults.length > 0) {
    displayResults(scfResults, 'scf', division, undefined, { mta: mtaResults, trc: trcResults });
  } else {
    setContent(ID.TOURNAMENT_RESULTS, 'No results have been recorded yet.');
  }
};
