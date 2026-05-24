import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'fs';

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  plugins: [
    {
      // ビルド時: プロジェクトルートの assets/ を dist/assets/ にコピー
      // (publicDir が public/ のみのため手動でコピーが必要)
      name: 'copy-game-assets',
      apply: 'build',
      closeBundle() {
        if (existsSync('assets')) {
          cpSync('assets', 'dist/assets', { recursive: true });
        }
      },
    },
  ],
  server: {
    port: 5173,
    open: true,
  },
});
