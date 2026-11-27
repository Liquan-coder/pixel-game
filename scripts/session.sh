#!/bin/bash
# 每個 Claude 視窗一個自己的資料夾 + 分支（git worktree），改檔案、commit 都不會撞到別的視窗。
#
#   scripts/session.sh <名字>        開一個：.worktrees/<名字>（分支 <名字>，從 main 開始），印出試玩網址
#   scripts/session.sh <名字> 3dtest 從 3dtest 分支開始（3D 試驗），land.sh 會併回 3dtest 而不是 main
#   scripts/session.sh list          列出現在有哪些
#   scripts/session.sh end <名字>    收掉（要先用 scripts/land.sh 併回 main；還沒併的 commit 會擋下來）
#
# 做完一件事：在 .worktrees/<名字> 裡 commit → scripts/land.sh（rebase 到最新的 main、檢查、併進去）
set -e
ROOT="$(git -C "$(dirname "$0")/.." rev-parse --path-format=absolute --git-common-dir)/.."
ROOT="$(cd "${ROOT}" && pwd)"
WT="${ROOT}/.worktrees"
cmd="$1"

port_of() { cat "${WT}/$1/.session-port" 2>/dev/null; }
base_of() { cat "${WT}/$1/.session-base" 2>/dev/null || echo main; }   # 從哪個分支開出來的（做完併回那裡）

if [ -z "$cmd" ]; then echo "用法：scripts/session.sh <名字> | list | end <名字>"; exit 1; fi

if [ "$cmd" = list ]; then
  for d in "${WT}"/*/; do [ -d "${d}" ] || continue; n=$(basename "${d}")
    b=$(base_of "${n}"); ahead=$(git -C "${ROOT}" rev-list --count "${b}".."${n}" 2>/dev/null || echo ?)
    echo "${n}   port $(port_of "${n}")   比 ${b} 多 ${ahead} 個 commit"; done
  exit 0
fi

if [ "$cmd" = end ]; then
  n="$2"; [ -n "${n}" ] || { echo "要給名字：scripts/session.sh end <名字>"; exit 1; }
  b=$(base_of "${n}"); left=$(git -C "${ROOT}" rev-list --count "${b}".."${n}" 2>/dev/null || echo 0)
  if [ "${left}" != 0 ]; then echo "✗ ${n} 還有 ${left} 個 commit 沒併進 ${b}（先跑 scripts/land.sh）"; exit 1; fi
  if [ -n "$(git -C "${WT}/${n}" status --porcelain 2>/dev/null)" ]; then echo "✗ ${n} 還有沒 commit 的改動："; git -C "${WT}/${n}" status --short; exit 1; fi
  p=$(port_of "${n}"); [ -n "${p}" ] && lsof -tiTCP:"${p}" -sTCP:LISTEN | xargs kill 2>/dev/null || true   # 關掉它的開發伺服器
  git -C "${ROOT}" worktree remove --force "${WT}/${n}" && git -C "${ROOT}" branch -d "${n}" >/dev/null && echo "✓ 收掉了 ${n}"
  exit 0
fi

n="$cmd"
case "${n}" in *[!a-z0-9-]*) echo "名字只能用小寫英文、數字、-（例如 seals、dungeon-map）"; exit 1;; esac
if [ -d "${WT}/${n}" ]; then echo "已經有 ${n} 了：${WT}/${n}（port $(port_of "${n}")）"; exit 0; fi
mkdir -p "${WT}"
base="${2:-main}"
git -C "${ROOT}" rev-parse -q --verify "${base}" >/dev/null || { echo "沒有 ${base} 這個分支"; exit 1; }
git -C "${ROOT}" worktree add -q -b "${n}" "${WT}/${n}" "${base}"
if [ "${base}" = main ]; then ln -s ../../node_modules "${WT}/${n}/node_modules"
else echo "${base}" > "${WT}/${n}/.session-base"; ln -s "../${base}/node_modules" "${WT}/${n}/node_modules"; fi   # 3dtest 多裝了 three.js，用它的
ln -s ../../docs "${WT}/${n}/docs"                                        # 設計筆記大家共用（docs/ 不進 git）
p=5174; while lsof -iTCP:${p} -sTCP:LISTEN >/dev/null 2>&1 || grep -qx "${p}" "${WT}"/*/.session-port 2>/dev/null; do p=$((p + 1)); done
echo "${p}" > "${WT}/${n}/.session-port"
ip=$(ipconfig getifaddr en0 2>/dev/null || true)
echo "✓ 開好了：${WT}/${n}（分支 ${n}，從 ${base} 開出來）"
echo "  開發伺服器：cd ${WT}/${n} && npm run dev -- --port ${p} --strictPort"
echo "  試玩：http://localhost:${p}/${ip:+   手機：http://$ip:${p}/}"
echo "  做完：在裡面 commit → scripts/land.sh（併回 ${base}）"
