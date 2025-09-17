import React from 'react';
import QueryProvider from '../../queryProvider';
import { FlagsmithProvider } from 'flagsmith/react';
import { ToastProvider } from '../Toast';
import flagsmith from 'flagsmith';
import { useAnimeNotifications } from '../../hooks/useAnimeNotifications';

function NotificationProvider() {
  // Initialize anime notifications globally
  useAnimeNotifications();
  return null; // This component doesn't render anything
}

export default function GlobalNotifications() {
  // Ensure we're on the client side before accessing window
  const environmentID = typeof window !== 'undefined'
    ? (window as any).config?.flagsmith_environment_id || 'fallback'
    : 'fallback';

  return (
    <QueryProvider>
      <FlagsmithProvider
        options={{
          environmentID,
          api: "https://flagsmith.weeb.vip/api/v1/",
        }}
        flagsmith={flagsmith}
      >
        <ToastProvider>
          <NotificationProvider />
        </ToastProvider>
      </FlagsmithProvider>
    </QueryProvider>
  );
}