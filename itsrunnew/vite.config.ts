import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    {
      name: 'itsrun-deploy-target-meta',
      transformIndexHtml(html) {
        if (process.env.VITE_DEPLOY_TARGET !== 'preview') return html;
        return html.replace('<meta name="robots" content="index,follow">', '<meta name="robots" content="noindex,nofollow">');
      },
    },
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2022' },
});
