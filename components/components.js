const setContent = (elementId, content) => {
  $(`#${elementId}`).html(content);
};

const appendContent = (parentId, content) => {
  $(`#${parentId}`).append(content);
};

const clearTournamentContent = () => [ID.TOURNAMENT_TITLE, ID.TOURNAMENT_INFO, ID.TOURNAMENT_NAV_TOP, ID.TOURNAMENT_NAV_BOTTOM, ID.TOURNAMENT_RESULTS, ID.TOURNAMENT_PLAYERS, ID.PLAYER_PAGE_NAME, ID.SUBTITLE].forEach((id) => setContent(id, ''));

const clearPageContent = () => [ID.TOURNAMENT_RESULTS, ID.TOURNAMENT_PLAYERS, ID.PLAYER_PAGE_NAME].forEach((id) => setContent(id, ''));

const clearAdminTournamentContent = () => [ID.TOURNAMENT_RESULTS, ID.TOURNAMENT_PLAYERS].forEach((id) => setContent(id, ''));

/*** Notices ***/

const showMessage = (type, msg, duration) => {
  if (GLOBAL.messageTimerId > 0) {
    clearTimeout(GLOBAL.messageTimerId);
    GLOBAL.messageTimerId = 0;
  }
  const el = $(`#${ID.NOTICE}`);
  el.removeClass('error info');
  el.addClass(type);
  setContent(ID.NOTICE, msg);
  scrollToTop();
  if (duration) {
    GLOBAL.messageTimerId = setTimeout(hideMessage, duration * 1000);
  }
};

const hideMessage = () => setContent(ID.NOTICE, '');
const showError = (msg, duration) => showMessage('error', msg, duration);
const showInfo = (msg, duration) => showMessage('info', msg, duration);

/*** Home page ***/

const getTournamentHtml = (tournament, addSeparator) => {
  const year = tournament.start.split('-')[0];
  const start = (new Date(tournament.start)).toLocaleString('default', { month: 'long', day: 'numeric' });
  const end = (new Date(tournament.end)).toLocaleString('default', { month: 'long', day: 'numeric' });

  return `
${addSeparator ? '<div class="separator"></div>' : ''}
<div class="tournament-listing" onClick="updateQueryParams({ id: ${tournament.id} })">
  <div class="tournament-title">${year} ${tournament.name}</div>
  <div>${start} - ${end} in ${tournament.location}</div>
</div>
  `;
};

/*** Tournament header ***/

const displayTournamentInfo = (tournament) => {
  const isoSuffix = 'T10:00:00Z';
  const startDate = tournament.start && new Date(tournament.start + isoSuffix);
  const endDate = tournament.end && new Date(tournament.end + isoSuffix);
  const year = startDate ? startDate.getFullYear() : '';
  const tournamentTitle = `${year} ${tournament.name}`;
  setContent(ID.PAGE_TITLE, tournamentTitle);
  setContent(ID.TOURNAMENT_TITLE, tournamentTitle);
  const location = tournament.location ? `${tournament.location}: ` : '';
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  const dates = start && end ? `${start} - ${end}` : '';
  const tournamentInfo = `${location}${dates}`;
  setContent(ID.TOURNAMENT_INFO, tournamentInfo);
};

const getPageLinkHtml = (page, label) => {
  return `<span class="page-link" id="${page}">${label}</span>`;
};

const addPageLink = (page, elId, label, handler) => {
  appendContent(elId, getPageLinkHtml(page, label || capitalize(page)));
  $(`#${page}`).on('click', handler || (() => updateQueryParams({ page })));
};

/*** Selects ***/

// Adds options to a division <select>.
const populateDivisionSelect = (selectId, divisions, page, curDivision, omitAll) => {
  const select = $(`#${selectId}`);
  select.empty();
  let divs = Array.isArray(divisions) ? divisions : (divisions || '').split(/\s*,\s*/);
  divs = divs.filter((div) => !(isVirginiaStates() && isTeamEvent(page) && isJuniorDivision(div)));
  divs.sort((a, b) => DIV_ORDER.indexOf(a) - DIV_ORDER.indexOf(b));
  if (!isTeamEvent(page) && !omitAll) {
    divs.unshift('ALL');
  }
  divs.forEach((div) => {
    const option = new Option(DIV_NAME[div], div);
    option.selected = div === curDivision;
    select.append(option);
  });

  const updateDivParam = (div) => updateQueryParams({ div: div === getDefaultDivision(GLOBAL.curPage) ? '' : div });
  select.on('change', ((ev) => updateDivParam($(ev.currentTarget).val())));
};

