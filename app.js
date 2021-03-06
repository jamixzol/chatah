// Configs==============================================================================
var web_servername = "localhost",
    web_port = "3000",
    web_upload_directory = "/uploads",
    web_upload_sizelimit = "900mb",
    web_upload_rootpath = "C:\\Program Files\\nodejs\\",
    sql_servername = "localhost",
    sql_port = "3306",
    sql_database = "chat",
    sql_username = "root",
    sql_password = "password",
    tbl_chat = "chat",
    tbl_users = "users",
    tbl_memchat = "memchat",
    tbl_userveiw = "vw_users2";
    
// Configs==============================================================================

// Globals==============================================================================
var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	mysql = require('mysql'),
	colog = require('colog'),
	fs = require('fs'),
    path = require('path'),
	lasttimestamp = "",
	lastUser = "",
	lastColor = "",
	users = {},
    ausers = {username:"",lastactivity:"",avatar:"",lastseen:""},
	usedquestions = new Array(),
	usedanswers = new Array(),
	Colors = ["red","green","yellow","blue","magenta","cyan","white"],
	$user = new Object,
	$rows = new Object,
	prefs = "",
	msgID = "",
	timestamp = "",
	avatar = "",
    lastCommand = "",
    userslist = [];
// Globals==============================================================================

//Start HTTP server==============================================================================
server.listen(web_port);
	//Serve documents==============================================================================
  app.configure(function() {
  var hourMs = 1000*60*60;
  app.use(express.static(__dirname + '/', { maxAge: hourMs }));
  app.use(express.directory(__dirname + '/'));
  app.use(express.errorHandler());
  app.use(express.bodyParser({ 
    keepExtensions: true, 
    uploadDir: __dirname + web_upload_directory,
    limit: web_upload_sizelimit
  }));
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});
	//Serve documents==============================================================================
//Start HTTP server==============================================================================

// Database connection info==============================================================================
function connect(){
var connection = mysql.createConnection({
  host     : sql_servername,
  port : sql_port,
  database: sql_database,
  user     : sql_username,
  password : sql_password,
});
return connection;
}
// Database connection info==============================================================================

// error catching==============================================================================
process.on('uncaughtException', function(err) {
if(err.name.indexOf("TypeError") >= 0) { 
	colog.warning(Timestamp() + 'Error Name: ' + err.name + "\nError Message: " + err.message + "\n"); 
}
else {
	colog.headerError(Timestamp() + 'Error Name: ' + err.name + "\nError Message: " + err.message + "\n"); 
	io.sockets.emit('reload', {err: err});
  }
});
// error catching==============================================================================

// utility globals==============================================================================
var gsocket;
var connection = connect();
var lastUserlist;
io.set('log level', 1); // reduce logging
io.sockets.emit('reload', {err: "Server restared"});
// utility globals==============================================================================

