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
var SECURE_MODE = true;

var RM_ROUTE = '/rm';
var REDIS_NEW_MESSAGE = 'pmessage'; //Note: hardcoded, can't be edited

//Name and Namespace constants
var REDIS_KEY_PREFIX = 'rm:';
var REDIS_USERS_PREFIX = 'users:';

var MESSAGE_SUBJECT = 'message';
var IDENTIFIER_SUBJECT = 'identifier';
var RM_CHANNEL_PREFIX = 'rm.';

var Server = SocketIO.of(RM_ROUTE);
var Clients = {};

// SocketIO listen
Http.listen(WS_PORT, onListenDebug);

function onListenDebug() {
  console.log("Now listening on port " + WS_PORT);
}

// Connect to Redis instance
var redisSubscriber = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT
});

var redisClient = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT
});

redisSubscriber.psubscribe(RM_CHANNEL_PREFIX + '*', onSubscribeDebug);
redisSubscriber.on(REDIS_NEW_MESSAGE, onNewMessage);

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
      onIdentityRecv(socket, message)
  });

  socket.emit(MESSAGE_SUBJECT, "You're subscribed to "
    + RM_CHANNEL_PREFIX + socket.id + " on " + REDIS_HOST + "!");
}

function onIdentityRecv(socket, id) {
    var idKey = id.split(':');
    var uid = idKey[0];
    var key = idKey[1];
    if(!SECURE_MODE) {
        assignClientSocket(socket, uid);
    } else if(key) {
        console.log("Verifying user key...");
        redisClient.get(REDIS_KEY_PREFIX + REDIS_USERS_PREFIX + uid + ':key',
            function(err, result) {
                console.log("Redis response: " + err + ", " + result);
                if(!err && result === key) {
                    console.log("Identity verified for " + uid);
                    assignClientSocket(socket, uid);
                } else {
                    socket.on(IDENTIFIER_SUBJECT, null);
                }
            })
    } else {
        console.log("User key was not provided for " + uid);
        socket.on(IDENTIFIER_SUBJECT, null);
    }
}

function assignClientSocket(socket, id) {
    console.log("Assigning id " + id + " to socket " + socket.id);
    Clients[RM_CHANNEL_PREFIX + id] = socket;
}

function onNewMessage(pattern, channel, message) {
  console.log("New message! Looking up socket " + channel);
  var socket = Clients[channel];
  if (socket == null) {
    console.log("Client is not online, queueing message");
  }
  console.log("Sending message " + message + " to " + socket.id);
  socket.emit(MESSAGE_SUBJECT, message);
}