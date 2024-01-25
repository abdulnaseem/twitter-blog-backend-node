const mongoose = require('mongoose')

mongoose.connect('mongodb+srv://naseem123:naseem123@devconnector.qm6wkvu.mongodb.net/?retryWrites=true&w=majority')

// mongoose.connect((process.env.MONGODB_URL), {
//     useNewurlParser: true
// })