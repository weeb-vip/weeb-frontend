import React, { useCallback } from 'react';
import QueryProvider from '../../queryProvider';
import ShowContent from '../ShowContent';
import debug from '../../utils/debug';

interface Props {
  animeId: string;
}

export default function ShowContentLoader({ animeId }: Props) {
  const handleContentLoaded = useCallback(() => {
    debug.info('ShowContentLoader: Content loaded, dispatching event');
    // Dispatch event to notify parent that content is ready
    const event = new CustomEvent('show-content-loaded');
    document.dispatchEvent(event);
    debug.info('ShowContentLoader: Event dispatched');
  }, []);

  return (
    <QueryProvider>
      <ShowContent animeId={animeId} onLoaded={handleContentLoaded} />
    </QueryProvider>
  );
}
