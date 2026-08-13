// Browser RUM via OpenTelemetry.
//
// Server-side spans are emitted by the SvelteKit server straight to
// tempo-distributor over gRPC. A browser cannot reach that, so page-side spans
// go over OTLP/HTTP to https://otel.weeb.vip (Grafana Alloy), which batches and
// forwards them into the same Tempo. Both halves land in one trace view.
//
// Everything here is loaded dynamically. The OTel web SDK is a sizeable
// dependency and RUM is not needed to render a page, so it must never sit on
// the critical path of first paint.

import type { IConfig } from '../../config/interfaces';

let started = false;

/**
 * Initialise RUM if the active config declares an OTLP endpoint.
 *
 * Safe to call more than once — SvelteKit re-runs onMount on some navigations,
 * and registering two tracer providers would double every span.
 */
export function initTelemetryWhenConfigured(): void {
  if (typeof window === 'undefined' || started) return;

  const config = (window as any).config as IConfig | undefined;
  const endpoint = config?.otlp_endpoint;

  // No endpoint means RUM is deliberately off (local, development). Not an
  // error, and not worth a console warning on every page load.
  if (!endpoint) return;

  started = true;

  void start(endpoint, config?.environment || 'production');
}

async function start(endpoint: string, environment: string): Promise<void> {
  try {
    const [
      { WebTracerProvider, BatchSpanProcessor },
      { OTLPTraceExporter },
      { resourceFromAttributes },
      { ZoneContextManager },
      { registerInstrumentations },
      { FetchInstrumentation },
      { DocumentLoadInstrumentation },
    ] = await Promise.all([
      import('@opentelemetry/sdk-trace-web'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/context-zone'),
      import('@opentelemetry/instrumentation'),
      import('@opentelemetry/instrumentation-fetch'),
      import('@opentelemetry/instrumentation-document-load'),
    ]);

    const exporter = new OTLPTraceExporter({ url: endpoint });

    const provider = new WebTracerProvider({
      resource: resourceFromAttributes({
        // Distinct from the server-side "weeb-frontend" so browser and server
        // spans stay separable in Tempo while still sharing a trace.
        'service.name': 'weeb-frontend-browser',
        'deployment.environment': environment,
      }),
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });

    // ZoneContextManager keeps trace context across async boundaries, so a
    // fetch started inside a click handler stays attached to that interaction.
    provider.register({ contextManager: new ZoneContextManager() });

    registerInstrumentations({
      tracerProvider: provider,
      instrumentations: [
        new DocumentLoadInstrumentation(),
        new FetchInstrumentation({
          // Only propagate trace headers to our own APIs. Sending traceparent
          // to a third party trips their CORS preflight and the request fails.
          propagateTraceHeaderCorsUrls: [
            /^https:\/\/([a-z0-9-]+\.)*weeb\.vip\//,
          ],
          // The collector call is itself a fetch; tracing it would generate a
          // span for every export and never settle.
          ignoreUrls: [new RegExp(escapeRegExp(endpoint))],
        }),
      ],
    });
  } catch (err) {
    // RUM must never take the page down with it.
    console.warn('[telemetry] RUM init failed, continuing without it', err);
    started = false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
