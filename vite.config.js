import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tripReports: resolve(__dirname, 'trip-reports/index.html'),
        lifeList: resolve(__dirname, 'life-list/index.html'),
      },
    },
  },
});
