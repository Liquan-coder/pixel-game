/* ================= Boss 的動作：出招的時候身體跟武器真的會動 =================
   每一招都分三段，跟 AI 的狀態一一對應（world/bossAI3.ts）：
     1. 蓄力（xxxWind，e.t 從 e.wt 倒數）：往反方向收 → 讓玩家「看身體就知道要打哪裡」
     2. 出手（AI 打出去的那一格會記 e.act = { k, t0, aim }）：很快、一格到位，不要慢慢轉
     3. 收招（G.time - e.act.t0）：停在打完的姿勢一下，再慢慢回到站姿 → 這段就是玩家反擊的空檔
   姿勢 = 身體（位移 / 前傾 / 抬高）+ 武器（角度 / 沿著武器方向滑動）。武器繞著手轉（art/bossRig.ts 拆好的三層）。
   新增一隻 Boss 的動作：照 docs/Boss製作指南.md，在 POSE 加一個函式。 */
import { G } from '../core/state';
import { HK, ctx, snapF } from '../core/canvas';
import { TAU, clamp } from '../core/util';
import { drawSprite } from '../art/sprite';
import { limbFrame, rigOf, weaponFrame, type Layer, type Rig } from '../art/bossRig';
import { drawShadow } from './player';
import { drawOrb, dustPuff } from './fx';
import { camDt } from '../main';
import { shake } from '../game/worldUpdate';

