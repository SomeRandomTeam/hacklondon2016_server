var express = require('express')
var router = express.Router()

var pusher = require('../api/pusher')

var debug = require('debug')('hacklondon2016_server:http')

var events = {}

var err404 = {
  errCode: 404,
  error: 'Not found'
}

var handledError = {}

function createEvent (eventId, event) {
  events[eventId] = event
  event.id = eventId
  event.users = {}
  event.messages = []
  return Promise.resolve(event)
}

function getEvent (id) {
  if (events[id]) {
    return Promise.resolve(events[id])
  } else {
    return Promise.reject(err404)
  }
}

function joinEvent (eventId, userId, user) {
  if (events[eventId]) {
    user.id = userId
    user.locations = []
    events[eventId].users[userId] = user
    return Promise.resolve(user)
  } else {
    return Promise.reject(err404)
  }
}

function recordMsg (eventId, msg) {
  if (events[eventId]) {
    events[eventId].messages.push(msg)
    return Promise.resolve(msg)
  } else {
    return Promise.reject(err404)
  }
}

function notify (channel, event, data) {
  return new Promise(function (resolve, reject) {
    pusher.trigger(channel, event, data, null, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

function recordLoc (eventId, userId, loc) {
  var event = events[eventId]
  if (!event) {
    return Promise.reject(err404)
  }
  var user = event.users[userId]
  if (!user) {
    return Promise.reject(err404)
  }
  user.locations.push(loc)
  return Promise.resolve(loc)
}

router.get('/', function (req, res) {
  res.render('overwatch')
})

router.get('/map/:eventId', function (req, res) {
  res.render('map', {
    id: req.params.eventId
  })
})

router.get('/clear', function (req, res) {
  events = {}
  res.status(200).end()
})

router.get('/dump', function (req, res) {
  res.send(JSON.stringify(events, null, 2)).end()
})

router.route('/api/v1/events')
  .post(function (req, res) {
    createEvent(req.body.id, req.body)
      .then(function (event) {
        res.json(event)
      })
  })

router.route('/api/v1/events/:id')
  .get(function (req, res) {
    getEvent(req.params.id)
      .then(function (event) {
        res.json(event)
      })
      .catch(function (err) {
        res.status(err.errCode).json(err)
      })
  })

router.route('/api/v1/events/:id/join')
  .post(function (req, res) {
    joinEvent(req.params.id, req.body.id, req.body)
      .then(function (user) {
        return notify(req.params.id, 'user', {
          id: user.id,
          user: user
        })
      })
      .then(function () {
        res.status(200).json({})
      })
      .catch(function (err) {
        debug(err)
        res.status(err.errCode).json(err)
      })
  })

router.route('/api/v1/events/:id/message')
  .post(function (req, res) {
    var msg = {
      sender: req.body.sender,
      message: req.body.message,
      timestamp: Date.now()
    }
    recordMsg(req.params.id, msg)
      .catch(function (err) {
        debug(err)
        res.status(err.errCode).json(err)
        return Promise.reject(handledError)
      })
      .then(function () {
        return notify(req.params.id, 'message', msg)
      })
      .then(function () {
        res.status(200).json({})
      })
      .catch(function (err) {
        if (err === handledError) {
          return
        }

        debug(err)
        res.status(500).json(err)
      })
  })

router.route('/api/v1/events/:eventId/users/:userId/loc')
  .post(function (req, res) {
    recordLoc(req.params.eventId, req.params.userId, req.body)
      .catch(function (err) {
        debug(err)
        res.status(err.errCode).json(err)
        return Promise.reject(handledError)
      })
      .then(function (loc) {
        return notify(req.params.eventId, 'location', {
          sender: req.params.userId,
          location: loc
        })
      })
      .then(function () {
        res.json({})
      })
      .catch(function (err) {
        if (err === handledError) {
          return
        }

        req.status(err.errCode).json(err)
      })
  })

module.exports = router
