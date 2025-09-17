import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login } from '../services/queries';
import debug from '../utils/debug';

export const useLogin = (
  onSuccess?: (response: any) => void,
  onError?: (error: any) => void
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...login(),
    onSuccess: (response: any) => {
      debug.auth("Login successful:", response);

      // Invalidate user query to refetch with new token
      queryClient.invalidateQueries({ queryKey: ['user'] });

      onSuccess?.(response);
    },
    onError: (error: any) => {
      debug.auth("Login failed:", error.message);
      onError?.(error);
    }
  });
};