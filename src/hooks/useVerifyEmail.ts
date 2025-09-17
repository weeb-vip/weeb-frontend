import { useMutation } from '@tanstack/react-query';
import { verifyEmail } from '../services/queries';
import debug from '../utils/debug';

export const useVerifyEmail = (
  token: string,
  onSuccess?: () => void,
  onError?: (error: any) => void
) => {
  return useMutation({
    ...verifyEmail(token),
    onSuccess: () => {
      debug.auth("Email verification successful");
      onSuccess?.();
    },
    onError: (error: any) => {
      debug.auth("Email verification failed:", error.message);
      onError?.(error);
    }
  });
};