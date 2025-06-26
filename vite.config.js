import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  base: '/Chess-game/', // Replace 'your-repo-name' with the actual repository name
  plugins: [react()],
  build: {
    target: 'baseline-widely-available',
  },
});
