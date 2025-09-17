import { useMutation } from '@tanstack/react-query';
import { resetPassword } from '../services/queries';
import debug from '../utils/debug';

export const usePasswordReset = (onSuccess?: (response: boolean) => void, onError?: (error: any) => void) => {
  return useMutation({
    ...resetPassword(),
    onSuccess: (response: boolean) => {
      debug.auth("Password reset successful:", response);
      onSuccess?.(response);
    },
    onError: (error: any) => {
      debug.auth("Password reset failed:", error.message);
      onError?.(error);
    }
  });
};