export interface Pose {
  ox: number; oy: number;   // 身體位移（世界像素）
  lift: number;             // 往上抬（世界像素）
  lean: number;             // 前傾：正 = 頭往右
  rot: number;              // 整個身體轉一點點（弧度）
  wa: number;               // 武器角度（世界角度：0 = 右、π/2 = 下）
  ws: number;               // 武器沿著自己的方向滑多少（美術格）：負 = 往後收、正 = 刺出去
  arm?: number;             // 拿武器的手臂繞肩膀轉多少（美術格的弧度；沒翻面時正 = 順時針）。霜墓騎士：正 = 往外、往上舉
  arm2?: number;            // 另一隻手（提燈的手）繞肩膀轉多少
  lamp?: number;            // 燈火變亮（0~1）
  behind2?: boolean;        // 另一隻手 + 吊著的東西擺到身體後面（畫在身體前面會蓋住臉 / 身體）
  clip?: boolean;           // 武器插進地裡（腳底以下不畫）
  glow?: number;            // 武器尖端發光（0~1）
  snap?: boolean;           // 這一格直接到位（出手那一下），不要平滑過去
  k?: number;               // 平滑的速度（越大越快回到目標姿勢；預設 18）
}
const ease = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const angTo = (a: number, b: number) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;   // a 轉到 b 最近的那一邊（帶正負）
const lerpA = (a: number, b: number, t: number) => a + angTo(a, b) * t;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---- 霜墓騎士：全身重甲、單手握長戟。動作要「重」：蓄力久、出手快、收招慢 ---- */
function frostknight(e, rig: Rig): Pose {
  const f = e.flip ? -1 : 1, A = e.anim || 0, st = e.state, q = e.wt ? clamp(1 - e.t / e.wt, 0, 1) : 0;
  const rest = -Math.PI / 2 + .14 * f, up = -Math.PI / 2, OVER = 2.85;   // 站姿：長戟直立、尖端微微朝向你；OVER = 手臂舉過頭頂的角度
  const P: Pose = { ox: 0, oy: 0, lift: 0, lean: 0, rot: 0, wa: rest, ws: 0, arm: 0 };
  const aim = e.aim ?? 0, cx = Math.cos(aim), cy = Math.sin(aim);
  const act = e.act, since = act ? G.time - act.t0 : 99;
  const mir = rig.spec.mirror ? !e.flip : e.flip, sh = rig.spec.shoulder, B = Math.atan2(rig.spec.grip[1] - sh[1], rig.spec.grip[0] - sh[0]);   // B = 手臂垂下來時，肩膀 → 手的方向（美術格）
  const armDir = (th: number) => mir ? Math.PI - (B + th) : B + th;      // 手臂轉了 th 以後，在世界上指向哪裡
  const swing = (th: number, wrist: number) => armDir(th) - wrist * f;   // 揮砍：長戟跟手臂連成一根，一起繞肩膀轉（wrist = 握法的小角度，正 = 戟尖往後倒）
  const shiver = (from: number) => q > from ? Math.sin(G.time * 70) * .5 * (q - from) / (1 - from) : 0;   // 蓄力最後一段：抖（快出手了）
  switch (st) {
    case 'intro': {                                                      // 開場：把長戟舉過頭 → 往地上一插（冰封的騎士醒了）
      const u = 1 - e.t / 1.4; P.wa = up;
      if (u < .45) { P.arm = OVER * ease(u / .45); P.ws = 4 * ease(u / .45); P.lean = -.06 * f * ease(u / .45); }
      else if (u < .55) { const k = ease((u - .45) / .1); P.arm = lerp(OVER, .1, k); P.ws = lerp(4, -9, k); P.clip = true; P.snap = true; }
      else { P.arm = .1; P.ws = u < .85 ? -9 : -9 * (1 - ease((u - .85) / .15)); P.clip = true; P.oy = u < .65 ? 1 : 0;
        if (e._introHit !== e.def.id) { e._introHit = e.def.id; dustPuff(e.x - 6 * f, e.y, 8, 40); shake(4, .2); } }
      return P; }
    case 'thrustWind': {                                                 // 刺・蓄力：戟放平對準你，手往身體收、往後拉，身體往後坐
      const k = ease(q / .6); P.wa = aim; P.arm = -.35 * k; P.ws = -17 * k; P.lean = -.1 * cx * k; P.ox = -3 * cx * k + shiver(.7); P.oy = -1.5 * cy * k;
      return P; }
    case 'thrust':                                                       // 刺・出手：手臂整個伸出去，戟穿過手掌刺出去，身體往前壓
      P.wa = aim; P.arm = 1; P.ws = 22; P.lean = .13 * cx; P.snap = true; return P;
    case 'sweepWind': {                                                  // 橫掃・蓄力：手舉過頭頂，戟尖甩到腦後，身體往後仰
      const sg = f, k = ease(q / .55);
      P.arm = (OVER + .3) * k; P.wa = swing(OVER + .3, .3); P.ws = 2; P.lean = -.1 * cx * k; P.rot = -.06 * sg * k; P.lift = k; P.ox = -2 * cx * k + shiver(.75);
      return P; }
    case 'chargeWind':                                                   // 衝鋒・蓄力：手往前伸，把戟放平當長槍，壓低身體
      P.wa = aim; P.arm = .8; P.ws = -5 * ease(q / .5); P.lean = .1 * cx * ease(q / .5); P.ox = -2 * cx * ease(q / .5) + shiver(.7); P.oy = 1;
      return P;
    case 'dash':                                                         // 衝鋒中：身體前傾、戟往前頂，重重的腳步一路揚塵
      P.wa = aim; P.arm = .9; P.ws = 10; P.lean = .16 * cx; P.lift = Math.abs(Math.sin(A * 14)) * 1.2; P.snap = true;
      if ((e._dustT = (e._dustT || 0) - camDt) <= 0) { e._dustT = .08; dustPuff(e.x - cx * 6, e.y, 3, 30); }
      return P;
    case 'castWind': case 'donutWind': case 'summonWind': {             // 戟插地（冰劍落下 / 外圈冰爆 / 叫醒屍鬼）：舉過頭 → 停住 → 往地上一插
      const top = .62, hit = .86;
      P.wa = up; P.glow = st === 'castWind' ? 0 : ease(q / top);
      if (q < top) { const k = ease(q / top); P.arm = OVER * k; P.ws = 4 * k; P.lean = -.06 * f * k; P.lift = k; }
      else if (q < hit) { P.arm = OVER; P.ws = 4; P.lean = -.06 * f; P.lift = 1; P.ox = shiver(top); }
      else { const k = ease((q - hit) / (1 - hit)); P.arm = lerp(OVER, .1, k); P.ws = lerp(4, -9, k); P.clip = true; P.snap = true; P.oy = 1; }
      return P; }
  }
  if (/Wind$/.test(st)) { P.wa = lerpA(rest, aim, .5); P.arm = .4; P.ws = -4 * q; P.ox = shiver(.6); return P; }   // 沒寫到的招：至少把戟轉向你、會抖
  /* ---- 收招（idle 的時候，剛打完的那一招還在收） ---- */
  if (act && act.k === 'thrust' && since < .7) {
    if (since < .24) { P.wa = act.aim; P.arm = 1; P.ws = 22; P.lean = .1 * Math.cos(act.aim); P.snap = true; return P; }   // 刺到底：停一下（反擊的空檔）
    P.k = 7;
  }
  if (act && act.k === 'sweep' && since < .8) {
    // 整隻手臂揮：手臂從頭頂後面（OVER + .3）一路劈到前下方（−.3），長戟跟著手臂一起轉 → 戟尖畫一個以肩膀為中心的大弧
    // 角度一律照揮的方向算，不用 lerpA（最近的那一邊）：不然會從背後繞、收招順著轉回頭頂 → 轉一整圈
    const sg = f, c = Math.cos(act.aim), T0 = OVER + .3, T1 = -.3, a1 = swing(T1, -.1);
    if (since < .13) { const k = ease(since / .13), th = lerp(T0, T1, k); P.arm = th; P.wa = swing(th, lerp(.3, -.1, k)); P.ws = 6; P.lean = lerp(-.1, .16, k) * c; P.rot = .06 * sg * k; P.lift = 1 - k; P.snap = true; return P; }   // 劈下來
    if (since < .42) { P.arm = T1; P.wa = a1; P.ws = 4; P.lean = .12 * c; P.rot = .05 * sg; P.oy = 1; P.snap = true; return P; }                                                                          // 劈到底停住
    const dir = mir ? 1 : -1;                                                                                                          // 手臂往下劈時長戟轉的方向（翻面就反過來）
    let back = angTo(a1, rest); if (Math.sign(back) === dir) back -= dir * TAU;                                                      // 收招：沿原路倒轉回去（跟揮的方向相反）
    const k = ease((since - .42) / .38); P.wa = a1 + back * k; P.arm = lerp(T1, 0, k) + 1.2 * Math.sin(k * Math.PI); P.ws = lerp(4, 0, k); P.lean = .12 * c * (1 - k); P.rot = .05 * sg * (1 - k); P.snap = true; return P;   // 手臂順勢抬一下把戟收回直立
  }
  if (act && act.k === 'chargeEnd' && since < .45) { const u = since / .45; P.wa = act.aim; P.arm = .9 * (1 - u); P.ws = 10 * (1 - u); P.lean = -.08 * Math.cos(act.aim) * (1 - u); P.k = 10;   // 煞車：身體往後仰回來
    if (since < .05 && e._skid !== act.t0) { e._skid = act.t0; dustPuff(e.x + Math.cos(act.aim) * 4, e.y, 7, 46); } return P; }
  if (act && act.k === 'plant' && since < .7) {                         // 戟插在地上一下，再拔起來
    P.wa = up; P.arm = .1; if (since < .35) { P.ws = -9; P.clip = true; P.oy = since < .12 ? 1 : 0; P.snap = true; return P; }
    P.ws = 0; P.k = 8; P.clip = true; return P;
  }
  /* ---- 平常：站著呼吸 / 走路（重甲：一步一頓，戟跟著晃） ---- */
  const v = e._v || 0;
  if (v > 10) { const ph = A * 4.2, s = Math.sin(ph);
    P.lift = Math.abs(s) * 1.4; P.lean = .03 * s + .04 * f; P.wa = rest + .07 * s; P.ws = Math.abs(s) * 1.5; P.arm = .08 * s;
    if (Math.sign(s) !== e._stepS) { e._stepS = Math.sign(s); dustPuff(e.x + (s > 0 ? 3 : -3), e.y, 2, 16); }   // 每一步落地揚一點雪
  } else { const b = Math.sin(A * 1.7); P.wa = rest + .025 * b; P.ws = b; P.arm = .03 * b; P.lift = b > .3 ? HK : 0; }
  if (e.flash > 0) { P.lean -= .07 * f; P.ox -= f; P.arm -= .15; }       // 被打中：往後晃一下
  return P;
}
/* ---- 近衛隊長・殘燈：骷髏劍士，右手長劍、左手提燈。比霜墓騎士輕：蓄力短、踏步大；劍一樣綁在手臂上揮（不是甩手腕）----
   角度都用「面向右時」的方向寫（0 = 前、−π/2 = 上、π/2 = 下、π = 後），W() 換成世界角度（朝左時自動翻）。
   手臂角度 a 是「肩膀 → 手」的方向；從垂著（B1）往上舉要經過前面 → 數字往負的走（不要寫成 +2π，會從背後繞） */
