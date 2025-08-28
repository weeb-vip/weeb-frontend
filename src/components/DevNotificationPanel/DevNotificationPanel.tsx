import React, { useState } from 'react';
import { useToast } from '../Toast';
import Button, { ButtonColor } from '../Button';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentlyAiring } from '../../services/queries';
import { CurrentlyAiringQuery } from '../../gql/graphql';

const DevNotificationPanel: React.FC = () => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: currentlyAiringData } = useQuery<CurrentlyAiringQuery>(fetchCurrentlyAiring());
  
  // Get a sample anime for testing
  const sampleAnime = currentlyAiringData?.currentlyAiring?.[0];

  const triggerFiveMinuteWarning = () => {
    if (!sampleAnime) return;
    
    showToast({
      type: 'warning',
      title: 'Anime Airing Soon',
      message: `Episode ${sampleAnime.nextEpisode?.episodeNumber || '1'} starts in 5 minutes`,
      duration: 8000,
      anime: {
        id: sampleAnime.id,
        titleEn: sampleAnime.titleEn,
        titleJp: sampleAnime.titleJp,
        imageUrl: sampleAnime.imageUrl
      }
    });
  };

  const triggerCurrentlyAiring = () => {
    if (!sampleAnime) return;
    
    const episodeTitle = sampleAnime.nextEpisode?.titleEn || sampleAnime.nextEpisode?.titleJp || 'Unknown Episode';
    
    showToast({
      type: 'info',
      title: 'Now Airing',
      message: `Episode ${sampleAnime.nextEpisode?.episodeNumber || '1'}: ${episodeTitle}`,
      duration: 10000,
      anime: {
        id: sampleAnime.id,
        titleEn: sampleAnime.titleEn,
        titleJp: sampleAnime.titleJp,
        imageUrl: sampleAnime.imageUrl
      }
    });
  };

  const triggerCustomNotification = () => {
    showToast({
      type: 'success',
      title: 'Custom Test',
      message: 'This is a custom notification for testing',
      duration: 5000,
      anime: sampleAnime ? {
        id: sampleAnime.id,
        titleEn: sampleAnime.titleEn,
        titleJp: sampleAnime.titleJp,
        imageUrl: sampleAnime.imageUrl
      } : undefined
    });
  };

  const triggerMultipleNotifications = () => {
    // Trigger multiple notifications with delays
    triggerFiveMinuteWarning();
    setTimeout(() => triggerCurrentlyAiring(), 1000);
    setTimeout(() => triggerCustomNotification(), 2000);
  };

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <>
      {/* Toggle Button */}
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          color={ButtonColor.blue}
          label={isOpen ? 'Hide Dev Panel' : '🧪 Dev Notifications'}
          showLabel
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs px-3 py-2"
        />
      </div>

      {/* Dev Panel */}
      {isOpen && (
        <div className="fixed bottom-16 left-4 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 w-80">
          <div className="mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
              🧪 Notification Testing Panel
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Test different notification types using {sampleAnime?.titleEn || sampleAnime?.titleJp || 'sample anime'}
            </p>
          </div>

          <div className="space-y-2">
            <Button
              color={ButtonColor.blue}
              label="🕐 5-Minute Warning"
              showLabel
              onClick={sampleAnime ? triggerFiveMinuteWarning : () => {}}
              className={`w-full text-xs px-3 py-2 ${!sampleAnime ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            
            <Button
              color={ButtonColor.blue}
              label="▶️ Currently Airing"
              showLabel
              onClick={sampleAnime ? triggerCurrentlyAiring : () => {}}
              className={`w-full text-xs px-3 py-2 ${!sampleAnime ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            
            <Button
              color={ButtonColor.blue}
              label="✅ Custom Success"
              showLabel
              onClick={triggerCustomNotification}
              className="w-full text-xs px-3 py-2"
            />
            
            <Button
              color={ButtonColor.blue}
              label="🚀 Multiple Notifications"
              showLabel
              onClick={sampleAnime ? triggerMultipleNotifications : () => {}}
              className={`w-full text-xs px-3 py-2 ${!sampleAnime ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          {!sampleAnime && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
              ⚠️ No currently airing data available for testing
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              💡 Notifications appear in top-right corner
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default DevNotificationPanel;