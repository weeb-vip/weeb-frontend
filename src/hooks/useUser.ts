import { useQuery } from "@tanstack/react-query";
import { getUser } from "../services/queries";

export const useUser = () => {
  return useQuery(getUser());
};