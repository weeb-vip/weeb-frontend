import { useQuery } from "@tanstack/react-query";
import { getUser } from "../services/queries.ts";
import { useLoggedInStore } from "../services/globalstore";

export const useUser = () => {
  const isLoggedIn = useLoggedInStore((state) => state.isLoggedIn);

  return useQuery({
    ...getUser(),
    enabled: isLoggedIn && !!localStorage.getItem('authToken')
  });
};
