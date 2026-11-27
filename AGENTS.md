# 像素荒野：給 AI agent 的規則

這個專案同時有好幾個 AI agent 在改（Claude、Codex、Antigravity）。
這份只寫「不要撞車」的規則和使用者定好的產品決定；怎麼設計、怎麼寫，用你自己的判斷。

## 〇、你在 3dtest 分支（2.5D / three.js 試驗）
- **先讀 `docs/11-28討論.md`**：為什麼做 2.5D、怎麼做的、踩過的效能坑。尤其第四章「攔截畫圖指令」：角色的圖**每張只上傳一次**，不要改成每幀重畫再上傳（Mac 上 1 個角色就要搬 ~10MB/幀）
- 2.5D **只是畫面**：遊戲邏輯、數值、碰撞全部跟原本一樣，沒有高低差、不會掉下去
- 主要的程式：`src/render/three3d.ts`（3D 畫面）、`src/render/render.ts`（`T3` 的分支）、`src/render/isoState.ts`
- 試玩：`?lab&three`（右上角有效能表：fps、新圖 MB、最卡的一幀）
- **開工**：`scripts/session.sh <名字> 3dtest`（從 3dtest 開，不是從 main）→ 在自己的資料夾改、commit → `scripts/land.sh` 會**併回 3dtest**
- 不要直接改 `.worktrees/3dtest` 這個資料夾，它是大家併好的版本（使用者在 http://localhost:5175/?lab&three 試玩）
- **3dtest 不能併進 main**，要不要併由使用者決定

## 一、一個 agent 一個資料夾（最重要）
- 開工第一步：`scripts/session.sh <名字>` → 之後所有讀寫、指令都在 `.worktrees/<名字>` 裡
- **不要直接改主資料夾**（`game/` 本身），那是已經併進 main 的版本
- 試玩：照 session.sh 印的 `npm run dev -- --port <port> --strictPort` 開自己的伺服器
- 做完：在自己的資料夾 commit → `scripts/land.sh '<相關的測試>'` 併進 main（不會 push）
- 收工：`scripts/session.sh end <名字>`
- **push 一定要使用者試玩過、說 OK**

## 二、開工先登記要改的檔案
- 登記在 `.worktrees/CLAIMS.md`（在自己的資料夾裡就是 `../CLAIMS.md`）
- 開工時加一行，land 完刪掉：
  | 誰 | 資料夾 | 要改的檔案 | 開始時間 |
  |---|---|---|---|
  | codex | seals | src/data/gear.ts, src/game/weaponFx.ts | 11-27 14:00 |
- 看到別人登記了同一個檔案 → 先跟使用者說，不要直接改

## 三、電腦和額度
- 吃 CPU 的工作（playtest、產生器、大量搜尋）用 `~/.claude/watchdog/heavy <指令>` 跑：
  所有 agent 加起來最多 2 個同時跑，其他排隊。`land.sh` 裡面已經會排隊，不用再包
- 不要在一個指令裡自己同時開好幾份一起跑（例如 4 個產生器）；要跑多份就分成多個 heavy 指令去排隊
- 跑完確認沒留下 headless Chrome
- 自己的額度剩不到 15%：開大工作前先問使用者

## 四、使用者定好的產品決定（不能違反）
- 玩家看得到的文字**不顯示等級、不給危險提示**（不能出現「Lv」「建議等級」「危險」），只寫氛圍文字
- UI 不要讓玩家心算：最關鍵的數字做成最大的格子，物品效果直接寫在卡片上
- 程式註解和 UI 文字用**繁體中文、白話**
- **沒有圖檔**：角色、怪物、地形全部用程式畫；新的圖照使用者給的參考圖描
- 改了功能，`scripts/playtest.mjs` 的測試要在同一個 commit 一起改
- `docs/` 不要 commit
