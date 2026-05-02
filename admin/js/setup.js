const showTournamentForm = async (tournamentId) => {
  const pwHash = await getPasswordHash('testing');
  console.log('*** hash: ' + pwHash);
  const token = await getToken(tournamentId);
  console.log('*** token: ' + token);
  
  $('#name, #location, #start, #end').on('change', handleTournamentInfoChange);
  $('#scf,#mta,#trc').on('change', handleScfChange);
  let divisions;
  let tournamentData;
  if (tournamentId) {
    tournamentData = await getTournament({ tournamentId });
    if (!tournamentData) {
      showError(`Failed to fetch data for tournament ${tournamentId}`);
      return;
    }
    divisions = tournamentData.divisions.split(',');
  }
  renderEventsTable(divisions);
  renderScoringTable(divisions);
  let eventData;
  if (tournamentId) {
    eventData = await getEvents({ tournamentId });
    handleScfChange();
  }
  loadTournament(tournamentData, eventData);
  $('input[name="divisions"]').change(() => {
    renderEventsTable();
    renderScoringTable();
  });
  $('#save-tournament-button').on('click', saveTournament.bind(null, tournamentId));
};

const renderEventsTable = (divisions) => {
  divisions = divisions || (Array.from($('input[name="divisions"]:checked'))).map((cb) => cb.value);
  const rows = $('#admin-setup-events .admin-setup-row');
  const header = rows.first();
  header.children().slice(2, -1).hide();
  divisions.forEach((division) => {
    $(`#header-rounds-${division}`).show();
    $(`#header-cumulative-rounds-${division}`).show();
  });
  
  EVENT_ORDER.forEach((event) => {
    const row = $(`#admin-setup-event-${event}`);
    row.children().slice(2, -1).hide();
    divisions.forEach((division) => {
      $(`#${event}-rounds-${division}`).parent().show();
      $(`#${event}-cumulative-rounds-${division}`).parent().show();
    });
  });
};

const renderScoringTable = (divisions) => {
  divisions = divisions || (Array.from($('input[name="divisions"]:checked'))).map((cb) => cb.value);
  const headerRow = $('#admin-setup-scoring-base-header');
  headerRow.children().slice(1).hide();
  divisions.forEach((division) => $(`#header-scoring-base-${division}`).show());

  const scoringBaseRow = $('#admin-setup-scoring-base');
  scoringBaseRow.children().slice(1).hide();
  divisions.forEach((division) => $(`#scoring-base-${division}`).parent().show());
};

const handleTournamentInfoChange = () => {
  const info = {
    name: $('#name').val(),
    location: $('#location').val(),
    start: $('#start').val(),
    end: $('#end').val(),
  };
  displayTournamentInfo(info);
};

// A tournament with SCF does not need to offer MTA and TRC. Conversely, one with MTA or TRC does
// not separately offer SCF.
const handleScfChange = (ev) => {
  if ($('#scf').is(':checked')) {
    $('#admin-setup-event-mta,#admin-setup-event-trc').hide();
    $('#mta,#trc').prop('checked', false);
  } else {
    $('#admin-setup-event-mta,#admin-setup-event-trc').show();
  }

  if (ev && $('#mta').is(':checked') || $('#trc').is(':checked')) {
    $('#admin-setup-event-scf').hide();
    $('#scf').prop('checked', false);
  } else {
    $('#admin-setup-event-scf').show();
  }
};

// Takes an encoded value and returns an object with values for each division. Missing divisions are ignored.
// "3;W:2;OJ:1" => { O: '3', W: '2', OJ: '1', WJ: '3' }
// "O:50;W:20" => { O: '50', W: '20 }
const decodeDatabaseValue = (dbValue, divisions) => {
  const result = {};
  if (!dbValue) {
    return result;
  }
  if (!dbValue.includes(':')) {
    divisions.forEach((div) => result[div] = dbValue);
    return result;
  }

  const divValues = dbValue.split(';');
  const dbDefaultValue = divValues.find((divValue) => !divValue.includes(':'));
  divValues.forEach((divValue) => {
    if (divValue.includes(':')) {
      const [div, value] = divValue.split(':');
      if (divisions.includes(div)) {
	result[div] = value;
      }
    }
  });
  divisions.forEach((div) => result[div] = result[div] || dbDefaultValue || '');

  return result;
};

// Encodes a set of values per division. For example, { O: '3', W: '2', OJ: '1', WJ: '3' } becomes "O:3;W:2;OJ:1;WJ:3".
const encodeDatabaseValue = (valuesByDivision) => Object.entries(valuesByDivision).map((entry) => entry.join(':')).join(';');

