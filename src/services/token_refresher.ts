import {SigninResult} from "../gql/graphql";

type RefreshTokenFunction<T> = () => Promise<T>;

export class TokenRefresher {
  private static instance: TokenRefresher;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private refreshFunction: RefreshTokenFunction<SigninResult>;
  private refreshWindow: number;

  private constructor(refreshFunction: RefreshTokenFunction<never>, refreshWindow: number = 60 * 1000) {
    this.refreshFunction = refreshFunction;
    this.refreshWindow = refreshWindow; // Default refresh window is 1 minute
  }

  /**
   * Returns the singleton instance of TokenRefresher.
   * @param refreshFunction - The function to refresh the token.
   * @param refreshWindow - The window (in milliseconds) before token expiry to refresh.
   */
  public static getInstance(refreshFunction: RefreshTokenFunction<never>, refreshWindow: number = 60 * 1000): TokenRefresher {
    if (!TokenRefresher.instance) {
      TokenRefresher.instance = new TokenRefresher(refreshFunction, refreshWindow);
    }
    return TokenRefresher.instance;
  }

  /**
   * Starts or restarts the token refresh process.
   * @param token - The JWT token to manage.
   */
  public start(token: string): void {
    this.cancel(); // Cancel any existing process

    const expiryTime = this.getTokenExpiry(token);
    if (!expiryTime) {
      throw new Error('Invalid token: Unable to determine expiry time.');
    }

    console.log('Token expiry time:', new Date(expiryTime).toLocaleString());

    const now = Date.now();
    const refreshTime = expiryTime - now - this.refreshWindow;

    if (refreshTime <= 0) {

      //throw new Error('Token is already expired or too close to expiration.');
      console.log('Token is already expired or too close to expiration.');
      return;
    }

    this.refreshTimeout = setTimeout(() => this.refreshToken(), refreshTime);
  }

  /**
   * Cancels the ongoing token refresh process.
   */
  public cancel(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  /**
   * Determines the expiry time of a JWT token.
   * @param token - The JWT token.
   * @returns The expiry time in milliseconds since epoch, or null if invalid.
   */
  private getTokenExpiry(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (typeof payload.exp === 'number') {
        return payload.exp * 1000;
      }
    } catch (error) {
      console.error('Failed to parse token:', error);
    }
    return null;
  }

  /**
   * Triggers the token refresh process.
   */
  private async refreshToken(): Promise<void> {
    try {
      if (!this.refreshFunction) {
        throw new Error('No refresh function provided.');
      }
      console.log('Refreshing token...');
      const newTokenResponse = await this.refreshFunction();
      console.log('Token refreshed successfully.');
      const newToken = newTokenResponse.Credentials.token

      this.storeAuthToken(newToken);
      this.start(newToken); // Restart the process with the new token
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // Optionally, you can implement retry logic here
    }
  }

  /**
   * Stores the refreshed auth token in localStorage.
   * @param token - The refreshed JWT token.
   */
  private storeAuthToken(token: string): void {
    try {
      console.log('Storing auth token:', token);
      localStorage.setItem('authToken', token);

    } catch (error) {
      console.error('Failed to store auth token:', error);
    }
  }
}

