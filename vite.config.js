import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tripReports: resolve(__dirname, 'trip-reports/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        lifeList: resolve(__dirname, 'life-list/index.html'),
        rsvp: resolve(__dirname, 'rsvp/index.html'),
        gear: resolve(__dirname, 'gear/index.html'),
      },
    },
  },
});
