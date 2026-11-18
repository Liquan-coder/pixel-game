// 瀏覽器內建型別沒有的東西，在這裡告訴 TypeScript「它們存在」
interface Window {
  claude?: any;                                // 在 Claude Artifact 裡執行時才有（熱重載存檔用）
  webkitAudioContext?: typeof AudioContext;    // 舊版 Safari 的 AudioContext
  __pw?: any;                                  // 除錯 / 自動測試用的掛勾
}
