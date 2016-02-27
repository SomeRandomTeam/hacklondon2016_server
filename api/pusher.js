var Pusher = require('pusher')

var pusher = new Pusher({
  appId: process.env.PUSHER_APPID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  encrypted: true
})
pusher.port = 443

module.exports = pusher
