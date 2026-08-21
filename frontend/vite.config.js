import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
    plugins: [react(), tailwind()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
        proxy: {
            '/api': {
                target: process.env.DASHBOARD_API_TARGET ?? 'http://127.0.0.1:8090',
                changeOrigin: true,
            },
        },
    },
    build: { outDir: 'dist', sourcemap: false },
});
