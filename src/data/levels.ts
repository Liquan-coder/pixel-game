/* ================= 等級的尺度 =================
   怪物 / Boss 的等級最高大約 80（最後的星之看守者 = 80），從那裡等比例往下排；玩家也要練到差不多的等級才打得贏。
   公式（怪物的血、傷害、魂晶、Boss 招式傷害、素材、能力值的效果……）都用 tier(lv) = lv ÷ LV_K 來算：
   80 級的怪 ≈ 以前 32 級的強度，只是現在要多升好幾級（每一點能力值的效果是以前的 1/2.5，升級也比較便宜，總共大約要多刷一倍的魂晶）。
   要整體調整：改 LV_K。 */
export const LV_K = 2.5;
export const tier = (lv: number) => lv / LV_K;

/* ---- 等級差：怪比你高幾級，你就被打得比較痛、打牠比較不痛（不顯示在畫面上，玩家只會覺得「這裡好難」）----
   差距用 tier 算（每 2.5 級 = 以前的 1 級）。例：你 25 級打 50 級的 Boss → 被打 ×1.7、打牠 ×0.5；你 50 級打 25 級的怪 → 被打 ×0.8、打牠 ×1.1
   上限：被打最多 ×2.2、最少 ×0.6；打牠最少 ×0.3、最多 ×1.2（以前每差一階只差 5% / 3.5%，30 級就能打 50 級的王） */
export function gapTaken(srcLv: number, plLv: number) { if (!srcLv) return 1; const g = tier(srcLv - plLv); return g > 0 ? Math.min(2.2, 1 + .07 * g) : Math.max(.6, 1 + .02 * g); }
export function gapDealt(plLv: number, eLv: number) { if (!eLv) return 1; const g = tier(eLv - plLv); return g > 0 ? Math.max(.3, 1 - .05 * g) : Math.min(1.2, 1 - .01 * g); }
