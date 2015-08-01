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

var RM_ROUTE = '/rm';
var REDIS_NEW_MESSAGE = 'pmessage';
var MESSAGE_SUBJECT = 'message';
var IDENTIFIER_SUBJECT = 'identifier';
var RM_CHANNEL_PREFIX = 'rm.';

var Server = SocketIO.of(RM_ROUTE);

var Clients = {};
var MessageQueue = {};

// SocketIO listen
Http.listen(WS_PORT, onListenDebug);

function onListenDebug() {
  console.log("Now listening on port " + WS_PORT);
}

// Connect to Redis instance
var redisSub = new Redis(
  host = REDIS_HOST,
  port = REDIS_PORT
);

var redisQueue = new Redis(
  host = REDIS_HOST,
  post = REDIS_PORT
);

redisSub.psubscribe(RM_CHANNEL_PREFIX + '*', onSubscribeDebug);
redisSub.on(REDIS_NEW_MESSAGE, onNewMessage);

function onSubscribeDebug(error, count) {
  console.log("We're now subscribed to " + count + " channels on Redis.");
}

// Express routes
Express.get(RM_ROUTE, onDefaultPageRequest);

function onDefaultPageRequest(request, response) {
  console.log(request.ip + ": Sending default request response");
  response.send("Hey, you're connected!");
}

// SocketIO connection events
Server.on(SocketIOConnection, onConnect);

function onConnect(socket) {
  console.log(socket.id + ": New connection! Waiting for ID");

  socket.on(IDENTIFIER_SUBJECT, function (message) {
    var channel = RM_CHANNEL_PREFIX + message;
    onIdentityRecv(socket, message);

    socket.emit(MESSAGE_SUBJECT, "You're subscribed to "
      + channel + " on " + REDIS_HOST + "!");

    purgeMessageQueue(channel);
  });
}

function purgeMessageQueue(channel) {
  var messages = [];
  redisQueue.lrange(channel, 0, -1, function(error, result) {
    console.log("DEBUG: redis server returned " + result);
    messages = result;

    redisQueue.del(channel);
    console.log(channel + " has " + messages.length + " messages enqueued, purging!");
    messages.forEach(function(message) {
      onQueuedMessage(channel, message);
    });
  });

}

function onIdentityRecv(socket, id) {
  console.log("Assigning id " + id + " to socket " + socket.id);
  Clients[RM_CHANNEL_PREFIX + id] = socket;
}

function onNewMessage(pattern, channel, message) {
  console.log("New message! Looking up socket " + channel);
  var socket = Clients[channel];
  if (socket == null || !socket.connected) {
    console.log("Client is not online, queueing message IN REDIS");
    redisQueue.rpush(channel, message);
    redisQueue.lrange(channel, 0, -1, function(error, result) {
      console.log("DEBUG: redis server returned " + result);
      console.log(JSON.stringify(result));
    });
  }

  else {
    console.log("Sending message " + message + " to " + socket.id);
    socket.emit(MESSAGE_SUBJECT, message);
  }
}

function onQueuedMessage(channel, message) {
  console.log(channel + " - Purging message " + message);
  var socket = Clients[channel];
  if (socket == null) {
    console.log("Client is no longer online, recommitting to queue");
    redisQueue.rpush(channel, message);
    return;
  }

  socket.emit(MESSAGE_SUBJECT, message);
}