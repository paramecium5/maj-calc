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
};

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const qs  = sel => document.querySelector(sel);
const qsa = sel => document.querySelectorAll(sel);

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
function initSetup(){
  const defaultNames = ['玩家一','玩家二','玩家三','玩家四'];
  for (let i = 0; i < 4; i++){
    $(`setup-name-${i}`).value = defaultNames[i];
  }
  $('btn-start').addEventListener('click', startGame);
}

function startGame(){
  const names = [0,1,2,3].map(i => {
    const val = $(`setup-name-${i}`).value.trim();
    return val || `玩家${i+1}`;
  });

  const gameLength  = $('setup-length').value;
  const startPoints = parseInt($('setup-points').value) || 25000;
  const umaKey      = $('setup-uma').value;
  const uma = {
    '20-10': [20000, 10000,-10000,-20000],
    '15-5':  [15000,  5000, -5000,-15000],
    '10-5':  [10000,  5000, -5000,-10000],
    '0':     [0, 0, 0, 0],
  }[umaKey] || [20000,10000,-10000,-20000];

  App.game = new MahjongGame({ names, gameLength, startPoints, uma });
  App.prevScores = null;
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
  for (let i = 0; i < 4; i++){
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
  const max = Math.min(count, 6);
  for (let i = 0; i < max; i++){
    const stick = document.createElement('div');
    stick.className = 'riichi-stick-icon';
    container.appendChild(stick);
  }
  if (count > 6){
    const more = document.createElement('span');
    more.className = 'riichi-count-more';
    more.textContent = `×${count}`;
    container.appendChild(more);
  }
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
    const bonus = d.winType === 'ron' ? g.honba * 300 : g.honba * 100 * (winnerIsDealer ? 3 : 1);
    html += `<div class="confirm-row"><span>本場加點</span><strong class="pts-positive">+${bonus.toLocaleString()}</strong></div>`;
  }

  // Delta table
  html += '<div class="delta-preview">';
  for (let i = 0; i < 4; i++){
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
  const deltas = [0, 0, 0, 0];
  const winnerIsDealer = d.winnerId === g.dealerIdx;

  if (d.winType === 'ron'){
    deltas[d.winnerId] += pmts.loserPays;
    deltas[d.loserId]  -= pmts.loserPays;
  } else {
    for (let i = 0; i < 4; i++){
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
  for (let i = 0; i < 4; i++){
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

  for (let i = 0; i < 4; i++){
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
  const nc  = 4 - tc;
  const deltas = [0, 0, 0, 0];

  if (tc > 0 && tc < 4){
    const recv = 3000 / tc;
    const pay  = 3000 / nc;
    for (let i = 0; i < 4; i++){
      deltas[i] = ids.includes(i) ? recv : -pay;
    }
  }

  let html = '<div class="delta-preview">';
  for (let i = 0; i < 4; i++){
    const p  = g.players[i];
    const dv = deltas[i];
    const cls = dv > 0 ? 'pts-positive' : dv < 0 ? 'pts-negative' : '';
    html += `<div class="delta-row">
      <span class="dr-name">${p.name}</span>
      <span class="dr-delta ${cls}">${fmtDelta(dv)}</span>
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
    const tc = ev.tenpaiIds.length;
    if (tc === 0)      bodyHtml = '<div class="result-hand result-draw">全員未聽</div>';
    else if (tc === 4) bodyHtml = '<div class="result-hand result-draw">全員聽牌</div>';
    else               bodyHtml = `<div class="result-hand result-draw">聽牌 ${tc} 人 / 未聽 ${4-tc} 人</div>`;
  } else if (ev.type === 'chombo'){
    titleText = '錯和';
    bodyHtml  = `<div class="result-hand result-chombo">${g.players[ev.pid].name}　錯和</div>`;
  }

  // Delta table
  bodyHtml += '<div class="result-deltas">';
  for (let i = 0; i < 4; i++){
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

  // Modal close buttons
  $('btn-win-close').addEventListener('click',    () => hideModal('modal-win'));
  $('btn-draw-close').addEventListener('click',   () => hideModal('modal-draw'));
  $('btn-chombo-close').addEventListener('click', () => hideModal('modal-chombo'));

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