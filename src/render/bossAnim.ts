/* ================= Boss 的動作：出招的時候身體跟武器真的會動 =================
   每一招都分三段，跟 AI 的狀態一一對應（world/bossAI3.ts）：
     1. 蓄力（xxxWind，e.t 從 e.wt 倒數）：往反方向收 → 讓玩家「看身體就知道要打哪裡」
     2. 出手（AI 打出去的那一格會記 e.act = { k, t0, aim }）：很快、一格到位，不要慢慢轉
     3. 收招（G.time - e.act.t0）：停在打完的姿勢一下，再慢慢回到站姿 → 這段就是玩家反擊的空檔
   姿勢 = 身體（位移 / 前傾 / 抬高）+ 武器（角度 / 沿著武器方向滑動）。武器繞著手轉（art/bossRig.ts 拆好的三層）。
   新增一隻 Boss 的動作：照 docs/boss-anim-sop.md，在 POSE 加一個函式。 */
import { G } from '../core/state';
import { HK, ctx, snapF } from '../core/canvas';
import { TAU, clamp } from '../core/util';
import { drawSprite } from '../art/sprite';
import { armFrame, rigOf, weaponFrame, type Rig } from '../art/bossRig';
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
  arm?: number;             // 手臂繞肩膀轉多少（弧度）：正 = 往外、往上舉（約 2.6 = 舉過頭頂），負 = 往身體收
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
      P.wa = aim - sg * ((e.mo?.half ?? 1.1) + 1.1); P.arm = OVER * k; P.ws = 2; P.lean = -.1 * cx * k; P.rot = -.06 * sg * k; P.lift = k; P.ox = -2 * cx * k + shiver(.75);
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
    // 角度一律照「揮的方向」算，不用 lerpA（最近的那一邊）：不然劈下去會從背後繞、收招會順著轉回頭頂 → 看起來轉一整圈
    const sg = f, half = act.half ?? 1.1, a0 = act.aim - sg * (half + 1.1), a1 = act.aim + sg * (half + .35), c = Math.cos(act.aim);
    if (since < .12) { const k = ease(since / .12); P.wa = lerp(a0, a1, k); P.arm = lerp(OVER, .5, k); P.ws = 6; P.lean = lerp(-.1, .14, k) * c; P.rot = .05 * sg * k; P.snap = true; return P; }   // 從頭頂經過前面劈下來
    if (since < .42) { P.wa = a1; P.arm = .5; P.ws = 4; P.lean = .1 * c; P.rot = .04 * sg; P.oy = 1; P.snap = true; return P; }                                                   // 劈到底停住
    let back = angTo(a1, rest); if (Math.sign(back) === sg) back -= sg * TAU;                                                        // 收招：沿原路倒轉回去（跟揮的方向相反）
    const k = ease((since - .42) / .38); P.wa = a1 + back * k; P.arm = lerp(.5, 0, k); P.ws = lerp(4, 0, k); P.lean = .1 * c * (1 - k); P.rot = .04 * sg * (1 - k); P.snap = true; return P;
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
export const POSE: Record<string, (e, rig: Rig) => Pose> = { db_frostknight: frostknight };

/* 畫一隻有骨架的 Boss。回傳 false = 這隻沒有骨架，照舊畫整張圖
   有手臂（spec.arm）：影子 → 武器 → 手臂 → 身體（肩甲蓋住手臂根部；武器從手邊往後穿過身體後面）
   沒有手臂：影子 → 身體 → 武器 → 手 */
