//RedMessenger Client Configuration

function RedMessenger(url, userID, userKey) {
    this.url = url;
    this.userID = userID;
    this.userKey = userKey || '';

    this.onMessage =  function(msg) {
        console.log('RedMessage! ' + msg);
    };

    var socket;
    if(io) {
        var socket = io(this.url);
        socket.on('connect', function () {
            console.log('RedMessenger Connected!');
            console.log('Sending identifier ' + userID);

            socket.emit('identifier', this.userID +
                (this.userKey ? ':' + this.userKey : '')
            );

            socket.on('message', function (msg) {
                this.onMessage(msg);
            }.bind(this))
        }.bind(this));
    } else {
        console.log('Socket.IO is not embedded in this page. RedMessenger will not be able to serve messages.')
    }
}

var rm = new RedMessenger('http://localhost:8080/rm', 'seanc', '1234');
