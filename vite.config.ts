import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Fail loudly instead of silently moving to another port when 5173 is taken.
    port: 5173,
    strictPort: true,
    // Dev screenshots and tooling are not part of the app.
    watch: { ignored: ['**/.shots/**', '**/tools/**'] },
    // The lane server (server/index.ts) handles scores, name claims and score cards,
    // and serves the staff page, so localhost:5173/staff works as well as :8787/staff.
    proxy: {
      '/api': 'http://localhost:8787',
      '/staff': 'http://localhost:8787',
    },
  },
});
