import { useMutation } from '@tanstack/react-query';
import { requestPasswordReset } from '../services/queries';
import debug from '../utils/debug';

export const useRequestPasswordReset = () => {
  return useMutation({
    ...requestPasswordReset(),
    onSuccess: (response: boolean) => {
      debug.auth("Password reset request successful:", response);
    },
    onError: (error: any) => {
      debug.auth("Password reset request failed:", error.message);
    }
  });
};