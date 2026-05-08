'use strict';

// ── Wind constants ─────────────────────────────────────────
const WINDS = ['east','south','west','north'];
const WINDS_3P = ['east','south','west'];  // Three-player mahjong winds
const WIND_KAN = { east:'東', south:'南', west:'西', north:'北' };
const WIND_NAME = { east:'東家', south:'南家', west:'西家', north:'北家' };
const WIND_NAME_3P = { east:'東家', south:'南家', west:'西家' };

// ── Scoring helpers for 4-player ───────────────────────────
function ru100(n){ return Math.ceil(n / 100) * 100; }

function getLimit(han, fu){
  if (han >= 13) return 'yakuman';
  if (han >= 11) return 'sanbaiman';
  if (han >= 8)  return 'baiman';
  if (han >= 6)  return 'haneman';
  if (han >= 5)  return 'mangan';
  if (han === 4 && fu >= 30) return 'mangan';
  if (han === 3 && fu >= 70) return 'mangan';
  return null;
}

const LIMIT_LABEL = {
  mangan:'滿貫', haneman:'跳滿', baiman:'倍滿',
  sanbaiman:'三倍滿', yakuman:'役滿'
};

// [dealerRon, dealerTsumoEach, nonDealerRon, tsumoDealer, tsumoNonDealer]
const LIMIT_TABLE = {
  mangan:    [12000, 4000,  8000, 4000, 2000],
  haneman:   [18000, 6000, 12000, 6000, 3000],
  baiman:    [24000, 8000, 16000, 8000, 4000],
  sanbaiman: [36000,12000, 24000,12000, 6000],
  yakuman:   [48000,16000, 32000,16000, 8000],
};

function calcRegularTable(han, fu){
  const b = fu * Math.pow(2, han + 2);
  return {
    dealerRon:       ru100(b * 6),
    dealerTsumoEach: ru100(b * 2),
    nonDealerRon:    ru100(b * 4),
    tsumoDealer:     ru100(b * 2),
    tsumoNonDealer:  ru100(b * 1),
  };
}

/**
 * Returns payment breakdown for a win.
 * All honba bonuses already included.
 */
function calcPayments(han, fu, winnerIsDealer, winType, honba, numPlayers = 4, threePlayerMode = 'zimo-loss'){
  const limit = getLimit(han, fu);
  let t;

  if (limit){
    const [dR, dT, nR, tD, tN] = LIMIT_TABLE[limit];
    t = { dealerRon:dR, dealerTsumoEach:dT, nonDealerRon:nR, tsumoDealer:tD, tsumoNonDealer:tN };
  } else {
    t = calcRegularTable(han, fu);
  }

  const honbaRon   = honba * 300;   // full bonus for ron
  const honbaTsumo = honba * 100;   // per player for tsumo

  if (winnerIsDealer){
    if (winType === 'ron'){
      const pay = t.dealerRon + honbaRon;
      return { loserPays: pay, total: pay, winType, limit, han, fu };
    } else {
      const each = t.dealerTsumoEach + honbaTsumo;
      return { eachPays: each, total: each * (numPlayers - 1), winType, limit, han, fu };
    }
  } else {
    if (winType === 'ron'){
      const pay = t.nonDealerRon + honbaRon;
      return { loserPays: pay, total: pay, winType, limit, han, fu };
    } else {
      const extra = numPlayers === 3 && threePlayerMode === 'plus1000' ? 1000 : 0;
      const dPay = t.tsumoDealer    + honbaTsumo + extra;
      const nPay = t.tsumoNonDealer + honbaTsumo + extra;
      return { dealerPays: dPay, nonDealerPays: nPay, total: dPay + nPay * (numPlayers - 2), winType, limit, han, fu };
    }
  }
}

