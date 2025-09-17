import React from 'react';
import QueryProvider from '../../queryProvider';
import ShowContentWithInitialData from '../ShowContentWithInitialData';
import debug from '../../utils/debug';

interface Props {
  animeId: string;
  initialData?: any;
}

export default function ShowContentSSR({ animeId, initialData }: Props) {
  const handleContentLoaded = React.useCallback(() => {
    debug.info('ShowContentSSR: Content loaded');
    const event = new CustomEvent('show-content-loaded');
    document.dispatchEvent(event);
  }, []);

  // Extract the anime data from the GraphQL response if it exists
  const processedInitialData = initialData?.anime ? initialData : null;

  return (
    <QueryProvider>
      <ShowContentWithInitialData
        animeId={animeId}
        initialData={processedInitialData}
        onLoaded={handleContentLoaded}
      />
    </QueryProvider>
  );
}