//Main socket loop==============================================================================
io.sockets.on('connection', function(socket){
gsocket = socket; // push to global

//Handle Uploads==============================================================================
app.post('/', function(req, res) {
    colog.info(Timestamp() + "File uploaded: " + req.files.myFile.path);
    var filepath = req.files.myFile.path;
    res.send(filepath.replace(web_upload_rootpath,""));
  res.end();
});
//Handle Uploads==============================================================================
    
socket.on('register', function(data, callback){
	connection.query("SELECT * FROM " + tbl_users + " where username = '" + data.nickname + "'", function(err, rows){
		if(err != null) {
			colog.error(Timestamp() + "Query error:" + err);
		} else {
		if(rows.length > 0){
			callback({ok: false, error: "User already exists, try another username"});
		}
	}
});
var defaultsettings = "pic=2&bar=2&system=1&bubble=#cccccc&btype=2&txtcolor=#000000&txtsize=3&bgcolor=#191919&panelcolor=#666666&barcolor=#333333&txtfont=1&bold=0&italic=0&underline=0&userstyle=1&showusernames=1&historyhours=3&wallpaper=&";
connection.query("INSERT INTO users (username,password,prefs,avatar,email,alive) VALUES ('" + 
				data.nickname + "','" +
				data.password + "','" +
				defaultsettings + "','" +
				data.avatar + "','" +
				data.email + "'" +
				",NOW());",
	function(err) { 
		if(err != null) {
			colog.error(Timestamp() + "Query error:" + err);
		} else {
			callback({ok: true, error: "You have been registered as " + data.nickname});
		}
	});
});

socket.on('send command',function(data){
    console.log(Timestamp() + "Send Command recieved: " + data);
    lastCommand = data;
    io.sockets.emit('send command',data);
});
    
//New user logs in==============================================================================
socket.on('new mobile user', function(data, callback){  });
socket.on('new user', function(data, callback){

if (data.password == ""){
colog.error(Timestamp() + data.nickname + " didn't enter a password");
callback({ok: false, error: 2});
}
else{
console.log(Timestamp() + 'Authenticating user ' + data.nickname);
	connection.query("SELECT * FROM " + tbl_users + " where username = '" + data.nickname + "'", function(err, rows){
		if(err != null) {
			colog.error(Timestamp() + "Query error:" + err);
		} else {
		if(rows.length > 0){
				if(rows[0].password != data.password){
				colog.error(Timestamp() + rows[0].username + " entered the wrong password");
				callback({ok: false, error: 3});
				}else {
					if (data.nickname in users){
						users[rows[0].username].emit('reload', {err: "Logging in at another location"});
						colog.error(Timestamp() + rows[0].username + " is already logged in somewhere else");
						callback({ok: false, error: 1});
					} 
					else{
					connection.query("UPDATE " + tbl_users + " set online = 1, alive = NOW(), lastpost = NOW() where username = '" + data.nickname + "'");
						callback({ok: true, error: 0, useravatar: rows[0].avatar, barvatar: rows[0].barvatar, prefs: rows[0].prefs, email: rows[0].email});
						socket.nickname = rows[0].username;
						socket.avatar = rows[0].avatar;
						users[rows[0].username] = socket;
						if(data.source != "mobile"){
							updateNicknames();
						}
						getHistory(socket.nickname);
						colog.headerSuccess(Timestamp() + socket.nickname + " logged in");
						io.sockets.emit('system', {
						msg: "<img src=\"" + socket.avatar + "\" style=\"height:20px;\" />" + socket.nickname + " logged in", 
						nick: "system"
						});						
					}
				}
			} else {
			colog.error(Timestamp() + data.nickname + " is not registered");
				callback({ok: false, error: 4});
			}
		}
		});
	}
});
//New user logs in==============================================================================	
	
//Get history=================================================================================
function getHistory(name){
    connection.query("SELECT *,date_format(timestamp,'%Y-%m-%d %T') as 'SafeDate' FROM " + tbl_chat + " order by timestamp desc limit 50", function(err, rows){ //where timestamp >= TIMESTAMPADD(HOUR,-10,NOW())
        if(err != null) {
            colog.error(Timestamp() + "Query error:" + err);
        } else {
		for (var i = rows.length-1, len = 0; i >= len; i--) {
            
			lasttimestamp = rows[i].SafeDate;
//				if(rows[i].user != "SYSTEM"){
					if(rows[i].user != "undefined"){
							try {
								users[name].emit('new message', {
									msg: rows[i].message, 
									nick: rows[i].user, 
									timestamp: lasttimestamp, 
									prefs: rows[i].misc, 
									avatar: rows[i].file,
									id: rows[i].id
									});
							} catch(err) {
								colog.warning(Timestamp() + 'Error Name: ' + err.name + "\nError Message: " + err.message + "\n"); 
							}
						}
//					}
				}
        }
	});
	users[name].emit('hidefish',true);
    users[name].emit('send command',lastCommand);
}
//Get history=================================================================================
	
//User closes window==============================================================================
socket.on('disconnect', function(data){
	if(!socket.nickname) return;
	connection.query("UPDATE " + tbl_users + " set online = 0 where username = '" + socket.nickname + "'");
	delete users[socket.nickname];
	updateNicknames();
	colog.headerError(Timestamp() + socket.nickname + " logged out");
	io.sockets.emit('system', {msg: socket.nickname + " logged out because they hate you", nick: "system"});
});

//User closes window==============================================================================

    //socket.emit("seen",$me,$lastSeen,$myavatar);

socket.on('seen', function(data, callback){
    io.sockets.emit("seen",{ username: data.username,id: data.id, avatar: data.avatar });
});
    
//request user list===============================================================================
//socket.on('get users', function(data, callback){
//    callback(io.sockets.get_user_list());
//});
//request user list===============================================================================
    
//Userlist update=================================================================================
function updateNicknames(){
    
//    for (var socketId in io.sockets.sockets) {
//    io.socket.sockets[socketId].get('nickname', function(err, nickname) {
//        console.log(nickname);
//    });
//}

var sql = "SELECT vu.username,vu.online,u.avatar,u.score FROM " + tbl_userveiw + " vu JOIN " + tbl_users + " u ON u.username = vu.username WHERE vu.username != 'SYSTEM' AND vu.online > 0 ORDER BY vu.online";
//var userslist = [];
connection.query(sql, function(err, rows){ 
	if(err != null) { 
		colog.error(Timestamp() + "Query error:" + err); 
	} else { 
		for(var i = 0; i < rows.length; i++){
			userslist.push({name: rows[i].username, online: rows[i].online, avatar: rows[i].avatar, score: rows[i].score});
		}
		// console.log(userslist);
		if(lastUserlist != userslist){		
			lastUserlist = userslist;
			io.sockets.emit('usernames', userslist); //Object.keys(users));
		}
	} 
});

// connection.end();
};
//Userlist update==============================================================================
socket.on("delete", function(data){
    connection.query("DELETE FROM " + tbl_chat + " where id = " + data + " LIMIT 1", function(err, rows){    
    	if(err != null) {
			colog.error(Timestamp() + "Query error:" + err);
		} else {
            io.sockets.emit("utility","$('#bubble" + data + "').html('*deleted*');");
            connection.query("DELETE FROM " + tbl_memchat + " where id = " + data + " LIMIT 1", function(err, rows){    
                if(err != null) {
                    colog.error(Timestamp() + "Query error:" + err);
                } else {

                }   
            });
        }
    });
});
    
    
    socket.on("plusone", function(data){
connection.query("SELECT score FROM " + tbl_users + " where username = '" + data + "'", function(err, rows){
		if(err != null) {
			colog.error(Timestamp() + "Query error:" + err);
		} else {
		var newscore = rows[0].score + 1;
			connection.query("UPDATE " + tbl_users + " set score = '" + newscore + "' where username = '" + data + "'");
            var sql = "SELECT vu.username,vu.online,u.avatar,u.score FROM " + tbl_userveiw + " vu JOIN " + tbl_users + " u ON u.username = vu.username WHERE vu.username != 'SYSTEM' AND vu.online > 0 ORDER BY vu.online";
            connection.query(sql, function(err, rows){ 
                if(err != null) { 
                    colog.error(Timestamp() + "Query error:" + err); 
                } else { 
                    userslist = [];
                    for(var i = 0; i < rows.length; i++){
                        userslist.push({name: rows[i].username, online: rows[i].online, avatar: rows[i].avatar, score: rows[i].score});
                    }
                        io.sockets.emit('usernames', userslist); //Object.keys(users));
                } 
            });
		}
});
});

socket.on("subone", function(data){
connection.query("SELECT score FROM " + tbl_users + " where username = '" + data + "'", function(err, rows){
		if(err != null) {
			colog.error(Timestamp() + "Query error:" + err);
		} else {
		var newscore = rows[0].score - 1;
			connection.query("UPDATE " + tbl_users + " set score = '" + newscore + "' where username = '" + data + "'");
            var sql = "SELECT vu.username,vu.online,u.avatar,u.score FROM " + tbl_userveiw + " vu JOIN " + tbl_users + " u ON u.username = vu.username WHERE vu.username != 'SYSTEM' AND vu.online > 0 ORDER BY vu.online";
//var userslist = [];
connection.query(sql, function(err, rows){ 
	if(err != null) { 
		colog.error(Timestamp() + "Query error:" + err); 
	} else { 
        userslist = [];
		for(var i = 0; i < rows.length; i++){
			userslist.push({name: rows[i].username, online: rows[i].online, avatar: rows[i].avatar, score: rows[i].score});
		}
			io.sockets.emit('usernames', userslist); //Object.keys(users));
	} 
		});
		}
});
    });
    
//upload image==============================================================================
socket.on('upload image', function(data, callback){

var string = data.image;
var regex = /^data:.+\/(.+);base64,(.*)$/;

var matches = string.match(regex);
var ext = matches[1];
var data2 = matches[2];
var buffer = new Buffer(data2, 'base64');
var filename =  data.username + Date.now() + '.' + ext;
fs.writeFile(web_upload_directory + '/' + filename, buffer, function(err){
if (err) { 
callback('File upload failed: ' + err);
colog.error(Timestamp() + 'File upload failed: ' + err);
} else {
colog.success(Timestamp() + 'File uploaded: http://' + web_servername + ':' + web_port + web_upload_directory + '/' + filename);
callback('http://' + web_servername + ':' + web_port + web_upload_directory + '/' + filename);
}
});


});
//upload image==============================================================================
	

socket.on('keepalive', function(data, callback){
updateNicknames();
try	{
users[socket.nickname].emit('keepalive', true);
connection.query("UPDATE " + tbl_users + " set online = 1, alive = NOW() where username = '" + socket.nickname + "'");
}
catch(e) {
delete users[socket.nickname];
// colog.error("Error in keepalive: " + e);
}
callback(true);
});

//New message received==============================================================================
	socket.on('send message', function(data, callback){
		var msg = data.trim();
		if(msg == null) { msg = ""; }
		connection.query("UPDATE " + tbl_users + " set online = 1, alive = NOW(), lastpost = NOW() where username = '" + socket.nickname + "'");
//imgur scrape links=====================================================================================
// if(msg.indexOf("i.imgur.com/") != -1){

// }		
//imgur scrape links=====================================================================================

	//Whisper logic==============================================================================
	if(msg.indexOf("/uptime") >= 0){
	console.log("uptime fired");
	io.sockets.emit('system', {msg: "Server has been running for " + process.uptime() + " seconds.", nick: "system"});
	return;
	}
    if(msg.indexOf("/fabulous") >= 0){
	console.log(socket.nickname + " is FABULOUS!");
	io.sockets.emit('system', {msg: socket.nickname + ' is <b style="background-color:black;padding:3px;border-radius:5px;"><FONT COLOR="#FF0000">F</FONT><FONT COLOR="#FFAA00">A</FONT><FONT COLOR="#FFff00">B</FONT><FONT COLOR="#55ff00">U</FONT><FONT COLOR="#00ff00">L</FONT><FONT COLOR="#00ffAA">O</FONT><FONT COLOR="#00ffff">U</FONT><FONT COLOR="#00AAff">S</FONT><FONT COLOR="#0000ff">!</FONT></b>', nick: "system"});
	return;
	}
    if((msg.indexOf("/me ") >= 0) || (msg.indexOf("/me's ") >= 0)){
	console.log("emote by " + socket.nickname + ": " + msg.replace("/me",socket.nickname));
	io.sockets.emit('system', {msg: msg.replace("/me",socket.nickname), nick: "system"});
	return;
	}
	if(msg.substr(0,3) === '/w '){
			msg = msg.substr(3);
			var ind = msg.indexOf(' ');
			// colog.answer("Whisper fired");
			if(ind !== -1){
				var name = msg.substring(0, ind);
				var msg = msg.substring(ind + 1);
				// colog.success("name: " + name + "\nmsg: " + msg + "\nUsers: " + users);
				if(name in users){
					users[name].emit('whisper', {msg: msg, nick: socket.nickname, avatar: users[socket.nickname].avatar});
					users[socket.nickname].emit('whisper', {msg: msg, nick: "To " + name, avatar: users[socket.nickname].avatar});
					colog.answer(Timestamp() + 'message sent to ' + name + ' from ' + socket.nickname + ': ' + msg );
					return;
				} else{
					callback('Error!  Enter a valid user.');
					return;
				}
			} else{
				callback('Error!  Please enter a message for your whisper.');
				return;
			}
		} else{

		}
    connection.query("SELECT * FROM users WHERE username = '" + socket.nickname + "'", function(err, rows){
        if(err != null) { console.log("Query error:" + err); } 
		else {
				try {
					prefs = rows[0].prefs;
					msgID = rows[0].ID;
					avatar = rows[0].avatar;
					var sql = "INSERT INTO " + tbl_chat + " (user, url, file, message, timestamp, misc,source) VALUES (?,?,?,?,NOW(),?,'node')";
					var sql2 = "INSERT INTO " + tbl_memchat + "(user,url,file,message,timestamp,misc,id,source) VALUES(?,?,?,?,NOW(),?,(select id from chat order by timestamp desc limit 1),'node')";
					var sql3 = "DELETE FROM " + tbl_memchat + " WHERE timestamp not in ( SELECT * FROM ( SELECT timestamp FROM memchat ORDER BY timestamp desc limit 0, 100 ) as t);";
					var values = [ rows[0].username, rows[0].barvatar, rows[0].avatar, msg, rows[0].prefs ];
					
					connection.query(sql, values, function(err){ 
						if(err != null) { 
							console.log("Query error:" + err); 
						} 
						else {  
						} });
					
					connection.query(sql2, values, function(err){ 
						if(err != null) { 
							console.log("Query error:" + err); 
						} 
						else { 
						} 
					}); 
				    
					connection.query("SELECT * FROM " + tbl_memchat + " WHERE user = '" + socket.nickname + "' order by timestamp desc limit 1 ", function(err, rows){
						if(err != null) { colog.error(Timestamp() + "Query error:" + err); } else {
							try {
								io.sockets.emit('new message', {
									msg: msg, 
									nick: rows[0].user, 
									timestamp: Timestamp(), 
									prefs: prefs,
									avatar: rows[0].file,
									id: rows[0].id
									});
							} catch(err) {
								colog.warning(Timestamp() + 'Error Name: ' + err.name + "\nError Message: " + err.message + "\n"); 
							}
						}
					});
					
					connection.query(sql3, values, function(err){ 
						if(err != null) { 
							console.log("Query error:" + err); 
						} 
						else { 
						} 
					}); 
				} catch(err) {
					colog.warning(Timestamp() + 'Error Name: ' + err.name + "\nError Message: " + err.message + "\n"); 
				}

				if(lastUser != socket.nickname)
				{
					var thisColor = Colors[Math.floor(Math.random() * Colors.length)];
					lastUser = socket.nickname;
					lastColor = thisColor;
				}
				colog.format("<" + lastColor + ">" + Timestamp() + socket.nickname + ": </" + lastColor + ">" + msg); 
		}
	});
	});
//New message received==============================================================================

//Save user settings==============================================================================
socket.on('save prefs', function(data, callback){
	connection.query("UPDATE " + tbl_users + " SET prefs = '" + data + "' WHERE username = '" + socket.nickname + "'", function(err){
        if(err != null) { console.log("Query error:" + err); } 
		else {
		users[socket.nickname].emit('system', {msg: "Your setting have been saved", nick: "system"});
			callback("Settings saved");
		}
	});	
});

socket.on('save avatar', function(data, callback){
	connection.query("UPDATE " + tbl_users + " SET avatar = '" + data + "' WHERE username = '" + socket.nickname + "'", function(err){
        if(err != null) { console.log("Query error:" + err); } 
		else {
		users[socket.nickname].emit('system', {msg: "Your avatar has been updated", nick: "system"});
			callback("Settings saved");
		}
	});	
});

socket.on('save barvatar', function(data, callback){
	connection.query("UPDATE " + tbl_users + " SET barvatar = '" + data + "' WHERE username = '" + socket.nickname + "'", function(err){
        if(err != null) { console.log("Query error:" + err); } 
		else {
		users[socket.nickname].emit('system', {msg: "Your barvatar has been updated", nick: "system"});
			callback("Settings saved");
		}
	});	
});

socket.on('save email', function(data, callback){
	connection.query("UPDATE " + tbl_users + " SET email = '" + data + "' WHERE username = '" + socket.nickname + "'", function(err){
        if(err != null) { console.log("Query error:" + err); } 
		else {
		users[socket.nickname].emit('system', {msg: "Your email address has been updated", nick: "system"});
			callback("Email saved");
		}
	});	
});

socket.on('save password', function(data, callback){
	connection.query("UPDATE " + tbl_users + " SET password = '" + data + "' WHERE username = '" + socket.nickname + "'", function(err){
        if(err != null) { console.log("Query error:" + err); } 
		else {
		users[socket.nickname].emit('system', {msg: "Your password has been updated", nick: "system"});
			callback("Settings saved");
		}
	});	
});
//Save user settings==============================================================================
	
});
//Main socket loop==============================================================================

	function Timestamp() {
    var str = "";

    var currentTime = new Date()
    var hours = currentTime.getHours()
    var minutes = currentTime.getMinutes()
    var seconds = currentTime.getSeconds()

    if (minutes < 10) {
        minutes = "0" + minutes
    }
    if (seconds < 10) {
        seconds = "0" + seconds
    }
    str += hours + ":" + minutes + ":" + seconds + " ";
    return str;
}