// ── MahjongGame ────────────────────────────────────────────
class MahjongGame {
  constructor(cfg){
    this.numPlayers = cfg.numPlayers ?? 4;
    this.config = {
      startPoints:  cfg.startPoints  ?? (this.numPlayers === 3 ? 35000 : 25000),
      returnPoints: cfg.returnPoints ?? (this.numPlayers === 3 ? 40000 : 30000),
      uma:          cfg.uma          ?? (this.numPlayers === 3 
        ? [10000, 0, -10000]  // 3P uma
        : [20000, 10000, -10000, -20000]),  // 4P uma
      gameLength:   cfg.gameLength   ?? 'east-south',   // 'east' | 'east-south'
      endOnBust:    cfg.endOnBust    !== false,
      threePlayerMode: cfg.threePlayerMode ?? 'zimo-loss',
    };

    const winds = this.numPlayers === 3 ? ['bottom','right','top'] : ['bottom','right','top','left'];
    // Positions: [0]=bottom, [1]=right, [2]=top, [3]=left
    this.players = cfg.names.map((name, i) => ({
      id: i,
      name,
      score: this.config.startPoints,
      position: winds[i],
    }));

    this.roundWind    = 'east';
    this.roundNumber  = 1;
    this.dealerIdx    = 0;
    this.honba        = 0;
    this.riichiPool   = 0;
    this.riichiThisRound = new Set();
    this.history      = [];
    this.startTime    = Date.now();  // Game start time for timer
    this.ended        = false;
  }

  get dealer(){ return this.players[this.dealerIdx]; }

  /** Seat wind for a player relative to current dealer */
  getWind(pid){
    if (this.numPlayers === 3){
      return WINDS_3P[(pid - this.dealerIdx + 3) % 3];
    } else {
      return WINDS[(pid - this.dealerIdx + 4) % 4];
    }
  }

  getRoundLabel(){
    return `${WIND_KAN[this.roundWind]}${this.roundNumber}局`;
  }

  getRoundWindLabel(){
    return WIND_KAN[this.roundWind] + '場';
  }

  /** Declare riichi for a player (deducts 1000 from score) */
  declareRiichi(pid){
    if (this.riichiThisRound.has(pid)) return false;
    this.riichiThisRound.add(pid);
    this.players[pid].score -= 1000;
    this.riichiPool++;
    return true;
  }

  cancelRiichi(pid){
    if (!this.riichiThisRound.has(pid)) return false;
    this.riichiThisRound.delete(pid);
    this.players[pid].score += 1000;
    this.riichiPool--;
    return true;
  }

  /**
   * Process a winning hand.
   * @param {number} winnerId  - player index who won
   * @param {number|null} loserId - player who dealt in (null for tsumo)
   * @param {number} han
   * @param {number} fu
   * @param {'ron'|'tsumo'} winType
   */
  processWin(winnerId, loserId, han, fu, winType){
    // Save game state before the event
    const gameStateBefore = {
      dealerIdx: this.dealerIdx,
      honba: this.honba,
      roundWind: this.roundWind,
      roundNumber: this.roundNumber,
      riichiPool: this.riichiPool,
      riichiThisRound: new Set(this.riichiThisRound),
      ended: this.ended,
    };

    const winnerIsDealer = winnerId === this.dealerIdx;
    const pmts = calcPayments(han, fu, winnerIsDealer, winType, this.honba, this.numPlayers, this.config.threePlayerMode);

    const deltas = Array(this.numPlayers).fill(0);

    if (winType === 'ron'){
      deltas[winnerId] += pmts.loserPays;
      deltas[loserId]  -= pmts.loserPays;
    } else {
      for (let i = 0; i < this.numPlayers; i++){
        if (i === winnerId) continue;
        const amt = winnerIsDealer
          ? pmts.eachPays
          : (i === this.dealerIdx ? pmts.dealerPays : pmts.nonDealerPays);
        deltas[winnerId] += amt;
        deltas[i]        -= amt;
      }
    }

    // Winner takes riichi pool
    deltas[winnerId] += this.riichiPool * 1000;

    const scoreBefore = this.players.map(p => p.score);
    for (let i = 0; i < this.numPlayers; i++) this.players[i].score += deltas[i];

    const elapsedMs = Date.now() - this.startTime;
    const ev = {
      type: 'win',
      round: this.getRoundLabel(),
      honba: this.honba,
      winnerId,
      loserId: winType === 'ron' ? loserId : null,
      winType, han, fu,
      payments: pmts,
      deltas,
      riichiPool: this.riichiPool,
      riichiPlayers: [...this.riichiThisRound],
      scoreBefore,
      scoreAfter: this.players.map(p => p.score),
      gameStateBefore,
      timestamp: elapsedMs,
    };

    this.riichiPool = 0;
    this.riichiThisRound.clear();
    this.history.push(ev);

    if (winnerIsDealer) this.honba++;
    else this._rotateDealer();

    if (this._checkEnd()) this.ended = true;
    return ev;
  }

