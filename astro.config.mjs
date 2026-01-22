import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  site: 'https://5hon.com',
  integrations: [react({ experimentalDisableStreaming: true }), sitemap()],
  vite: {
    plugins: [
      {
        name: 'react-dom-messagechannel-polyfill',
        enforce: 'pre',
        transform(code, id) {
          if (!id.includes('react-dom-server.browser')) return;
          const polyfill = `if (typeof MessageChannel === 'undefined') {
  globalThis.MessageChannel = class MessageChannel {
    constructor() {
      const port1 = { onmessage: null };
      const port2 = { postMessage: () => {
        if (typeof port1.onmessage === 'function') {
          if (typeof globalThis.queueMicrotask === 'function') {
            globalThis.queueMicrotask(() => port1.onmessage());
          } else {
            setTimeout(() => port1.onmessage(), 0);
          }
        }
      }};
      this.port1 = port1;
      this.port2 = port2;
    }
  };
}
`;
          return {
            code: polyfill + code,
            map: null,
          };
        },
      },
    ],
  },
});
