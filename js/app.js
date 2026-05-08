'use strict';

// ─────────────────────────────────────────────────────────────
// App State
// ─────────────────────────────────────────────────────────────
const App = {
  game: null,
  winStep: 0,
  winData: {
    winnerId: null,
    loserId:  null,
    winType:  null,
    han:      null,
    fu:       null,
  },
  drawData: { tenpaiIds: [] },
  pendingEvent: null,
  prevScores: null,
  fuCalcResult: null,
  fuModalReady: false,
  fuActiveTarget: null,
  fuReturnStep: null,
  timerInterval: null,  // Timer interval ID
};

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const qs  = sel => document.querySelector(sel);
const qsa = sel => document.querySelectorAll(sel);

const TILE_OPTIONS = [
  { value: '', label: '選擇牌' },
  { value: 'm1', label: '1萬' }, { value: 'm2', label: '2萬' }, { value: 'm3', label: '3萬' },
  { value: 'm4', label: '4萬' }, { value: 'm5', label: '5萬' }, { value: 'm6', label: '6萬' },
  { value: 'm7', label: '7萬' }, { value: 'm8', label: '8萬' }, { value: 'm9', label: '9萬' },
  { value: 'p1', label: '1筒' }, { value: 'p2', label: '2筒' }, { value: 'p3', label: '3筒' },
  { value: 'p4', label: '4筒' }, { value: 'p5', label: '5筒' }, { value: 'p6', label: '6筒' },
  { value: 'p7', label: '7筒' }, { value: 'p8', label: '8筒' }, { value: 'p9', label: '9筒' },
  { value: 's1', label: '1索' }, { value: 's2', label: '2索' }, { value: 's3', label: '3索' },
  { value: 's4', label: '4索' }, { value: 's5', label: '5索' }, { value: 's6', label: '6索' },
  { value: 's7', label: '7索' }, { value: 's8', label: '8索' }, { value: 's9', label: '9索' },
  { value: 'E', label: '東' }, { value: 'S', label: '南' }, { value: 'W', label: '西' }, { value: 'N', label: '北' },
  { value: 'P', label: '白' }, { value: 'F', label: '發' }, { value: 'C', label: '中' },
];

const HONOR_MAP = {
  E: { kind: 'wind', wind: 'east', label: '東' },
  S: { kind: 'wind', wind: 'south', label: '南' },
  W: { kind: 'wind', wind: 'west', label: '西' },
  N: { kind: 'wind', wind: 'north', label: '北' },
  P: { kind: 'dragon', dragon: 'white', label: '白' },
  F: { kind: 'dragon', dragon: 'green', label: '發' },
  C: { kind: 'dragon', dragon: 'red', label: '中' },
};

const TILE_ASSETS = {
  m1: 'image/Man1.svg', m2: 'image/Man2.svg', m3: 'image/Man3.svg',
  m4: 'image/Man4.svg', m5: 'image/Man5.svg', m6: 'image/Man6.svg',
  m7: 'image/Man7.svg', m8: 'image/Man8.svg', m9: 'image/Man9.svg',
  p1: 'image/Pin1.svg', p2: 'image/Pin2.svg', p3: 'image/Pin3.svg',
  p4: 'image/Pin4.svg', p5: 'image/Pin5.svg', p6: 'image/Pin6.svg',
  p7: 'image/Pin7.svg', p8: 'image/Pin8.svg', p9: 'image/Pin9.svg',
  s1: 'image/Sou1.svg', s2: 'image/Sou2.svg', s3: 'image/Sou3.svg',
  s4: 'image/Sou4.svg', s5: 'image/Sou5.svg', s6: 'image/Sou6.svg',
  s7: 'image/Sou7.svg', s8: 'image/Sou8.svg', s9: 'image/Sou9.svg',
  E: 'image/Ton.svg', S: 'image/Nan.svg', W: 'image/Shaa.svg', N: 'image/Pei.svg',
  P: 'image/Haku.svg', F: 'image/Hatsu.svg', C: 'image/Chun.svg',
};

const TILE_LABELS = TILE_OPTIONS.reduce((acc, tile) => {
  if (tile.value) acc[tile.value] = tile.label;
  return acc;
}, {});

const TILE_GROUPS = [
  { label: '萬子', tiles: ['m1','m2','m3','m4','m5','m6','m7','m8','m9'] },
  { label: '筒子', tiles: ['p1','p2','p3','p4','p5','p6','p7','p8','p9'] },
  { label: '索子', tiles: ['s1','s2','s3','s4','s5','s6','s7','s8','s9'] },
  { label: '字牌', tiles: ['E','S','W','N','P','F','C'] },
];

