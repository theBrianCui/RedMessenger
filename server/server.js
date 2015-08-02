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
var REDIS_GLOBAL_PREFIX = 'rm:';
var REDIS_USERS_PREFIX = 'users:';
var REDIS_CHANNELS_PREFIX = 'channels:';

//Redis PubSub Channel Naming
var RM_GLOBAL_PREFIX = 'rm.';
var RM_USERS_PREFIX = 'users.';
var RM_CHANNELS_PREFIX = 'channels.';

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

redisSubscriber.psubscribe(RM_GLOBAL_PREFIX + '*', function (error, count) {
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
        console.log("Performing GET " + REDIS_GLOBAL_PREFIX + REDIS_USERS_PREFIX + uid + ':key');

        redisClient.get(REDIS_GLOBAL_PREFIX + REDIS_USERS_PREFIX + uid + ':key',
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
    if(channel.indexOf(RM_GLOBAL_PREFIX + RM_USERS_PREFIX) === 0) {

        var uid = channel.substring((RM_GLOBAL_PREFIX + RM_USERS_PREFIX).length);
        console.log("User ID for this message is " + uid);
        passMessage(uid, message);

    } else if (channel.indexOf(RM_GLOBAL_PREFIX + RM_CHANNELS_PREFIX) === 0) {

        var cid = channel.substring((RM_GLOBAL_PREFIX + RM_CHANNELS_PREFIX).length);
        console.log("Channel ID for this message is " + cid);
        distributeMessage(cid, message)

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

//"Distribute" a message on a given CID. This means passing the message to each user on the channel.
function distributeMessage(cid, message) {
    console.log("Getting SMEMBERS for " + REDIS_GLOBAL_PREFIX + REDIS_CHANNELS_PREFIX + cid + ":subscribers");
    redisClient.smembers(REDIS_GLOBAL_PREFIX + REDIS_CHANNELS_PREFIX + cid + ":subscribers",
        function(err, result) {
            if(!err && result.length !== 0) {
                console.log("There are " + result.length + " recipients for channel " + cid);
                result.forEach(function(uid) {
                    passMessage(uid, message);
                });
            } else if (err) {
                console.log("Redis connection error: " + err);
            }
        }
    );
}

function enqueueMessage(uid, message) {
    var queueName = getQueueName(uid);

    redisClient.pipeline()
      .rpush(queueName, message)
      .expire(queueName, EXPIRY_TIME)
      .exec(function(error, result) {
          if (error)
            console.log("Error queueing message: " + error);
      });
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
                console.log("Dequeuing message for " + uid + ": " + message);
                passMessage(uid, message);
            });
        } else {
            console.log(queue + " has 0 messages enqueued.");
        }
    });
}

function getChannelName(uid) {
    return RM_GLOBAL_PREFIX + RM_USERS_PREFIX + uid;
}

function getQueueName(uid) {
    return REDIS_GLOBAL_PREFIX + REDIS_USERS_PREFIX + uid + ':messages';
}