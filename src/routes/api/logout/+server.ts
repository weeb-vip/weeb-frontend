import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
  try {
    const cookiesToClear = ['authToken', 'refreshToken', 'session', 'auth', 'user'];

    cookiesToClear.forEach((cookieName) => {
      cookies.delete(cookieName, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
      });
    });

    return json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return json({ success: false, error: 'Logout failed' }, { status: 500 });
  }
};
