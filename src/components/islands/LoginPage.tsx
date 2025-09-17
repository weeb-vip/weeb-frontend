import React from 'react';
import QueryProvider from '../../queryProvider';
import Login from '../../views/auth/login';

export default function LoginPage() {
  return (
    <QueryProvider>
      <Login />
    </QueryProvider>
  );
}