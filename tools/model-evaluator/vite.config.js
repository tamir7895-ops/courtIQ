import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Custom plugin to serve ONNX models from the project root
function serveModelsPlugin() {
  const modelsDir = path.resolve(__dirname, '../../models');
  return {
    name: 'serve-models',
    configureServer(server) {
      server.middlewares.use('/models', (req, res, next) => {
        const filePath = path.join(modelsDir, req.url);
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/octet-stream');
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), serveModelsPlugin()],
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: [
        path.resolve(__dirname, '../..'),
      ]
    }
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  }
});
