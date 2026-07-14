import { json } from '@sveltejs/kit';

// Health check endpoint
export function GET() {
  return json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: (typeof process !== 'undefined' && process.env.PUBLIC_APP_ENV) || 'unknown',
    message: 'Health check passed'
  });
}
