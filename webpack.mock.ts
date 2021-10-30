import webpackMockServer from 'webpack-mock-server'
import cookieparser from 'cookie-parser'
import cors from 'cors'

// app is expressjs application
export default webpackMockServer.add((app, helper) => {
  // you can find more about expressjs here: https://expressjs.com/
  app.use(cookieparser())
  app.use(cors({
    origin(origin, callback) {
      callback(null, true)
    },
    credentials: true,
  }))
  app.post('/auth', (_req, res) => {
    res.cookie('service-token', 'some jwt', { maxAge: 900000, httpOnly: true })
    res.json(`JS get-object can be here. Random int:${helper.getRandomInt()}`)
  })

  app.get('/user', (req, res) => {
    if (req.cookies['service-token']) {
      res.status(200)
      return res.send('you have been successfully validated')
    }
    res.status(401)
    return res.send('Username or password incorrect , Please try it again')
  })
  app.post('/auth/register', (_req, res) => {
    res.cookie('service-token', 'some jwt', { maxAge: 900000, httpOnly: true })
    res.json(`JS get-object can be here. Random int:${helper.getRandomInt()}`)
  })
})
