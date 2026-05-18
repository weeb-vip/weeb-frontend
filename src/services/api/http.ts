import config from '../../config'

class FetchClient {
  private baseURL: string;

  constructor() {
    this.baseURL = config?.api_host || 'http://localhost:8079';
  }

  async get(url: string) {
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'GET',
      credentials: 'include', // Re-enabled - server supports credentials
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  }

  async post(url: string, data?: any) {
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'POST',
      credentials: 'include', // Re-enabled - server supports credentials
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    return { data: responseData };
  }
}

const instance = new FetchClient();
export default instance
