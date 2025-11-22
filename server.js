const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  })

  // Store connected users
  const connectedUsers = new Map()

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    // Authenticate user
    socket.on('authenticate', (userId) => {
      connectedUsers.set(socket.id, userId)
      socket.join(`user-${userId}`)
      console.log(`User ${userId} authenticated`)
    })

    // Handle data updates
    socket.on('data-update', (data) => {
      const userId = connectedUsers.get(socket.id)
      if (userId) {
        // Broadcast to all user's devices
        socket.to(`user-${userId}`).emit('data-update', data)
      }
    })

    // Handle task completion
    socket.on('task-completed', (data) => {
      const userId = connectedUsers.get(socket.id)
      if (userId) {
        socket.to(`user-${userId}`).emit('task-completed', data)
      }
    })

    socket.on('disconnect', () => {
      connectedUsers.delete(socket.id)
      console.log('User disconnected:', socket.id)
    })
  })

  httpServer.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})