export function drawRigged(e, white: boolean): boolean {
  const rig = rigOf(e.kind), poseOf = POSE[e.kind]; if (!rig || !poseOf) return false;
  const dt = Math.max(1e-3, camDt);
  if (e._lx !== undefined) { const v = Math.hypot(e.x - e._lx, e.y - e._ly) / dt; e._v = (e._v || 0) + (Math.min(400, v) - (e._v || 0)) * Math.min(1, dt * 12); }
  e._lx = e.x; e._ly = e.y;
  const T = poseOf(e, rig), S = e._pose || (e._pose = { ...T });          // S = 畫面上的姿勢：平滑地追 T（出手那一下直接到位）
  if (T.snap) Object.assign(S, T);
  else { const k = 1 - Math.exp(-dt * (T.k || 18));
    S.ox = lerp(S.ox, T.ox, k); S.oy = lerp(S.oy, T.oy, k); S.lift = lerp(S.lift, T.lift, k); S.lean = lerp(S.lean, T.lean, k); S.rot = lerp(S.rot, T.rot, k);
    S.wa = lerpA(S.wa, T.wa, k); S.ws = lerp(S.ws, T.ws, k); S.arm = lerp(S.arm || 0, T.arm || 0, k); S.clip = T.clip; S.glow = T.glow; }
  const sp = rig.spec, body = rig.body, mir = sp.mirror ? !e.flip : e.flip, th = S.arm || 0;
  drawShadow(e.x, e.y + 1, body.w * .7);
  const X = snapF(e.x + S.ox), Y = snapF(e.y + 2 + S.oy - (e.z || 0) - S.lift);
  const place = () => { ctx.translate(X, Y); if (S.rot) ctx.rotate(S.rot); ctx.transform(1, 0, -S.lean, 1, 0, 0); };
  const c = Math.cos(S.rot), s = Math.sin(S.rot);
  const toWorld = (ax: number, ay: number) => { const lx = ((mir ? rig.aw - ax : ax) - rig.aw / 2) * HK, ly = (ay - rig.ah) * HK, bx = lx - S.lean * ly;   // 美術格（沒翻面）→ 世界座標，跟身體同一個變形
    return [X + bx * c - ly * s, Y + bx * s + ly * c]; };
  // 手的位置：沒有手臂 = 固定在身體上；有手臂 = 繞肩膀轉 th
  let gx = sp.grip[0] + .5, gy = sp.grip[1] + .5;
  const arm = rig.arows && sp.shoulder, px = arm ? sp.shoulder[0] + .5 : 0, py = arm ? sp.shoulder[1] + .5 : 0;
  if (arm && th) { const vx = gx - px, vy = gy - py, C = Math.cos(th), Sn = Math.sin(th); gx = px + vx * C - vy * Sn; gy = py + vx * Sn + vy * C; }
  const shrug = arm ? 8 * clamp((th - 1.2) / 1.5, 0, 1) : 0; gy -= shrug;   // 舉過頭的時候整隻手臂連肩膀一起往上提（前臂太短，只轉的話手只到頭盔）
  const [hx, hy] = toWorld(gx, gy);
  const drawBody = () => { ctx.save(); place(); drawSprite(body, 0, 0, mir, white, false); ctx.restore(); };
  if (!arm) drawBody();
  const F = weaponFrame(e.kind, rig, S.wa, mir), wx = hx + Math.cos(S.wa) * S.ws * HK, wy = hy + Math.sin(S.wa) * S.ws * HK;
  if (S.clip) { ctx.save(); ctx.beginPath(); ctx.rect(X - 300, Y - 300, 600, 300); ctx.clip(); }   // 插進地裡：腳底以下不畫
  ctx.drawImage(white ? F.w : F.c, snapF(wx - F.ox * HK), snapF(wy - F.oy * HK), F.c.width * HK, F.c.height * HK);
  if (S.clip) ctx.restore();
  if (S.glow > .05) { const L = (sp.grip[1] - (rig as any)._y0 + S.ws) * HK, tx = wx + Math.cos(S.wa) * L, ty = wy + Math.sin(S.wa) * L;   // 尖端聚起寒氣
    drawOrb(tx, ty, (1.5 + 2 * S.glow) * (1 + .15 * Math.sin(G.time * 30)), e.def.aura || ['#4a6e94', '#a8dcff', '#ffffff']); }
  if (arm) { const A = armFrame(e.kind, rig, th + (mir ? -S.rot : S.rot), mir), [sx, sy] = toWorld(px, py - shrug);
    ctx.drawImage(white ? A.w : A.c, snapF(sx - A.ox * HK), snapF(sy - A.oy * HK), A.c.width * HK, A.c.height * HK);
    drawBody(); }
  else { ctx.save(); place(); drawSprite(rig.hand, 0, 0, mir, white, false); ctx.restore(); }
  return true;
}
