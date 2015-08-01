//RedMessenger Client goes here
var rm = {
    url: 'http://seanc-linux:8080/rm'
};

if(io) {
    rm.socket = io(rm.url);

    rm.socket.on('connect', function() {
        console.log('RedMessenger Connected!');
        rm.socket.on('message', function(msg) {
            console.log('Red Message! ' + msg);
        });
    });
} else {
    console.log('Socket.IO is not embedded on the page. RedMessenger notifications will not be enabled.');
}
