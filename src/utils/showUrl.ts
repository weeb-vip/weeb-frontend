// Utility to generate show URLs for static mode
export const getShowUrl = (id: string | number): string => {
  return `/show?id=${encodeURIComponent(id)}`;
};