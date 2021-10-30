import http from './http'

export default {
  login: async (body: {
    username: string,
    password: string,
    savelogin: string
  }) => {
    const {
      data,
    } = await http.post('/auth', body)
    return data
  },
  register: async (body: {
    first_name: string,
    last_name: string,
    username: string,
    password: string,
  }) => {
    const { data } = await http.post('/auth/register', body)
    return data
  },

  getUserProfile: async () => http.get('/user'),
}
