#!/bin/bash
# 在 .worktrees/<名字> 裡跑：把這個分支接到最新的 main 後面（rebase），檢查過再併進 main。歷史還是一條直線。
#
#   scripts/land.sh                  型別檢查 + build，通過就併進 main
#   scripts/land.sh '刻印|小地圖'     另外跑這些 playtest（等於 ONLY=...），全部通過才併
#
# 直接跑，不要外面再包 heavy（裡面的 build、playtest 已經會走 ~/.claude/watchdog/heavy 排隊）。
# main 剛好被別的視窗更新 → 自動再 rebase、再檢查一次（最多 3 次）。rebase 有衝突會停下來讓你處理。
# 併進 main 不等於 push：push 照舊要使用者在 localhost:5173 試過、說 OK。
set -e
only="$1"
br=$(git rev-parse --abbrev-ref HEAD)
ROOT="$(cd "$(git rev-parse --path-format=absolute --git-common-dir)/.." && pwd)"
[ "${br}" != main ] || { echo "✗ 要在 .worktrees/<名字> 裡跑（現在在 main）"; exit 1; }
if [ -n "$(git status --porcelain)" ]; then echo "✗ 還有沒 commit 的改動："; git status --short; exit 1; fi

check() {
  echo "… 型別檢查 + build"; ~/.claude/watchdog/heavy npx tsc --noEmit && ~/.claude/watchdog/heavy npx vite build --logLevel error >/dev/null || { echo "✗ 型別檢查 / build 沒過"; return 1; }
  if [ -n "${only}" ]; then
    echo "… playtest：${only}"; log=$(mktemp)
    ONLY="${only}" ~/.claude/watchdog/heavy npm run playtest >"${log}" 2>&1 || true
    grep -E '^✓|^✗|全部通過|失敗|頁面錯誤' "${log}" | cut -c1-200
    grep -q '全部通過' "${log}" && grep -q '頁面錯誤: 無' "${log}" || { echo "✗ playtest 沒過（完整輸出：${log}）"; return 1; }
  fi
}

for try in 1 2 3; do
  if ! git merge-base --is-ancestor main HEAD; then
    echo "… rebase 到最新的 main"
    git rebase -q main || { echo "✗ rebase 有衝突：改好 → git add <檔案> → git rebase --continue，再跑一次 scripts/land.sh"; exit 1; }
  fi
  check || exit 1
  git merge-base --is-ancestor main HEAD || { echo "… 檢查的時候 main 又被更新了，再來一次"; continue; }
  if git -C "${ROOT}" merge --ff-only -q "${br}"; then
    echo "✓ 併進 main 了：$(git log --oneline -1 | cut -c1-80)"
    echo "  收掉這個資料夾：scripts/session.sh end ${br}（還要繼續做別的就留著，下次一樣 commit → land.sh）"
    exit 0
  fi
  echo "✗ 併不進去：main 的資料夾（${ROOT}）裡有人改了同一個檔案還沒 commit。等他 commit 或請他也改用 worktree"; exit 1
done
echo "✗ main 一直被更新，試了 3 次都沒併進去，等一下再跑"; exit 1