// converts tournament data into web format for the setup form
const databaseToForm = (tournamentData, eventData) => {

  const divisions = tournamentData.divisions.split(',');

  const formData = {
    'name': tournamentData.name,
    'location': tournamentData.location,
    'start': tournamentData.start,
    'end': tournamentData.end,
    'td_name': tournamentData.td_name,
    'td_email': tournamentData.td_email,
    'password': '',
    'url': tournamentData.url,
    'note': tournamentData.note,
    'divisions': divisions,
    'age_divisions': tournamentData.age_divisions === '1',
    'pools': tournamentData.pools,
    'ddc_team': tournamentData.ddc_team || '2',
    'freestyle_team': tournamentData.freestyle_team ? tournamentData.freestyle_team.split(',') : ['2'],
    'min_events': tournamentData.min_events,
  };

  (eventData || []).forEach((eventObj) => {
    const event = eventObj.name;
    formData[event] = true;
    const rounds = decodeDatabaseValue(eventObj.rounds, divisions);
    const cumulativeRounds = decodeDatabaseValue(eventObj.cumulative_rounds, divisions);
    divisions.forEach((div) => {
      formData[`${event}-rounds-${div}`] = !rounds[div] || rounds[div] === '0' ? '' : rounds[div];
      formData[`${event}-cumulative-rounds-${div}`] = !cumulativeRounds[div] || cumulativeRounds[div] === '0' ? '' :cumulativeRounds[div];
    });
  });

  const scoringBase = decodeDatabaseValue(tournamentData.countdown_base, divisions);
  divisions.forEach((div) => {
    formData[`scoring-base-${div}`] = scoringBase[div];
  });

  return formData;
};

// creates an empty form for adding a new tournament
const clearForm = () => {

  const formData = {
    'name': '',
    'location': '',
    'start': '',
    'end': '',
    'td_name': '',
    'td_email': '',
    'password': '',
    'url': '',
    'note': '',
    'divisions': DEFAULT_DIVISIONS.join(','),
    'age_divisions': false,
    'pools': '',
    'ddc_team': '2',
    'freestyle_team': ['2'],
    'min_events': '',
  };

  EVENT_ORDER.forEach((event) => {
    formData[event] = false;
    DIV_ORDER.forEach((div) => {
      formData[`${event}-rounds-${div}`] = '';
      formData[`${event}-cumulative-rounds-${div}`] = '';
    });
  });

  DIV_ORDER.forEach((div) => {
    formData[`scoring-base-${div}`] = '';
  });

  return formData;
};

const getEncodedDivisionalValues = (idBase, divisions) => {
  const values = {};
  divisions.forEach((division) => {
    const value = $(`#${idBase}-${division}`).val();
    if (value) {
      values[division] = value;
    }
  });
  return encodeDatabaseValue(values);
};

const formToDatabase = async () => {

  const divisions = $('input[name="divisions"]:checked').map(function() { return $(this).val() }).get();

  const tournamentData = {
    age_divisions: $('#age_divisions').is(':checked') ? '1' : '0',
    countdown_base: getEncodedDivisionalValues('scoring-base', divisions),
    ddc_team: $('input[name="ddc_team"]:checked').val(),
    divisions: divisions.join(','),
    end: $('#end').val(),
    freestyle_team: $('input[name="freestyle_team"]:checked').map(function() { return $(this).val() }).get().join(','),
    location: $('#location').val(),
    min_events: $('#min_events').val(),
    name: $('#name').val(),
    note: $('#note').val(),
    pools: $('#pools').val(),
    start: $('#start').val(),
    td_email: $('#td_email').val(),
    td_name: $('#td_name').val(),
    url: $('#url').val(),
  };

  const pw = $('#password').val();
  if (pw) {
    const pwHash = await getPasswordHash(pw);
    tournamentData.password = pwHash;
  }

  const eventData = EVENT_ORDER
    .filter((event) => $(`#${event}`).is(':checked'))
    .map((event) => ({
      name: event,
      rounds: getEncodedDivisionalValues(`${event}-rounds`, divisions),
      cumulative_rounds: getEncodedDivisionalValues(`${event}-cumulative-rounds`, divisions),
    }));

  return { tournamentData, eventData };
};

const loadTournament = (tournamentData, eventData) => {
  console.log('Load tournament ' + (tournamentData && tournamentData.id));
  const formData = tournamentData ? databaseToForm(tournamentData, eventData) : clearForm();
  Object.keys(formData).forEach((field) => {
    if (field === 'divisions') {
      $('input[name="divisions"]').each(function() {
	$(this).prop('checked', formData.divisions.includes($(this).val()));
      });
    } else if (field === 'age_divisions') {
      $('#age_divisions').prop('checked', formData['age_divisions']);
    } else if (field === 'ddc_team') {
      $('input[name="ddc_team"]').each(function() {
	$(this).prop('checked', formData['ddc_team'] === $(this).val());
      });
    } else if (field === 'freestyle_team') {
      $('input[name="freestyle_team"]').each(function() {
	$(this).prop('checked', formData['freestyle_team'].includes($(this).val()));
      });
    } else if (EVENT_ORDER.includes(field)) {
      $(`#${field}`).prop('checked', formData[field]);
    } else {
      const el = $(`#${field}`);
      if (el) {
	el.val(formData[field] || '');
      }
    }
  });
};

const getDatabaseValue = (key, value) => NUMERIC_FIELDS.includes(key) ? value : quote(value);

