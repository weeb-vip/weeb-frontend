import axios from 'axios'
import config from '../../config'

const instance = axios.create({
  baseURL: config?.api_host || 'http://localhost:8079',
  // timeout: 1000,
  withCredentials: true,
})

export default instance
