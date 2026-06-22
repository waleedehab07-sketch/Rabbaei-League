import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        chart: 'chart.html',
        profile: 'profile.html'
        rules: 'rules.html'
      }
    }
  }
})
