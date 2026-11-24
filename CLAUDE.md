# 像素荒野（pixel-wilds）

俯視角的像素動作 RPG（無縫開放世界 + 地城 + Boss，魂系風格）。Vite + TypeScript，畫在 canvas 上，**沒有框架、沒有圖檔**：角色、怪物、地形全部用程式畫。
以後要用 Capacitor 上架 App Store；現在先部署在 GitHub Pages。

## 指令
| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器 http://localhost:5173/（`--host`，手機可以用區網 IP 連） |
| `npm run typecheck` | 只檢查型別 |
| `npm run build` | 型別檢查 + 打包（CI 跑的就是這個） |
| `npm run playtest` | headless Chrome 自動試玩，幾乎所有程式路徑都會跑過（完整約 2 分鐘）。完整跑只印失敗和總結，`VERBOSE=1` 印全部。只跑一部分：`ONLY='地城\|機關' npm run playtest`（會印全部） |
| `npm run balance` | 每個地區的生存 / 擊殺數字，超出目標範圍會標 ✗ |
| `npm run shots -- <資料夾>` | 用幾種手機尺寸截 UI 畫面 |
| `node scripts/look.mjs a.png "<JS>"` | 開遊戲 → 執行一段 JS → 截圖（JS 裡可以用 `await imp('core/state')`） |
| `node scripts/tour.mjs <資料夾> <場景.json>` | 同上，一次截很多張 |
| `node scripts/dungeonmap.mjs out.png` | 把地城格局畫成一張圖 |
| `node scripts/worldhash.mjs` | 野外的指紋。改地城前後各跑一次，確認野外沒有被動到 |
| `scripts/session.sh <名字>` | **開工第一步**：開一個自己的資料夾 `.worktrees/<名字>`（自己的分支、自己的 port），印出試玩網址。`list` 列出、`end <名字>` 收掉 |
| `scripts/land.sh ['<測試>']` | 在自己的資料夾裡跑：rebase 到最新的 main → 型別檢查 + build（+ `ONLY=` 的 playtest）→ 併進 main（不會 push） |
| `scripts/cdp.mjs` | 所有腳本共用的 headless Chrome：自動挑 port（多個 session 同時跑不會互撞）、超過 15 分鐘自動結束（`CDP_TIMEOUT=秒數`）、腳本怎麼結束都會關掉 Chrome。新腳本要開 Chrome 就用它 |

## 程式怎麼跑
`src/main.ts`：`boot()` → `genWorld()` 生成世界 → 寶箱、石碑、地城入口、機關、神像 → 標題畫面。
每一格 `frame()`：`readInput()` → `update(dt)`（game/worldUpdate.ts）→ `render()` → `updateHUD()`。

- **共用的可變狀態都放在 `G`（src/core/state.ts）**。ES module 匯入的變數不能重新賦值，所以要寫 `G.B = null`，不能寫 `B = null`。
- 資料的型別在 `src/types.ts`（Player、Enemy、Item、Camp）。
- `tsconfig` 是 `strict: false`（舊程式碼還在慢慢補型別）。
- 很多模組是「被 import 就會自己登記」（例如 `import './world/puz2'`），所以 main.ts 的 import 順序有意義。
- 除錯用：瀏覽器 console 的 `window.__pw` 可以拿到玩家、敵人、地圖、`makeItem` 等。

