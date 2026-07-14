import { json, type RequestHandler } from '@sveltejs/kit';
import { clearAuthCookies } from '$lib/server/auth-cookies';

export const POST: RequestHandler = async ({ cookies }) => {
  try {
    clearAuthCookies(cookies);
    return json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return json({ success: false, error: 'Logout failed' }, { status: 500 });
  }
};
