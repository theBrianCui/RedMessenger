var Redis = require('ioredis');
var Express = require('express');
var Http = require('http').Server(Express);
var SocketIO = require('socket.io')(Http);

// Constants
var SocketIOConnection = 'connection';

// TODO: Refactor into a config.json
var HOST = "nm-hackathon";
var WS_PORT = 80;
var REDIS_PORT = 6379;

// SocketIO listen
SocketIO.listen(WS_PORT);

// Connect to Redis instance
var redis = new Redis(
  host = HOST,
  port = REDIS_PORT
);

// Express routes
Express.get('/', onDefaultPageRequest);

function onDefaultPageRequest(request, response) {
  console.log(request.ip + ": Sending default request response");
  response.send("Hey, you're connected!");
}

// SocketIO connection events
SocketIO.on(SocketIOConnection, onConnect);

function onConnect(socket) {
  console.log(socket.id + ": New connection!")
}

function onNewMessage(channel, message) {
  console.log(channel + ": " + message);
}

