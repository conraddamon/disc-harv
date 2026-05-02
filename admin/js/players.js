const setupPlayersPage = (tournamentId, start) => {
  if (PAGE_INITIALIZED['players']) {
    return;
  }
  $('#delete-mode-players').off('change').on('change', handlePlayerDeleteModeChange);
  setupPlayerAutocomplete(start);
  $('#add-player').off('click').on('click', () => {
    console.log('*** add player click');
    handlePlayerAdd(tournamentId);
  });
  $('#player').on('keydown', (ev) => {
    if (ev.key === 'Enter') {
      console.log('*** add player Enter');
      handlePlayerAdd(tournamentId);
    }
  });
  PAGE_INITIALIZED['players'] = true;
};

const handlePlayerDeleteModeChange = () => {
  const isDeleteMode = $('#delete-mode-players').is(':checked');
  $('#add-player').text(isDeleteMode ? 'Remove' : 'Add');
  setContent(ID.PAGE_DESCRIPTION, ADMIN_DESCRIPTION[isDeleteMode ? 'playersDelete' : 'players']);
  $('#player').focus();
};

const setupPlayerAutocomplete = async (start) => {
  const year = start.split('-')[0];
  const date = start.replace(year, String(Number(year) - AUTOCOMPLETE_RECENT_YEARS));
//  const players = await getRecentPlayers({ date });
  const players = await getPersons();
  if (players) {
    GLOBAL.autocomplete.player = players
      .map((player) => player.name)
      .filter((player) => !GLOBAL.playerByName[player])
      .sort(compareNames);
  }

  $('#player').autocomplete({
    autoFocus: true,
    source: function(request, response) {
      const isDeleteMode = $('#delete-mode-players').is(':checked');
      const names = isDeleteMode ? Object.keys(GLOBAL.playerByName) : GLOBAL.autocomplete.player;
      const matches = names.filter((name) => matchName(name, request.term));
      response(matches.slice(0, AUTOCOMPLETE_MATCHES));
    }
  });
};

// list players and teams
const showRegisteredPlayersAdmin = async (tournamentId) => {
  const division = getDivision('players');
  const pool = getPool('players');
  const containerId = ID.TOURNAMENT_PLAYERS;
  const allPlayers = await getPlayers({ tournamentId, getName: true }) || [];
  const players = allPlayers.filter((player) => divisionMatch(player.id, division, false) && poolMatch(player, pool));
  console.log('Players: ' + players.length);

  if (players.length === 0) {
    let msg = "There are no players registered in the " + getDivisionAdjective(division) + " division";
    setContent(containerId, msg);
    return;
  }

  setContent(containerId, showPlayers(players, { showIndexes: true, showDivisions: false, nameClass: '' }));

  const poolText = pool ? `, Pool ${pool}` : '';
  const numPlayers = players.length;
  const totalPlayers = allPlayers.length;
  const count = `${numPlayers} / ${totalPlayers}`;
  subtitle = `${getDivisionAdjective(division)} Players${poolText} (${count})`;
  setContent(ID.SUBTITLE, subtitle);
};

const handlePlayerAdd = async (tournamentId) => {
  const player = $('#player').val();
  if (!player) {
    return;
  }

  if ($('#delete-mode-players').is(':checked')) {
    handlePlayerDelete(tournamentId, player);
    $('#player').val('').focus();
    return;
  }

  // capitalize the entered name only if it's all lower-case
  const playerName = /[A-Z]/.test(player) ? player : capitalize(player);
  if (GLOBAL.playerByName[playerName]) {
    return showError(`${playerName} is already registered to play in this tournament`);
  }

  const division = getDivision('players');
  const pool = getPool('players');

  let isNewPlayer = false;
  let personId = GLOBAL.personByName[playerName] && GLOBAL.personByName[playerName].id;
  if (!personId) {
    const sex = isWomenDivision(division) ? 'female' : 'male';
    personId = await addPerson(playerName, sex);
    if (personId) {
      const person = { id: personId, name: playerName, sex };
      GLOBAL.personById[personId] = GLOBAL.personByName[playerName] = person;
      isNewPlayer = true;
    } else {
      return showError(`Failed to add new overall person ${playerName}`);
    }
  }

  const playerId = await addPlayer(tournamentId, personId, division, pool);
  if (!playerId) {
    return showError(`Failed to add player ${playerName}`);
  }

  let msg = `${isNewPlayer ? 'New player ' : ''} ${playerName} added to ${DIV_NAME[division]}`;
  if (pool) {
    msg += ` in pool ${pool}`;
  }
  showInfo(msg, 5);
  GLOBAL.autocomplete.player = GLOBAL.autocomplete.player.filter((person) => person !== player);
  $('#player').val('').focus();

  showRegisteredPlayersAdmin(tournamentId);
};

const handlePlayerDelete = async (tournamentId, player) => {

  const playerObj = GLOBAL.playerByName[player];
  if (!playerObj) {
    return showError(`${player} is not registered to play in this tournament`);
  }
  const playerId = playerObj && playerObj.id;
  if (playerId) {
    const result = await removePlayer(playerId);
    if (result) {
      showInfo(`Removed player ${player}`);
    } else {
      return showError(`Failed to remove player ${player}`);
    }
  }

  const idx = GLOBAL.autocomplete.player.findIndex((name) => compareNames(player, name) > 0);
  if (idx === -1) {
    GLOBAL.autocomplete.player.append(player);
  } else {
    GLOBAL.autocomplete.player.splice(idx, 0, player);
  }
  
  showRegisteredPlayersAdmin(tournamentId);
};
