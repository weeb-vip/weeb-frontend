// Explicit trace context propagation.
//
// The browser SDK auto-traces every fetch, but each of those spans is just
// "HTTP POST" against the same /graphql URL, so a trace of six calls is six
// identical rows. These helpers wrap a call in a named parent span, which is
// what makes the waterfall readable.
//
// Explicit rather than automatic on purpose. The automatic option is
// ZoneContextManager, which cannot track context inside a native async
// function (see opentelemetry-js#1502) and this app builds to es2020, so its
// async/await is native and would not be tracked anyway. It also patches
// timers, promises and event handlers process-wide, which previously broke
// the search autocomplete by reordering Svelte's microtask scheduling.
//
// The tradeoff to know about: context is active only for the synchronous body
// of the callback. Start the request inside the callback, not after an await:
//
//   withSpan('x', {}, () => fetch(url))          // fetch nests correctly
//   withSpan('x', {}, async () => {              // fetch does NOT nest,
//     await somethingElse();                     // context is gone by here
//     return fetch(url);
//   })
//
// Safe everywhere. Without a registered tracer provider the OTel API returns
// no-op spans, so this costs nothing during SSR or when RUM is disabled.

import { context, trace, SpanStatusCode, type Attributes } from '@opentelemetry/api';

const tracer = trace.getTracer('weeb-frontend');

/**
 * Run `fn` inside a named span, so any fetch it starts nests underneath.
 */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: () => Promise<T> | T
): Promise<T> {
  const span = tracer.startSpan(name, { attributes });

  try {
    return await context.with(trace.setSpan(context.active(), span), fn);
  } catch (err) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof Error) span.recordException(err);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Pull the operation name out of a GraphQL request body so the span can be
 * named after it rather than after the URL, which is identical for every call.
 *
 * graphql-request sends a JSON body with operationName set. Uploads use
 * multipart/form-data instead, where the same field lives in the "operations"
 * part. Returns null when it cannot be determined, and never throws — a
 * telemetry helper must not be able to fail a request.
 */
export function graphqlOperationName(body: BodyInit | null | undefined): string | null {
  try {
    if (typeof body === 'string') {
      const parsed = JSON.parse(body);
      return typeof parsed?.operationName === 'string' ? parsed.operationName : null;
    }

    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      const operations = body.get('operations');
      if (typeof operations === 'string') {
        const parsed = JSON.parse(operations);
        return typeof parsed?.operationName === 'string' ? parsed.operationName : null;
      }
    }
  } catch {
    // Unparseable body is not worth reporting; the span just keeps a generic name.
  }

  return null;
}
