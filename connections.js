/*
	CONNECTION FUNCTIONS
		by Daniel Scutt
	1) Allows universal handling of socket and process connections
	2) Takes a string argument for ID
	3) Provides socket and child build functions, as well as message send and receive functions
*/


function Connections(this_id) {
	/* CONNECTIONS CLASS */
	
	/* VARIABLES */
	// Class Data
	this.id = this_id;
	this.nickname = false;
	// Allow Flags
	this.show_nickname = false;
	this.read_line = false;
	this.use_process_listener = false;
	this.allow_receipts = false;
	this.allow_permanent_connections = false;
	// Limits
	this.process_long_wait = 1000;
	this.process_short_wait = 0;
	this.connection_silence = 10000;
	// Toggles
	this.loop_logic_print_connections = false;
	
	/* Objects */
	this.ConnectionsHandler = false;
	this.connections = false;
	this.valid_child_processes = ["test_child.js"];
	this.events = require('events');
	this.fork = require('child_process').fork;
	
	/* UTILITY FUNCTIONS */
	this.Print = function(m) {
		// console.log
		if (this.nickname && this.show_nickname) {
			console.log("["+this.nickname+"] "+m);
		} else if (this.id) {
			console.log("["+this.id+"] "+m);
		} else {
			console.log(m);
		}
		return true;
	}
	this.GetCurrentTime = function() {
		// Return current time
		return (new Date().getTime());
	}
	this.CountArrayElements = function() {
		// Count the number of elements in an array
		// Takes one or two arguments: the array to look thru and elements to find
		try {
			var args = Array.prototype.slice.call(arguments);
			var i = 0;
			if (args.length == 1 && typeof args[0] == "object") {
				// Just count elements
				for (key in args[0]) {
					i += 1;
				}
				return i;
			} else if (args.length == 2 && typeof args[0] == "object") {
				// Count number of instances of FIND elements in array
				for (key in args[0]) {
					if (typeof args[1] == "string" || typeof args[1] == "number") {
						if (args[0][key] == args[1]) i += 1;
					} else if (typeof args[1] == "object") {
						for (find_key in args[1]) {
							if (args[0][key] == args[1][find_key]) i += 1;
						}
					}
				}
			return i;
			} else {
				return 0;
			}
		} catch(err) {
			this.print("CountArrayElements() failed on error: "+err);
			return false;
		}
	}
	this.ParseStandardFormatMessage = function(msg) {
		// Parses a message that is formatted in the standardized format
		// TITLE@key1=value1&key2=value2...
		try {
			if (typeof msg == "string") {
				var packet = msg.split("@");
				var parsed = {'title':packet[0]};
				if (packet.length > 1) {
					var parts = packet[1].split("&");
					for (part_key in parts) {
						var pair = parts[part_key].split("=");
						if (pair.length == 1) {
							parsed[pair[0]] = true;
						} else if (pair.length == 2) {
							parsed[pair[0]] = pair[1];
						}
					}
				}
				return parsed;
			} else {
				throw new Error("message is not a string.");
			}
		} catch(err) {
			this.print("ParseStandardFormatMessage() failed on error: "+err);
			return false;
		}
	}
	this.AssembleStandardFormatMessage = function (parts) {
		// Assemble a message in the standardized format
		// Requires a keyed array
		// TITLE@key1=value1&key2=value2...
		try {
			var title = "";
			var reply = false;
			if (typeof parts == "string") {
				parts = {'title':parts};
				var parts_length = 1;
			} else {
				var parts_length = this.CountArrayElements(parts);
			}
			if (parts_length > 0 && parts['title']) {
				var i = 2;	// set to 2 to account for title and first msg argument doesn't count
				for (part_key in parts) {
					if (part_key == 'title') {
						title = parts['title'];
					} else {
						if (reply === false) {
							reply = "";
						}
						reply += part_key+"="+parts[part_key];
						if (i < parts_length) {
							reply += "&";
						}
					}
					i += 1;
				}
				if (reply) {
					reply = title+"@"+reply;
				} else {
					reply = title;
				}
				return reply;
			} else {
				throw new Error("message parts not an object.");
			}
		} catch(err) {
			this.print("AssembleStandardFormatMessage() failed on error: "+err);
			return false;
		}
	}
	this.Toggle = function(toggle) {
		// Toggle a toggle
		if (toggle) {
			toggle = false;
		} else if (toggle === false) {
			toggle = true;
		} else {
			this.print("Toggle() received an improper toggle: "+toggle+"; set to false.");
			toggle = false;
		}
		return toggle;
	}
	
	/* Command Line Listener */
	this.SetCommandListener = function(line) {
		// Process something typed on the command line
		try {
			this.read_line = require('readline').createInterface({
				input: process.stdin,
				output: process.stdout
			});
			this.read_line.on('line',(line) => {
				var args = line.split(" ");
				if ((args[0] == "exit") || (((args[0] == this.id || args[0] == this.nickname) && args.length == 2) && args[1] == "exit")) {
					// Shut down the process
					for (conn_key in this.sockets) {
						if (this.connections[conn_key]['type'] == "socket") {
							this.connections[conn_key]['socket'].close();
						} else if (this.connections[conn_key]['type'] == "child") {
							this.connections[conn_key]['child'].kill();
						}
					}
					this.print(this.id + " exiting...");
					process.exit();
				} else if ((args[0] == this.id || args[0] == this.nickname) && args.length > 1) {
					if (args.length == 4 && args[1] == "set" && args[2] == "nickname" && typeof args[3] == "string") {
						// Set this process' nickname
						if (args[3] == "false") {
							this.nickname = false;
							this.print("Removed "+this.id+"'s nickname");
						} else {
							this.nickname = args[3];
							this.print("Setting "+this.id+"'s nickname to "+this.nickname);
						}
					} else if (args.length == 3 && args[1] == "show" && args[2] == "nickname") {
						this.show_nickname = true;
						this.print("Using nickname.");
					} else if (args.length == 3 && args[1] == "hide" && args[2] == "nickname") {
						this.print("Using id.");
					}
				} else if (args[0] == "print" && args.length > 1) {
					// Print class information
					if (args[1] == "id") {
						this.print(this.id);
					} else if (args[1] == "connections" || args[1] == "conns") {
						this.loop_logic_print_connections = this.Toggle(this.loop_logic_print_connections);
					}
				} else if (args[0] == "close" && args.length > 1) {
					// Close a connection
					if (args[1] in this.connections) {
						if (this.connections[args[1]]['type'] == "socket") {
							this.connections[args[1]]['socket'].close();
						} else if (this.connections[args[1]]['type'] == "child") {
							this.connections[args[1]]['child'].kill();
						}
						delete this.connections[args[1]];
						this.print("Closed connection: "+args[1]);
					}
				} else if (args[0] == "open" && args.length > 1) {
					// Open a Connection
					if (args[1] == "socket" && args.length == 6) {
						var new_conn = this.BuildSocket(args[2],args[3],args[4],Number(args[5]));
						if (new_conn) {
							this.print("... new socket created.");
						} else {
							this.print("... new socket failed creation.");
						}
					} else if (args[1] == "child" && args.length == 4) {
						var new_conn = this.BuildChild(args[2],args[3]);
						if (new_conn) {
							this.print("... new child created.");
						} else {
							this.print("... new child failed creation.");
						}
					} else {
						this.print("Incorrect arguments.");
					}
				} else if (args.length == 3 && args[0] == "connections" && args[1] == "start" && args[2] == "validator") {
					// Start connection validator
					this.use_process_listener = true;
					this.ProcessListener();
					this.print("... starting the process listener. Your connections may begin closing.");
					this.print("... to end the process listener type: connections end validator");
				} else if (args.length == 3 && args[0] == "connections" && args[1] == "end" && args[2] == "validator") {
					// Exit connection validator
					this.use_process_listener = false;
					this.print("... exiting the process listener. Your connections are no longer being validated.");
				} else {
					throw new Error("typed command not recognized.");
				}
			});
			return true;
		} catch(err) {
			this.Print("LineInput() failed with possible error: "+err);
			return false;
		}
	}
	
	/* Connection Functions */
	this.SetupConnectionsHandler = function() {
		// Set Up the Connection Handler
		// Puts connection handling into the callback stack to keep execution fast
		try {
			this.allow_receipts = true;
			this.ConnectionsHandler = new this.events.EventEmitter();
			this.ConnectionsHandler.on('open', (args) => {
				// Open a new connection
				// Requires an array passed with at least 3 elements
				try {
					if (this.connections === false) {
						this.connections = {};
					}
					if (args.length == 4) {
						this.BuildConnection(args[0],args[1],args[2],args[3]);
					} else if (args.length == 6) {
						this.BuildConnection(args[0],args[1],args[2],args[3],args[4],args[5]);
					} else {
						throw new Error("incorrect arguments provided.");
					}
					return true;
				} catch(err) {
					this.print("ConnectionsHandler() failed on error: "+err);
					return false;
				}
			});
			return true;
		} catch(err) {
			this.print("SetupConnectionsHandler() failed on error: "+err);
			this.allow_receipts = false;
			this.ConnectionsHandler = false;
			return false;
		}
	}
	this.ValidateConnections = function() {
		// Validate connections in connections list
		try {
			if (this.connections) {
				if (this.CountArrayElements(this.connections) <= 0) this.connections = false;
				if (this.connections) {
					var connections_to_remove = [];
					for (c in this.connections) {
						if (this.connections[c]['deathday'] > -1 && this.GetCurrentTime() >= this.connections[c]['deathday']) {
							this.print("Connection "+c+" has reached the end of its life. Attempting removal.");
							if (this.connections[c]['type'] == "socket") {
								this.connections[c]['connection'].close();
								connections_to_remove.push(c);
							} else if (this.connections[c]['type'] = "child") {
								this.connections[c]['connection'].kill();
								connections_to_remove.push(c);
							} else {
								this.print("ValidateConnections() Alert: "+c+" is an unknown connection type.");
								this.print("... "+this.connections[c]);
							}
						} else if (this.connections[c]['silence_limit'] && (this.GetCurrentTime() - this.connections[c]['last_update']) >= this.connections[c]['silence_limit']) {
							this.print("Connection "+c+" has timed out. Marking for removal.");
							this.connections[c]['deathday'] = 1;
						}
					}
					for (key in connections_to_remove) {
						delete this.connections[connections_to_remove[key]];
						this.print("Connection "+c+" has been removed.");
					}
				}
			}
			return true;
		} catch(err) {
			this.print("ValidateConnections() failed on error: "+err);
		}
	}
	this.BuildConnection = function() {
		// Builds a connection
		// Requires 4 arguments for a child process or 6 arguments for a socket
		//		Child: ID, deathday, silence limit, filename
		//		Socket: ID, deathday, silence limit, UDP type, IP and port number
		try {
			var args = Array.prototype.slice.call(arguments);
			if (args.length < 3) throw new Error("not enough arguments provided.");
			if (args[0] in this.connections) throw new Error("a connection with ID "+id+" already exists.");
			for (arg_key in args) {
				if (!(typeof args[arg_key] == "string" || typeof args[arg_key] == "number" || typeof args[arg_key] == "boolean")) {
					throw new Error("at least one provided argument is something other than a string/number/boolean.");
				}
			}
			var id = args[0];
			var deathday = args[1];
			var silence_limit = args[2];
			var type = false;
			if (silence_limit == true || this.allow_permanent_connections === false) silence_limit = this.connection_silence;
			if (arguments.length == 4) {
				// New Connection is Child
				type = "child";
			} else if (arguments.length == 6) {
				// New Connection is Socket
				type = "socket";
			} else {
				throw new Error("cannot recognize desired connection type.");
			}
			this.connections[id] = {
				'status':'idle',
				'last_update':(this.GetCurrentTime()),
				'silence_limit':silence_limit,
				'type':type,
				'birthday':(this.GetCurrentTime()),
				'deathday':deathday,
				'connection':false
			};
			if (type == "child") {
				// Type is Child, Create New Child Process
				if (typeof args[3] == "string") {
					this.connections[id]['connection'] = this.fork('./'+args[2]);
					this.print("Connection "+id+" (child) is listening.");
					this.connections[id]['connection'].on('message',(m) => {
						//this.print("Connection "+id+" received a message.");
						//this.print("... "+m);
						this.connections[id]['last_update'] = this.GetCurrentTime();
						this.ConnectionsHandler.emit("receive",[id,m]);
					});
					this.connections[id]['connection'].on('kill',() => {
						this.print("Killing "+id);
						this.connections[id]['connection'].exit();
					});
				} else {
					throw new Error("provided filename was not a string.");
				}
			} else if (type == "socket") {
				// Type is Socket, Create New Socket
				if (typeof args[3] == "string" && typeof args[4] == "string" && typeof args[5] == "number") {
					this.connections[id]['connection'] = require('dgram').createSocket(args[3]);
					this.connections[id]['connection'].bind(args[5],args[4]);
					this.connections[id]['connection'].on('listening',() => {
						this.print("Connection "+id+" (socket) is listening.");
						if (this.connections[id]['silence_limit'] === false) {
							this.print("... "+id+" is a permanent connection.");
						}
					});
					this.connections[id]['connection'].on('message',(m,r) => {
						m = m.toString('utf8');
						//this.print("Connection "+id+" received a message.");
						//this.print("... "+r.address+":"+r.port);
						//this.print("... "+m+" is of type "+(typeof m));
						this.connections[id]['last_update'] = this.GetCurrentTime();
						this.ConnectionsHandler.emit("receive",[id,m,r]);
					});
				} else {
					throw new Error("incorrect arguments provided for creating new socket.");
				}
			} else {
				delete this.connections[id];
				throw new Error("set type, but failed on check later.");
			}
			return true;
		} catch(err) {
			this.print("BuildConnection() failed on error: "+err);
			return false;
		}
	}
	this.SendMessage = function() {
		// Send a message
		//	For child: conn key and msg
		//	For socket: conn key, msg, possibly ip and port
		try {
			var args = Array.prototype.slice.call(arguments);
			var type = false;
			if (typeof args != "object" || this.CountArrayElements(args) < 2) throw new Error("not enough or no provided arguments, or args is not an array.");
			if (!(args[0] in this.connections)) throw new Error(args[0]+" not found in connections.");
			if (typeof args[0] == "string") type = this.connections[args[0]]['type'];
			var msg = this.AssembleStandardFormatMessage(args[1]);
			if (type == "child") {
				// Send child message
				this.connections[args[0]]['connectin'].send(msg);
			} else if (type == "socket") {
				// Send socket message
				if ("target" in this.connections[args[0]] && "ip" in this.connections[args[0]]['target'] && "port" in this.connections[args[0]]['target']) {
					var target_ip = this.connections[args[0]]['target']['ip'];
					var target_port = this.connections[args[0]]['target']['port'];
				} else if (this.CountArrayElements(args) == 4) {
					var target_ip = args[2];
					var target_port = args[3];
				} else {
					throw new Error("connection has no saved target and no provided target.");
				}
				if (target_ip && target_port) {
					this.connections[args[0]]['connection'].send(msg,0,msg.length,target_port,target_ip,(err,bytes) => {
						if (err) throw err;
						this.print("Sending message to "+target_ip+":"+target_port);
					});
				}
			} else {
				throw new Error("type not recognized.");
			}
		} catch(err) {
			this.print("SendMessage() failed on error: "+err);
		}
	}
	
	/* Class Maintenance and Listneing Logic */
	this.ClassMaintenance = function() {
		// Perform class maintenance
		try {
			// Validate Connections
			this.ValidateConnections();
		} catch(err) {
			this.print("ProcessListener() failed on error: "+err);
		}
	}
	this.LoopLogic = function() {
		// Continuously loop performing various functions
		var wait = this.process_long_wait;
		if (this.connections) {
			wait = this.process_short_wait;
		}
		setTimeout(()=>{
			try {
				this.ClassMaintenance();
				if (this.loop_logic_print_connections && this.connections) {
					// Print connections if loop_logic_printed_connections set to true
					this.loop_logic_print_connections = this.Toggle(this.loop_logic_print_connections);
					for (c in this.connections) {
						var silent = this.GetCurrentTime() - this.connections[c]['last_update'];
						this.print("Connection - ID:"+c+", type:"+this.connections[c]['type']+", Silent:"+silent);
					}
				} else if (this.loop_logic_print_connections) {
					this.print("There are no connections.");
					this.loop_logic_print_connections = this.Toggle(this.loop_logic_print_connections);
				}
			} catch(err) {
				this.print("LoopLogic() failed on error: "+err);
			}
			this.LoopLogic();
		},wait);
	}
	
	/* NORMAL USER FUNCTIONS */
	this.print = function(m) {
		try {
			this.Print(m);
			return true;
		} catch(err) {
			this.Print("User function print() failed on error: "+err);
			return false;
		}
	}
	this.buildconnection = function () {
		this.ConnectionsHandler.emit("open",arguments);
	}
	this.allowpermanentconnections = function() {
		this.allow_permanent_connections = true;
	}
	
	
	
	this.SendMessage1 = function() {
		// Send a message over a connection
		try {
			var args = Array.prototype.slice.call(arguments);
			if (args.length > 1 && args[0] in this.connections) {
				if (this.connections[args[0]]['type'] == "socket" && args.length == 4) {
					// Type is socket
					this.connections[args[0]]['socket'].send(args[1],0,args[1].length,args[2],args[3],(err,bytes) => {
						if (err) throw err;
						//this.print("Sent message to "+args[0]+"("+args[3]+":"+args[2]+"): "+args[1]);
					});
				} else if (this.connections[args[0]]['type'] == "child" && typeof args[1] == "string") {
					// Type is child_process
					this.connections[args[0]]['child'].send(args[1]);
					//this.print("Sent message to "+args[0]+": "+args[1]);
				} else {
					throw new Error("incorrect arguments.");
				}
			}
			return true;
		} catch(err) {
			this.print("SendMessage() failed with possible error: "+err);
			return false;
		}
	}
	this.ParseMessage1 = function (msg) {
		// Return a Title/Flag/Command and argument pairs
		try {
			if (msg != "string") msg = msg.toString('utf8');
			var reply = {};
			var packet = msg.split("@");
			if (packet.length == 2) {
				reply['title'] = packet[0];
				var args = packet[1].split("&");
				for (arg_key in args) {
					var pair = args[arg_key].split("=");
					if (pair.length == 1) reply[pair[0]] = true;
					if (pair.length == 2) reply[pair[0]] = pair[1];
				}
				return reply;
			} else {
				throw new Error("too many arguments.");
			}
		} catch(err) {
			this.print("ParseMessage() failed on error: "+err);
			return false;
		}
	}
	this.ReceiveMessage1 = function (conn_key,msg,remote) {
		// Received a message over a connection
		try {
			if (this.allow_receipts) {
				var conn_type = false;
				if (remote) {
					// Message from Socket
					conn_type = "socket";
					//this.print("Received message from "+conn_key+"("+remote.address+":"+remote.port+"): "+msg);
					this.ReceiptEmitter.emit('message',[conn_key,msg,remote]);
				} else if (remote === false) {
					// Message from Child
					conn_type = "child";
					//this.print("Recieved message from "+conn_key+": "+msg);
					this.ReceiptEmitter.emit('message',[conn_key,msg]);
				}
				// Parse Message
				if (conn_type) {
					msg = this.ParseMessage(msg);
					if (msg['title'] == "Test") {
						this.print("Connection type "+conn_type+".");
					}
				} else {
					throw new Error("Method failed to identify connection type.");
				}
			} else {
				throw new Error("message received, but currently not allowing for messages.")
			}
		} catch(err) {
			this.print("ReceiveMessage() failed on error: "+err);
			return false;
		}
	}
	this.SetupReceipts1 = function() {
		// Allow receipt of messages to be processed
		this.allow_receipts = true;
		this.ReceiptEmitter = new this.events.EventEmitter();
	}
	
	/* LOGIC */
}


