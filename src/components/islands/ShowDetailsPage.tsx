import React from 'react';
import QueryProvider from '../../queryProvider';
import {FlagsmithProvider} from 'flagsmith/react';
import flagsmith from 'flagsmith';
import ShowIndex from '../../views/show/index';


export default function ShowDetailsPage() {
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
        <ShowIndex />
      </FlagsmithProvider>
    </QueryProvider>
  );
}