  /**
   * Process an exhaustive draw (流局).
   * @param {number[]} tenpaiIds - player indices who are tenpai
   */
  processDraw(tenpaiIds){
    // Save game state before the event
    const gameStateBefore = {
      dealerIdx: this.dealerIdx,
      honba: this.honba,
      roundWind: this.roundWind,
      roundNumber: this.roundNumber,
      riichiPool: this.riichiPool,
      riichiThisRound: new Set(this.riichiThisRound),
      ended: this.ended,
    };

    const deltas = Array(this.numPlayers).fill(0);
    const tc = tenpaiIds.length;
    const nc = this.numPlayers - tc;

    if (tc > 0 && tc < this.numPlayers){
      const recv = 3000 / tc;
      const pay  = 3000 / nc;
      for (let i = 0; i < this.numPlayers; i++){
        if (tenpaiIds.includes(i)) deltas[i] += recv;
        else                       deltas[i] -= pay;
      }
    }

    const scoreBefore = this.players.map(p => p.score);
    for (let i = 0; i < this.numPlayers; i++) this.players[i].score += deltas[i];

    const dealerTenpai = tenpaiIds.includes(this.dealerIdx);
    const elapsedMs = Date.now() - this.startTime;
    const ev = {
      type: 'draw',
      round: this.getRoundLabel(),
      honba: this.honba,
      tenpaiIds, dealerTenpai, deltas,
      riichiPool: this.riichiPool,
      riichiPlayers: [...this.riichiThisRound],
      scoreBefore,
      scoreAfter: this.players.map(p => p.score),
      gameStateBefore,
      timestamp: elapsedMs,
    };

    this.history.push(ev);
    this.riichiThisRound.clear();
    // Riichi pool stays on the table for next round
    this.honba++;
    if (!dealerTenpai) this._rotateDealer();
    if (this._checkEnd()) this.ended = true;
    return ev;
  }

  /**
   * Process an abortive draw (途中流局), e.g. 九種九牌 or 四槓散了.
   * Dealer always keeps dealership and honba increases.
   */
  processAbortiveDraw(reason){
    // Save game state before the event
    const gameStateBefore = {
      dealerIdx: this.dealerIdx,
      honba: this.honba,
      roundWind: this.roundWind,
      roundNumber: this.roundNumber,
      riichiPool: this.riichiPool,
      riichiThisRound: new Set(this.riichiThisRound),
      ended: this.ended,
    };

    const deltas = Array(this.numPlayers).fill(0);
    const scoreBefore = this.players.map(p => p.score);

    const elapsedMs = Date.now() - this.startTime;
    const ev = {
      type: 'draw',
      drawKind: 'abortive',
      reason,
      round: this.getRoundLabel(),
      honba: this.honba,
      tenpaiIds: [],
      dealerTenpai: true,
      deltas,
      riichiPool: this.riichiPool,
      riichiPlayers: [...this.riichiThisRound],
      scoreBefore,
      scoreAfter: this.players.map(p => p.score),
      gameStateBefore,
      timestamp: elapsedMs,
    };

    this.history.push(ev);
    this.riichiThisRound.clear();
    // Riichi pool stays on table, abortive draw is always renchan.
    this.honba++;
    if (this._checkEnd()) this.ended = true;
    return ev;
  }

