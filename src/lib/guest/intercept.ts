import { overlayGuestList } from './overlay';
import { activeGuestEntries } from './active';

/**
 * The response interceptor: wraps a fetch so a GraphQL response comes back
 * with the signed-out visitor's browser list already in it, the way an axios
 * interceptor would. Members and pre-auth requests pass straight through, and
 * a response with nothing to change is returned as it came.
 */
export function withGuestOverlay(
  fetchFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  entries: () => ReturnType<typeof activeGuestEntries> = activeGuestEntries
) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await fetchFn(input, init);
    const active = entries();
    if (!active || !response.ok) return response;
    if (!(response.headers.get('content-type') ?? '').includes('json')) return response;

    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      return response;
    }
    const overlaid = overlayGuestList(body, active);
    if (overlaid === body) return response;

    return new Response(JSON.stringify(overlaid), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };
}
