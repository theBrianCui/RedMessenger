# RedMessenger

#### If a Redis instance `PUBLISH`es to a channel with no `SUBSCRIBE`rs, does it make a sound?

#### RedMessenger
```
PUBLISH rm.users.user1 "Hello, world!"
(integer) 0
```
**RedMessenger** is a Redis proxy server written for **Node.js** that ensures that there's always someone listening on your Redis channel - even if no one's immediately there to hear it. It sits in between your Redis instance and your application, exposing a `WebSocket` on your app's side that delivers a Redis `PUBLISH` message to a user on your app.   
  
If the user isn't there, that's OK! It'll save that message to that user back on your Redis server. When your user comes back on, it'll handle grabbing all the missed `PUBLISH`es since last time and send them over the `WebSocket`.

## How does it work?

As part of its queuing mechanism, RedMessenger will take messages with no immediate responder and send them back to Redis. 

#### RedMessenger

```
New message from channel rm.users.user1
Client is not online, queueing message in Redis (rm:users:user1:messages)
New message from channel rm.users.user1
Client is not online, queueing message in Redis (rm:users:user1:messages)
```

#### Redis
```  
"RPUSH" "rm:users:user1:messages" "Hello, world!"
"RPUSH" "rm:users:user1:messages" "My life is a spicy pepper..."
```

This message will be stored in a message queue on Redis until a user is available to receieve it. This is done by passing a payload on a `WebSocket` open on RedMessenger containing the user's identifier, along with an optional authentication token.

#### RedMessenger
```
New connection 127.0.0.1:63769 on *:8080! Waiting for ID...
Assigning id user1 to socket 127.0.0.1:63769.
You're subscribed to rm.users.user1!
rm.users.user1 has 2 messages enqueued, purging!
user1: Purging message 'Hello, world!' from rm.users.user1
user1: Purging message 'My life is a spicy pepper...' from rm.users.user1
```

#### Redis
```
"LRANGE" "rm:users:user1:messages" "0" "-1"
"DEL" "rm:users:user1:messages"
```

### What if something happens while we're purging the message queue?

Don't worry! RedMessenger will take care of requeueing them for you.

#### RedMessenger
```
New connection 127.0.0.1:63769 on *:8080! Waiting for ID...
Assigning id user1 to socket 127.0.0.1:63769.
You're subscribed to rm.users.user1!
rm.users.user1 has 2 messages enqueued, purging!
user1: Purging message 'Hello, world!' from rm.users.user1
user1: Client is no longer online, recommitting 'My life is a spicy pepper...' to rm.users.user1 queue.
```

#### Redis
```
"LRANGE" "rm:users:user1:messages" "0" "-1"
"DEL" "rm:users:user1:messages"
"RPUSH" "rm:users:rm.user1:messages" "My life is like a spicy pepper..."
```

### What if we want to subscribe to multiple channels at once?

We gotcha covered!

#### Redis
```
"RPUSH" "rm:users:user1:messages" "Hello, world!"
"RPUSH" "rm:channels:cats:messages" "Meow!"
"LRANGE" "rm:channels:cats:members" "0" "-1"
"RPUSH" "rm:users:user1:messages" "Meow!"
"RPUSH" "rm:users:user2:messages" "Meow!"
```

#### RedMessenger
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

#### Redis
```
"LRANGE" "rm:users:user1:messages" "0" "-1"
"DEL" "rm:users:user1:messages"
```

## API
### `subscribe(uid[, auth_key])`
Subscribes to `rm.users.$uid` and any group in `rm.channels.$cid` that `uid` is subscribed to (has an entry in `rm:channels:$cid:subscribers`). Recieves all queued messages from `rm:users:$uid:messages` immediately. If an `auth_key` is provided, attempts to match it against the value in `rm:users:$uid:key` - if it doesn't match, does nothing.

## Value namespaces

### `rm:users:$uid:messages`
Holds user `$uid`'s specific message queue.

### `rm:users:$uid:key`
Holds user `$uid`'s specific authentication token.

### `rm:channels:$cid:subscribers`
Holds a list of members to deliver a message to `rm:channels:$cid` to.

## Channel namespaces

### `rm.users.$uid`
`PUBLISH`ing to this channel will deliver a message to `$uid` directly.

### `rm.channels.$cid`
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