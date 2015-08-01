var Redis = require('ioredis');
var Express = require('express')();
var Http = require('http').Server(Express);
var SocketIO = require('socket.io')(Http);

// Constants
var SocketIOConnection = 'connection';

// TODO: Refactor into a config.json
var REDIS_HOST = "nm-hackathon";
var WS_PORT = 8080;
var REDIS_PORT = 6379;

var ROOT = '/';
var RM_ROUTE = '/rm';
var MESSAGE_PREFIX = 'pmessage';
var RM_CHANNEL_PREFIX = 'rm.';

var RedMessenger = SocketIO.of(RM_ROUTE);
var Clients = {};

// SocketIO listen
Http.listen(WS_PORT, onListenDebug);

function onListenDebug() {
  console.log("Now listening on port " + WS_PORT);
}

// Connect to Redis instance
var redis = new Redis(
  host = REDIS_HOST,
  port = REDIS_PORT
);

redis.psubscribe(RM_CHANNEL_PREFIX + '*', onSubscribeDebug);
redis.on(MESSAGE_PREFIX, onNewMessage);

function onSubscribeDebug(error, count) {
  console.log("We're now subscribed to " + count + " channels on Redis.");
}

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
  console.log(socket.id + ": New connection! Adding to table");
  Clients[socket.id] = socket;

  socket.emit(MESSAGE_PREFIX, "You're subscribed to "
    + RM_CHANNEL_PREFIX + socket.id + " on " + REDIS_HOST + "!");
}

function sendMessageToClient(channel, message) {
  console.log(channel + ": " + message);
  console.log("Sending to client " + socket.id);
  socket.emit(MESSAGE_PREFIX, message);
}

function onNewMessage(pattern, channel, message) {
  console.log(JSON.stringify(socket));
  console.log("New message! Looking up socket " + channel);
  var socket = Clients[channel];
  console.log("Sending message to " + socket.id);
  socket.emit(MESSAGE_PREFIX, message);
}

