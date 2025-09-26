import * as api from '@opentelemetry/api';

// Lazy-loaded dependencies
let deps: any = {};

// Initialize telemetry only on server
let sdk: any = null;
let tracer: api.Tracer | null = null;
let meter: api.Meter | null = null;

// Custom metrics
let ssrRequestCounter: api.Counter | null = null;
let ssrDurationHistogram: api.Histogram | null = null;
let configLoadHistogram: api.Histogram | null = null;
let authCheckHistogram: api.Histogram | null = null;
let graphqlDurationHistogram: api.Histogram | null = null;

async function loadDependencies() {
  if (typeof window !== 'undefined' || deps.loaded) {
    return;
  }

  try {
    const [
      sdkModule,
      autoInstrumentationsModule,
      metricsModule,
      resourcesModule,
      semanticModule,
      traceExporterModule,
      metricExporterModule,
    ] = await Promise.all([
      import('@opentelemetry/sdk-node'),
      import('@opentelemetry/auto-instrumentations-node'),
      import('@opentelemetry/sdk-metrics'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/semantic-conventions'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/exporter-metrics-otlp-http'),
    ]);

    // Extract Resource from the module structure
    const Resource = resourcesModule.Resource ||
                     (resourcesModule.default && resourcesModule.default.Resource) ||
                     resourcesModule.default;

    deps = {
      NodeSDK: sdkModule.NodeSDK || sdkModule.default?.NodeSDK || sdkModule.default,
      getNodeAutoInstrumentations: autoInstrumentationsModule.getNodeAutoInstrumentations || autoInstrumentationsModule.default?.getNodeAutoInstrumentations || autoInstrumentationsModule.default,
      PeriodicExportingMetricReader: metricsModule.PeriodicExportingMetricReader || metricsModule.default?.PeriodicExportingMetricReader || metricsModule.default,
      ConsoleMetricExporter: metricsModule.ConsoleMetricExporter || metricsModule.default?.ConsoleMetricExporter,
      Resource: Resource,
      ATTR_SERVICE_NAME: semanticModule.ATTR_SERVICE_NAME || 'service.name',
      ATTR_SERVICE_VERSION: semanticModule.ATTR_SERVICE_VERSION || 'service.version',
      OTLPTraceExporter: traceExporterModule.OTLPTraceExporter || traceExporterModule.default?.OTLPTraceExporter || traceExporterModule.default,
      OTLPMetricExporter: metricExporterModule.OTLPMetricExporter || metricExporterModule.default?.OTLPMetricExporter || metricExporterModule.default,
      loaded: true,
    };
  } catch (error) {
    console.error('Failed to load OpenTelemetry dependencies:', error);
  }
}

export async function initTelemetry() {
  console.log('🔍 Telemetry initialization disabled for debugging');
  return; // Temporarily disabled

  if (typeof window !== 'undefined' || sdk) {
    return; // Only run on server and only once
  }

  await loadDependencies();

  if (!deps.loaded) {
    console.warn('OpenTelemetry dependencies not loaded, skipping initialization');
    return;
  }

  try {
    const serviceName = process.env.OTEL_SERVICE_NAME || 'weeb-frontend-ssr';
    const serviceVersion = process.env.OTEL_SERVICE_VERSION || process.env.npm_package_version || '1.0.0';
    const environment = process.env.OTEL_ENVIRONMENT || process.env.NODE_ENV || 'development';

    const resource = new deps.Resource({
      [deps.ATTR_SERVICE_NAME]: serviceName,
      [deps.ATTR_SERVICE_VERSION]: serviceVersion,
      environment: environment,
      'service.instance.id': process.env.HOSTNAME || `${serviceName}-${Date.now()}`,
    });

    // Configure exporters based on environment
    const isProduction = process.env.NODE_ENV === 'production';

    // OTLP endpoints - configure these based on your setup
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

    const traceExporter = isProduction
      ? new deps.OTLPTraceExporter({
          url: `${otlpEndpoint}/v1/traces`,
          headers: {},
        })
      : new deps.OTLPTraceExporter({
          url: `${otlpEndpoint}/v1/traces`,
        });

    const metricExporter = isProduction
      ? new deps.OTLPMetricExporter({
          url: `${otlpEndpoint}/v1/metrics`,
          headers: {},
        })
      : new deps.ConsoleMetricExporter();

    sdk = new deps.NodeSDK({
      resource,
      traceExporter,
      metricReader: new deps.PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 10000, // Export every 10 seconds
      }),
      instrumentations: [
        deps.getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable fs instrumentation to reduce noise
          },
        }),
      ],
    });

    sdk.start();

    // Get tracer and meter for manual instrumentation
    tracer = api.trace.getTracer(serviceName, serviceVersion);
    meter = api.metrics.getMeter(serviceName, serviceVersion);

    // Create custom metrics
    ssrRequestCounter = meter.createCounter('ssr.requests', {
      description: 'Number of SSR requests',
      unit: 'requests',
    });

    ssrDurationHistogram = meter.createHistogram('ssr.duration', {
      description: 'SSR request duration',
      unit: 'ms',
    });

    configLoadHistogram = meter.createHistogram('config.load.duration', {
      description: 'Config loading duration',
      unit: 'ms',
    });

    authCheckHistogram = meter.createHistogram('auth.check.duration', {
      description: 'Auth check duration',
      unit: 'ms',
    });

    graphqlDurationHistogram = meter.createHistogram('graphql.query.duration', {
      description: 'GraphQL query duration',
      unit: 'ms',
    });

    console.log('🔍 OpenTelemetry initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error);
  }
}

// Shutdown telemetry gracefully
export async function shutdownTelemetry() {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('OpenTelemetry shut down successfully');
    } catch (error) {
      console.error('Error shutting down OpenTelemetry:', error);
    }
  }
}

// Helper functions for tracing
export function startSpan(name: string, attributes?: api.Attributes): api.Span {
  if (!tracer) {
    return api.trace.getActiveSpan() || api.trace.getTracer('noop').startSpan('noop');
  }
  return tracer.startSpan(name, { attributes });
}

export function withSpan<T>(
  name: string,
  fn: (span: any) => T | Promise<T>,
  attributes?: any
): T | Promise<T> {
  // Telemetry disabled - just execute the function directly
  return fn({ setAttributes: () => {}, setStatus: () => {} });
}

// Metric recording functions
export function recordSSRRequest(attributes: Record<string, any>) {
  // Telemetry disabled
}

export function recordSSRDuration(duration: number, attributes: Record<string, any>) {
  // Telemetry disabled
}

export function recordConfigLoadDuration(duration: number) {
  // Telemetry disabled
}

export function recordAuthCheckDuration(duration: number, attributes: Record<string, any>) {
  // Telemetry disabled
}

export function recordGraphQLDuration(duration: number, attributes: Record<string, any>) {
  // Telemetry disabled
}

// Process-level handlers
if (typeof window === 'undefined') {
  process.on('SIGTERM', async () => {
    await shutdownTelemetry();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await shutdownTelemetry();
    process.exit(0);
  });
}