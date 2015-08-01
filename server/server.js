var Redis = require('ioredis');
var Express = require('express')();
var Http = require('http').Server(Express);
var SocketIO = require('socket.io')(Http);

// Constants
var SocketIOConnection = 'connection';

// TODO: Refactor into a config.json
var HOST = "nm-hackathon";
var WS_PORT = 8080;
var REDIS_PORT = 6379;
var ROOT = '/';
var RM_ROUTE = '/rm';
var RedMessenger = SocketIO.of(RM_ROUTE);

// SocketIO listen
Http.listen(WS_PORT, onListenDebug);

function onListenDebug() {
  console.log("Now listening on port " + WS_PORT);
}

// Connect to Redis instance
var redis = new Redis(
  host = HOST,
  port = REDIS_PORT
);

// Express routes
Express.get(ROOT, onDefaultPageRequest);
Express.get(RM_ROUTE, onDefaultPageRequest);

function onDefaultPageRequest(request, response) {
  console.log(request.ip + ": Sending default request response");
  response.send("Hey, you're connected!");
}

// SocketIO connection events
RedMessenger.on(SocketIOConnection, onConnect);

function onConnect(socket) {
  console.log(socket.id + ": New connection!");
  socket.emit('message', "Heya, " + socket.id + "!");
}

function onNewMessage(channel, message) {
  console.log(channel + ": " + message);
}

