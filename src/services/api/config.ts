import axios from 'axios'

const configApi = {
  fetch: async () => {
    const {
      data: config,
    } = await axios.get('/config.json')
    // @ts-ignore
    global.config = config
    return config
  },
}

export default configApi
