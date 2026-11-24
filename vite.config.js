import { defineConfig } from 'vite';

// GitHub Pages 的網址是 https://<帳號>.github.io/<repo名>/，所以要設 base。
// 部署流程會用環境變數 BASE_PATH 傳進來；本機開發和 Cloudflare Pages 用預設的 '/'。
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  server: { watch: { ignored: ['**/.worktrees/**'] } },   // 別的視窗的資料夾（scripts/session.sh）改了東西，不要讓這裡的開發伺服器重新載入
});
