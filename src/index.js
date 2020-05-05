const path = require('path')
const http = require('http')
const express = require('express')
const socketsio = require('socket.io')
const Filter = require('bad-words')
const {generateMessage, generateLocationMessage} = require('./utils/messages')
const {addUser, removeUser, getUser, getUsersInRoom} = require('./utils/users')

const app = express()
// creating a server by ourself and then setup socket.io
const server = http.createServer(app)
// when we require a library we get a function back and we call the function by passing our server variable
// We have created it on our own as socketsio needs a server as input. Eventhough express creates it behind the scenes we need to pass it as a parameter and hence have created it again

const io = socketsio(server)

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

// Counter Example To Demonstrate The Functionality Between The Server And The Client
// let count = 0

// Server
// socket parameter contains information about the connection

// server (emit) -> client (receive) - countUpdated
// client (emit) -> server (receive) - increment

io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    // Emitting the event from the server to the client
    // This second argument count will be the first argument for the callback function in chat.js and can hence provide the information to the client from the server
    // socket.emit('countUpdated', count)

    // socket.on('increment', () => {
    //     count++
    //     // Emitting only to a particular connection, we need to send the data to all the connections so hence replace socket.emit with io.emit
    //     // socket.emit('countUpdated', count)
    //     io.emit('countUpdated', count)
    // })

    // socket.emit = single client
    // io.emit = all clients
    // socket.broadcast.emit = all clients except that particular connection or user functionality
    

    // {username, room} can be written as options and later we can use the spread operator accordingly
    socket.on('join', (options, callback) => {

        const {error, user} = addUser({id: socket.id, ...options})

        if(error) {
            return callback(error)
        }
        
        socket.join(user.room)

        // socket.emit (specific client), io.emit (every client), socket.broadcast.emit (every connected client except that particular client)
        // io.to.emit (emits to everybody in a specific room), socket.broadcast.to.emit (everyone to the specific chat room except to that particular client)

        socket.emit('message', generateMessage('Admin', 'Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined the room!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)
        const filter = new Filter()

        if(filter.isProfane(message)) {
           return callback('Profanity is not allowed') 
        }

        io.to(user.room).emit('message', generateMessage(user.username, message))
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)
        
        if(user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left the room!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
        
    })

})
server.listen(port, () => {
    console.log(`Server is up on port ${port}!`)
})