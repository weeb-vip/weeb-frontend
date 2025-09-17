import React, { useEffect } from 'react';
import { useNavigate } from '../../utils/navigation';
import { useLoggedInStore, useLoginModalStore } from '../../services/globalstore';

interface RequireAuthProps {
  children: React.ReactNode;
  redirectTo?: string;
  showLoginModal?: boolean;
}

/**
 * RequireAuth component ensures only logged-in users can access protected pages
 * Redirects non-authenticated users to login or shows login modal
 */
const RequireAuth: React.FC<RequireAuthProps> = ({ 
  children, 
  redirectTo = '/login',
  showLoginModal = false 
}) => {
  const isLoggedIn = useLoggedInStore((state) => state.isLoggedIn);
  const isAuthInitialized = useLoggedInStore((state) => state.isAuthInitialized);
  const openLogin = useLoginModalStore((state) => state.openLogin);
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect/show modal after auth is initialized and user is not logged in
    if (isAuthInitialized && !isLoggedIn) {
      if (showLoginModal) {
        // Show the login modal instead of redirecting
        openLogin();
      } else {
        // Redirect to login page
        navigate(redirectTo);
      }
    }
  }, [isLoggedIn, isAuthInitialized, navigate, redirectTo, showLoginModal, openLogin]);

  // Don't render anything until auth is initialized
  if (!isAuthInitialized) {
    return <>{children}</>;
  }

  // If user is not logged in (and auth is initialized), don't render the protected content
  if (!isLoggedIn) {
    return null;
  }

  // Render the protected content for logged-in users
  return <>{children}</>;
};

export default RequireAuth;