function captain(e, rig: Rig): Pose {
  const f = e.flip ? -1 : 1, A = e.anim || 0, st = e.state, q = e.wt ? clamp(1 - e.t / e.wt, 0, 1) : 0, sp = rig.spec;
  const B1 = Math.atan2(sp.grip[1] - sp.shoulder[1], sp.grip[0] - sp.shoulder[0]);                      // 劍的手臂垂著的方向（往下偏後）
  const B2 = Math.atan2(sp.hang.pivot[1] - sp.arm2.pivot[1], sp.hang.pivot[0] - sp.arm2.pivot[0]);      // 提燈的手臂原本的方向（往前）
  const SW = sp.base, W = (a: number) => f > 0 ? a : Math.PI - a;      // SW = 劍平常的角度（往前下 30°）
  const aim = e.aim ?? 0, rel = f > 0 ? aim : Math.PI - aim, cx = Math.cos(aim), cy = Math.sin(aim);
  const act = e.act, since = act ? G.time - act.t0 : 99;
  const P: Pose = { ox: 0, oy: 0, lift: 0, lean: 0, rot: 0, wa: W(SW), ws: 0, arm: 0, arm2: 0, lamp: 0 };
  const sword = (a: number, sw: number, ws = 0) => { P.arm = a - B1; P.wa = W(sw); P.ws = ws; };     // 手臂方向 a、劍的方向 sw
  const lantern = (a: number) => { P.arm2 = a - B2; };
  const shiver = (from: number) => q > from ? Math.sin(G.time * 70) * .5 * (q - from) / (1 - from) : 0;
  const UP = -2.2, DOWN = .95, LOW = 2.6, HIGH = -.9, TOSS0 = 2.5, TOSS1 = -.7;   // TOSS：甩燈從後下（2.5）經過下面甩到前上（−0.7）                   // 下劈：從頭頂後面（UP）劈到前下（DOWN）；上撩：從後下（LOW）撩到前上（HIGH）
  switch (st) {
    case 'intro': {                                                      // 「誰？報上名來。」：舉燈照你 → 劍指著你
      const u = 1 - e.t / 1.4; lantern(u < .7 ? lerp(B2, -1.1, ease(u / .4)) : B2); P.lamp = u < .7 ? 1 : 0;
      if (u > .45) sword(.35, 0, 4); return P; }
    case 'thrustWind': { const k = ease(q / .6);                         // 刺・蓄力：手肘往後拉、劍尖對準你，重心往後
      sword(lerp(B1, 2.5, k), rel, -8 * k); P.lean = -.08 * cx * k; P.ox = -2 * cx * k + shiver(.7); P.oy = -cy * k; return P; }
    case 'thrust':                                                       // 刺・出手：整隻手臂伸直、大步踏出去
      sword(rel, rel, 4); P.lean = .16 * cx; P.snap = true; return P;
    case 'sweepWind': { const k = ease(q / .55), rev = e.mo?.rev;       // 下劈：舉過頭頂、劍尖倒向腦後；上撩：手臂垂到身後、劍尖朝後下
      if (!rev) { const a = lerp(B1, UP, k); sword(a, a + lerp(SW - B1, -.5, k), 2); P.lean = -.1 * cx * k; P.lift = k; }
      else { const a = lerp(B1, LOW, k); sword(a, a + lerp(SW - B1, .35, k), 2); P.lean = -.06 * cx * k; P.oy = k; }
      P.ox = -2 * cx * k + shiver(.75); return P; }
    case 'chargeWind': { const k = ease(q / .5);                         // 突進・蓄力：劍收到身後、劍尖朝你，壓低
      sword(lerp(B1, 2.3, k), rel, -6 * k); P.lean = .1 * cx * k; P.oy = 1; P.ox = shiver(.7); return P; }
    case 'dash':                                                         // 突進中：劍往前頂、身體前傾
      sword(rel + .5, rel, 6); P.lean = .18 * cx; P.lift = Math.abs(Math.sin(A * 16)); P.snap = true;
      if ((e._dustT = (e._dustT || 0) - camDt) <= 0) { e._dustT = .08; dustPuff(e.x - cx * 6, e.y, 3, 30); }
      return P;
    case 'fanWind': case 'poolWind': { const k = ease(q / .6);           // 甩燈・蓄力：燈往身後下方擺（下手甩），燈火越來越亮
      lantern(lerp(B2, TOSS0, k)); P.lamp = k; P.behind2 = k > .5; P.lean = -.08 * cx * k; P.rot = -.04 * f * k; P.ox = shiver(.75); return P; }
    case 'donutWind': { const k = ease(q / .6);                          // 舉燈：燈高高舉起，燈火一圈一圈變亮 → 往外炸開
      lantern(lerp(B2, -.8, k)); P.lamp = k; P.lift = k; P.ox = shiver(.8); return P; }   // 往前上方舉（正上方的話燈會吊在臉前面）
    case 'guard': {                                                      // 架招：劍斜舉在身前擋住自己、重心往後，劍身閃白光 → 看得出「現在打他會被擋」
      const k = ease(Math.min(1, (e.wt - e.t) / .15)); sword(lerp(B1, .1, k), lerp(SW, -1.25, k), 2 * k); P.lean = -.06 * f * k; P.glow = .5 + .3 * Math.sin(G.time * 16); return P; }
    case 'summonWind': { const k = ease(q / .6);                         // 舉劍號令：劍往上指，劍尖發光
      sword(lerp(B1, -1.3, k), lerp(SW, -Math.PI / 2, k), 2 * k); P.glow = k; P.lean = -.05 * f * k; return P; }
  }
  if (/Wind$/.test(st)) { sword(lerp(B1, 2.2, .5), rel, -4 * q); P.ox = shiver(.6); return P; }   // 沒寫到的招：劍轉向你、會抖
  /* ---- 收招 ---- */
  if (act && act.k === 'thrust' && since < .7) {
    if (since < .22) { sword(act.aim === aim ? rel : (f > 0 ? act.aim : Math.PI - act.aim), rel, 4); P.lean = .12 * cx; P.snap = true; return P; }   // 刺到底：停一下
    P.k = 8;
  }
  if (act && act.k === 'sweep' && since < .8) {
    const c = Math.cos(act.aim), [a0, a1, w0, w1] = act.rev ? [LOW, HIGH, .35, -.2] : [UP, DOWN, -.5, -.3];
    if (since < .13) { const k = ease(since / .13), a = lerp(a0, a1, k); sword(a, a + lerp(w0, w1, k), 6); P.lean = lerp(-.1, .16, k) * c; P.rot = .05 * f * k; P.snap = true; return P; }   // 揮過去：整隻手臂帶著劍
    if (since < .4) { sword(a1, a1 + w1, 4); P.lean = .12 * c; P.rot = .04 * f; P.oy = act.rev ? 0 : 1; P.snap = true; return P; }                                  // 揮到底停住
    const k = ease((since - .4) / .4); sword(lerp(a1, B1, k), lerp(a1 + w1, SW, k), 4 * (1 - k)); P.lean = .12 * c * (1 - k); P.snap = true; return P;              // 手臂帶著劍回到身前（沿原路）
  }
  if (act && act.k === 'chargeEnd' && since < .45) { const u = since / .45; sword(lerp(act.aim === aim ? rel + .5 : B1, B1, u), rel, 6 * (1 - u)); P.lean = -.08 * cx * (1 - u); P.k = 10;
    if (since < .05 && e._skid !== act.t0) { e._skid = act.t0; dustPuff(e.x + cx * 4, e.y, 7, 46); } return P; }
  if (act && act.k === 'toss' && since < .7) {                          // 甩燈：從身後下方往前上方甩出去（經過下面；燈自己會晃）
    if (since < .14) { const k = ease(since / .14); lantern(lerp(TOSS0, TOSS1, k)); P.lamp = 1; P.behind2 = k < .3; P.lean = .12 * cx; P.snap = true; return P; }
    if (since < .35) { lantern(TOSS1); P.lamp = .5; P.lean = .08 * cx; P.snap = true; return P; }
    P.k = 6;
  }
  if (act && act.k === 'plant' && since < .7) { P.k = 6; if (since < .15) P.lamp = 1; }   // 舉燈 / 舉劍之後慢慢放下
  /* ---- 平常：站著 / 走路（劍跟燈跟著步伐晃） ---- */
  const v = e._v || 0;
  if (v > 10) { const s = Math.sin(A * 5);
    P.lift = Math.abs(s) * 1.2; P.lean = .03 * s + .05 * f; sword(B1 + .12 * s, SW + .1 * s); lantern(B2 + .1 * s);
    if (Math.sign(s) !== e._stepS) { e._stepS = Math.sign(s); dustPuff(e.x + (s > 0 ? 3 : -3), e.y, 2, 14); }
  } else { const b = Math.sin(A * 1.7); sword(B1 + .03 * b, SW + .04 * b); lantern(B2 + .04 * b); P.lift = b > .3 ? HK : 0; }
  if (e.flash > 0) { P.lean -= .07 * f; P.ox -= f; }
  return P;
}
export const POSE: Record<string, (e, rig: Rig) => Pose> = { db_frostknight: frostknight, db_captain: captain };