function fmt(n){
  const abs = Math.abs(n);
  return (n < 0 ? '-' : '') + abs.toLocaleString();
}
function fmtDelta(n){
  if (n === 0) return '±0';
  return n > 0 ? `+${n.toLocaleString()}` : `-${Math.abs(n).toLocaleString()}`;
}
function fmtFinal(n){
  const s = Math.abs(n).toFixed(1);
  return n >= 0 ? `+${s}` : `-${s}`;
}
function fmtTime(ms){
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours > 0){
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTileInfo(value){
  if (!value) return null;
  if (HONOR_MAP[value]){
    return { type: 'honor', ...HONOR_MAP[value] };
  }
  const suit = value[0];
  const rank = parseInt(value.slice(1), 10);
  const isTerminal = rank === 1 || rank === 9;
  return {
    type: 'suit',
    suit,
    rank,
    isTerminal,
    isYaochu: isTerminal,
  };
}

function getTileLabel(value){
  return TILE_LABELS[value] || value || '';
}

function getTileAsset(value){
  return TILE_ASSETS[value] || '';
}

function isYakuhaiPair(tile, seatWind, roundWind){
  if (!tile || tile.type !== 'honor') return false;
  if (tile.kind === 'dragon') return true;
  if (tile.kind === 'wind') return tile.wind === seatWind || tile.wind === roundWind;
  return false;
}

function hideAllModals(){
  qsa('.modal').forEach(m => {
    m.classList.remove('active');
    m.style.display = 'none';
  });
}
function showModal(id){
  hideAllModals();
  const m = $(id);
  m.style.display = 'flex';
  requestAnimationFrame(() => m.classList.add('active'));
}
function hideModal(id){
  const m = $(id);
  m.classList.remove('active');
  setTimeout(() => { m.style.display = 'none'; }, 280);
}
function showScreen(id){
  qsa('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function ensureGameReady(){
  if (App.game) return true;
  showToast('請先開始遊戲');
  return false;
}

// ─────────────────────────────────────────────────────────────
// Setup Screen
// ─────────────────────────────────────────────────────────────
function updatePlayerFieldsVisibility(){
  const mode = $('setup-mode').value;
  const numPlayers = mode === 'three' ? 3 : 4;
  const threeRuleWrap = $('setup-three-rule-wrap');
  
  for (let i = 0; i < 4; i++){
    const field = $(`player-field-${i}`);
    if (field) field.style.display = i < numPlayers ? 'flex' : 'none';
  }

  if (threeRuleWrap) threeRuleWrap.style.display = mode === 'three' ? 'flex' : 'none';

  const pointsSelect = $('setup-points');
  if (pointsSelect){
    if (mode === 'three' && pointsSelect.value === '25000') pointsSelect.value = '35000';
  }
}

function initSetup(){
  const defaultNames = ['玩家一','玩家二','玩家三','玩家四'];
  for (let i = 0; i < 4; i++){
    $(`setup-name-${i}`).value = defaultNames[i];
  }
  
  // Add mode change listener
  const modeSelect = $('setup-mode');
  if (modeSelect){
    modeSelect.addEventListener('change', updatePlayerFieldsVisibility);
    updatePlayerFieldsVisibility();  // Initial call
  }
  
  $('btn-start').addEventListener('click', startGame);
}

function startGame(){
  const mode = $('setup-mode').value;
  const numPlayers = mode === 'three' ? 3 : 4;
  
  const names = [];
  for (let i = 0; i < numPlayers; i++){
    const val = $(`setup-name-${i}`).value.trim();
    names.push(val || `玩家${i+1}`);
  }

  const gameLength  = $('setup-length').value;
  const startPoints = parseInt($('setup-points').value) || 25000;
  const returnPoints = numPlayers === 3 ? 40000 : 30000;
  const umaKey      = $('setup-uma').value;
  const threePlayerMode = numPlayers === 3 ? $('setup-three-rule').value : 'zimo-loss';
  
  let uma;
  if (numPlayers === 3){
    uma = {
      '20-10': [10000, 0, -10000],
      '15-5':  [7500, 0, -7500],
      '10-5':  [5000, 0, -5000],
      '0':     [0, 0, 0],
    }[umaKey] || [10000, 0, -10000];
  } else {
    uma = {
      '20-10': [20000, 10000,-10000,-20000],
      '15-5':  [15000,  5000, -5000,-15000],
      '10-5':  [10000,  5000, -5000,-10000],
      '0':     [0, 0, 0, 0],
    }[umaKey] || [20000,10000,-10000,-20000];
  }

  App.game = new MahjongGame({ names, gameLength, startPoints, returnPoints, uma, numPlayers, threePlayerMode });
  App.prevScores = null;
  
  // Set game mode class for CSS
  const gameScreen = $('screen-game');
  gameScreen.classList.remove('mode-three', 'mode-four');
  gameScreen.classList.add(numPlayers === 3 ? 'mode-three' : 'mode-four');
  
  // Set the riichi stick visibility for all 4 overlays (but only 3 are used in 3P mode)
  for (let i = 0; i < 4; i++){
    const rtoStick = $(`rto-${i}`);
    if (rtoStick){
      // Active seats rely on the .visible class for showing riichi sticks.
      // Keep only inactive seats force-hidden in 3P mode.
      rtoStick.style.display = i < numPlayers ? '' : 'none';
      if (i < numPlayers) rtoStick.classList.remove('visible');
    }
  }

  // Start timer updates
  if (App.timerInterval) clearInterval(App.timerInterval);
  App.timerInterval = setInterval(() => {
    if (App.game && !App.game.ended){
      const elapsedMs = Date.now() - App.game.startTime;
      const timerEl = $('info-timer');
      if (timerEl) timerEl.textContent = fmtTime(elapsedMs);
    }
  }, 1000);
  
  renderGame();
  showScreen('screen-game');
}

// ─────────────────────────────────────────────────────────────
// Game Table Rendering
// ─────────────────────────────────────────────────────────────
function renderGame(){
  const g = App.game;

  // Round info
  $('info-round').textContent = g.getRoundLabel();
  $('info-honba').textContent = `${g.honba} 本場`;
  $('info-riichi-pool').textContent = g.riichiPool;

  renderHonbaDots(g.honba);
  renderRiichiSticks(g.riichiPool);

  // Player panels
  for (let i = 0; i < g.numPlayers; i++){
    const p       = g.players[i];
    const pos     = p.position;
    const wind    = g.getWind(i);
    const isDealer  = i === g.dealerIdx;
    const hasRiichi = g.riichiThisRound.has(i);

    const panel = $(`panel-${pos}`);
    if (!panel) continue;

    // Wind tile
    const windTile = panel.querySelector('.pnl-wind-tile');
    if (windTile) windTile.textContent = WIND_KAN[wind];

    // Name & score
    panel.querySelector('.pnl-name').textContent = p.name;
    const scoreEl = panel.querySelector('.pnl-score');
    const oldScore = App.prevScores ? App.prevScores[i] : null;

    scoreEl.textContent = fmt(p.score);
    scoreEl.className   = `pnl-score${p.score < 0 ? ' negative' : ''}`;

    // Score flash animation
    if (oldScore !== null && oldScore !== p.score){
      const cls = p.score > oldScore ? 'score-up' : 'score-down';
      scoreEl.classList.add(cls);
      setTimeout(() => scoreEl.classList.remove(cls), 700);
    }

    // Dealer badge
    const dealerBadge = panel.querySelector('.pnl-dealer');
    if (dealerBadge) dealerBadge.style.display = isDealer ? 'flex' : 'none';

    // Riichi indicator
    const riichiInd = panel.querySelector('.pnl-riichi-indicator');
    if (riichiInd) riichiInd.style.opacity = hasRiichi ? '1' : '0';

    // Riichi button
    const rBtn = panel.querySelector('.btn-riichi');
    if (rBtn){
      rBtn.textContent = hasRiichi ? '立直中' : '立直';
      rBtn.dataset.pid = i;
      rBtn.classList.toggle('active', hasRiichi);
    }

    const overlay = $(`rto-${i}`);
    if (overlay){
      if (hasRiichi){
        overlay.classList.add('visible');
      } else {
        overlay.classList.remove('visible');
      }
    }
  }

  App.prevScores = g.players.map(p => p.score);
}

function renderHonbaDots(honba){
  const container = $('honba-dots');
  if (!container) return;
  container.innerHTML = '';
  const max = Math.min(honba, 8);
  for (let i = 0; i < max; i++){
    const dot = document.createElement('div');
    dot.className = 'honba-dot';
    container.appendChild(dot);
  }
  if (honba > 8){
    const more = document.createElement('span');
    more.className = 'honba-more';
    more.textContent = `+${honba - 8}`;
    container.appendChild(more);
  }
}

function renderRiichiSticks(count){
  const container = $('riichi-sticks-visual');
  if (!container) return;
  container.innerHTML = '';
  const max = Math.min(count, 5);
  for (let i = 0; i < max; i++){
    const stick = document.createElement('div');
    stick.className = 'riichi-stick-icon';
    container.appendChild(stick);
  }
  if (count > 5){
    const more = document.createElement('span');
    more.className = 'riichi-count-more';
    more.textContent = `×${count}`;
    container.appendChild(more);
  }
}

// ─────────────────────────────────────────────────────────────
// Auto Fu Modal
// ─────────────────────────────────────────────────────────────
function buildTileOptions(selectEl){
  selectEl.innerHTML = '';
  for (const opt of TILE_OPTIONS){
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    selectEl.appendChild(o);
  }
}

function buildFuMeldRows(){
  const container = $('fu-melds');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 4; i++){
    const row = document.createElement('div');
    row.className = 'fu-meld-row';
    row.innerHTML = `
      <select id="fu-meld-${i}-type" class="fu-select">
        <option value="shuntsu">順子</option>
        <option value="pon">刻子</option>
        <option value="kan">槓子</option>
      </select>
      <select id="fu-meld-${i}-open" class="fu-select">
        <option value="open">明牌</option>
        <option value="closed">暗牌</option>
      </select>
      <button id="fu-meld-${i}-tile" class="fu-tile-target" type="button" data-kind="meld" data-index="${i}">選擇牌</button>
    `;
    container.appendChild(row);
    row.querySelector(`#fu-meld-${i}-tile`).addEventListener('click', () => {
      setActiveFuTarget({ kind: 'meld', index: i });
    });
  }
}

function buildTileGrid(){
  const grid = $('fu-tile-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const group of TILE_GROUPS){
    const groupEl = document.createElement('div');
    groupEl.className = 'tile-group';
    const row = document.createElement('div');
    row.className = `tile-row${group.tiles.length === 7 ? ' honors' : ''}`;
    const label = document.createElement('div');
    label.className = 'tile-group-label';
    label.textContent = group.label;
    groupEl.appendChild(label);
    groupEl.appendChild(row);

    for (const value of group.tiles){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile-btn';
      btn.dataset.value = value;
      btn.innerHTML = `<img src="${getTileAsset(value)}" alt="${getTileLabel(value)}">`;
      btn.addEventListener('click', () => handleTilePick(value));
      row.appendChild(btn);
    }
    grid.appendChild(groupEl);
  }
}

function getFuTargetElement(target){
  if (!target) return null;
  if (target.kind === 'meld') return $(`fu-meld-${target.index}-tile`);
  if (target.kind === 'pair') return $('fu-pair-tile');
  return null;
}

function renderTileTarget(el, value){
  if (!el) return;
  const label = getTileLabel(value);
  const asset = getTileAsset(value);
  if (!value){
    el.classList.remove('selected');
    el.dataset.value = '';
    el.innerHTML = el.dataset.kind === 'pair' ? '選擇雀頭' : '選擇牌';
    return;
  }
  el.classList.add('selected');
  el.dataset.value = value;
  el.innerHTML = `<img src="${asset}" alt="${label}"><span>${label}</span>`;
}

function setActiveFuTarget(target){
  App.fuActiveTarget = target;
  qsa('.fu-tile-target').forEach(btn => btn.classList.remove('active'));
  const el = getFuTargetElement(target);
  if (el) el.classList.add('active');
  const label = target.kind === 'meld'
    ? `第 ${target.index + 1} 組面子`
    : '雀頭';
  $('fu-tile-target-label').textContent = `目前選擇：${label}`;
  updateTileGridSelection();
}

function updateTileGridSelection(){
  const value = App.fuActiveTarget ? getFuTargetElement(App.fuActiveTarget)?.dataset.value : '';
  qsa('#fu-tile-grid .tile-btn').forEach(btn => {
    btn.classList.toggle('selected', value && btn.dataset.value === value);
  });
}

function handleTilePick(value){
  if (!App.fuActiveTarget){
    showToast('請先選擇要填入的欄位');
    return;
  }
  const el = getFuTargetElement(App.fuActiveTarget);
  if (!el || el.classList.contains('is-disabled')) return;
  const current = el.dataset.value || '';
  const nextValue = current === value ? '' : value;
  renderTileTarget(el, nextValue);
  updateTileGridSelection();
}

function clearActiveTile(){
  if (!App.fuActiveTarget){
    showToast('請先選擇要填入的欄位');
    return;
  }
  const el = getFuTargetElement(App.fuActiveTarget);
  if (!el || el.classList.contains('is-disabled')) return;
  renderTileTarget(el, '');
  updateTileGridSelection();
}

function initFuModal(){
  if (App.fuModalReady) return;
  buildFuMeldRows();
  buildTileGrid();
  const pairBtn = $('fu-pair-tile');
  pairBtn.dataset.kind = 'pair';
  pairBtn.addEventListener('click', () => setActiveFuTarget({ kind: 'pair' }));
  $('fu-hand-type').addEventListener('change', updateFuHandTypeState);
  App.fuModalReady = true;
}

function updateFuHandTypeState(){
  const isChiitoi = $('fu-hand-type').value === 'chiitoi';
  const menqian = $('fu-menqian');
  if (isChiitoi){
    menqian.value = 'yes';
    menqian.disabled = true;
  } else {
    menqian.disabled = false;
  }
  qsa('#fu-melds select').forEach(s => { s.disabled = isChiitoi; });
  qsa('.fu-tile-target').forEach(btn => {
    btn.disabled = isChiitoi;
    btn.classList.toggle('is-disabled', isChiitoi);
  });
  if (isChiitoi){
    App.fuActiveTarget = null;
    $('fu-tile-target-label').textContent = '七對子不需選牌';
    updateTileGridSelection();
  } else if (!App.fuActiveTarget) {
    $('fu-tile-target-label').textContent = '請先選擇要填入的欄位';
  }
  $('fu-wait-type').disabled = isChiitoi;
}

function syncFuDefaults(){
  const g = App.game;
  const d = App.winData;
  $('fu-hand-type').value = 'normal';
  $('fu-menqian').value = 'yes';
  $('fu-win-type').value = d.winType || 'tsumo';
  $('fu-wait-type').value = 'ryanmen';
  if (g){
    $('fu-round-wind').value = g.roundWind || 'east';
    if (d.winnerId !== null && d.winnerId !== undefined){
      $('fu-seat-wind').value = g.getWind(d.winnerId);
    } else {
      $('fu-seat-wind').value = g.getWind(g.dealerIdx);
    }
  }
  for (let i = 0; i < 4; i++){
    $(`fu-meld-${i}-type`).value = 'shuntsu';
    $(`fu-meld-${i}-open`).value = 'closed';
    renderTileTarget($(`fu-meld-${i}-tile`), '');
  }
  renderTileTarget($('fu-pair-tile'), '');
  $('fu-result').innerHTML = '';
  App.fuCalcResult = null;
  App.fuActiveTarget = null;
  $('fu-tile-target-label').textContent = '請先選擇要填入的欄位';
  updateTileGridSelection();
  updateFuHandTypeState();
}

function openFuModal(){
  if (!ensureGameReady()) return;
  initFuModal();
  syncFuDefaults();
  App.fuReturnStep = App.winStep || 5;
  showModal('modal-fu');
}

function readFuForm(){
  const melds = [];
  for (let i = 0; i < 4; i++){
    const type = $(`fu-meld-${i}-type`).value;
    const open = $(`fu-meld-${i}-open`).value === 'open';
    const tileValue = $(`fu-meld-${i}-tile`).dataset.value || '';
    melds.push({
      type,
      open,
      tileValue,
      tile: getTileInfo(tileValue),
    });
  }
  return {
    handType: $('fu-hand-type').value,
    isMenzen: $('fu-menqian').value === 'yes',
    winType: $('fu-win-type').value,
    waitType: $('fu-wait-type').value,
    roundWind: $('fu-round-wind').value,
    seatWind: $('fu-seat-wind').value,
    pairTileValue: $('fu-pair-tile').dataset.value || '',
    pairTile: getTileInfo($('fu-pair-tile').dataset.value || ''),
    melds,
  };
}

function validateFuDetails(details){
  if (details.handType === 'chiitoi') return true;
  if (!details.pairTile){
    showToast('請選擇雀頭');
    return false;
  }
  for (let i = 0; i < details.melds.length; i++){
    const m = details.melds[i];
    if (m.type !== 'shuntsu' && !m.tile){
      showToast(`請選擇第 ${i + 1} 組面子牌`);
      return false;
    }
  }
  return true;
}

function isPinfu(details){
  if (details.handType !== 'normal') return false;
  if (!details.isMenzen) return false;
  if (details.waitType !== 'ryanmen') return false;
  if (details.melds.some(m => m.type !== 'shuntsu')) return false;
  if (isYakuhaiPair(details.pairTile, details.seatWind, details.roundWind)) return false;
  return true;
}

function calcMeldFu(meld){
  const tile = meld.tile;
  if (!tile) return null;
  const isYaochu = tile.type === 'honor' || tile.isTerminal;
  let base = isYaochu ? 4 : 2;
  if (!meld.open) base *= 2;
  if (meld.type === 'kan') base *= 4;

  const typeLabel = meld.type === 'pon'
    ? (meld.open ? '明刻' : '暗刻')
    : (meld.open ? '明槓' : '暗槓');
  const tileLabel = isYaochu ? '幺九' : '中張';
  return { value: base, label: `${typeLabel} ${tileLabel}` };
}

function calculateFu(details){
  if (details.handType === 'chiitoi'){
    return {
      totalFu: 25,
      items: [{ label: '七對子固定', value: 25 }],
      rawFu: 25,
      roundedFu: 25,
    };
  }

  if (isPinfu(details)){
    const fu = details.winType === 'ron' ? 30 : 20;
    return {
      totalFu: fu,
      items: [{ label: details.winType === 'ron' ? '平和（門前榮和）' : '平和（自摸）', value: fu }],
      rawFu: fu,
      roundedFu: fu,
    };
  }

  let fu = 20;
  const items = [{ label: '起符', value: 20 }];

  if (details.winType === 'tsumo'){
    fu += 2;
    items.push({ label: '自摸', value: 2 });
  }
  if (details.isMenzen && details.winType === 'ron'){
    fu += 10;
    items.push({ label: '門前榮和', value: 10 });
  }

  if (details.waitType === 'tanki'){
    fu += 2;
    items.push({ label: '聽牌型：單騎', value: 2 });
  } else if (details.waitType === 'kanchan'){
    fu += 2;
    items.push({ label: '聽牌型：嵌張', value: 2 });
  } else if (details.waitType === 'penchan'){
    fu += 2;
    items.push({ label: '聽牌型：邊張', value: 2 });
  }

  if (details.pairTile && details.pairTile.type === 'honor'){
    const isDragon = details.pairTile.kind === 'dragon';
    const isRoundWind = details.pairTile.kind === 'wind' && details.pairTile.wind === details.roundWind;
    const isSeatWind = details.pairTile.kind === 'wind' && details.pairTile.wind === details.seatWind;
    
    if (isDragon || isRoundWind || isSeatWind){
      // 連風檢查：同時是場風和自風
      if (isRoundWind && isSeatWind){
        fu += 4;
        items.push({ label: '連風雀頭（場風+自風）', value: 4 });
      } else {
        fu += 2;
        items.push({ label: '役牌雀頭', value: 2 });
      }
    }
  }

  for (const meld of details.melds){
    if (meld.type === 'shuntsu') continue;
    const detail = calcMeldFu(meld);
    if (detail){
      fu += detail.value;
      items.push(detail);
    }
  }

  let rawFu = fu;
  let roundedFu = Math.ceil(rawFu / 10) * 10;
  if (roundedFu !== rawFu){
    items.push({ label: '進位到10', value: roundedFu - rawFu });
  }

  // 副露30符規則：非門前和牌，若符數不是30，則調整為30
  if (!details.isMenzen && roundedFu !== 30){
    const adjustment = 30 - roundedFu;
    items.push({ label: '副露調整（最低30符）', value: adjustment });
    roundedFu = 30;
  }

  return { totalFu: roundedFu, items, rawFu, roundedFu };
}

function renderFuResult(result){
  const container = $('fu-result');
  if (!container) return;
  if (!result){
    container.innerHTML = '';
    return;
  }
  let html = `<div><strong>總符數：${result.totalFu} 符</strong></div>`;
  html += '<div class="fu-result-list">';
  for (const item of result.items){
    html += `<div class="fu-result-item"><span>${item.label}</span><span>${item.value} 符</span></div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

function applyFuResult(result){
  if (!result) return;
  App.winData.fu = result.totalFu;
  buildFuGrid(App.winData);
  App.winStep = App.fuReturnStep || 5;
  renderWinStep();
  showModal('modal-win');
  showToast(`已套用 ${result.totalFu} 符`);
}

// ─────────────────────────────────────────────────────────────
// Win Modal — step-by-step
// ─────────────────────────────────────────────────────────────
function openWinModal(){
  if (!ensureGameReady()) return;
  App.winStep = 1;
  App.winData = { winnerId:null, loserId:null, winType:null, han:null, fu:null };
  renderWinStep();
  showModal('modal-win');
}

function renderWinStep(){
  qsa('#modal-win .win-step').forEach(s => s.style.display = 'none');
  $(`win-step-${App.winStep}`).style.display = 'block';

  const titles = [
    '',
    '選擇和牌者',
    '和牌類型',
    '選擇放銃者',
    '輸入番數',
    '輸入符數',
    '確認',
  ];
  $('win-step-title').textContent = titles[App.winStep] || '';

  updateStepDots(App.winStep);

  const g = App.game;
  const d = App.winData;

  if (App.winStep === 1){
    buildPlayerSelector('win-winner-btns', pid => {
      d.winnerId = pid;
      App.winStep = 2;
      renderWinStep();
    });
  }

  if (App.winStep === 2){
    $('btn-win-tsumo').onclick = () => {
      d.winType = 'tsumo';
      App.winStep = 4;
      renderWinStep();
    };
    $('btn-win-ron').onclick = () => {
      d.winType = 'ron';
      App.winStep = 3;
      renderWinStep();
    };
  }

  if (App.winStep === 3){
    buildPlayerSelector('win-loser-btns', pid => {
      if (pid === d.winnerId) return;
      d.loserId = pid;
      App.winStep = 4;
      renderWinStep();
    }, d.winnerId);
  }

  if (App.winStep === 4){
    buildHanGrid(d);
  }

  if (App.winStep === 5){
    buildFuGrid(d);
  }

  if (App.winStep === 6){
    renderWinConfirm();
  }
}

function buildHanGrid(d){
  const hanBtns = $('win-han-btns');
  hanBtns.innerHTML = '';

  // Category labels
  const categories = [
    { label: '一般番數', range: [1, 4], cls: 'han-normal' },
    { label: '限定役', range: [5, 12], cls: 'han-limit' },
    { label: '役滿', range: [13, 13], cls: 'han-yakuman' },
  ];

  for (const cat of categories){
    const header = document.createElement('div');
    header.className = 'han-cat-label';
    header.textContent = cat.label;
    hanBtns.appendChild(header);

    const row = document.createElement('div');
    row.className = 'han-row';

    for (let h = cat.range[0]; h <= cat.range[1]; h++){
      const btn = document.createElement('button');
      btn.className = `han-btn ${cat.cls}${h === d.han ? ' selected' : ''}`;
      btn.dataset.han = h;

      let mainText, subText;
      if (h === 13){
        mainText = '役滿';
        subText  = '';
      } else if (h >= 11){
        mainText = `${h}番`;
        subText  = '三倍滿';
      } else if (h >= 8){
        mainText = `${h}番`;
        subText  = '倍滿';
      } else if (h >= 6){
        mainText = `${h}番`;
        subText  = '跳滿';
      } else if (h === 5){
        mainText = `5番`;
        subText  = '滿貫';
      } else if (h === 4){
        mainText = `4番`;
        subText  = '需符';
      } else {
        mainText = `${h}番`;
        subText  = '';
      }

      btn.innerHTML = `<span class="hb-main">${mainText}</span>${subText ? `<span class="hb-sub">${subText}</span>` : ''}`;

      btn.onclick = () => {
        d.han = h;
        qsa('#win-han-btns .han-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      row.appendChild(btn);
    }
    hanBtns.appendChild(row);
  }
}

function buildFuGrid(d){
  const fuBtns = $('win-fu-btns');
  fuBtns.innerHTML = '';
  const fuOptions = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
  for (const fu of fuOptions){
    const btn = document.createElement('button');
    btn.className = `fu-btn${fu === d.fu ? ' selected' : ''}`;
    btn.innerHTML = `<span class="fu-main">${fu}</span><span class="fu-sub">符</span>`;
    btn.onclick = () => {
      d.fu = fu;
      qsa('#win-fu-btns .fu-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    fuBtns.appendChild(btn);
  }
}

function updateStepDots(currentStep){
  // Map real steps to dot indices (steps 1-6, but step 3 may be skipped)
  const dots = qsa('#win-step-dots .step-dot');
  const d = App.winData;
  dots.forEach((dot, i) => {
    const dotStep = i + 1;
    dot.classList.remove('active', 'done', 'skipped');
    if (dotStep === currentStep) dot.classList.add('active');
    else if (dotStep < currentStep) dot.classList.add('done');
    // Mark step 3 (loser) as skipped if tsumo
    if (dotStep === 3 && d.winType === 'tsumo') dot.classList.add('skipped');
  });
}

function renderWinConfirm(){
  const g   = App.game;
  const d   = App.winData;
  const winner      = g.players[d.winnerId];
  const winnerIsDealer = d.winnerId === g.dealerIdx;
  const pmts = calcPayments(d.han, d.fu, winnerIsDealer, d.winType, g.honba);

  const limitStr = pmts.limit ? LIMIT_LABEL[pmts.limit] : '';
  const hanStr   = d.han >= 5
    ? `${d.han}番　${limitStr}`
    : `${d.han}番 ${d.fu}符　${limitStr}`;

  let html = '';
  html += `<div class="confirm-row"><span>和牌者</span><strong>${winner.name}</strong></div>`;
  html += `<div class="confirm-row"><span>和牌類型</span><strong>${d.winType === 'tsumo' ? '自摸' : '榮和'}</strong></div>`;
  if (d.winType === 'ron'){
    html += `<div class="confirm-row"><span>放銃者</span><strong>${g.players[d.loserId].name}</strong></div>`;
  }
  html += `<div class="confirm-row"><span>番符</span><strong>${hanStr}</strong></div>`;

  // Payment breakdown
  const deltas = computeDeltas(d, g, pmts);
  html += `<div class="confirm-row total"><span>獲得點數</span><strong class="pts-positive">+${pmts.total.toLocaleString()}</strong></div>`;

  if (g.riichiPool > 0){
    html += `<div class="confirm-row"><span>供託收入</span><strong class="pts-positive">+${(g.riichiPool * 1000).toLocaleString()}</strong></div>`;
  }
  if (g.honba > 0){
    const bonus = d.winType === 'ron' ? g.honba * 300 : g.honba * 100 * (winnerIsDealer ? (g.numPlayers - 1) : 1);
    html += `<div class="confirm-row"><span>本場加點</span><strong class="pts-positive">+${bonus.toLocaleString()}</strong></div>`;
  }

  // Delta table
  html += '<div class="delta-preview">';
  for (let i = 0; i < g.numPlayers; i++){
    const p  = g.players[i];
    const dv = deltas[i];
    const cls = dv > 0 ? 'pts-positive' : dv < 0 ? 'pts-negative' : '';
    html += `<div class="delta-row">
      <span class="dr-name">${p.name}</span>
      <span class="dr-delta ${cls}">${fmtDelta(dv)}</span>
      <span class="dr-arrow ${cls}">${dv > 0 ? '▲' : dv < 0 ? '▼' : '—'}</span>
    </div>`;
  }
  html += '</div>';

  $('win-confirm-body').innerHTML = html;

  $('btn-win-confirm').onclick = () => {
    const ev = g.processWin(d.winnerId, d.loserId, d.han, d.fu, d.winType);
    hideModal('modal-win');
    showResultModal(ev);
  };

  $('btn-win-back').onclick = () => {
    App.winStep = d.han >= 5 ? 4 : 5;
    renderWinStep();
  };
}

function computeDeltas(d, g, pmts){
  const deltas = Array(g.numPlayers).fill(0);
  const winnerIsDealer = d.winnerId === g.dealerIdx;

  if (d.winType === 'ron'){
    deltas[d.winnerId] += pmts.loserPays;
    deltas[d.loserId]  -= pmts.loserPays;
  } else {
    for (let i = 0; i < g.numPlayers; i++){
      if (i === d.winnerId) continue;
      const amt = winnerIsDealer
        ? pmts.eachPays
        : (i === g.dealerIdx ? pmts.dealerPays : pmts.nonDealerPays);
      deltas[d.winnerId] += amt;
      deltas[i] -= amt;
    }
  }
  deltas[d.winnerId] += g.riichiPool * 1000;
  return deltas;
}

function buildPlayerSelector(containerId, cb, excludeId = null){
  const g = App.game;
  const container = $(containerId);
  container.innerHTML = '';
  for (let i = 0; i < g.numPlayers; i++){
    const p   = g.players[i];
    const btn = document.createElement('button');
    const wind    = g.getWind(i);
    const isDealer = i === g.dealerIdx;
    const excluded = i === excludeId;
    btn.className = `player-select-btn${excluded ? ' ps-disabled' : ''}`;
    btn.disabled  = excluded;
    btn.innerHTML = `
      <span class="ps-wind">${WIND_KAN[wind]}${isDealer ? '<span class="ps-dealer">莊</span>' : ''}</span>
      <span class="ps-name">${p.name}</span>
      <span class="ps-score">${fmt(p.score)}</span>`;
    btn.onclick = () => cb(i);
    container.appendChild(btn);
  }
}

// ─────────────────────────────────────────────────────────────
// Draw Modal
// ─────────────────────────────────────────────────────────────
function openDrawModal(){
  if (!ensureGameReady()) return;
  App.drawData.tenpaiIds = [];
  const g = App.game;
  const container = $('draw-tenpai-btns');
  container.innerHTML = '';

  for (let i = 0; i < g.numPlayers; i++){
    const p    = g.players[i];
    const wind = g.getWind(i);
    const isDealer = i === g.dealerIdx;

    const btn = document.createElement('button');
    btn.className  = 'draw-player-btn';
    btn.dataset.pid = i;
    btn.innerHTML  = `
      <span class="dp-wind">${WIND_KAN[wind]}${isDealer ? '<small>莊</small>' : ''}</span>
      <span class="dp-name">${p.name}</span>
      <span class="dp-status">未聽</span>`;

    btn.onclick = () => {
      const idx = App.drawData.tenpaiIds.indexOf(i);
      if (idx === -1){
        App.drawData.tenpaiIds.push(i);
        btn.classList.add('tenpai');
        btn.querySelector('.dp-status').textContent = '聽牌';
      } else {
        App.drawData.tenpaiIds.splice(idx, 1);
        btn.classList.remove('tenpai');
        btn.querySelector('.dp-status').textContent = '未聽';
      }
      updateDrawPreview();
    };
    container.appendChild(btn);
  }

  updateDrawPreview();
  showModal('modal-draw');
}

function updateDrawPreview(){
  const g   = App.game;
  const ids = App.drawData.tenpaiIds;
  const tc  = ids.length;
  const nc  = g.numPlayers - tc;
  const deltas = Array(g.numPlayers).fill(0);

  if (tc > 0 && tc < g.numPlayers){
    const recv = 3000 / tc;
    const pay  = 3000 / nc;
    for (let i = 0; i < g.numPlayers; i++){
      deltas[i] = ids.includes(i) ? recv : -pay;
    }
  }

  let html = '<div class="delta-preview">';
  for (let i = 0; i < g.numPlayers; i++){
    const p  = g.players[i];
    const dv = deltas[i];
    const cls = dv > 0 ? 'pts-positive' : dv < 0 ? 'pts-negative' : '';
    html += `<div class="delta-row">
      <span class="dr-name">${p.name}</span>
      <span class="dr-delta ${cls}">${fmtDelta(dv)}</span>
      <span class="dr-arrow ${cls}">${dv > 0 ? '▲' : dv < 0 ? '▼' : '—'}</span>
    </div>`;
  }
  html += '</div>';
  $('draw-preview').innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// Result Modal
// ─────────────────────────────────────────────────────────────
function showResultModal(ev){
  const g = App.game;
  let titleText = '';
  let bodyHtml  = '';

  if (ev.type === 'win'){
    const winner   = g.players[ev.winnerId];
    const limitStr = ev.payments.limit ? LIMIT_LABEL[ev.payments.limit] : '';
    const hanStr   = ev.han >= 5
      ? `${ev.han}番　${limitStr}`
      : `${ev.han}番 ${ev.fu}符${limitStr ? '　' + limitStr : ''}`;
    const typeStr  = ev.winType === 'tsumo' ? '自摸' : '榮和';

    titleText = `${winner.name}　${typeStr}`;
    bodyHtml  = `
      <div class="result-hand">
        <span class="result-hand-label">${hanStr}</span>
        <span class="result-pts">+${ev.payments.total.toLocaleString()}</span>
      </div>`;
    if (ev.riichiPool > 0){
      bodyHtml += `<div class="result-sub">供託 +${(ev.riichiPool * 1000).toLocaleString()}</div>`;
    }
  } else if (ev.type === 'draw'){
    titleText = '流局';
    if (ev.drawKind === 'abortive'){
      const label = ev.reason === 'kyuushu' ? '九種九牌' : (ev.reason === 'suukantsu' ? '四槓散了' : '途中流局');
      bodyHtml = `<div class="result-hand result-draw">${label}</div>`;
    } else {
      const tc = ev.tenpaiIds.length;
      if (tc === 0)      bodyHtml = '<div class="result-hand result-draw">全員未聽</div>';
      else if (tc === g.numPlayers) bodyHtml = '<div class="result-hand result-draw">全員聽牌</div>';
      else               bodyHtml = `<div class="result-hand result-draw">聽牌 ${tc} 人 / 未聽 ${g.numPlayers-tc} 人</div>`;
    }
  } else if (ev.type === 'chombo'){
    titleText = '錯和';
    bodyHtml  = `<div class="result-hand result-chombo">${g.players[ev.pid].name}　錯和</div>`;
  }

  // Delta table
  bodyHtml += '<div class="result-deltas">';
  for (let i = 0; i < g.numPlayers; i++){
    const p     = g.players[i];
    const delta = ev.deltas[i];
    const score = ev.scoreAfter[i];
    const cls   = delta > 0 ? 'pts-positive' : delta < 0 ? 'pts-negative' : '';
    bodyHtml += `
      <div class="result-delta-row${ev.type === 'win' && i === ev.winnerId ? ' result-winner-row' : ''}">
        <span class="rd-name">${p.name}</span>
        <span class="rd-delta ${cls}">${fmtDelta(delta)}</span>
        <span class="rd-score${score < 0 ? ' pts-negative' : ''}">${fmt(score)}</span>
      </div>`;
  }
  bodyHtml += '</div>';

  if (!g.ended){
    bodyHtml += `<div class="result-next">下一局：${g.getRoundLabel()}　${g.honba > 0 ? g.honba + ' 本場' : ''}</div>`;
  } else {
    bodyHtml += `<div class="result-next result-end-notice">遊戲結束</div>`;
  }

  $('result-title').textContent = titleText;
  $('result-body').innerHTML    = bodyHtml;

  const okBtn = $('btn-result-ok');
  okBtn.textContent = g.ended ? '查看結果' : '下一局';
  okBtn.onclick = () => {
    hideModal('modal-result');
    if (g.ended) showEndScreen();
    else         renderGame();
  };

  showModal('modal-result');
}

// ─────────────────────────────────────────────────────────────
// End Screen
// ─────────────────────────────────────────────────────────────
function showEndScreen(){
  const g      = App.game;
  const finals = g.getFinalScores();

  const rankLabels = ['一', '二', '三', '四'];
  let html = '';
  for (const f of finals){
    const rankCls  = ['first','second','third','fourth'][f.rank - 1];
    const finalCls = f.final >= 0 ? 'pts-positive' : 'pts-negative';
    const umaCls   = f.uma  >= 0 ? 'pts-positive' : 'pts-negative';
    html += `
      <div class="end-row rank-${rankCls}">
        <div class="end-rank-badge">
          <span class="end-rank-num">${f.rank}</span>
          <span class="end-rank-label">位</span>
        </div>
        <div class="end-info">
          <div class="end-name">${f.player.name}</div>
          <div class="end-detail">
            <span class="end-raw">${fmt(f.player.score)}</span>
            <span class="end-uma-label">馬</span>
            <span class="end-uma ${umaCls}">${fmtFinal(f.uma / 1000)}</span>
          </div>
        </div>
        <div class="end-final ${finalCls}">${fmtFinal(f.final)}</div>
      </div>`;
  }

  $('end-results').innerHTML = html;
  $('end-round-label').textContent = g.getRoundLabel();
  showScreen('screen-end');
}

// ─────────────────────────────────────────────────────────────
// Event Bindings
// ─────────────────────────────────────────────────────────────
function showHistoryModal(){
  if (!App.game || App.game.history.length === 0){
    showToast('沒有遊戲記錄');
    return;
  }

  const tbody = $('history-tbody');
  tbody.innerHTML = '';

  const g = App.game;
  const playerNames = g.players.map(p => p.name);

  // Build header dynamically to include one column per player
  const thead = document.querySelector('#history-table thead');
  const headerCols = ['<th>時間</th>', '<th>局</th>', '<th>事件</th>'];
  for (let pi = 0; pi < playerNames.length; pi++){
    headerCols.push(`<th>${playerNames[pi]}</th>`);
  }
  thead.innerHTML = `<tr>${headerCols.join('')}</tr>`;

  for (let i = 0; i < g.history.length; i++){
    const ev = g.history[i];
    let eventDesc = '';

    if (ev.type === 'win'){
      const winnerName = playerNames[ev.winnerId];
      const loserName = ev.loserId !== null ? playerNames[ev.loserId] : '自摸';
      eventDesc = `${LIMIT_LABEL[ev.payments.limit] || ''} ${ev.han}番${ev.fu}符 ${ev.winType === 'ron' ? '放銃' : '自摸'}`;
    } else if (ev.type === 'draw'){
      if (ev.drawKind === 'abortive'){
        eventDesc = `途中流局 (${ev.reason === 'kyuushu' ? '九種九牌' : '四槓散了'})`;
      } else {
        const tenpaiCt = ev.tenpaiIds.length;
        eventDesc = `流局 (${tenpaiCt}人聽、${g.numPlayers - tenpaiCt}人失聽)`;
      }
    } else if (ev.type === 'chombo'){
      const playerName = playerNames[ev.pid];
      eventDesc = '錯和';
    }

    const row = document.createElement('tr');
    const cells = [];
    const timeStr = ev.timestamp !== undefined ? fmtTime(ev.timestamp) : '-';
    cells.push(`<td>${timeStr}</td>`);
    cells.push(`<td>${ev.round}</td>`);
    cells.push(`<td>${eventDesc}</td>`);

    // Per-player columns: show delta and cumulative score for each player
    for (let pi = 0; pi < g.players.length; pi++){
      const d = ev.deltas && ev.deltas[pi] != null ? ev.deltas[pi] : 0;
      const s = ev.scoreAfter && ev.scoreAfter[pi] != null ? ev.scoreAfter[pi] : g.players[pi].score;
      const cls = d > 0 ? 'pts-positive' : d < 0 ? 'pts-negative' : '';
      cells.push(`<td><div class="hist-delta ${cls}">${fmtDelta(d)}</div><div class="hist-score">${fmt(s)}</div></td>`);
    }

    row.innerHTML = cells.join('');
    tbody.appendChild(row);
  }

  showModal('modal-history');
}

// ─────────────────────────────────────────────────────────────
// Event Bindings
// ─────────────────────────────────────────────────────────────
function bindGameEvents(){
  // Action buttons
  $('btn-win').addEventListener('click', openWinModal);
  $('btn-draw').addEventListener('click', openDrawModal);

  $('btn-draw-confirm').addEventListener('click', () => {
    if (!ensureGameReady()) return;
    const ev = App.game.processDraw(App.drawData.tenpaiIds);
    hideModal('modal-draw');
    showResultModal(ev);
  });

  $('btn-draw-kyuushu').addEventListener('click', () => {
    if (!ensureGameReady()) return;
    const ev = App.game.processAbortiveDraw('kyuushu');
    hideModal('modal-draw');
    showResultModal(ev);
  });

  $('btn-draw-suukantsu').addEventListener('click', () => {
    if (!ensureGameReady()) return;
    const ev = App.game.processAbortiveDraw('suukantsu');
    hideModal('modal-draw');
    showResultModal(ev);
  });

  $('btn-chombo').addEventListener('click', () => {
    if (!ensureGameReady()) return;
    buildPlayerSelector('chombo-btns', pid => {
      const ev = App.game.processChombo(pid);
      hideModal('modal-chombo');
      showResultModal(ev);
    });
    showModal('modal-chombo');
  });

  // Riichi buttons (delegated)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-riichi');
    if (!btn || !App.game) return;
    const pid = parseInt(btn.dataset.pid);
    const g   = App.game;
    if (g.riichiThisRound.has(pid)) g.cancelRiichi(pid);
    else                            g.declareRiichi(pid);
    renderGame();
  });

  // Win modal — step 4 back button
  $('btn-win-step-back').addEventListener('click', () => {
    if (App.winStep <= 1){ hideModal('modal-win'); return; }
    const d = App.winData;
    if (App.winStep === 4 && d.winType === 'tsumo') App.winStep = 2;
    else App.winStep--;
    renderWinStep();
  });

  // ── BUG FIX: step 5 back button was unbound ──────────────
  $('btn-win-step-back-5').addEventListener('click', () => {
    App.winStep = 4;
    renderWinStep();
  });
  // ──────────────────────────────────────────────────────────

  // Han confirm
  $('btn-han-confirm').addEventListener('click', () => {
    const d = App.winData;
    if (d.han === null){
      showToast('請選擇番數');
      return;
    }
    if (d.han >= 5){
      d.fu = 30;
      App.winStep = 6;
    } else {
      App.winStep = 5;
    }
    renderWinStep();
  });

  // Fu confirm
  $('btn-fu-confirm').addEventListener('click', () => {
    if (App.winData.fu === null){
      showToast('請選擇符數');
      return;
    }
    App.winStep = 6;
    renderWinStep();
  });

  // Auto Fu
  $('btn-fu-auto').addEventListener('click', () => {
    openFuModal();
  });

  // Modal close buttons
  $('btn-win-close').addEventListener('click',    () => hideModal('modal-win'));
  $('btn-draw-close').addEventListener('click',   () => hideModal('modal-draw'));
  $('btn-chombo-close').addEventListener('click', () => hideModal('modal-chombo'));
  $('btn-fu-close').addEventListener('click',     () => hideModal('modal-fu'));

  $('btn-fu-calc').addEventListener('click', () => {
    const details = readFuForm();
    if (!validateFuDetails(details)) return;
    const result = calculateFu(details);
    App.fuCalcResult = result;
    renderFuResult(result);
  });

  $('btn-fu-apply').addEventListener('click', () => {
    let result = App.fuCalcResult;
    if (!result){
      const details = readFuForm();
      if (!validateFuDetails(details)) return;
      result = calculateFu(details);
      App.fuCalcResult = result;
      renderFuResult(result);
    }
    applyFuResult(result);
  });

  $('fu-tile-clear').addEventListener('click', () => {
    clearActiveTile();
  });

  // Undo button (require confirmation to avoid accidental undo)
  $('btn-undo').addEventListener('click', () => {
    if (!ensureGameReady()) return;
    if (App.game.history.length === 0){
      showToast('沒有可以撤銷的動作');
      return;
    }

    // Native confirm is simple and reliable across browsers
    const ok = window.confirm('確定要撤銷上一個動作嗎？此操作會還原分數與局況。');
    if (!ok) return;

    if (App.game.undoLastEvent()){
      renderGame();
      showToast('已撤銷上一個動作');
    }
  });

  // History button
  $('btn-history').addEventListener('click', () => {
    showHistoryModal();
  });

  // History modal close
  $('btn-history-close').addEventListener('click', () => {
    hideModal('modal-history');
  });
  $('btn-history-ok').addEventListener('click', () => {
    hideModal('modal-history');
  });

  // End screen
  $('btn-new-game').addEventListener('click', () => {
    App.game = null;
    showScreen('screen-setup');
  });
  $('btn-rematch').addEventListener('click', () => {
    const names = App.game.players.map(p => p.name);
    const cfg   = { ...App.game.config, names };
    App.game = new MahjongGame(cfg);
    App.prevScores = null;
    renderGame();
    showScreen('screen-game');
  });
}

// ─────────────────────────────────────────────────────────────
// Toast Notification
// ─────────────────────────────────────────────────────────────
function showToast(msg){
  let toast = $('toast');
  if (!toast){
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ─────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
  bindGameEvents();

  if (!App.game) showScreen('screen-setup');

  // Prevent double-tap zoom (tablet mode)
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

  // Handle orientation change for tablet mode
  window.addEventListener('orientationchange', () => {
    if (App.game) renderGame();
  });
});