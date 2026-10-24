import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function oddsApiDevPlugin() {
  return {
    name: 'odds-api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/odds/refresh') && req.method === 'POST') {
          try {
            let body = '';
            for await (const chunk of req) {
              body += chunk;
            }
            const parsedBody = body ? JSON.parse(body) : {};
            const { handleRefreshOddsServerless } = await import('./api/odds/refresh.js');
            const mockReq = { method: 'POST', body: parsedBody, headers: req.headers };
            const mockRes = {
              statusCode: 200,
              setHeader(k, v) { res.setHeader(k, v); },
              status(code) { this.statusCode = code; return this; },
              json(payload) {
                res.statusCode = this.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(payload));
              },
              end() { res.end(); }
            };
            return await handleRefreshOddsServerless(mockReq, mockRes);
          } catch (err) {
            console.error('[Vite Dev Odds Middleware Error]', err);
            next(err);
          }
        } else {
          next();
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), oddsApiDevPlugin()],
  json: {
    stringify: true,
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            return 'vendor-misc';
          }
          if (id.includes('src/data/app_data.json')) {
            return 'data-app-data';
          }
          if (id.includes('compiled/analytics_cache.json')) {
            return 'data-analytics';
          }
          if (id.includes('src/data/squads/')) {
            return 'data-squads';
          }
          if (id.includes('src/data/players') || id.includes('compiled/players_master_registry.json')) {
            return 'data-players';
          }
        },
      },
    },
  },
})