## 資料夾地圖
| 資料夾 | 放什麼 | 重要檔案 |
|---|---|---|
| `core/` | 底層 | `state.ts`（G）、`canvas.ts`（畫布、`HK` 美術像素）、`audio.ts`、`util.ts`（`mulberry32` 種子亂數） |
| `data/` | 數值表（平衡都改這裡） | `items.ts`（武器、`BEH` 怪物行為、`KIND` 怪物種類）、`gear.ts`（防具 / 飾品 / 刻印）、`attrs.ts`（能力值、補正）、`forge.ts`（鍛造）、`uniques.ts`（獨特武器、Boss 招牌裝備 `UG`）、`story.ts`（主線、傳聞、石碑）、`levels.ts`（`tier`） |
| `game/` | 遊戲規則 | `player.ts`（`calcStats` / `recalc`、升級花費）、`combat.ts`（攻擊、`hurtPlayer`）、`enemies.ts`、`boss.ts`（狼王）、`bossTuning.ts`、`status.ts`（異常狀態）、`weaponFx.ts`（刻印效果）、`quest.ts`、`save.ts`（三格存檔） |
| `world/` | 地圖和地點 | `map.ts`（地圖格子、`REGIONS`）、`gen.ts` + `terrain.ts`（野外生成）、`chunks.ts`（地面預先烘成 16×16 格的區塊）、`dungeons.ts` + `dungeonLayout.ts`（地城）、`puzzles.ts` + `puz2~5.ts`（機關）、`regionBoss.ts` + `bossAI*.ts` + `bossMech.ts`（區域 / 地城 Boss）、`towns.ts`（NPC、鐵匠）、`chests.ts`、`statues.ts`、`elfland.ts`（地區 8） |
| `art/` | 用程式畫的圖 | `hero.ts`（女主角）、`monsters.ts`（`SPR`、`sculpt()` 造型）、`dungeonMonsters.ts`、`skeleton.ts`、`bossArt.ts`（**自動產生，不要手改**） |
| `render/` | 每一格怎麼畫 | `render.ts`（主流程）、`player.ts`、`enemy.ts`（怪、預警圈）、`fx.ts`、`bossFx.ts`、`map.ts`（小地圖 / 大地圖） |
| `ui/` | DOM 介面 | `hud.ts`（血條、`toast`、`coinChip` / `soulChip`）、`menus.ts`（營火、角色、背包）、`shop.ts`（商人）、`pause.ts`、`title.ts`、`input.ts`（鍵盤 / 搖桿） |
| `vendor/pixelfx/` | 外部的 MIT 特效函式庫 | 不要改，接到遊戲裡的部分在 `render/pfx.ts` |

## 常見的改動要動哪裡
- **新增地城**：`world/dungeons.ts` 的 `DUNGEONS` 加一筆、`PUZ` 加一筆，格局會自動排好。Boss 寫在 `world/dungeonBoss.ts` 的 `DBOSS`（招式從 `bossAI3.ts` 的招式庫挑）。
- **新增機關**：寫在 `puzN.ts`，登記進 `MECHS`（`world/puzzles.ts`）；main.ts 要在 `setupPuzzles()` 之前 import 那個檔案。
- **新增小怪**：`data/items.ts` 的 `KIND`（行為從 `BEH` 挑一種）＋ `art/` 裡的 `SPR` 圖（第一次用到才畫）。
- **Boss 的圖**：從參考圖描下來，再用 `docs/tools/boss-trace/emit.py` 輸出成 `src/art/bossArt.ts`。
- **改數值**：改完跑 `npm run balance`。

## 美術規則
- 女主角是 chibi 紫色魔女（紫色尖帽配金星、長紫髮、深藍紫袍、1px 近黑外框）。新的圖都要跟這個風格一致：3~4 階陰影、寶石點綴。
- 美術密度：1 個世界像素 = 3 個美術像素（`HK = 1/3`）。
- 新的圖是照使用者給的 AI 參考圖描成程式格式（調色盤字母格子 / `sculpt`），不用 PNG。圖都朝右畫，武器另外畫、繞著手旋轉。

## 玩家看得到的文字和 UI
- **不顯示等級，也不給危險提示**（艾爾登法環式的探索）：不能出現「Lv」「建議等級」「危險」「你打不過」，只寫氛圍文字。
- **不要讓玩家自己心算**：選單裡最關鍵的 1~3 個數字（剩多少魂晶、等級 a → b、升級需要多少）要做成最大的格子；物品效果直接寫在卡片上。用「升級需要」這個說法。
- 程式註解和 UI 文字用繁體中文、白話。

