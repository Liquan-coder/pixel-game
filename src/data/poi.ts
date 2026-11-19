/* 地圖上要標出來的「其他地點」（遺跡入口、地標……）：生成世界的程式把地點放進 POIS，地圖就會畫出圖示、點了會顯示名字和說明
   kind：'ruin' = 遺跡 / 地下入口、'landmark' = 地標（祭壇、神殿、觀景點……）、'town' = 城鎮
   這個檔案不 import 任何東西，誰都可以放心 import（避免循環引用） */
export type POI = { id: string; name: string; tx: number; ty: number; kind: 'ruin' | 'landmark' | 'town'; desc?: string };
export const POIS: POI[] = [];