module.exports = {
	Connections: Connections
}



/*

// Erase this section for new files

console.log("Connections Class v1.0, by Daniel Scutt.");
console.log("Built for use with Node.js.");
console.log("");
console.log("Detail: Integrated socket and child process functionality, providing near-seamless control of both types of connections in a single class. The goal of this class is to allow quick setup of a server, as well as client programs and other listening processes using the JavaScript language. As development continues the class should become more streamlined and its functionality more powerful.");
console.log("");
console.log("This version provides the BuildSocket and BuildChild methods, to set up connections for other processes and child processes, as well as the SendMessage method to communicate across these connections. It also provides the ProcessListener method, which validates connections and shuts them down when they become inactive. Finally, the CommandLineListener method provides a level of control over the process including opening and closing connections, providing a nickname for this process, printing back connection information and exiting this (or all class instances running in the same Node instance) process.");
console.log("");
console.log("To learn about how this class works, it is recommended you learn first-hand and open this file in an appropriate text editor such as Notepad++ or Sublime. Additional editors can be found here: https://en.wikipedia.org/wiki/List_of_text_editors");
console.log("");
console.log("	***	*	**	*	***");



var new_connection = false;
function StartConnection(name) {
	// Start the listener
	setTimeout(function() {
		new_connection = new Connections(name);
		new_connection.SetCommandListener();
		new_connection.print("New Connections class listening...");
		new_connection.print("To create a new socket type: open socket *name* udp4/udp6 IP port");
		new_connection.print("To create a new child type: open child *name* *filepath/filename*");
		new_connection.print("Connections is currently set up to allow only testing files. See connections.js to edit.");
		new_connection.print("To start the process listener, to validate connections over time type: connections start validator");
	},1000);
}

setTimeout(function() {
	console.log("Name this instance of connections.js. Alpha-numeric only. All other characters will be removed.");
	var name_new_instance = require('readline').createInterface({
		input: process.stdin,
		output: process.stdout
	});
	name_new_instance.on('line',(line) => {
		var args = line.split(" ");
		if (args.length == 1) {
			try {
				var new_name = args[0].replace(/\W+/g, " ");
				console.log(new_name+" is valid. Accepted.");
				StartConnection(new_name);
				console.log("... setting main listener to pause...");
				name_new_instance.close();
			} catch(err) {
				console.log("Failed to create new instance. Possible error: "+err);
			}
		} else {
			console.log(line+" is not valid");
		}
	});

},1000);

*/













