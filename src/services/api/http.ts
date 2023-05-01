import axios from 'axios'
import config from '../../config'

const instance = axios.create({
  baseURL: config.api_host,
  // timeout: 1000,
  withCredentials: true,
})

export default instance
