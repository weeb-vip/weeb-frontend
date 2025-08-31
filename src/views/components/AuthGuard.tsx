import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoggedInStore } from '../../services/globalstore';

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * AuthGuard component prevents logged-in users from accessing auth pages
 * like login, password reset, etc. and redirects them to the home page
 */
const AuthGuard: React.FC<AuthGuardProps> = ({ children, redirectTo = '/' }) => {
  const isLoggedIn = useLoggedInStore((state) => state.isLoggedIn);
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn) {
      navigate(redirectTo, { replace: true });
    }
  }, [isLoggedIn, navigate, redirectTo]);

  // If user is logged in, don't render the auth page content
  if (isLoggedIn) {
    return null;
  }

  // Render the auth page content for non-logged-in users
  return <>{children}</>;
};

export default AuthGuard;