import React, { useEffect, useState } from 'react';
import QueryProvider from '../../queryProvider';
import { FlagsmithProvider } from 'flagsmith/react';
import flagsmith from 'flagsmith';
import ProfileIndex from '../../views/profile/index';
import Loader from '../Loader';

export default function ProfilePage() {
  const [configLoaded, setConfigLoaded] = useState(false);
  const [environmentID, setEnvironmentID] = useState('fallback');

  useEffect(() => {
    // Wait for config to be loaded
    if (typeof window !== 'undefined') {
      const checkConfig = () => {
        if ((window as any).config) {
          setEnvironmentID((window as any).config.flagsmith_environment_id || 'fallback');
          setConfigLoaded(true);
        } else {
          // Config not loaded yet, try again
          setTimeout(checkConfig, 100);
        }
      };
      checkConfig();
    } else {
      setConfigLoaded(true);
    }
  }, []);

  if (!configLoaded) {
    return <Loader />;
  }

  return (
    <QueryProvider>
      <FlagsmithProvider
        options={{
          environmentID,
          api: "https://flagsmith.weeb.vip/api/v1/",
        }}
        flagsmith={flagsmith}
      >
        <ProfileIndex />
      </FlagsmithProvider>
    </QueryProvider>
  );
}