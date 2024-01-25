const express = require('express')
require('./db/mongoose')
const userRouter = require('./router/user')
const postRouter = require('./router/post')


const app = express()

app.use(express.json())
app.use(userRouter)
app.use(postRouter)

app.get('/api/hello', (req, res) => {
    res.send({ express: 'Hello From Express' });
});

module.exports = app

