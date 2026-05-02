// load HARV and render based on URL
const launchHarvAdmin = () => {
  if (!isBrowserCompatible()) {
    return;
  }
  
  const { id: tournamentId, page, div, event, pool, round } = parseQueryString();

  if (tournamentId) {
    renderTournament(tournamentId, page, div, event, pool, round);
  } else if (page === 'setup' && !tournamentId) {
    renderNewTournament();
  } else {
    renderHome();
  }
  registerParamChangeHandler(render);
  scrollToTop();
};

// render the appropriate component when a query param changes
const render = async (oldParams, newParams) => {
  console.log('*** render');
  if (JSON.stringify(oldParams) === JSON.stringify(newParams)) {
    return;
  }
  hideMessage();

  if (Object.keys(newParams).length === 0) {
    renderHome();
  } else if (newParams.id && newParams.id !== oldParams.id) {
    renderTournament(newParams.id);
  } else if (newParams.page === 'setup' && !newParams.id) {
    renderNewTournament();
  } else {
    // page, div, event, pool, or round changed on tournament admin page
    renderPage(newParams.id, newParams.page, newParams.div, newParams.event, newParams.pool, newParams.round);
  }
  scrollToTop();
}

// the home page lists overall tournaments
const renderHome = async () => {
  console.log('*** admin: render home');
  clearTournamentContent();
  clearGlobals();
  $(`#${ID.TOURNAMENT}`).hide();
  $(`#${ID.HOME}`).show();

  setContent(ID.PAGE_TITLE, ADMIN_APP_TITLE);
  setContent(ID.TITLE, ADMIN_APP_TITLE);
  const tournamentList = await getTournaments();
  if (tournamentList && tournamentList.length > 0) {
    setContent(ID.TOURNAMENT_LIST, '');
    tournamentList.forEach(tournament => {
      if (tournament.name.length > 0) {
	appendContent(ID.TOURNAMENT_LIST, getTournamentHtml(tournament));
      }
    });
  } else {
    setContent(ID.TOURNAMENT_LIST, 'Loading tournaments ...');
  }

  $(`#${ID.NEW_TOURNAMENT}`).on('click', () => updateQueryParams({ page: 'setup' }));
};

const renderNewTournament = () => {
  console.log('*** admin: render new tournament');

  clearGlobals();
  $(`#${ID.HOME}`).hide();
  $(`#${ID.TOURNAMENT}`).show();
  setContent(ID.TOURNAMENT_TITLE, '');
  setContent(ID.TOURNAMENT_INFO, '');
  setContent(ID.TOURNAMENT_NAV_TOP, '');
  setContent(ID.TOURNAMENT_NAV_BOTTOM, '');

  addPageLink('harv', ID.TOURNAMENT_NAV_TOP, 'HARV', () => updateQueryParams({}, true));

  renderPage(undefined, 'setup');
};

// renders the tournament header then calls renderPage()
const renderTournament = async (tournamentId, page = DEFAULT_PAGE, division, event, pool, round) => {
  console.log('*** admin: render tournament ' + tournamentId);
  const tournamentData = await getTournament({ tournamentId });
  if (!tournamentData) {
    return showError(`Failed to fetch data for tournament ${tournamentId}`);
  }

  // tournament pages require auth
  const token = await getToken(tournamentId);
  const authCookie = await getCookie('auth');
  const userToken = decodeURIComponent(authCookie);
  if (userToken !== token) {
    const pw = prompt(`Enter password for ${tournamentData.name}`);
    const pwHash = await getPasswordHash(pw);
    if (pwHash === tournamentData.password || pwHash === ADMIN_PW) {
      await cookieStore.set('auth', token);
    } else {
      alert('Wrong password');
      navigateTo(ADMIN_HOME);
    }
  }

  $(`#${ID.HOME}`).hide();
  $(`#${ID.TOURNAMENT}`).show();

  displayTournamentInfo(tournamentData);

  // get event, player, and team data
  const eventData = await getEvents({ tournamentId });
  await getPlayers({ tournamentId, getName: true });
  await getTeamInfoByEvent(tournamentId);

  setContent(ID.TOURNAMENT_NAV_TOP, '');
  setContent(ID.TOURNAMENT_NAV_BOTTOM, '');

  // top nav bar
  addPageLink('admin-tournament', ID.TOURNAMENT_NAV_TOP, 'Tournament', () => navigateTo(HARV_HOME, { id: tournamentId }));
  addPageLink('harv', ID.TOURNAMENT_NAV_TOP, 'HARV', () => updateQueryParams({}, true));

  // bottom nav bar
  addPageLink('setup', ID.TOURNAMENT_NAV_BOTTOM, undefined, () => updateQueryParams({ id: tournamentId, page: 'setup' }, true));
  addPageLink('players', ID.TOURNAMENT_NAV_BOTTOM, undefined, () => updateQueryParams({ id: tournamentId, page: 'players', div: division }, true));
  if (hasEvent('ddc') || hasEvent('freestyle')) {
    const params = { id: tournamentId, page: 'teams', div: division };
    if (isTeamEvent(event)) {
      params.event = event;
    }
    addPageLink('teams', ID.TOURNAMENT_NAV_BOTTOM, undefined, () => updateQueryParams(params, true));
  }
  addPageLink('scores', ID.TOURNAMENT_NAV_BOTTOM, undefined, () => updateQueryParams({ id: tournamentId, page: 'scores', div: division }, true));

  renderPage(tournamentId, page, division, event, pool, round);
};

