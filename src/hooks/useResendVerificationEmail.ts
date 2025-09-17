import { useMutation } from '@tanstack/react-query';
import { resendVerificationEmail } from '../services/queries';
import debug from '../utils/debug';

export const useResendVerificationEmail = (
  onSuccess?: (response: boolean) => void,
  onError?: (error: any) => void
) => {
  return useMutation({
    ...resendVerificationEmail(),
    onSuccess: (response: boolean) => {
      debug.auth("Resend verification email successful:", response);
      onSuccess?.(response);
    },
    onError: (error: any) => {
      debug.auth("Resend verification email failed:", error.message);
      onError?.(error);
    }
  });
};