const validateForm = (tournamentData, eventData, tournamentId) => {
  let error;
  for (let i = 0; i < REQUIRED_FIELDS.length; i++) {
    const field = REQUIRED_FIELDS[i];
    if (!tournamentData[field] && !(tournamentId && field === 'password')) {
      const label = $(`label[for="${field}"]`).text().replace('*', '').replace(':', '');
      error = `Missing required field: ${label}`;
      break;
    }
  }

  if (!error) {
    if (!isPositiveInteger(tournamentData.min_events)) {
      error = 'Invalid value for minimum required number of overall events';
    }
  }

  const divisions = tournamentData.divisions.split(',');
  if (!error) {
    const scoringBaseByDivision = decodeDatabaseValue(tournamentData.countdown_base, divisions);
    for (let j = 0; j < divisions.length; j++) {
      const division = divisions[j];
      if (!isPositiveInteger(scoringBaseByDivision[division])) {
	error = `Invalid value for ${DIV_NAME[division]} scoring base`;
	break;
      }
    }
  }

  if (!error) {
    for (let i = 0; i < eventData.length; i++) {
      const eventObj = eventData[i];
      const roundsByDivision = decodeDatabaseValue(eventObj.rounds, divisions);
      const cumulativeRoundsByDivision = decodeDatabaseValue(eventObj.cumulative_rounds, divisions);
      for (let j = 0; j < divisions.length; j++) {
	const division = divisions[j];
	const rounds = roundsByDivision[division];
	const cumulativeRounds = cumulativeRoundsByDivision[division];
	if (!isPositiveInteger(rounds)) {
	  error = `Invalid or missing value for ${DIV_NAME[division]} rounds for ${eventObj.name}`;
	  break;
	} else if (cumulativeRounds && Number(cumulativeRounds) > Number(rounds)) {
	  error = `Cumulative rounds exceeds ${DIV_NAME[division]} rounds for ${eventObj.name}`;
	  break;
	}
      }
    }
  }

  return error;
};

const saveTournament = async (tournamentId) => {
  console.log('Save tournament');

  const { tournamentData: newTournamentData, eventData: newEventData } = await formToDatabase();
  const error = validateForm(newTournamentData, newEventData, tournamentId);

  if (error) {
    return showError(error);
  }

  const keys = Object.keys(newTournamentData);
  const values = keys.map((key) => getDatabaseValue(key, newTournamentData[key]));
  let updated;

  let newTournamentId;
  if (tournamentId) {
    const updates = keys
      .filter((key) => newTournamentData[key] !== GLOBAL.tournament[key])
      .map((key) => `${key}=${getDatabaseValue(key, newTournamentData[key])}`);
    if (updates.length > 0) {
      const result = await updateTournament(tournamentId, updates);
      updated = true;
    }
  } else {
    newTournamentId = await addTournament(keys, values);
    if (!newTournamentId) {
      return showError('Failed to add new tournament');
    } else {
      showInfo('Tournament added');
    }
  }

  const resultData = await getResults({ tournamentId });
  
  for (let i = 0; i < newEventData.length; i++) {
    const eventObj = newEventData[i];
    const keys = Object.keys(eventObj);
    const values = keys.map((key) => getDatabaseValue(key, eventObj[key]));
    const currentEventObj = GLOBAL.eventByName[eventObj.name];
    if (currentEventObj) {
      const updates = keys
        .filter((key) => eventObj[key] !== currentEventObj[key])
        .map((key) => `${key}=${getDatabaseValue(key, eventObj[key])}`);

      if (updates.length > 0) {
	// check if there are invalid results, eg results for round 3 when the number of rounds is now 2
	let warning;
	if (eventObj.rounds) {
	  const roundsByDiv = decodeDatabaseValue(eventObj.rounds, newTournamentData.divisions.split(','));
	  const hasInvalidResults = resultData && !!resultData.find((result) => {
	    const playerObj = isTeamEvent(eventObj.name) ? GLOBAL.teamById[result.player_id] : GLOBAL.playerById[result.player_id];
	    const div = playerObj && playerObj.division;
	    if (div && Number(result.round) > roundsByDiv[div]) {
	      warning = `Results have been recorded for ${DIV_NAME[div]} ${capitalizeEvent(eventObj.name)} ${getRoundName(eventObj.name, result.round, div)}. You may want to consider removing invalid results so they don't affect the overall. Save tournament anyway?`;
	    }
	  });
	};
	if (!warning || confirm(warning)) {
	  const result = await updateEvent(currentEventObj.id, updates);
	  console.log('updated event ' + eventObj.name);
	  updated = true;
	}
      }
    } else {
      keys.push('tournament_id');
      values.push(tournamentId || newTournamentId);
      const eventId = await addEvent(keys, values);
      console.log('new event ID for ' + eventObj.name + ': ' + eventId);
      updated = true;
    }
  }

  if (updated) {
    PAGE_INITIALIZED['teams'] = false;
    showInfo('Tournament updated');
  }
  
  if (newTournamentId) {
    navigateTo(ADMIN_HOME, { id: tournamentId || newTournamentId });
  } else {
    await getTournament({ tournamentId });
  }
};
