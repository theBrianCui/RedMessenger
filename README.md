# RedMessenger

#### If a Redis instance `PUBLISH`es to a channel with no `SUBSCRIBE`rs, does it make a sound?

#### Redis
```
PUBLISH rm.users.user1 "Hello, world!"
(integer) 0
```
**RedMessenger** is a Redis proxy written for **Node.js** that ensures that there's always someone listening on your Redis channel - even if no one's immediately there to hear it. It sits in between your Redis instance and your application, exposing a `WebSocket` on your app's side that delivers a Redis `PUBLISH` message to a user on your app.   
  
If the user isn't there, that's OK! It'll save that message to that user back on your Redis server. When your user comes back on, it'll handle grabbing all the missed `PUBLISH`es since last time and send them over the `WebSocket`.

## How does it work?

As part of its queuing mechanism, RedMessenger will take messages with no immediate responder and send them back to Redis. 

```
New message from channel rm.users.user1
Client is not online, queueing message in Redis (rm:users:user1:messages)
New message from channel rm.users.user1
Client is not online, queueing message in Redis (rm:users:user1:messages)
```

This message will be stored in a message queue on Redis until a user is available to receieve it. This is done by passing a payload on a `WebSocket` open on RedMessenger containing the user's identifier, along with an optional authentication token.

```
New connection 127.0.0.1:63769 on *:8080! Waiting for ID...
Assigning id user1 to socket 127.0.0.1:63769.
You're subscribed to rm.users.user1!
rm.users.user1 has 2 messages enqueued, purging!
user1: Purging message 'Hello, world!' from rm.users.user1
user1: Purging message 'My life is a spicy pepper...' from rm.users.user1
```

### What if something happens while we're purging the message queue?

Don't worry! RedMessenger will take care of requeueing them for you.

```
New connection 127.0.0.1:63769 on *:8080! Waiting for ID...
Assigning id user1 to socket 127.0.0.1:63769.
You're subscribed to rm.users.user1!
rm.users.user1 has 2 messages enqueued, purging!
user1: Purging message 'Hello, world!' from rm.users.user1
user1: Client is no longer online, recommitting 'My life is a spicy pepper...' to rm.users.user1 queue.
```

### What if we want to subscribe to multiple channels at once?

We gotcha covered!

```
New message from channel rm.users.user1
Client is not online, queueing message in Redis (rm:users:user1:messages)
New message from channel rm.channels.cats
Client is not online, queueing message in Redis (rm:users:user1:messages)
Client is not online, queueing message in Redis (rm:users:user2:messages)
user5: Sending message 'Meow!' from rm.cats

New connection 127.0.0.1:63769 on *:8080! Waiting for ID...
Assigning id user1 to socket 127.0.0.1:63769.
You're subscribed to rm.users.user1 and rm.cats!
rm.users.user1 has 2 messages enqueued, purging!
user1: Purging message 'Hello, world!' from rm.users.user1
user1: Purging message 'Meow!' from rm.cats
```

## Message format
Every message contains some metadata and a message payload.
```javascript
{
  source: 'rm.users.user1',
  timestamp: 1438480701712,
  bubble: true,
  payload: '...'
}
```

#### `source`
What channel the message originated from. For a one-to-one message, this will be `rm.users.$uid`; for a one-to-many message, this will be `rm.groups.$cid`.

#### `timestamp`
The time this message was originally `PUBLISH`ed, in Unix time.

#### `bubble`
Directive that this message should be displayed on the desktop, if the browser supports desktop notifications. Set to `true` on the first `WebSocket` established for this user, and `false` on further concurrent `WebSockets` opened.

This is to prevent multiple tabs identifying as the same user from spawning one desktop notification _each_ on a single message.

#### `payload`
The message payload that was `PUBLISH`ed. This can be whatever you want! (JSON, plaintext, a hash value...)

## How do I hook it up?
Write a client to handle `server/server.js`. An example one is provided for you in `client/redmessenger.js`!

Here's what you need to do:

* In `server/config.json`, configure the configuration options according to your setup:<br/>
**`redis_host`**: The ip address/hostname of your running Redis instance.<br />
**`redis_port`**: The port that your Redis instance is listening on.<br />
**`ws_port`**: The port that your `RedMessenger` server should open a `WebSocket` on.<br />
**`secure_mode`**: If `true`, requires users to authenticate. Connections to a user's message queue must be coupled with a string that matches a user's `rm:users:$uid:key` string on Redis, or no messages will be delivered.<br />
**`rm_route`**: The route that the `WebSocket` on `RedMessenger` should listen on.<br />
**`queue_expiry`**: The expiration time for a user's message queue, in seconds. When it expires, clears out a user's entire message queue.<br />
**`conn_limit`**: The maximum number of parallel connections `RedMessenger` can accomodate on its `WebSocket`.<br />
* Open a `socket.io` socket on the `WebSocket` route defined on your server's `server/config.json`.
* Define an `on('connect')` event handler that sends over a `uid` (and `key` if `secure_mode` is `true`) upon opening a socket to RedMessenger.
* Define an `on('message')` event handler that does something with a message delivered by RedMessenger. The message will be [an object](#message-format).

### Here's an example!
```javascript
function RedMessenger(url, userId, userKey) {
  this.url = url;
  this.userId = userId;
  this.userKey = userKey || '';
  
  var socket; // Our sockets.io socket
  if (io) {
    socket = io(this.url);
    socket.on('connect', function() {
      console.log("Connected to RedMessenger!");  
      
      var identifier = this.generateIdentifier();  
      console.log("Authenticating...");
      socket.emit('identifier', identifier);
    }.bind(this));
    
    socket.on('message', function(message) {
      this.onMessage(message);
    }.bind(this));
  }
  
  this.onMessage = function(message) {
    console.log("Message from " + message.source + ": " + message.payload);
  }
  
  this.generateIdentifier = function () {
    return this.userId + ":" + this.userKey;
  }
}
```


## Value namespaces

#### `rm:users:$uid:messages`
Holds user `$uid`'s specific message queue.

#### `rm:users:$uid:key`
Holds user `$uid`'s specific authentication token.

#### `rm:channels:$cid:subscribers`
Holds a list of members to deliver a message to `rm:channels:$cid` to.

## Channel namespaces

#### `rm.users.$uid`
`PUBLISH`ing to this channel will deliver a message to `$uid` directly.

#### `rm.channels.$cid`
`PUBLISH`ing to this channel will deliver a message to all `$uid`s subscribed to `$cid`.

## Example direct message flow
### Send a message to **`user1`!**
* **Redis** Deliver the message to the **`rm.users.user1`** channel.
* **RedMessenger** If `user1` is online, deliver the message to `user1` over their `WebSocket`!
* **RedMessenger** If `user1` isn't online, store the message in `rm:users:user1:messages`.
* **RedMessenger** When `user1` is active on our `WebSocket`, send `user1` all messages from `rm:users:user1:messages` over their `WebSocket`.

## Example group message flow
### Send a message to **`cats`!**
* **Redis** Deliver the message to the **`rm.channels.cats`** channel.
* **RedMessenger** For every `$user` in **`rm:channels:cats:subscribers`** ...
* **RedMessenger** If `$user` is online, deliver the message to `$user` over their `WebSocket`!
* **RedMessenger** If `$user` isn't online, store the message in `rm:users:$user:messages`.
* **RedMessenger** When `$user` is active on our `WebSocket`, send `$user` all messages from `rm:users:$user:messages`, including the one delivered to **`rm.channels.cats`** over their `WebSocket`.