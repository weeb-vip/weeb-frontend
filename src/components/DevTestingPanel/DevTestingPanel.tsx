import React, { useState, useEffect } from 'react';
import { useToast } from '../Toast';
import Button, { ButtonColor } from '../Button';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentlyAiring } from '../../services/queries';
import { type CurrentlyAiringQuery } from '../../gql/graphql';
import debug from '../../utils/debug';
import { animeNotificationService } from '../../services/animeNotifications';

interface TimeOffset {
  hours: number;
  minutes: number;
  seconds: number;
}

const DevTestingPanel: React.FC = () => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'time' | 'debug'>('notifications');
  
  // Time manipulation state
  const [timeOffset, setTimeOffset] = useState<TimeOffset>({ hours: 0, minutes: 0, seconds: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const { data: currentlyAiringData } = useQuery<CurrentlyAiringQuery>(fetchCurrentlyAiring());
  
  // Get a sample anime for testing
  const sampleAnime = currentlyAiringData?.currentlyAiring?.[0];

  // Update current time display
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const offsetMs = (timeOffset.hours * 3600 + timeOffset.minutes * 60 + timeOffset.seconds) * 1000;
      setCurrentTime(new Date(now.getTime() + offsetMs));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timeOffset]);

  // Apply time offset globally (this would need to be implemented in your time utilities)
  const applyTimeOffset = () => {
    const offsetMs = (timeOffset.hours * 3600 + timeOffset.minutes * 60 + timeOffset.seconds) * 1000;
    debug.warn(`🕐 DEV: Time offset applied: ${offsetMs}ms (${timeOffset.hours}h ${timeOffset.minutes}m ${timeOffset.seconds}s)`);
    
    // Store in global state or context for other components to use
    (window as any).__DEV_TIME_OFFSET__ = offsetMs;
    
    // Send offset to the anime notification worker
    animeNotificationService.setDevTimeOffset(offsetMs);
    
    showToast({
      type: 'info',
      title: 'Time Offset Applied',
      message: `Time shifted by ${timeOffset.hours}h ${timeOffset.minutes}m ${timeOffset.seconds}s`,
      duration: 3000
    });
  };

  const resetTimeOffset = () => {
    setTimeOffset({ hours: 0, minutes: 0, seconds: 0 });
    (window as any).__DEV_TIME_OFFSET__ = 0;
    
    // Reset offset in the anime notification worker
    animeNotificationService.setDevTimeOffset(0);
    
    debug.info('🕐 DEV: Time offset reset');
    
    showToast({
      type: 'success',
      title: 'Time Reset',
      message: 'Time offset has been reset to normal',
      duration: 3000
    });
  };

  // Quick time presets
  const quickTimePresets = [
    { label: '+5min', hours: 0, minutes: 5, seconds: 0 },
    { label: '+1hr', hours: 1, minutes: 0, seconds: 0 },
    { label: '+6hr', hours: 6, minutes: 0, seconds: 0 },
    { label: '+12hr', hours: 12, minutes: 0, seconds: 0 },
    { label: '+1day', hours: 24, minutes: 0, seconds: 0 },
    { label: '-5min', hours: 0, minutes: -5, seconds: 0 },
  ];

  // Notification testing functions
  const triggerFiveMinuteWarning = () => {
    if (!sampleAnime) return;
    
    showToast({
      type: 'warning',
      title: 'Anime Airing Soon',
      message: `Episode 1 starts in 5 minutes`,
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
    
    const episodeTitle = 'Test Episode';
    
    showToast({
      type: 'info',
      title: 'Now Airing',
      message: `Episode 1: ${episodeTitle}`,
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

  // Debug functions
  const logWorkerStatus = () => {
    debug.info('🔧 DEV: Worker status check requested');
    debug.info('🔧 DEV: Current time offset:', (window as any).__DEV_TIME_OFFSET__ || 0);
    debug.info('🔧 DEV: Currently airing data:', currentlyAiringData?.currentlyAiring?.length || 0, 'anime');
  };

  const clearAllLogs = () => {
    console.clear();
    debug.success('🔧 DEV: Console cleared');
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
          label={isOpen ? 'Hide Dev Panel' : '🧪 Dev Tools'}
          showLabel
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs px-3 py-2"
        />
      </div>

      {/* Dev Panel */}
      {isOpen && (
        <div className="fixed bottom-16 left-4 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 w-96">
          <div className="mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
              🧪 Development Testing Panel
            </h3>
            
            {/* Tabs */}
            <div className="flex space-x-1 mb-3">
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-2 py-1 text-xs rounded ${
                  activeTab === 'notifications'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                🔔 Notifications
              </button>
              <button
                onClick={() => setActiveTab('time')}
                className={`px-2 py-1 text-xs rounded ${
                  activeTab === 'time'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                🕐 Time
              </button>
              <button
                onClick={() => setActiveTab('debug')}
                className={`px-2 py-1 text-xs rounded ${
                  activeTab === 'debug'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                🔧 Debug
              </button>
            </div>
          </div>

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Test notifications using {sampleAnime?.titleEn || sampleAnime?.titleJp || 'sample anime'}
              </p>
              
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

              {!sampleAnime && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  ⚠️ No currently airing data available
                </p>
              )}
            </div>
          )}

          {/* Time Tab */}
          {activeTab === 'time' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Manipulate time for testing airing schedules and progress bars
              </p>
              
              {/* Current Time Display */}
              <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs">
                <div>Current: {new Date().toLocaleString()}</div>
                <div className="font-semibold">
                  Testing: {currentTime.toLocaleString()}
                  {timeOffset.hours !== 0 || timeOffset.minutes !== 0 || timeOffset.seconds !== 0 && (
                    <span className="text-blue-600 dark:text-blue-400 ml-2">
                      ({timeOffset.hours >= 0 ? '+' : ''}{timeOffset.hours}h {timeOffset.minutes >= 0 ? '+' : ''}{timeOffset.minutes}m)
                    </span>
                  )}
                </div>
              </div>

              {/* Time Controls */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1">Hours</label>
                  <input
                    type="number"
                    value={timeOffset.hours}
                    onChange={(e) => setTimeOffset(prev => ({ ...prev, hours: parseInt(e.target.value) || 0 }))}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    min="-48"
                    max="48"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1">Minutes</label>
                  <input
                    type="number"
                    value={timeOffset.minutes}
                    onChange={(e) => setTimeOffset(prev => ({ ...prev, minutes: parseInt(e.target.value) || 0 }))}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    min="-59"
                    max="59"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1">Seconds</label>
                  <input
                    type="number"
                    value={timeOffset.seconds}
                    onChange={(e) => setTimeOffset(prev => ({ ...prev, seconds: parseInt(e.target.value) || 0 }))}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    min="-59"
                    max="59"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 text-xs">Quick Presets:</label>
                <div className="grid grid-cols-3 gap-1">
                  {quickTimePresets.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setTimeOffset(preset)}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply/Reset Buttons */}
              <div className="flex space-x-2">
                <Button
                  color={ButtonColor.blue}
                  label="Apply Offset"
                  showLabel
                  onClick={applyTimeOffset}
                  className="flex-1 text-xs px-3 py-2"
                />
                <Button
                  color={ButtonColor.blue}
                  label="Reset"
                  showLabel
                  onClick={resetTimeOffset}
                  className="flex-1 text-xs px-3 py-2"
                />
              </div>
            </div>
          )}

          {/* Debug Tab */}
          {activeTab === 'debug' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Debug tools and system information
              </p>
              
              <Button
                color={ButtonColor.blue}
                label="🔍 Log Worker Status"
                showLabel
                onClick={logWorkerStatus}
                className="w-full text-xs px-3 py-2"
              />
              
              <Button
                color={ButtonColor.blue}
                label="🧹 Clear Console"
                showLabel
                onClick={clearAllLogs}
                className="w-full text-xs px-3 py-2"
              />
              
              <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs">
                <div>Version: {__APP_VERSION__}</div>
                <div>Debug Level: {process.env.VITE_LOG_LEVEL || 'info'}</div>
                <div>Debug Enabled: {process.env.VITE_DEBUG === 'true' ? 'Yes' : 'No'}</div>
                <div>Sensitive Logs: {process.env.VITE_DEBUG_SENSITIVE === 'true' ? 'Yes' : 'No'}</div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              💡 Development mode only • Check console for debug output
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Version: {__APP_VERSION__}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default DevTestingPanel;