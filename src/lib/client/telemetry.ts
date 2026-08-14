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
import debug from '../../utils/debug';

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
      { registerInstrumentations },
      { FetchInstrumentation },
      { DocumentLoadInstrumentation },
    ] = await Promise.all([
      import('@opentelemetry/sdk-trace-web'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/resources'),
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
        // Same build constant the footer renders, so a span can be tied back
        // to an exact release. Baked in by vite from VITE_APP_VERSION, which
        // CI sets from the semantic-release version; it is the string "dev"
        // for local builds.
        'service.version': __APP_VERSION__,
        'deployment.environment': environment,
      }),
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });

    // Deliberately the default context manager, not ZoneContextManager.
    //
    // context-zone pulls in zone.js, which monkey-patches setTimeout, promises
    // and event handlers process-wide. That shifted the header search debounce
    // enough that refining a query re-ran the results panel's entrance
    // animation instead of swapping contents in place — the panel blinked to
    // opacity 0 on every keystroke in Firefox, caught by
    // tests/e2e/search-autocomplete-responsiveness.spec.ts.
    //
    // The tradeoff is small here: ZoneContextManager exists to keep trace
    // context across async boundaries so a fetch nests under the interaction
    // that triggered it, but we register no user-interaction instrumentation,
    // so there is no parent span for it to preserve. Fetch spans are still
    // created and exported either way. Do not reintroduce it without a
    // user-interaction span to hang them off, and re-run that spec if you do.
    provider.register();

    registerInstrumentations({
      tracerProvider: provider,
      instrumentations: [
        new DocumentLoadInstrumentation(),
        new FetchInstrumentation({
          // Staging hosts only, deliberately not all of weeb.vip.
          //
          // traceparent on a cross-origin request has to be listed in the
          // server's Access-Control-Allow-Headers or the browser blocks the
          // request outright. gateway.staging.weeb.vip sits behind an istio
          // corsPolicy with allowHeaders ["*"], so it accepts it. Production
          // gateway.weeb.vip answers with a fixed list:
          //
          //   Accept, Authorization, Content-Type, X-CSRF-Token
          //
          // no traceparent, so propagating there would fail the preflight and
          // break every GraphQL call rather than merely losing a span.
          //
          // To extend this to production, first add traceparent (and
          // tracestate) to gateway-proxy's allowed CORS headers, confirm with:
          //   curl -X OPTIONS https://gateway.weeb.vip/graphql \
          //     -H 'Origin: https://weeb.vip' \
          //     -H 'Access-Control-Request-Method: POST' \
          //     -H 'Access-Control-Request-Headers: traceparent'
          // then widen this regex back to ([a-z0-9-]+\.)*weeb\.vip.
          propagateTraceHeaderCorsUrls: [
            /^https:\/\/([a-z0-9-]+\.)*staging\.weeb\.vip\//,
          ],
          // The collector call is itself a fetch; tracing it would generate a
          // span for every export and never settle.
          ignoreUrls: [new RegExp(escapeRegExp(endpoint))],
        }),
      ],
    });
  } catch (err) {
    // RUM must never take the page down with it.
    debug.warn('[telemetry] RUM init failed, continuing without it', err);
    started = false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
