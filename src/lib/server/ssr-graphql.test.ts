import { isNotFoundError } from './ssr-graphql';

/** The shape graphql-request throws for a missing anime, via the federation router. */
const NOT_FOUND = {
  message: "Failed to fetch from Subgraph 'anime-api'.",
  response: {
    errors: [
      {
        message: "Failed to fetch from Subgraph 'anime-api'.",
        extensions: {
          errors: [
            {
              message: 'record not found',
              path: ['anime'],
              extensions: { code: 'DOWNSTREAM_SERVICE_ERROR' }
            }
          ],
          serviceName: 'anime-api'
        }
      }
    ],
    data: null
  }
};

describe('isNotFoundError', () => {
  it('recognises a missing record nested in subgraph extensions', () => {
    expect(isNotFoundError(NOT_FOUND)).toBe(true);
  });

  it('recognises it at the top level too', () => {
    expect(
      isNotFoundError({ response: { errors: [{ message: 'record not found' }] } })
    ).toBe(true);
  });

  it('does NOT treat a gateway failure as not-found', () => {
    // The important negative: answering 404 for a transient outage would tell Google
    // that real pages are gone.
    expect(
      isNotFoundError({
        message: 'connect ECONNREFUSED',
        response: {
          errors: [{ message: "Failed to fetch from Subgraph 'anime-api'." }]
        }
      })
    ).toBe(false);
  });

  it('does not treat auth or timeout errors as not-found', () => {
    expect(isNotFoundError({ message: 'Request timeout' })).toBe(false);
    expect(
      isNotFoundError({ response: { errors: [{ message: 'access denied' }] } })
    ).toBe(false);
  });

  it('survives malformed errors', () => {
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError({})).toBe(false);
    expect(isNotFoundError({ response: {} })).toBe(false);
    expect(isNotFoundError({ response: { errors: [{ extensions: {} }] } })).toBe(false);
  });
});