const populatePoolSelect = (selectId, poolConfig, page, curPool, omitAll) => {
  const select = $(`#${selectId}`);
  select.empty();
  const pools = Array.isArray(poolConfig) ? poolConfig : (poolConfig || '').split(/\s*,\s*/);
  if (!omitAll) {
    pools.unshift('ALL');
  }
  pools.forEach((pool) => {
    const option = new Option(pool === 'ALL' ? 'All' : pool, pool);
    option.selected = pool === curPool;
    select.append(option);
  });
  select.val(curPool || pools[0]);

  const updatePoolParam = (pool) => updateQueryParams({ pool: pool === 'ALL' ? '' : pool });
  select.on('change', ((ev) => updatePoolParam($(ev.currentTarget).val())));
};

const populateRoundSelect = (event, division, curRound) => {
  const select = $(`#${ID.ROUND_SELECT}`);
  select.empty();
  const numRounds = getRoundsByDivision(event, division);
  const hasPlayoff = GLOBAL.eventByName[event] && GLOBAL.eventByName[event].has_playoff && GLOBAL.eventByName[event].has_playoff.split(',').includes(division);

  for (let round = 1; round <= numRounds; round++) {
    const option = new Option(getRoundName(event, round, division), round);
    option.selected = round === curRound;
    select.append(option);
  }

  if (hasPlayoff) {
    const option = new Option('Playoff', numRounds + 1);
    option.selected = curRound === numRounds + 1;
    select.append(option);
  }

  const updateRoundParam = (round) => updateQueryParams({ round });
  select.on('change', ((ev) => updateRoundParam($(ev.currentTarget).val())));
};

/*** Players page ***/

// Displays a list of players in columns, first going from top to bottom, then from left to right.
const showPlayers = (data, options) => {

  options = options || {};
  let numCols = options.numCols || PLAYER_COLUMNS;
  const showIndexes = options.showIndexes !== false;
  const showDivisions = options.showDivisions !== false;
  const nameClass = options.nameClass != null ? options.nameClass : 'player-name';

  data = data || [];
  data.sort((a, b) => {
    // division is primary sort key
    if (showDivisions && a.division !== b.division) {
      return DIV_ORDER.indexOf(a.division) - DIV_ORDER.indexOf(b.division);
    }
    // name is secondary sort key, can be overridden by 'sortKey' property
    return compareNames(a.sortKey || a.name, b.sortKey || b.name);
  });

  // divvy players up into divisions
  const divList = {};
  if (showDivisions) {
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      const div = p.division;
      divList[div] = divList[div] || [];
      divList[div].push(p);
    }
  } else {
    divList.all = data;
  }
    
  let html = ''
  const divisions = showDivisions ? DIV_ORDER : ['all'];

  // show the list of players in each division
  divisions.forEach((div) => {

    const list = divList[div];
    let count = 0;

    // Do some math to figure out the index for each player. The data is sequential but the
    // table layout must be done row by row. For example, the first row for a list of 11 players
    // would contain players 0, 3, 5, 7, and 9.
    if (list) {
      numCols = Math.min(numCols, list.length);
      const numRows = Math.ceil(list.length / numCols);
      const numFullRows = Math.floor(list.length / numCols);
      const remainder = list.length % numCols; // number in bottom row if it's not full
      let idx;

      if (showDivisions) {
	html += "<div class='player-list-header'>" + DIV_NAME[div] + "</div>";
      }
      html += "<table class='player-list-table' id='player-list-table'>";

      // Find the index for each spot. The first column is easy, it's just the row number. After that,
      // we just bump it up by the number of items in the previous column, which is the number of full
      // rows plus one possible extra item for the first columns in a partial bottom row.
      for (let row = 0; row < numRows; row++) {
	html += "<tr>";
	for (let col = 0; col < numCols; col++) {
	  if (col === 0) {
	    idx = row;
	  } else {
	    let num = numFullRows;
	    if (remainder >= col) {
	      num++;
	    }
	    idx += num;
	  }

	  const p = list[idx];
	  if (p) {
	    // include optional attributes
	    const idxStr = showIndexes ? (idx + 1) + ". " : '';
	    const idStr = p.elId ? " id='" + p.elId + "'" : ''
	    const dataIdStr = p.id ? " data-id='" + p.id + "'" : ''
	    const dataDivStr = showDivisions && p.division ? " data-division='" + p.division + "'" : '';

	    html += "<td" + idStr + dataIdStr + dataDivStr + ">" + idxStr + `<span class='${nameClass}'>` + p.name + "</span></td>";
	    count++;
	  } else {
	    html == "<td></td>";
	  }
	  if (count >= list.length) {
	    break;
	  }
	}
	html += "</tr>";
      }
      html += "</table>";
    }
  });
  
  return html;
};

