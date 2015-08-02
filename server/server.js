var Redis = require('ioredis');
var Express = require('express')();
var Http = require('http').Server(Express);
var SocketIO = require('socket.io')(Http);
var Config = require('./config.json');

// Constants

// TODO: Refactor into a config.json
var REDIS_HOST = Config.redis_host;
var WS_PORT = Config.ws_port;
var REDIS_PORT = Config.redis_port;
var SECURE_MODE = Config.secure_mode;
var RM_ROUTE = Config.rm_route;
var EXPIRY_TIME = Config.queue_expiry;

//Name and Namespace constants
//Redis Key Naming
var REDIS_KEY_PREFIX = 'rm:';
var REDIS_USERS_PREFIX = 'users:';

//Redis PubSub Channel Naming
var RM_CHANNEL_PREFIX = 'rm.';
var RM_USERS_PREFIX = 'users.';

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

redisSubscriber.psubscribe(RM_CHANNEL_PREFIX + '*', function (error, count) {
    console.log("We're now subscribed to " + count + " channels on Redis.");
});
redisSubscriber.on('pmessage', function(pattern, channel, message) {
    onNewServerMessage(channel, message)
});

// Express routes
Express.get(RM_ROUTE, onDefaultPageRequest);

function onDefaultPageRequest(request, response) {
    console.log(request.ip + ": Sending default request response");
    response.send("Hey, you're connected!");
}

// SocketIO connection events
Server.on('connection', onConnect);

function onConnect(socket) {
    console.log(socket.id + ": New connection! Waiting for ID");

    socket.on('identifier', function (message) {
        onIdentityRecv(socket, message, function(uid) {
            purgeMessageQueue(uid);
        });
    });
}

function onIdentityRecv(socket, id, callback) {
    var idKey = id.split(':');
    var uid = idKey[0];
    var key = idKey[1];

    if(!SECURE_MODE) {
        assignClientSocket(socket, uid);
        callback(uid);

    } else if(key) {

        console.log("Verifying user key...");
        console.log("Performing GET " + REDIS_KEY_PREFIX + REDIS_USERS_PREFIX + uid + ':key');

        redisClient.get(REDIS_KEY_PREFIX + REDIS_USERS_PREFIX + uid + ':key',
            function(err, result) {
                console.log("Redis response: " + err + ", " + result);
                if(!err && result === key) {
                    console.log("Identity verified for " + uid);
                    assignClientSocket(socket, uid);
                    callback(uid);
                } else {
                    socket.on('identifier', function() {});
                }
            })

    } else {
        console.log("User key was not provided for " + uid);
        socket.on('identifier', function() {});
    }
}

function assignClientSocket(socket, uid) {
    console.log("Assigning id " + uid + " to socket " + socket.id);
    Clients[uid] = socket;
}

function onNewServerMessage(channel, message) {
    console.log("New message from channel " + channel);
    if(channel.indexOf(RM_CHANNEL_PREFIX + RM_USERS_PREFIX) === 0) {
        uid = channel.substring((RM_CHANNEL_PREFIX + RM_USERS_PREFIX).length);
        console.log("User ID for this message is " + uid);
        passMessage(uid, message);
    } else {
        console.log("Channel was not user-targeted.");
    }
}

//"Pass" a message to a UID. This means sending it if they're online, and queueing it if they're not.
function passMessage(uid, message) {
    var socket = Clients[uid];
    if (socket == null || !socket.connected) {
        console.log("Client is not online, queueing message in Redis list " + getQueueName(uid));
        enqueueMessage(uid, message);

        //Print existing messages
        /*redisClient.lrange(getQueueName(uid), 0, -1, function (error, result) {
            console.log("DEBUG: redis server returned " + result);
            console.log(JSON.stringify(result));
        });*/

    } else {
        console.log("Sending message " + message + " to " + uid + " on socket " + socket.id);
        socket.emit('message', message);
    }
}

function enqueueMessage(uid, message) {
    var queueName = getQueueName(uid);

    redisClient.pipeline()
      .rpush(queueName, message)
      .expire(queueName, EXPIRY_TIME)
      .exec();
}

function dequeueMessage(uid, message) {
    console.log("Dequeuing message for " + uid + ": " + message);
    passMessage(uid, message);
}

function purgeMessageQueue(uid) {
    var messages = [];
    var queue = getQueueName(uid);
    redisClient.lrange(queue, 0, -1, function(error, result) {
        if(result.length !== 0) {
            messages = result;
            redisClient.del(queue);

            console.log(queue + " has " + messages.length + " messages enqueued, purging!");
            messages.forEach(function (message) {
                dequeueMessage(uid, message);
            });
        } else {
            console.log(queue + " has 0 messages enqueued.");
        }
    });
}

function getChannelName(uid) {
    return RM_CHANNEL_PREFIX + RM_USERS_PREFIX + uid;
}

function getQueueName(uid) {
    return REDIS_KEY_PREFIX + REDIS_USERS_PREFIX + uid + ':messages';
}