//RedMessenger Client Configuration

function RedMessenger(url, userID) {
    this.url = url;
    this.userID = userID;

    this.onMessage =  function(msg) {
        console.log('RedMessage! ' + msg);
    };

    var socket;
    if(io) {
        var socket = io(this.url);
        socket.on('connect', function () {
            console.log('RedMessenger Connected!');
            console.log('Sending identifier ' + userID);

            socket.emit('identifier', this.userID);

            socket.on('message', function (msg) {
                this.onMessage(msg);
            }.bind(this))
        }.bind(this));
    } else {
        console.log('Socket.IO is not embedded in this page. RedMessenger will not be able to serve messages.')
    }
}

var rm = new RedMessenger('http://seanc-linux:8080/rm', 'brianc');