import {type SigninResult} from "../gql/graphql";
import debug from "../utils/debug";
import {AuthStorage} from "../utils/auth-storage";

type RefreshTokenFunction<T> = () => Promise<T>;

export class TokenRefresher {
  private static instance: TokenRefresher;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private refreshFunction: RefreshTokenFunction<SigninResult>;
  private refreshWindow: number;

  private constructor(refreshFunction: RefreshTokenFunction<SigninResult>, refreshWindow: number = 5 * 60 * 1000) {
    this.refreshFunction = refreshFunction;
    this.refreshWindow = refreshWindow; // Default refresh window is 5 minutes
    
    // Log current token expiry if available
    const currentToken = AuthStorage.getAuthToken();
    if (currentToken) {
      const currentExpiry = this.getTokenExpiry(currentToken);
      if (currentExpiry) {
        debug.auth('TokenRefresher started with current token expiry:', new Date(currentExpiry).toLocaleString());
        const timeUntilExpiry = currentExpiry - Date.now();
        const minutesUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60));
        debug.auth(`Current token expires in ${minutesUntilExpiry} minutes`);
      } else {
        debug.warn('TokenRefresher started but current token has invalid expiry');
      }
    } else {
      debug.auth('TokenRefresher started but no current token found');
    }
    
    // Check if we have a refresh token and attempt to refresh if needed
    const refreshToken = AuthStorage.getRefreshToken();
    if (refreshToken) {
      debug.auth('TokenRefresher found refresh token, attempting initial refresh');
      this.refreshToken();
    } else {
      debug.auth('TokenRefresher initialized but no refresh token available');
    }
  }

  /**
   * Returns the singleton instance of TokenRefresher.
   * @param refreshFunction - The function to refresh the token.
   * @param refreshWindow - The window (in milliseconds) before token expiry to refresh.
   */
  public static getInstance(refreshFunction: RefreshTokenFunction<SigninResult>, refreshWindow: number = 5 * 60 * 1000): TokenRefresher {
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

    debug.auth('Token expiry time:', new Date(expiryTime).toLocaleString());

    const now = Date.now();
    const refreshTime = expiryTime - now - this.refreshWindow;

    if (refreshTime <= 0) {
      debug.auth('Token is already expired or too close to expiration. Refreshing immediately...');
      // Token is expired or about to expire, refresh immediately
      this.refreshToken();
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
      debug.error('Failed to parse token:', error);
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
      debug.auth('Refreshing token...');
      const newTokenResponse = await this.refreshFunction();
      debug.success('Token refreshed successfully!');
      const newToken = newTokenResponse.Credentials.token

      this.storeAuthToken(newToken);

      debug.auth('Token refreshed successfully - continuing without page reload');

      this.start(newToken); // Restart the process with the new token
    } catch (error) {
      debug.error('Failed to refresh token:', error);
      // Optionally, you can implement retry logic here
    }
  }


  /**
   * Server handles token storage via HttpOnly cookies.
   * @param token - The refreshed JWT token (for restart logic only).
   */
  private storeAuthToken(token: string): void {
    try {
      debug.auth('Token refresh completed - server updated HttpOnly cookies');
      console.log('🔄 Token refreshed successfully - server manages cookie storage');

      // Server automatically updates HttpOnly cookies during refresh
      // No manual cookie setting needed by client

    } catch (error) {
      debug.error('Failed to handle token refresh:', error);
    }
  }
}

