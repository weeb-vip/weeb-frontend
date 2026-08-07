import { isInvalidCredentialsError, isUnverifiedEmailError } from '../auth-errors';

/**
 * Fixtures are the literal responses returned by the staging gateway
 * (gateway.staging.weeb.vip) — captured rather than invented, because the
 * useful code is nested two levels below a top-level message that says nothing.
 */
function gatewayError(code: string, message: string) {
  return {
    // graphql-request's ClientError shape
    message: `Failed to fetch from Subgraph 'auth-staging'.: ${JSON.stringify({ response: { errors: [] } })}`,
    response: {
      errors: [
        {
          message: "Failed to fetch from Subgraph 'auth-staging'.",
          extensions: {
            errors: [
              { message, path: ['CreateSession'], extensions: { code } },
            ],
            serviceName: 'auth-staging',
          },
        },
      ],
      data: { CreateSession: null },
    },
  };
}

const INACTIVE = gatewayError('INACTIVE_CREDENTIALS', 'credentials are not active');
const INVALID = gatewayError('INVALID_CREDENTIALS', 'invalid credentials');

describe('isUnverifiedEmailError', () => {
  it('matches the nested INACTIVE_CREDENTIALS code the gateway actually returns', () => {
    expect(isUnverifiedEmailError(INACTIVE)).toBe(true);
  });

  it('does not match a wrong password on a verified account', () => {
    expect(isUnverifiedEmailError(INVALID)).toBe(false);
  });

  // ClientError stringifies the whole response into .message, so the matcher
  // still works if the structured `response` is lost in transit.
  it('falls back to the stringified message when response is absent', () => {
    expect(isUnverifiedEmailError(new Error(JSON.stringify(INACTIVE.response)))).toBe(true);
    expect(isUnverifiedEmailError(new Error('credentials are not active'))).toBe(true);
  });

  it('returns false for unrelated failures', () => {
    expect(isUnverifiedEmailError(new Error('network error'))).toBe(false);
    expect(isUnverifiedEmailError(new Error(''))).toBe(false);
    expect(isUnverifiedEmailError(null)).toBe(false);
    expect(isUnverifiedEmailError(undefined)).toBe(false);
    expect(isUnverifiedEmailError({})).toBe(false);
  });

  it('does not blow up on deeply nested or cyclic-looking structures', () => {
    const deep: any = { response: { errors: [{ extensions: { errors: [{ extensions: { errors: [] } }] } }] } };
    expect(isUnverifiedEmailError(deep)).toBe(false);
  });
});

describe('isInvalidCredentialsError', () => {
  it('matches INVALID_CREDENTIALS', () => {
    expect(isInvalidCredentialsError(INVALID)).toBe(true);
  });

  it('does not match the unverified case', () => {
    expect(isInvalidCredentialsError(INACTIVE)).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isInvalidCredentialsError(null)).toBe(false);
    expect(isInvalidCredentialsError(undefined)).toBe(false);
  });
});

// The two branches drive different UI and must never both be true.
describe('the two classifications are mutually exclusive', () => {
  it.each([
    ['inactive', INACTIVE],
    ['invalid', INVALID],
  ])('%s matches exactly one classifier', (_label, error) => {
    const hits = [isUnverifiedEmailError(error), isInvalidCredentialsError(error)].filter(Boolean);
    expect(hits).toHaveLength(1);
  });
});
