import type { Actions, PageServerLoad } from './$types';
import { resetPassword } from '../../../services/queries';

export const load: PageServerLoad = async ({ url }) => {
  const token = url.searchParams.get('token');
  const email = url.searchParams.get('email');

  let errorMessage = '';
  let showForm = true;

  if (!token) {
    errorMessage = 'Invalid or missing reset token. Please request a new password reset.';
    showForm = false;
  } else if (!email) {
    errorMessage = 'Invalid or missing email. Please request a new password reset.';
    showForm = false;
  }

  return { token, email, errorMessage, showForm };
};

export const actions: Actions = {
  default: async ({ request, url }) => {
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email');

    if (!token || !email) {
      return { errorMessage: 'Invalid or missing reset token. Please request a new password reset.', successMessage: '' };
    }

    try {
      const formData = await request.formData();
      const newPassword = formData.get('newPassword') as string;
      const confirmPassword = formData.get('confirmPassword') as string;

      if (!newPassword || !confirmPassword) {
        return { errorMessage: 'Both password fields are required.', successMessage: '' };
      }
      if (newPassword.length < 8) {
        return { errorMessage: 'Password must be at least 8 characters long.', successMessage: '' };
      }
      if (newPassword !== confirmPassword) {
        return { errorMessage: 'Passwords do not match.', successMessage: '' };
      }

      const resetPasswordQuery = resetPassword();
      const result = await resetPasswordQuery.mutationFn({
        input: {
          token,
          newPassword,
          username: email
        }
      });

      if (result) {
        return { errorMessage: '', successMessage: 'Password reset successful! Redirecting to home page...' };
      }
      return { errorMessage: 'Password reset failed. Please try again.', successMessage: '' };
    } catch (error: any) {
      console.error('Password reset error:', error);
      return { errorMessage: error.message || 'Password reset failed. Please try again.', successMessage: '' };
    }
  }
};