/*** Results page ***/

const sortResults = (results, event, division, otherResults, ev) => {
  const id = $(ev.currentTarget).closest('th').prop('id');
  const column = id.replace('result-', '');
  if (column) {
    if (column === GLOBAL.sortColumn) {
      GLOBAL.reverseSort = !GLOBAL.reverseSort;
    }
    displayResults(results, event, division, column, otherResults);
  }
};

// Display event results in a table
const displayResults = (results, event, division, column = 'place', otherResults, options = {}) => {

  GLOBAL.sortColumn = column;
  const resultsTableId = ID.RESULTS_TABLE;
  setContent(ID.TOURNAMENT_RESULTS, `<table class="results-table" id="${resultsTableId}"></table>`);

  const useDecimal = shouldUseDecimal(event, results);
  const resultInfo = getSortedResults(results, event, division);

  if (!resultInfo) {
    return;
  }

  let { playerIds, scoreData } = resultInfo;
  if (!scoreData) {
    return;
  }

  const hasPlayoffResults = Object.values(scoreData).some((info) => !!info.playoff);
  if (!options.noHeaders) {
    appendContent(resultsTableId, getResultsHeader(event, division, hasPlayoffResults));
  }

  if (division === 'ALL') {
    const numRounds = getRoundsByDivision(event, division);
    const playersWhoPlayed = playerIds.filter((id) => {
      for (let i = 1; i <= numRounds; i++) {
	if (scoreData[id][i] < 0) {
	  return false;
	}
      }
      return true;
    });
    const latestRoundAllPlayed = Math.min(...playersWhoPlayed.map((id) => scoreData[id].latest));
    const numCumulativeRounds = getRoundsByDivision(event, division, true);
    column = latestRoundAllPlayed === numCumulativeRounds ? 'total' : `round${latestRoundAllPlayed}`;
  }

  // current sort header is underlined
  $(`#${resultsTableId} span.current`).removeClass('current');
  $(`#result-${column} span`).addClass('current');
  $(`#${resultsTableId} th span`).on('click', sortResults.bind(null, results, event, division, otherResults));
  
  // internal compare function that handles players or teams, with place as secondary sort key
  const compareByDivisionThenPlace = (a, b) => {

    if (!isTeamEvent(event)) {
      const result = compareByDivision(GLOBAL.playerById[a], GLOBAL.playerById[b]);
      return result !== 0 ? result : scoreData[a].rank - scoreData[b].rank;
    }

    // Sort two teams according to their strongest divisional player. A team with three players will always sort 
    // ahead of a team with two players.
    const teamA = GLOBAL.teamById[a];
    const teamB = GLOBAL.teamById[b];

    const divOrdersA = [teamA.player1, teamA.player2, teamA.player3].map((p) => GLOBAL.playerById[p] ? DIV_ORDER.indexOf(GLOBAL.playerById[p].division) : -1).sort();
    const divOrdersB = [teamB.player1, teamB.player2, teamB.player3].map((p) => GLOBAL.playerById[p] ? DIV_ORDER.indexOf(GLOBAL.playerById[p].division) : -1).sort();

    for (var i = 0; i < 3; i++) {
      if (divOrdersA[i] !== divOrdersB[i]) {
	return divOrdersA[i] - divOrdersB[i];
      }
    }
	
    return scoreData[a].rank - scoreData[b].rank;
  }

  if (column === 'place') {
    playerIds.sort((a, b) => scoreData[a].rank - scoreData[b].rank);
  } else if (column === 'player') {
    playerIds.sort((a, b) => compareNames(getName(a), getName(b)));
  } else if (column === 'div') {
    playerIds.sort(compareByDivisionThenPlace);
  } else if (column.indexOf('round') === 0) {
    let round = column.substr(-1, 1);
    playerIds.sort((a, b) => compareScores(scoreData[a][round], scoreData[b][round], event));
  } else if (column === 'total') {
    playerIds.sort((a, b) => compareScores(scoreData[a].total, scoreData[b].total, event));
  } else if (IS_SCF_EVENT[column.substr(0, 3)]) {
    const scfEvent = column.substr(0, 3);
    const round = column.substr(-1, 1);

    const scfEventResultInfo = getSortedResults(otherResults[scfEvent], scfEvent);
    const scfEventScoreData = scfEventResultInfo.scoreData;

    playerIds = scfEventResultInfo.playerIds,
    playerIds.sort((a, b) => compareScores(scfEventScoreData[a][round], scfEventScoreData[b][round], event));
  }

  if (GLOBAL.reverseSort) {
    playerIds.reverse();
  }

  const displayOptions = { useDecimal, showDivision: GLOBAL.tournament.show_division === '1', round: options.round, hasPlayoffResults };
  addResultRows(resultsTableId, playerIds, scoreData, event, division, otherResults, displayOptions);
};

