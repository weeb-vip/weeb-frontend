import { swipeNavigation } from '../utils/swipe-navigation';

// Initialize swipe navigation handler immediately
swipeNavigation;

// Clean up old states periodically
setInterval(() => {
  swipeNavigation.cleanupOldStates();
}, 10 * 60 * 1000); // Every 10 minutes
