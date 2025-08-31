import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const openLogin = useLoginModalStore((state) => state.openLogin);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn) {
      if (showLoginModal) {
        // Show the login modal instead of redirecting
        openLogin();
      } else {
        // Redirect to login page
        navigate(redirectTo, { replace: true });
      }
    }
  }, [isLoggedIn, navigate, redirectTo, showLoginModal, openLogin]);

  // If user is not logged in, don't render the protected content
  if (!isLoggedIn) {
    return null;
  }

  // Render the protected content for logged-in users
  return <>{children}</>;
};

export default RequireAuth;