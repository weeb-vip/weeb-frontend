// Navigation utilities to replace React Router functionality

export const navigate = (to: string) => {
  window.location.href = to;
};

export const useNavigate = () => {
  return navigate;
};

// Helper function to replace Link component usage
export const createHref = (to: string) => to;