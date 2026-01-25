import { Elysia } from 'elysia';

const PORT = process.env.PORT ?? 3000;

const app = new Elysia()
  .get('/health', () => ({
    status: 'healthy',
    version: '0.1.0',
    uptime_seconds: Math.floor(process.uptime()),
  }))
  .listen(PORT);

console.log(`🛡️ Popper running at http://localhost:${app.server?.port}`);
