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
        socket = io(this.url);
        socket.on('connect', function () {
            console.log('RedMessenger Connected!');

            var identifier = this.userID + (this.userKey ? ':' + this.userKey : '');
            console.log('Sending identifier ' + identifier);

            socket.emit('identifier', identifier);
        }.bind(this));

        socket.on('message', function (msg) {
            this.onMessage(msg);
        }.bind(this))
    } else {
        console.log('Socket.IO is not embedded in this page. RedMessenger will not be able to serve messages.')
    }
}

var rm = new RedMessenger('http://localhost:8080/rm', 'brianc', '1234');
