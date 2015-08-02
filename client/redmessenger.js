//RedMessenger Client Configuration

function RedMessenger(url, userID, userKey) {
    this.url = url;
    this.userID = userID;
    this.userKey = userKey || '';
    var notifList = setup();

    this.onMessage =  function(msg) {
    	var test = "Wassup yo"
        var notification = document.createElement("div");
        notification.className = 'notification';

        var icon = document.createElement("div");
        icon.className = 'icon';

        var title = document.createElement("div");
        title.className = 'title';
        title.innerHTML = 'Title';


        notifList.appendChild(notification);
        notification.appendChild(icon);
        notification.appendChild(title);
    };

    function setup() {
    	var div = document.createElement("div");
    	div.className = 'notif-space';

    	document.body.appendChild(div);
    	return div;
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

var rm = new RedMessenger('http://localhost:8080/rm', 'kevina', '1234');