## Git 和部署
- push 到 `main` → GitHub Actions 自動 build → 部署到 GitHub Pages。
- **好幾個視窗同時開發：每個視窗在自己的資料夾裡改，不要直接改主資料夾**（共用一個資料夾，commit 會互相帶走、蓋掉別人的改動）：
  1. 開工：`scripts/session.sh <名字>`（例如 `seals`），之後所有讀寫、指令都在 `.worktrees/<名字>` 裡；開發伺服器照它印的 `npm run dev -- --port <port> --strictPort` 背景跑
  2. 改完 → 測試（見下面）→ 在自己的資料夾裡 commit（`git commit -a` 就好，裡面只有自己的東西）
  3. 請使用者在 `localhost:<自己的 port>` 試玩 → 使用者說 OK
  4. `scripts/land.sh '<相關的測試>'` 併進 main（衝突會停下來，自己解）
  5. 使用者說可以 push → 在主資料夾（`main`）照下面「push 前」檢查 → `git push`
  6. 這件事做完就 `scripts/session.sh end <名字>`
- 主資料夾（`localhost:5173`）= 已經併進 main 的版本，只用來 land、push、試玩整合後的結果。
- **不用每改一次就測，照這個節奏**：
  | 什麼時候 | 跑什麼 |
  |---|---|
  | 調整的過程中（數值改了又改、美術一直修） | 只跑 `npm run typecheck` |
  | 一件事做完、commit 前 | `ONLY='<相關的測試>'` 跑**一次**；只改美術、文字、UI 排版就不跑，build + 一張截圖 |
  | **push 前** | 在乾淨的 worktree（見下面）build + **完整 playtest 一次**，一起檢查所有視窗的 commit |
  - 失敗了先看是哪個測試，找不出是哪個改動造成的，再分開測。
- **改了功能，playtest 要一起改，放在同一個 commit**（不然舊的測試會拿舊規則去檢查新東西）：
  - 改了行為或數值 → 先 `grep` `scripts/playtest.mjs` 找出測到它的測試，把預期改成新的規則
  - 新的功能 → 加一個測試，名字要好用 `ONLY=` 挑出來（例如「長弓」）
  - 刪掉的功能 → 刪掉它的測試
  - 測試失敗時，先確認是「規則本來就改了」還是「真的壞了」。只有前者才改測試，不能為了讓它通過就放寬條件

## 省 token
- 讀進對話的東西會一直留著，之後每一輪都要重送，所以**從源頭讓輸出變小**：
  - 只要確認「有沒有出現、位置對不對」就截低解析度：`node scripts/look.mjs a.png "<JS>" 1280 720 0.5`（版面跟預設一樣，圖變 640×360，token 約 1/4）。要看像素細節（美術、小字）才用預設的 `1280 720 1`。
  - 讀檔先 `grep -n` 找到行號，再用 Read 的 `offset` / `limit` 只讀那一段；不要整個讀。`src/art/bossArt.ts` 這種自動產生的檔案不要讀。
  - 這次對話已經讀過、自己也剛改過的檔案不要重讀（Edit 失敗才需要），要確認就 `git diff` 那幾行。
- **交給 subagent、只回報結論**：完整 playtest、一次要讀好幾個超過 500 行的檔案、只是要找東西在哪裡。美術截圖不要交出去（要自己看）。
- push 前在乾淨的 worktree 裡檢查一次 HEAD（主資料夾可能有還沒 land 的東西）：
  `git worktree add --detach <暫存>/clean HEAD` → 連結 `node_modules` → `npx tsc --noEmit && npx vite build && npm run playtest`
- `docs/` 在 .gitignore 裡：設計筆記寫在那裡，但**永遠不要 commit**（不要 `git add -f`）。
