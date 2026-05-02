const setupTeamsPage = (tournamentId) => {
  if (PAGE_INITIALIZED['teams']) {
    return;
  }
  const event = GLOBAL.curEvent;
  showElement('ddc-container', hasEvent('ddc'));
  showElement('freestyle-container', hasEvent('freestyle'));

  $('input[name="team-event"]').off('change').on('change', () => updateQueryParams({ event: $('input[name="team-event"]:checked').val() }));
  $('#delete-mode-teams').off('change').on('change', handleTeamDeleteModeChange);
  $('#show-all-players').off('change').on('change', () => handleShowAllPlayersChange(tournamentId));
  setupTeamAutocomplete();
  $('#add-team').off('click').on('click', () => {
    console.log('*** add team click');
    handleTeamAdd(tournamentId);
  });

  PAGE_INITIALIZED['teams'] = true;
};

const getPlayerSelectors = (event, suffix = '') => {
  const config = event === 'ddc' ? GLOBAL.tournament.ddc_team : GLOBAL.tournament.freestyle_team;
  const maxPlayers = Math.max(...config.split(',').map((num) => Number(num)));
  const selectors = [];
  for (let p = 1; p <= maxPlayers; p++) {
    selectors.push(`#player${p}${suffix}`);
  }
  return selectors.join(',');
};

const resetTeamForm = () => {
  const event = GLOBAL.curEvent;

  $(`#${event}-teams`).prop('checked', true);
  $('#player1-container,#player2-container,#player3-container').hide();
  const playerContainerSelector = getPlayerSelectors(event, '-container');
  $(playerContainerSelector).show();
  const playerSelector = getPlayerSelectors(event);
  $(playerSelector).on('keydown', (ev) => {
    if (ev.key === 'Enter') {
      console.log('*** player Enter');
      handleTeamAdd(tournamentId);
    }
  });
  $(playerSelector).val('');
  $('#player1').focus();
  $('#delete-mode-teams').prop('checked', false);
  handleTeamDeleteModeChange();
};

const handleTeamDeleteModeChange = () => {
  const event = GLOBAL.curEvent;
  const isDeleteMode = $('#delete-mode-teams').is(':checked');
  $('#player1-label').text(isDeleteMode ? 'Team:' : 'Player 1:');
  if (isDeleteMode) {
    $('#player2-container,#player3-container').hide();
  } else {
    const playerContainerSelector = getPlayerSelectors(event, '-container');
    $(playerContainerSelector).show();
  }
  $('#add-team').text(isDeleteMode ? 'Remove Team' : 'Add Team');
  setContent(ID.PAGE_DESCRIPTION, ADMIN_DESCRIPTION[isDeleteMode ? 'teamsDelete' : 'teams']);
  $('#player1').focus();
};

const handleShowAllPlayersChange = async (tournamentId) => {
  await getAvailablePlayers(tournamentId);
  showAvailablePlayers(tournamentId);
};

const setupTeamAutocomplete = async () => {
  const playerSelector = getPlayerSelectors(event);
  $(playerSelector).autocomplete({
    autoFocus: true,
    source: function(request, response) {
      const event = GLOBAL.curEvent;
      const division = getDivision('teams');
      const isDeleteMode = $('#delete-mode-teams').is(':checked');
      let names = [];
      if (isDeleteMode) {
	const teams = Object.values(GLOBAL.teamInfo[event]).filter((team) => divisionMatch(team.id, division, { scoringMode: true }));
	names = teams.map((team) => team.name);
      } else {
	const allPlayers = GLOBAL.availablePlayers[event];
	const showAllPlayers = $('#show-all-players').is(':checked');
	const players = showAllPlayers ? allPlayers : allPlayers.filter((player) => divisionMatch(player.id, division));
	names = players.map((player) => player.name);
      }
      const matches = names.filter((name) => isDeleteMode ? matchTeamName(name, request.term) : matchName(name, request.term));
      response(matches.slice(0, AUTOCOMPLETE_MATCHES));
    }
  });
};

const getAvailablePlayers = async (tournamentId) => {
  const event = GLOBAL.curEvent;
  const division = getDivision('teams');
  const allPlayers = await getPlayers({ tournamentId, getName: true }) || [];
  const showAllPlayers = $('#show-all-players').is(':checked');
  const players = showAllPlayers ? allPlayers : allPlayers.filter((player) => divisionMatch(player.id, division));
  const allTeams = Object.values(GLOBAL.teamInfo[event]);
  GLOBAL.availablePlayers[event] = players.filter((player) => !allTeams.find((team) => [team.player1, team.player2, team.player3].includes(player.id)));
};

