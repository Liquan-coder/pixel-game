// 會被「多個模組」改寫的遊戲狀態都放在這裡。
// ES module 規定：import 進來的變數不能重新賦值（B = null 會報錯），
// 但物件的屬性可以改（G.B = null 沒問題），所以共用的可變狀態都收進 G。
import type { Player, Enemy } from '../types';

export const G = {
  uid: 1,
  fogLocked: false,
  bossDead: false,
  RB_L: [],
  frameNo: 0,
  players: [] as Player[],      // 所有玩家（單機時只有 1 個）
  me: null as Player | null,    // 這台裝置操作的玩家：鏡頭、HUD、背包、存檔都看他
  enemies: [] as Enemy[],
  projs: [],
  drops: [],
  fx: [],
  parts: [],
  nums: [],
  motes: [],
  ghosts: [],
  B: null as Enemy | null,      // 狼王
  lost: null,
  lastCamp: 'start',
  paused: true,
  started: false,
  time: 0,
  shakeT: 0,
  shakeMag: 0,
  hitStop: 0,
  region: '',
  sub: '',
  potMax: 3,
  muted: false,
  coins: [],
  miniT: 0,
  campTab: 'lv',
  curCamp: null,
  selItem: null, pick: null,
};
