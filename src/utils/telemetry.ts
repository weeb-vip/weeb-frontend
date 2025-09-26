import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import * as api from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

// Initialize telemetry only on server
let sdk: NodeSDK | null = null;
let tracer: api.Tracer | null = null;
let meter: api.Meter | null = null;

// Custom metrics
let ssrRequestCounter: api.Counter | null = null;
let ssrDurationHistogram: api.Histogram | null = null;
let configLoadHistogram: api.Histogram | null = null;
let authCheckHistogram: api.Histogram | null = null;
let graphqlDurationHistogram: api.Histogram | null = null;

export function initTelemetry() {
  if (typeof window !== 'undefined' || sdk) {
    return; // Only run on server and only once
  }

  try {
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: 'weeb-frontend-ssr',
      [ATTR_SERVICE_VERSION]: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    });

    // Configure exporters based on environment
    const isProduction = process.env.NODE_ENV === 'production';

    // OTLP endpoints - configure these based on your setup
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

    const traceExporter = isProduction
      ? new OTLPTraceExporter({
          url: `${otlpEndpoint}/v1/traces`,
          headers: {},
        })
      : new OTLPTraceExporter({
          url: `${otlpEndpoint}/v1/traces`,
        });

    const metricExporter = isProduction
      ? new OTLPMetricExporter({
          url: `${otlpEndpoint}/v1/metrics`,
          headers: {},
        })
      : new ConsoleMetricExporter();

    sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 10000, // Export every 10 seconds
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable fs instrumentation to reduce noise
          },
        }),
      ],
    });

    sdk.start();

    // Get tracer and meter for manual instrumentation
    tracer = api.trace.getTracer('weeb-frontend-ssr', '1.0.0');
    meter = api.metrics.getMeter('weeb-frontend-ssr', '1.0.0');

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
  fn: (span: api.Span) => T | Promise<T>,
  attributes?: api.Attributes
): T | Promise<T> {
  if (!tracer) {
    return fn(api.trace.getActiveSpan() || api.trace.getTracer('noop').startSpan('noop'));
  }

  const span = tracer.startSpan(name, { attributes });
  const context = api.trace.setSpan(api.context.active(), span);

  return api.context.with(context, () => {
    try {
      const result = fn(span);
      if (result instanceof Promise) {
        return result
          .then((value) => {
            span.setStatus({ code: api.SpanStatusCode.OK });
            span.end();
            return value;
          })
          .catch((error) => {
            span.setStatus({
              code: api.SpanStatusCode.ERROR,
              message: error.message,
            });
            span.recordException(error);
            span.end();
            throw error;
          });
      } else {
        span.setStatus({ code: api.SpanStatusCode.OK });
        span.end();
        return result;
      }
    } catch (error: any) {
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      span.end();
      throw error;
    }
  });
}

// Metric recording functions
export function recordSSRRequest(attributes: Record<string, any>) {
  ssrRequestCounter?.add(1, attributes);
}

export function recordSSRDuration(duration: number, attributes: Record<string, any>) {
  ssrDurationHistogram?.record(duration, attributes);
}

export function recordConfigLoadDuration(duration: number) {
  configLoadHistogram?.record(duration);
}

export function recordAuthCheckDuration(duration: number, attributes: Record<string, any>) {
  authCheckHistogram?.record(duration, attributes);
}

export function recordGraphQLDuration(duration: number, attributes: Record<string, any>) {
  graphqlDurationHistogram?.record(duration, attributes);
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