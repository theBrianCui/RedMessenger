# RedMessenger

#### If a Redis instance `PUBLISH`es to a channel with no `SUBSCRIBE`rs, does it make a sound?

#### RedMessenger
```
PUBLISH rm.users.user1 "Hello, world!"
(integer) 0
```
**RedMessenger** is a Redis proxy server written for **Node.js** that ensures that there's always someone listening on your Redis channel - even if no one's immediately there to hear it. It sits in between your Redis instance and your application, exposing a `WebSocket` (TBF)

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
"RPUSH" "rm:users:rm.user1:messages" "Hello, world!"
"RPUSH" "rm:users:rm.user1:messages" "My life is like a spicy pepper..."
```
This message will be stored in a message queue on Redis until a user is available to receieve it. This is done by passing a payload on a `WebSocket` open on RedMessenger containing the user's identifier, along with an optional authentication token.

#### RedMessenger
```
New connection 127.0.0.1:63769 on *:8080! Waiting for ID...
Assigning id user1 to socket 127.0.0.1:63769.
You're subscribed to rm.users.user1!
rm.users.user1 has 2 messages enqueued, purging!
user1: Purging message 'Hello, world!'
user1: Purging message 'My life is like a spicy pepper...'
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
user1: Purging message 'Hello, world!'
user1: Client is no longer online, recommitting 'My life is like a spicy pepper...' to queue.
```

#### Redis
```
"LRANGE" "rm:users:user1:messages" "0" "-1"
"DEL" "rm:users:user1:messages"
"RPUSH" "rm:users:rm.user1:messages" "My life is like a spicy pepper..."
```