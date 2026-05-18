const configApi = {
  fetch: async () => {
    const response = await fetch('/config.json');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const config = await response.json();
    // @ts-ignore
    global.config = config
    return config
  },
}

export default configApi
