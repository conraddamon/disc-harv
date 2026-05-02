// Common

// map division codes to full names
const DIV_NAME = {
  'ALL': 'All',
  'O': 'Open',
  'OM': 'Open Master',
  'OGM': 'Open Grand Master',
  'OSGM': 'Open Senior Grand Master',
  'OL': 'Open Legend',
  'OJ': 'Open Junior',
  'W': 'Women',
  'WM': 'Women Master',
  'WGM': 'Women Grand Master',
  'WSGM': 'Women Senior Grand Master',
  'WL': 'Women Legend',
  'WJ': 'Women Junior',
  'MX': 'Mixed'
};

// order to present divisions in
const DIV_ORDER = [ 'O', 'OM', 'OGM', 'OSGM', 'OL', 'OJ', 'W', 'WM', 'WGM', 'WSGM', 'WL', 'WJ', 'MX' ];

// for each division, the divisions that include it; eg every OGM is also a OM
const DIV_LIST = {};
DIV_LIST['O'] = ['O', 'OM', 'OGM', 'OSGM', 'OL'];
DIV_LIST['OM'] = ['OM', 'OGM', 'OSGM', 'OL'];
DIV_LIST['OGM'] = ['OGM', 'OSGM', 'OL'];
DIV_LIST['OSGM'] = ['OSGM', 'OL'];
DIV_LIST['OL'] = ['OL'];
DIV_LIST['OJ'] = ['OJ'];
DIV_LIST['W'] = ['W', 'WM', 'WGM', 'WSGM', 'WL'];
DIV_LIST['WM'] = ['WM', 'WGM', 'WSGM', 'WL'];
DIV_LIST['WGM'] = ['WGM', 'WSGM', 'WL'];
DIV_LIST['WSGM'] = ['WSGM', 'WL'];
DIV_LIST['WL'] = ['WL'];
DIV_LIST['WJ'] = ['WJ'];

// for each division, divisions allowed to form a team in that division
const DIV_LIST_OVERALL_TEAM = {};
DIV_LIST_OVERALL_TEAM['O'] = ['O', 'OM', 'OGM', 'OSGM', 'OL', 'OJ', 'W', 'WM', 'WGM', 'WSGM', 'WL', 'WJ'];
DIV_LIST_OVERALL_TEAM['OM'] = ['OM', 'OGM', 'OSGM', 'OL', 'WM', 'WGM', 'WSGM', 'WL'];
DIV_LIST_OVERALL_TEAM['OGM'] = ['OGM', 'OSGM', 'OL', 'WGM', 'WSGM', 'WL'];
DIV_LIST_OVERALL_TEAM['OSGM'] = ['OSGM', 'OL', 'WSGM', 'WL'];
DIV_LIST_OVERALL_TEAM['OL'] = ['OL', 'WL'];
DIV_LIST_OVERALL_TEAM['OJ'] = ['OJ', 'WJ'];
DIV_LIST_OVERALL_TEAM['W'] = ['W', 'WM', 'WGM', 'WSGM', 'WL', 'WJ'];
DIV_LIST_OVERALL_TEAM['WM'] = ['WM', 'WGM', 'WSGM', 'WL'];
DIV_LIST_OVERALL_TEAM['WGM'] = ['WGM', 'WSGM', 'WL'];
DIV_LIST_OVERALL_TEAM['WSGM'] = ['WSGM', 'WL'];
DIV_LIST_OVERALL_TEAM['WL'] = ['WL'];
DIV_LIST_OVERALL_TEAM['WJ'] = ['WJ'];

DIV_CLASS_ORDER = [ 'O', 'W' ];
DIV_CLASSES = [ 'O', 'W', 'OJ', 'WJ' ];
DIV_AGE_ORDER = [ '', 'M', 'GM', 'SGM', 'L' ];

// indicates in which events a lower score is better; a team event score is a place, so lower is better
const LOWER_IS_BETTER = { 'golf': true, 'discathon': true, 'ddc': true, 'freestyle': true };

const TEAM_EVENTS = [ 'ddc', 'freestyle' ];
const IS_TEAM_EVENT = { 'ddc': true, 'freestyle': true };