// renders content for the given admin page
const renderPage = async (tournamentId, page = DEFAULT_ADMIN_PAGE, division = 'O', event, pool, round) => {
  console.log('*** render admin page ' + page);

  GLOBAL.curPage = page;

  $(`#${ID.TOURNAMENT_NAV_BOTTOM} .page-link`).removeClass('current');
  $(`#${page}`).addClass('current');
  setContent(ID.PAGE_DESCRIPTION, ADMIN_DESCRIPTION[page] || '');

  if (page !== 'setup') {
    let divisions = GLOBAL.tournament.divisions.split(',');
    if (page === 'players' && GLOBAL.tournament.age_divisions === '1') {
      // expand to include age divisions
      if (divisions.includes('O')) {
	divisions = [...divisions, ...DIV_LIST['O']];
      }
      if (divisions.includes('W')) {
	divisions = [...divisions, ...DIV_LIST['W']];
      }
    }
    populateDivisionSelect(`division-select-${page}`, uniquify(divisions), page, division, true);

    const poolSelectId = `pool-select-${page}`;
    if (GLOBAL.tournament.pools && (page === 'players' || (page === 'scores' && !['ddc', 'freestyle'].includes(event)))) {
      populatePoolSelect(poolSelectId, GLOBAL.tournament.pools, page, pool, true);
      $(`#${poolSelectId}-container`).show();
      if (page === 'players') {
	setContent(ID.PAGE_DESCRIPTION, ADMIN_DESCRIPTION['playersWithPool']);
      }
    } else {
      $(`#${poolSelectId}-container`).hide();
    }

    $(`#delete-mode-${page}`).prop('checked', false);
  }

  showElement(`#${ID.TOURNAMENT_NAV_EVENTS}`, page === 'scores');
  showElement(`#${ID.ROUND_SELECT_CONTAINER}`, page === 'scores');

  let subtitle = `${DIV_NAME[division]} ${capitalizeEvent(page)}`;
  let numPlayers = 0;

  clearAdminTournamentContent();
  ADMIN_PAGES.forEach((adminPage) => $(`#admin-${adminPage}`).hide());
  $(`#admin-${page}`).show();

  switch (page) {
    case 'setup': {
      subtitle = capitalizeEvent(page);
      showTournamentForm(tournamentId);
      break;
    }

    case 'players': {
      setupPlayersPage(tournamentId, GLOBAL.tournament.start);
      await showRegisteredPlayersAdmin(tournamentId);
      $('#player').focus();
      subtitle = '';
      break;
    }

    case 'teams': {
      if (!isTeamEvent(event)) {
	event = hasEvent('ddc') ? 'ddc' : 'freestyle';
      }
      GLOBAL.curEvent = event;
      setupTeamsPage(tournamentId);
      resetTeamForm();
      await getAvailablePlayers(tournamentId);
      showAvailablePlayers(tournamentId);
      const { allTeams, numTeams } = await showRegisteredTeams(tournamentId);
      const count = `${numTeams} / ${allTeams}`;
      subtitle = `${getDivisionAdjective(division)} ${capitalizeEvent(event)} Teams (${count})`;
      break;
    }

    case 'scores': {
      if (!event) {
	const events = Object.keys(GLOBAL.eventByName);
	event = events[0];
      }
      round = Number(round || 1);

      GLOBAL.curEvent = event;
      GLOBAL.curDivision = division;
      GLOBAL.curRound = round;

      setupScoresPage(tournamentId);
      setupScoreAutocomplete();
      subtitle = resetScoresPage(tournamentId);
      showAdminEventResults(tournamentId);
      break;
    }

    default: {
      console.log('Error: Unknown page ' + page);
    }
  }

  if (subtitle) {
    setContent(ID.SUBTITLE, subtitle);
  }
};