/* 畫一隻有骨架的 Boss：照 spec.order 一層一層畫。回傳 false = 這隻沒有骨架，照舊畫整張圖
   預設順序：有手臂 = 武器 → 手臂 → 身體（肩甲蓋住手臂根部）；沒有手臂 = 身體 → 武器 → 手 */
export function drawRigged(e, white: boolean): boolean {
  const rig = rigOf(e.kind), poseOf = POSE[e.kind]; if (!rig || !poseOf) return false;
  const dt = Math.max(1e-3, camDt);
  if (e._lx !== undefined) { const v = Math.hypot(e.x - e._lx, e.y - e._ly) / dt; e._v = (e._v || 0) + (Math.min(400, v) - (e._v || 0)) * Math.min(1, dt * 12); }
  e._lx = e.x; e._ly = e.y;
  const T = poseOf(e, rig), S = e._pose || (e._pose = { ...T });          // S = 畫面上的姿勢：平滑地追 T（出手那一下直接到位）
  if (T.snap) Object.assign(S, T);
  else { const k = 1 - Math.exp(-dt * (T.k || 18));
    S.ox = lerp(S.ox, T.ox, k); S.oy = lerp(S.oy, T.oy, k); S.lift = lerp(S.lift, T.lift, k); S.lean = lerp(S.lean, T.lean, k); S.rot = lerp(S.rot, T.rot, k);
    S.wa = lerpA(S.wa, T.wa, k); S.ws = lerp(S.ws, T.ws, k); S.arm = lerp(S.arm || 0, T.arm || 0, k); S.arm2 = lerp(S.arm2 || 0, T.arm2 || 0, k);
    S.lamp = lerp(S.lamp || 0, T.lamp || 0, k); S.clip = T.clip; S.glow = T.glow; S.behind2 = T.behind2; }
  const sp = rig.spec, L = rig.limbs, body = rig.body, mir = sp.mirror ? !e.flip : e.flip, th = S.arm || 0, th2 = S.arm2 || 0;
  drawShadow(e.x, e.y + 1, body.w * .7);
  const X = snapF(e.x + S.ox), Y = snapF(e.y + 2 + S.oy - (e.z || 0) - S.lift);
  const place = () => { ctx.translate(X, Y); if (S.rot) ctx.rotate(S.rot); ctx.transform(1, 0, -S.lean, 1, 0, 0); };
  const c = Math.cos(S.rot), s = Math.sin(S.rot), turn = (t: number) => t + (mir ? -S.rot : S.rot);   // 部位轉的角度也要加上身體的轉
  const toWorld = (ax: number, ay: number) => { const lx = ((mir ? rig.aw - ax : ax) - rig.aw / 2) * HK, ly = (ay - rig.ah) * HK, bx = lx - S.lean * ly;   // 美術格（沒翻面）→ 世界座標，跟身體同一個變形
    return [X + bx * c - ly * s, Y + bx * s + ly * c]; };
  const rotA = (p: number[], q: number[], t: number) => { const vx = q[0] - p[0], vy = q[1] - p[1], C = Math.cos(t), Sn = Math.sin(t); return [p[0] + vx * C - vy * Sn, p[1] + vx * Sn + vy * C]; };
  const ctr = (q: number[]) => [q[0] + .5, q[1] + .5];
  const blit = (F, x: number, y: number) => ctx.drawImage(white ? F.w : F.c, snapF(x - F.ox * HK), snapF(y - F.oy * HK), F.c.width * HK, F.c.height * HK);
  // 手的位置：沒有手臂 = 固定在身體上；有手臂 = 繞肩膀轉 th
  let g = ctr(sp.grip), shrug = 0;
  if (L.arm) { g = rotA(ctr(L.arm.pivot), g, th); shrug = (sp.shrug || 0) * clamp((th - 1.2) / 1.5, 0, 1); g[1] -= shrug; }   // 舉過頭：整隻手臂連肩膀往上提
  const [hx, hy] = toWorld(g[0], g[1]);
  // 吊著的東西（燈）：吊點跟著 arm2 的手走；角度用鐘擺算（手一甩，燈就晃）
  let hp: number[] = null, phi = 0;
  if (L.hang) { let q = ctr(L.hang.pivot); if (L.arm2) q = rotA(ctr(L.arm2.pivot), q, th2); hp = toWorld(q[0], q[1]);
    const P = e._pend || (e._pend = { phi: 0, w: 0, x: hp[0], y: hp[1], vx: 0, vy: 0 });
    let vx = (hp[0] - P.x) / dt, vy = (hp[1] - P.y) / dt; if (Math.hypot(hp[0] - P.x, hp[1] - P.y) > 30) { vx = vy = 0; P.vx = P.vy = 0; }   // 瞬移 / 重生：不要被甩飛
    const ax = clamp((vx - P.vx) / dt, -4000, 4000), ay = clamp((vy - P.vy) / dt, -4000, 4000);
    P.w += ((-ax * Math.cos(P.phi) - (400 - ay) * Math.sin(P.phi)) / 7 - 4 * P.w) * dt; P.phi = clamp(P.phi + P.w * dt, -1.4, 1.4);   // 擺長 7、重力 400、阻尼 4
    P.x = hp[0]; P.y = hp[1]; P.vx = vx; P.vy = vy; phi = P.phi; }
  const draw: Record<Layer, () => void> = {
    body: () => { ctx.save(); place(); drawSprite(body, 0, 0, mir, white, false); ctx.restore(); },
    hand: () => { if (L.arm) return; ctx.save(); place(); drawSprite(rig.hand, 0, 0, mir, white, false); ctx.restore(); },
    wpn: () => { const F = weaponFrame(e.kind, rig, S.wa, mir), wx = hx + Math.cos(S.wa) * S.ws * HK, wy = hy + Math.sin(S.wa) * S.ws * HK;
      if (S.clip) { ctx.save(); ctx.beginPath(); ctx.rect(X - 300, Y - 300, 600, 300); ctx.clip(); }   // 插進地裡：腳底以下不畫
      blit(F, wx, wy); if (S.clip) ctx.restore();
      if (S.glow > .05) { const len = (sp.tip ?? sp.grip[1] - rig.wy0) * HK + S.ws * HK, tx = wx + Math.cos(S.wa) * len, ty = wy + Math.sin(S.wa) * len;   // 尖端發光
        drawOrb(tx, ty, (1.5 + 2 * S.glow) * (1 + .15 * Math.sin(G.time * 30)), e.def.aura || ['#4a6e94', '#a8dcff', '#ffffff']); } },
    arm: () => { if (!L.arm) return; const p = ctr(L.arm.pivot), [sx, sy] = toWorld(p[0], p[1] - shrug); blit(limbFrame(e.kind, rig, 'arm', turn(th), mir), sx, sy); },
    arm2: () => { if (!L.arm2) return; const p = ctr(L.arm2.pivot), [sx, sy] = toWorld(p[0], p[1]); blit(limbFrame(e.kind, rig, 'arm2', turn(th2), mir), sx, sy); },
    hang: () => { if (!hp) return; blit(limbFrame(e.kind, rig, 'hang', mir ? phi : -phi, mir), hp[0], hp[1]);
      if (sp.light) { const p = ctr(L.hang.pivot), dx = (sp.light[0] - L.hang.pivot[0]) * HK * (mir ? -1 : 1), dy = (sp.light[1] - L.hang.pivot[1]) * HK, C = Math.cos(-phi), Sn = Math.sin(-phi);   // 燈芯：跟著燈晃
        const lx = hp[0] + dx * C - dy * Sn, ly = hp[1] + dx * Sn + dy * C, f = S.lamp || 0; void p;
        if (G.RB_L) G.RB_L.push({ x: lx, y: ly, r: 40 + 40 * f, warm: 1 });
        if (f > .05) drawOrb(lx, ly, (1 + 1.2 * f) * (1 + .15 * Math.sin(G.time * 30)), ['#7a1a08', '#f07a32', '#ffe38a']); } },   // 燈火：小小一顆，不要蓋住燈
  };
  let order: Layer[] = sp.order || (L.arm ? ['wpn', 'arm', 'body'] : ['body', 'wpn', 'hand']);
  if (S.behind2) order = ['arm2', 'hang', ...order.filter(k => k !== 'arm2' && k !== 'hang')] as Layer[];   // 擺到身後：先畫，被身體擋住
  for (const k of order) draw[k]();
  return true;
}
