import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// GitHub Pages 的網址是 https://<帳號>.github.io/<repo名>/，所以要設 base。
// 部署流程會用環境變數 BASE_PATH 傳進來；本機開發和 Cloudflare Pages 用預設的 '/'。
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  // 別的視窗的資料夾（scripts/session.sh）改了東西，不要讓這裡的開發伺服器重新載入。
  // 只忽略「這個資料夾底下的 .worktrees」：以前寫 '**/.worktrees/**'，在 worktree 裡面跑的伺服器路徑本身就有 .worktrees → 連自己的改動都看不到
  server: { watch: { ignored: [fileURLToPath(new URL('./.worktrees', import.meta.url)) + '/**'] } },
});