// Returns HTML for the results table header
const getResultsHeader = (event, division, hasPlayoffResults) => {
  const numRounds = getRoundsByDivision(event, division);
  const numCumulativeRounds = getRoundsByDivision(event, division, true);

  const playerHeader = '<th id="result-player"><span class="page-link">Player</span></th>';
  const divHeader = GLOBAL.tournament.show_division === '1' ? '<th id="result-div"><span class="page-link">Div</span></th>' : '';
  let html = `<tr><th id="result-place"><span class="page-link">Place</span></th>${playerHeader}${divHeader}`;

  if (!isRankScoring(event)) {
    for (let round = 1; round <= numRounds; round++) {
      if (event === 'scf') {
	html += `<th id="result-mta-round${round}"><span class="page-link">MTA</span></th>`;
	html += `<th id="result-trc-round${round}"><span class="page-link">TRC</span></th>`;
      }
      html += `<th id="result-round${round}"><span class="page-link">${getRoundName(event, round, division)}</span></th>`;
      if (round === numCumulativeRounds) {
	html += '<th id="result-total"><span class="page-link">Total</span></th>';
      }
    }
    if (hasPlayoffResults) {
      html += '<th id="result-playoff"><span class="page-link">Playoff</span></th>';
    }
  }
  html += '</tr>';

  return html;
};

const addResultRows = (resultsTableId, playerIds, scoreData, event, division, otherResults, options) => {

  const numRounds = getRoundsByDivision(event, division);
  const numCumulativeRounds = getRoundsByDivision(event, division, true);
  const table = $('#' + resultsTableId).get(0);

  playerIds.forEach((playerId, index) => {

    let rowHtml = '';
    const name = getName(playerId, event);
    const info = scoreData[playerId];
    if (!info) {
      return;
    }
    const row = table.rows[index + 1] || table.insertRow();

    let div = '';

    rowHtml += `<tr><td>${info.rank}</td>`;
    if (options.showName !== false) {
      rowHtml += `<td>${name}</td>`;
    }
    if (options.showDivision !== false) {
      if (isTeamEvent(event)) {
	const teamMembers = getTeamMembers(GLOBAL.teamById[playerId]);
	const teamDivs = teamMembers.map((p) => GLOBAL.playerById[p].division);
	div = teamDivs.join('/');
      } else {
	div = GLOBAL.playerById[playerId].division;
      }
      rowHtml += `<td>${div}</td>`;
    }

    if (!isRankScoring(event)) {
      for (let round = 1; round <= Math.max(numRounds, options.round || 0); round++) {
	if (options.round && round !== Number(options.round)) {
	  continue;
	}
	if (event === 'scf') {
	  SCF_EVENTS.forEach((scfEvent) => {
	    const result = otherResults[scfEvent].find((res) => res.player_id == playerId && res.round == round);
	    const score = formatScore(result ? result.score : null, scfEvent, options);
	    rowHtml += `<td>${score}</td>`;
	  });
	}
	rowHtml += `<td>${formatScore(info[round], event, options)}</td>`;
	if (round === numCumulativeRounds && !options.round) {
	  let cumulativeTotal = 0;
	  for (let i = 1; i <= numCumulativeRounds; i++) {
	    cumulativeTotal += Math.max(info[i] || 0, 0);
	  }
	  rowHtml += `<td>${formatScore(cumulativeTotal, event, options)}</td>`;
	}
      }
      if (options.hasPlayoffResults && info.playoff) {
	rowHtml += `<td>${formatScore(info.playoff, event, options)}</td>`;
      }
    }
    rowHtml += '</tr>';
    row.innerHTML = rowHtml;
  });
};
