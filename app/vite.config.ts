import { defineConfig, type Plugin } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { readdirSync, readFileSync } from 'fs';

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
    generateBundle() {
      const zkirDir = resolve(contractPath, 'zkir');
      const keysDir = resolve(contractPath, 'keys');

      for (const file of readdirSync(zkirDir)) {
        if (!file.endsWith('.bzkir')) continue;
        const circuitId = file.replace('.bzkir', '');

        this.emitFile({
          type: 'asset',
          fileName: `zk-config/${circuitId}/zkir`,
          source: readFileSync(resolve(zkirDir, file)),
        });

        const proverPath = resolve(keysDir, `${circuitId}.prover`);
        this.emitFile({
          type: 'asset',
          fileName: `zk-config/${circuitId}/prover-key`,
          source: readFileSync(proverPath),
        });

        const verifierPath = resolve(keysDir, `${circuitId}.verifier`);
        this.emitFile({
          type: 'asset',
          fileName: `zk-config/${circuitId}/verifier-key`,
          source: readFileSync(verifierPath),
        });
      }
    },
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
  plugins: [
    nodePolyfills({ include: ['buffer', 'process'] }),
    wasm(),
    topLevelAwait(),
    zkConfigMiddleware(contractsDir),
  ],
  build: {
    target: 'esnext',
  },
  resolve: {
    alias: {
      // The contract at ../contracts/counter/ imports compact-runtime but lives
      // outside app/ with no node_modules. Alias ensures Vite resolves it from here.
      '@midnight-ntwrk/compact-runtime': resolve(
        __dirname,
        'node_modules/@midnight-ntwrk/compact-runtime/dist/index.js',
      ),
    },
  },
  optimizeDeps: {
    // WASM packages must be pre-bundled separately so vite-plugin-wasm can
    // process them (esbuild can't handle top-level-await WASM in require() chains).
    include: [
      '@midnight-ntwrk/ledger-v7',
      '@midnight-ntwrk/compact-runtime',
    ],
    esbuildOptions: {
      plugins: [
        {
          // @midnight-ntwrk/midnight-js-* v3 packages ship broken CJS entries
          // (missing files, WASM top-level-await). When esbuild encounters them
          // via require(), force ESM resolution so the working import entries are used.
          name: 'force-esm-midnight',
          setup(build) {
            build.onResolve({ filter: /^@midnight-ntwrk\/midnight-js-/ }, async (args) => {
              if (args.kind === 'require-call') {
                return build.resolve(args.path, {
                  resolveDir: args.resolveDir,
                  kind: 'import-statement',
                });
              }
            });
          },
        },
      ],
    },
  },
  server: {
    fs: {
      allow: [
        '.',
        resolve(__dirname, '../contracts'),
        resolve(__dirname, '../../midday-sdk'),
      ],
    },
  },
});