const IS_TIMED_EVENT = { 'mta': true, 'discathon': true };

const SCF_EVENTS = [ 'mta', 'trc' ];
const IS_SCF_EVENT = { 'mta': true, 'trc': true };

// which events always show numbers with two decimal places
const USE_DECIMAL = { 'scf': true, 'mta': true };

const DUMMY_PLAYER_ID = '-1';
const DUMMY_PLAYER_NAME = '[ no partner ]';

// Tournament Viewer

const APP_TITLE = 'HARV 3001 Overall Tournament Viewer';

const DEFAULT_PAGE = 'players';

// DOM element IDs; set in index.html
const ID = {
  CHOOSER: 'chooser',
  DIVISION_SELECT: 'division-select',
  HOME: 'home',
  NOTICE: 'notice',
  PAGE_TITLE: 'page-title',
  PLAYER_PAGE_NAME: 'player-page-name',
  PLAYER_RESULTS: 'player-results',
  POOL_SELECT: 'pool-select',
  POOL_SELECT_CONTAINER: 'pool-select-container',
  RESULTS_TABLE: 'results-table',
  ROUND_SELECT: 'round-select',
  ROUND_SELECT_CONTAINER: 'round-select-container',
  SUBTITLE: 'subtitle',
  TITLE: 'title',
  TOURNAMENT: 'tournament',
  TOURNAMENT_INFO: 'tournament-info',
  TOURNAMENT_LIST: 'tournament-list',
  TOURNAMENT_NAV_TOP: 'tournament-nav-top',
  TOURNAMENT_NAV_BOTTOM: 'tournament-nav-bottom',
  TOURNAMENT_PLAYERS: 'tournament-players',
  TOURNAMENT_RESULTS: 'tournament-results',
  TOURNAMENT_TEAMS: 'tournament-teams',
  TOURNAMENT_TITLE: 'tournament-title',

  // Admin only
  NEW_TOURNAMENT: 'new-tournament-button',
  PAGE_DESCRIPTION: 'page-description',
  ROUND_SELECT: 'round-select',
  TOURNAMENT_AVAILABLE_PLAYERS: 'tournament-available-players',
  TOURNAMENT_NAV_EVENTS: 'tournament-nav-events',
};

// number of columns for displaying a large list of players
const PLAYER_COLUMNS = 5;

// order to present events in
const EVENT_ORDER = [ 'golf', 'distance', 'accuracy', 'scf', 'mta', 'trc', 'discathon', 'ddc', 'freestyle' ];

// Tournament Manager

const HARV_HOME = '/';
const ADMIN_HOME = '/admin';

const ADMIN_PW = '$2y$07$9Qpa9MpNB.WZNgJPPqX15u50GGFP.ilvt60ARMcn8Ra.syV7vcE26';

const ADMIN_APP_TITLE = 'HARV 3001 Overall Tournament Manager';

const ADMIN_PAGES = ['setup', 'players', 'teams', 'scores'];

const DEFAULT_ADMIN_PAGE = 'players';

const ADMIN_DESCRIPTION = {
  setup: 'Tournament information can be changed below. It is not recommended to change anything in the Events, Divisions, or Scoring sections once results have already been recorded. If you need help, look in the <a href="guide.html">Admin Guide</a>.',
  players: 'Add a player by entering their name below. Make sure the division is correct.',
  playersWithPool: 'Add a player by entering their name below. Make sure the division and pool are correct.',
  playersDelete: 'Remove a player by entering their name below.',
  teams: 'Create teams from the players listed below',
  teamsDelete: "Return a team's players to the available players pool",
  scores: 'Make sure that the division and round are correct',
  scoresDelete: 'Enter the name of the player whose score should be removed',
};

const DEFAULT_DIVISIONS = ['O'];

const NUMERIC_FIELDS = ['age_divisions', 'min_events'];
const DATE_FIELDS = ['end', 'start'];

const REQUIRED_FIELDS = ['name', 'location', 'start', 'end', 'td_email', 'td_name'];

const AUTOCOMPLETE_RECENT_YEARS = 10;
const AUTOCOMPLETE_MATCHES = 20;

const PAGE_INITIALIZED = {
  players: false,
  teams: false,
  scores: false,
};