  /**
   * Process a chombo (誤和了 / 錯和).
   * The offending player pays mangan to all others.
   */
  processChombo(pid){
    // Save game state before the event
    const gameStateBefore = {
      dealerIdx: this.dealerIdx,
      honba: this.honba,
      roundWind: this.roundWind,
      roundNumber: this.roundNumber,
      riichiPool: this.riichiPool,
      riichiThisRound: new Set(this.riichiThisRound),
      ended: this.ended,
    };

    const isDealer  = pid === this.dealerIdx;
    const penalty   = this.numPlayers === 3
      ? (isDealer ? 16000 : 12000)
      : (isDealer ? 12000 : 8000);
    const eachRecv  = Math.floor(penalty / (this.numPlayers - 1));

    const deltas = Array(this.numPlayers).fill(0);
    deltas[pid] -= penalty;
    for (let i = 0; i < this.numPlayers; i++){
      if (i !== pid) deltas[i] += eachRecv;
    }

    const scoreBefore = this.players.map(p => p.score);
    for (let i = 0; i < this.numPlayers; i++) this.players[i].score += deltas[i];

    const elapsedMs = Date.now() - this.startTime;
    const ev = {
      type: 'chombo',
      round: this.getRoundLabel(),
      pid, deltas, scoreBefore,
      scoreAfter: this.players.map(p => p.score),
      gameStateBefore,
      timestamp: elapsedMs,
    };
    this.history.push(ev);
    // Round does not advance on chombo
    return ev;
  }

  _rotateDealer(){
    this.honba    = 0;
    this.dealerIdx = (this.dealerIdx + 1) % this.numPlayers;

    if (this.dealerIdx === 0){
      if (this.roundWind === 'east'){
        if (this.config.gameLength === 'east-south'){
          this.roundWind   = 'south';
          this.roundNumber = 1;
        } else {
          this.ended = true;
        }
      } else {
        this.ended = true;
      }
    } else {
      this.roundNumber++;
    }
  }

  _checkEnd(){
    if (this.ended) return true;
    if (this.config.endOnBust && this.players.some(p => p.score < 0)) return true;
    return false;
  }

  /**
   * Undo the last event from game history.
   * Restores player scores and game state.
   * @returns {boolean} true if undo was successful, false if no history
   */
  undoLastEvent(){
    if (this.history.length === 0) return false;

    const ev = this.history.pop();

    // Restore player scores from before the event
    for (let i = 0; i < this.numPlayers; i++){
      this.players[i].score = ev.scoreBefore[i];
    }

    // Restore game state from before the event
    const before = ev.gameStateBefore;
    this.dealerIdx    = before.dealerIdx;
    this.honba        = before.honba;
    this.roundWind    = before.roundWind;
    this.roundNumber  = before.roundNumber;
    this.riichiPool   = before.riichiPool;
    this.riichiThisRound = new Set(before.riichiThisRound);
    this.ended        = before.ended;

    return true;
  }

  /** Compute final placements with uma and oka. */
  getFinalScores(){
    const sorted = [...this.players].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break: earlier seat wind is higher
      return a.id - b.id;
    });

    return sorted.map((p, rank) => {
      const oka   = p.score - this.config.returnPoints;
      const uma   = this.config.uma[rank];
      const final = oka / 1000 + uma / 1000;
      return { rank: rank + 1, player: p, uma, oka, final };
    });
  }
}

// ── Exports (global) ───────────────────────────────────────
window.MahjongGame = MahjongGame;
window.calcPayments = calcPayments;
window.getLimit = getLimit;
window.LIMIT_LABEL = LIMIT_LABEL;
window.WIND_KAN = WIND_KAN;
window.WIND_NAME = WIND_NAME;
window.WIND_NAME_3P = WIND_NAME_3P;
window.WINDS = WINDS;
window.WINDS_3P = WINDS_3P;
