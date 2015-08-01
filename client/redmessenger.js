//RedMessenger Client Configuration

function RedMessenger(url, userID) {
    this.url = url;
    this.userID = userID;

    var socket = io(this.url);
    socket.on('connect', function() {
        console.log('RedMessenger Connected!');
        console.log('Sending identifier ' + userID);

        socket.emit('identifier', this.userID);

        socket.on('message', function(msg) {
            this.onMessage(msg);
        }.bind(this))
    }.bind(this));

    this.onMessage =  function(msg) {
        console.log('RedMessage! ' + msg);
    };
}

var rm = new RedMessenger('http://seanc-linux:8080/rm', 'brianc');