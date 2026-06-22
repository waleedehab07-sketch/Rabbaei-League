import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        profile: resolve(__dirname, 'profile.html'),
        chart: resolve(__dirname, 'chart.html'),
        rules: resolve(__dirname, 'rules.html')
      }
    }
  }
});