const showAvailablePlayers = async (tournamentId) => {
  const event = GLOBAL.curEvent;
  const division = getDivision('teams');
  const containerId = ID.TOURNAMENT_AVAILABLE_PLAYERS;
  setContent(containerId, '');
  const availablePlayers = GLOBAL.availablePlayers[event];
  if (availablePlayers.length > 0) {
    const content = showPlayers(availablePlayers, { numCols: 5, showIndexes: true, showDivisions: false });
    appendContent(containerId, `<div class="header">Available Players</div>`);
    appendContent(containerId, `<div>${content}</div>`);
  }
};

const showRegisteredTeams = (tournamentId) => {
  const event = GLOBAL.curEvent;
  const division = getDivision('teams');
  const containerId = ID.TOURNAMENT_TEAMS;
  setContent(containerId, '');
  const allTeams = Object.values(GLOBAL.teamInfo[event]);
  const teams = allTeams.filter((team) => divisionMatch(team.id, division, { scoringMode: true }));
  if (teams.length > 0) {
    const content = showPlayers(teams, { numCols: 3, showIndexes: true, showDivisions: false });
    appendContent(containerId, `<div class="header">${capitalizeEvent(event)} Teams</div>`);
    appendContent(containerId, `<div>${content}</div>`);
  }

  return { allTeams: allTeams.length, numTeams: teams.length };
};

const handleTeamAdd = async (tournamentId) => {
  const event = GLOBAL.curEvent;

  const player1Name = $('#player1').val();
  const player2Name = $('#player2').val();
  const player3Name = $('#player3').val();
  const division = getDivision('teams');

  if ($('#delete-mode-teams').is(':checked')) {
    handleTeamDelete(tournamentId, player1Name);
    resetTeamForm(event);
    return;
  }

  const numPlayers = [player1Name, player2Name, player3Name].filter(Boolean).length;
  const config = event === 'ddc' ? GLOBAL.tournament.ddc_team : GLOBAL.tournament.freestyle_team;
  const allowedTeamSizes = config.split(',').map((num) => Number(num));
  if (!allowedTeamSizes.includes(numPlayers)) {
    return showError(`A team must have ${allowedTeamSizes.join(' or ')} player${allowedTeamSizes.length > 1 || allowedTeamSizes[0] > 1 ? 's' : ''}`);
  }
  
  const names = [player1Name, player2Name, player3Name];
  for (let i = 0; i < names.length; i++) {
    const playerName = names[i];
    if (playerName && !GLOBAL.playerByName[playerName]) {
      return showError(`${playerName} is not a registered player`);
    }
  }

  const player1 = GLOBAL.playerByName[player1Name];
  const player2 = GLOBAL.playerByName[player2Name];
  const player3 = GLOBAL.playerByName[player3Name];

  const teamName = getTeamName([player1Name, player2Name, player3Name]);
  const eventId = getEventId(event);
  const newTeam = { event, event_id: eventId, name: teamName, player1: player1.id, player2: player2.id, player3: player3 ? player3.id : '0' };
  let warning = '';
  if (!divisionMatch(newTeam, division, true, { scoringMode: true })) {
    warning = `NOTE: ${teamName} is not a valid team in the ${DIV_NAME[division]} division and will finish below qualifying teams with regard to overall points.`;
  }

  const teamId = await addTeam({ eventId, player1: player1.id, player2: player2.id, player3: player3 ? player3.id : '0' });
  if (!teamId) {
    return showError(`Failed to add team ${teamName}`);
  }

  showInfo(`${teamName} added to ${DIV_NAME[division]}. ${warning}`);

  const teamObj = { event, event_id: eventId, id: String(teamId), name: teamName, player1: player1.id, player2: player2.id, player3: player3 ? player3.id : '0' };
  GLOBAL.availablePlayers[event] = GLOBAL.availablePlayers[event].filter((player) => !names.includes(player.name));
  GLOBAL.teamInfo[event][teamId] = teamObj;
  GLOBAL.teamById[teamId] = teamObj;

  resetTeamForm(event);
  showAvailablePlayers(tournamentId);
  showRegisteredTeams(tournamentId);
};

const handleTeamDelete = async (tournamentId, team) => {

  const event = GLOBAL.curEvent;
  const teamObj = Object.values(GLOBAL.teamById).find((t) => t.name === team);
  if (!teamObj) {
    showError(`${team} is not a team in this tournament`);
    return;
  }
  const teamId = teamObj && teamObj.id;
  if (teamId) {
    const result = await removeTeam(teamId);
    if (result) {
      showInfo(`Removed team ${team}`);
    } else {
      showError(`Failed to remove team ${team}`);
      return;
    }
  }

  const players = [teamObj.player1, teamObj.player2, teamObj.player3].filter((playerId) => playerId !== '0').map((playerId) => GLOBAL.playerById[playerId]);
  GLOBAL.availablePlayers[event].push(...players);
  delete GLOBAL.teamInfo[event][teamObj.id];
  delete GLOBAL.teamById[teamObj.id];

  resetTeamForm();
  showAvailablePlayers(tournamentId);
  showRegisteredTeams(tournamentId);
};
