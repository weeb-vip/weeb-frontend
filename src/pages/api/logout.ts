import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Clear all authentication-related cookies
    const cookiesToClear = [
      'authToken',
      'refreshToken',
      'session',
      'auth',
      'user',
      // Add any other auth cookie names you use
    ];

    // Clear cookies by setting them with expired dates
    cookiesToClear.forEach(cookieName => {
      cookies.delete(cookieName, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
      });
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Logout error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: 'Logout failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};