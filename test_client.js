/*
	CLIENT PROCESS
		by Daniel Scutt
*/


/* Required Fucntions */


/* Imports */
// Connections class
var conn_class = require('./connections.js');


/* Variables */
// Connection Validation Data
var time_to_wait_for_response = 5000;
var maximum_connection_attempts = 10;
// Local data
var local_ip = '127.0.0.1';
var local_port = 5001;
// Socket 1
var client1 = {"name":"ClientSocket1","target_port":5551,"target_ip":'127.0.0.1'};

/* Objects */
var connection = new conn_class.Connections("Client");


/* Logic */
connection.SetCommandListener();
connection.LoopLogic();
connection.SetupConnectionsHandler();
connection.buildconnection(client1['name'],(connection.GetCurrentTime()+10000),true,"udp4",local_ip,local_port);

connection.SendMessage(client1['name'],{'title':'TEST'},'127.0.0.1',5000);

connection.ConnectionsHandler.on('receive',(args) => {
	try {
		var c = args[0];
		var m = args[1];
		var r = false;
		var type = false;
		if (args.length == 3) {
			r = args[2];
			type = "socket";
		} else if (connection.connections && c in connection.connections && connection.connections[c]['type'] == "child") {
			type = "child";
		}
		if (type) {
			// Parse Message
			var reply = false;
			var msg = connection.ParseStandardFormatMessage(m);
			var title = false;
			if ('title' in msg) title = msg['title'];
			
			// Look For Arguments
			if (title == "GENERIC" && 'reply' in msg) {
				connection.print("From "+r.address+":"+r.port+" - "+msg['reply']);
			}
			// Send reply if required
			if (reply) {
				connection.SendMessage(server1['name'],reply,r.address,r.port);
			}
		} else {
			throw new Error("received message's sender has no known type.");
		}
	} catch(err) {
		connection.print("ConnectionsHandler failed on error: "+err)
	}
});













