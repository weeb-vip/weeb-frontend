import React from 'react';
import QueryProvider from '../../queryProvider';
import Register from '../../views/auth/register';

export default function RegisterPage() {
  return (
    <QueryProvider>
      <Register />
    </QueryProvider>
  );
}