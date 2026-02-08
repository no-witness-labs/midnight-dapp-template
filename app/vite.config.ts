import { defineConfig, type Plugin } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { resolve } from 'path';
import { readFile } from 'fs/promises';

/**
 * Vite plugin to serve ZK config artifacts with the URL pattern expected by HttpZkConfigProvider.
 *
 * The SDK's HttpZkConfigProvider expects:
 *   - GET /zk-config/{circuitId}/zkir -> zkir/{circuitId}.bzkir
 *   - GET /zk-config/{circuitId}/prover-key -> keys/{circuitId}.prover
 *   - GET /zk-config/{circuitId}/verifier-key -> keys/{circuitId}.verifier
 */
function zkConfigMiddleware(contractPath: string): Plugin {
  return {
    name: 'zk-config-middleware',
    configureServer(server) {
      server.middlewares.use('/zk-config', async (req, res, next) => {
        const url = req.url || '';
        const match = url.match(/^\/([^/]+)\/(zkir|prover-key|verifier-key)$/);

        if (!match) {
          return next();
        }

        const [, circuitId, type] = match;
        let filePath: string;

        switch (type) {
          case 'zkir':
            filePath = resolve(contractPath, 'zkir', `${circuitId}.bzkir`);
            break;
          case 'prover-key':
            filePath = resolve(contractPath, 'keys', `${circuitId}.prover`);
            break;
          case 'verifier-key':
            filePath = resolve(contractPath, 'keys', `${circuitId}.verifier`);
            break;
          default:
            return next();
        }

        try {
          const content = await readFile(filePath);
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Length', content.length);
          res.end(content);
        } catch {
          res.statusCode = 404;
          res.end(`ZK artifact not found: ${filePath}`);
        }
      });
    },
  };
}

const contractsDir = resolve(__dirname, '../contracts/counter');

export default defineConfig({
  plugins: [wasm(), topLevelAwait(), zkConfigMiddleware(contractsDir)],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    // Pre-bundle compact-runtime (used by the contract) so esbuild converts
    // its CJS deps to ESM and vite-plugin-wasm handles its WASM imports.
    include: [
      '@midnight-ntwrk/compact-runtime',
    ],
  },
  server: {
    fs: {
      allow: ['.', resolve(__dirname, '../contracts')],
    },
  },
});