setInterval(keepalive, 1000*60*5);
function keepalive() {
  connection.query('select 1', [], function(err, result) {
    if(err) return console.log(err);
    //colog.headerInfo(Timestamp());
  });
}

//Timed fetch for legacy support
var myVar=setInterval(function(){ fetchDB() },2000);
function fetchDB()
{
var sql = "SELECT vu.username,vu.online,u.avatar,u.score FROM " + tbl_userveiw + " vu JOIN " + tbl_users + " u ON u.username = vu.username WHERE vu.username != 'SYSTEM' AND vu.online > 0 ORDER BY vu.online";
if(fetchDB.onlinecount == undefined){ fetchDB.onlinecount = 0; }
var thisOnlineCount = 0;
var userslist = [];
var lastUserlist = [];
connection.query(sql, function(err, rows){ 
	if(err != null) { 
		colog.error(Timestamp() + "Query error:" + err); 
	} else { 
		for(var i = 0; i < rows.length; i++){
			userslist.push({name: rows[i].username, online: rows[i].online, avatar: rows[i].avatar, score: rows[i].score});
			thisOnlineCount += rows[i].online;
		}
		// console.log(userslist);
		if(fetchDB.onlinecount != thisOnlineCount){		
			fetchDB.onlinecount = thisOnlineCount;
		//colog.error("lastUserlist: " + fetchDB.lastUserlist + " - " + thisOnlineCount);
		fetchDB.onlinecount = thisOnlineCount;
			io.sockets.emit('usernames', userslist); //Object.keys(users));
		}
	} 
});
connection.query("SELECT *,date_format(timestamp,'%Y-%m-%d %T') as 'SafeDate' FROM " + tbl_chat + " where timestamp > '" + lasttimestamp + "' order by timestamp desc limit 100", function(err, rows){
        if(err != null) {
            console.log(Timestamp() + "Query error:" + err);
        } else {
		for (var i = rows.length-1, len = 0; i >= len; i--) {
			lasttimestamp = rows[i].SafeDate;
//				if(rows[i].user != "SYSTEM"){
					if(rows[i].user != "undefined"){
						if(rows[i].source != "node"){
								if(lastUser != rows[i].user)
								{
									var thisColor = Colors[Math.floor(Math.random() * Colors.length)];
									lastUser = rows[i].user;
									lastColor = thisColor;
								}
								colog.format("<" + lastColor + ">" + Timestamp() + rows[i].user + ": </" + lastColor + ">" + rows[i].message); 
								//io.sockets.emit('new message', {msg: rows[i].message, nick: rows[i].user, timestamp: lasttimestamp, avatar: rows[i].file});
								io.sockets.emit('new message', {
									msg: rows[i].message, 
									nick: rows[i].user, 
									timestamp: lasttimestamp, 
									prefs: rows[i].misc,
									avatar: rows[i].file,
									id: rows[i].id
									});
							}
						}
//					}
				}
        }
	});
}