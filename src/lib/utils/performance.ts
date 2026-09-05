// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Mark the start of a timing measurement
  mark(name: string): void {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${name}-start`);
    }
    this.metrics.set(`${name}-start`, Date.now());
  }

  // Mark the end and calculate duration
  measure(name: string): number {
    const startTime = this.metrics.get(`${name}-start`);
    if (!startTime) {
      console.warn(`No start mark found for ${name}`);
      return 0;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }

    this.metrics.set(name, duration);
    
    // Log performance metrics in development
    if (import.meta.env.DEV) {
      console.log(`📊 Performance: ${name} took ${duration}ms`);
    }
    
    return duration;
  }

  // Get all collected metrics
  getMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    this.metrics.forEach((value, key) => {
      if (!key.endsWith('-start')) {
        result[key] = value;
      }
    });
    return result;
  }

  // Get Web Vitals
  getWebVitals(): void {
    if (typeof performance === 'undefined') return;

    // First Contentful Paint
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry;
    if (fcpEntry) {
      console.log(`🎨 First Contentful Paint: ${fcpEntry.startTime}ms`);
    }

    // Largest Contentful Paint (requires observer)
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log(`🖼️ Largest Contentful Paint: ${lastEntry.startTime}ms`);
        observer.disconnect();
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    }
  }

  // Report key metrics
  reportVitals(): void {
    // Time to Interactive approximation
    if (document.readyState === 'complete') {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        console.log(`⚡ Dom Content Loaded: ${navigationEntry.domContentLoadedEventEnd}ms`);
        console.log(`🏁 Page Load Complete: ${navigationEntry.loadEventEnd}ms`);
      }
    }
  }
}

// Easy-to-use singleton
export const perf = PerformanceMonitor.getInstance();

// React hook for measuring component render times
export function usePerformanceMonitor(componentName: string) {
  const monitor = PerformanceMonitor.getInstance();
  
  return {
    startRender: () => monitor.mark(`${componentName}-render`),
    endRender: () => monitor.measure(`${componentName}-render`),
    startMount: () => monitor.mark(`${componentName}-mount`),
    endMount: () => monitor.measure(`${componentName}-mount`)
  };
}