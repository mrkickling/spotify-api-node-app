// Imports
var UserHandler = require("./userHandler.js");
var Queue = require("./queueHandler.js");
require('dotenv').config();

const express = require('express');
const path = require('path');
const port = process.env.PORT;
const querystring = require('querystring');
const bcrypt = require('bcrypt');
var session = require('express-session');
var hbs = require('express-handlebars');
var SpotifyWebApi = require('spotify-web-api-node');
var sanitizeHtml = require('sanitize-html');

// Store users and queues in these arrays
var users = [];
var queues = {};

const app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  cookie: { maxAge: false },
  resave: false,
  saveUninitialized: true
});
// Session settings for server
app.use(sessionMiddleware);

io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});
// View engine settings for server
app.set('view engine', '.hbs');
app.engine('.hbs', hbs({
  extname: '.hbs',
  layoutsDir: path.join(__dirname, 'views')
}));

// Other settings for server
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.set('views', __dirname + '/views')

// The app object we'll use to interact with the API
var spotifyApi = new SpotifyWebApi({
  clientId : process.env.CLIENT_ID,
  clientSecret : process.env.CLIENT_SECRET
});

// Using the Client Credentials auth flow, authenticate our app
spotifyApi.clientCredentialsGrant()
  .then(function(data) {
    // Save the access token so that it's used in future calls
    spotifyApi.setAccessToken(data.body['access_token']);
  }, function(err) {
    console.log('Something went wrong when retrieving an access token', err.message);
  });

// API REQUESTS
app.get("/", function (request, response) {
  response.render('index', {queues:queues, test:"hej"});
});

app.get('/get_access', function (request, response) {
    // your application requests authorization
    if(!request.query.code){
      var scope = 'user-read-private user-read-email user-modify-playback-state user-read-recently-played user-read-currently-playing user-read-playback-state playlist-modify-public playlist-modify-private user-top-read';
      response.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
          response_type: 'code',
          client_id: process.env.CLIENT_ID,
          scope: scope,
          redirect_uri: 'http://'+process.env.HOST+':'+port+'/get_access',
          //state: state
        }));
    }else if(request.query.code){
      request.session.identifier = makeid(16);
      new_user = new UserHandler(request.session.identifier, 'http://'+process.env.HOST+':'+port+'/get_access');
      new_user.initializeAPI(request.query.code);
      users[request.session.identifier] = new_user;
      response.render('create-new-queue', {});
    }
});

app.post('/create-queue', function (request, response) {
  if(request.session.identifier){
    let queue_identifier = makeid(6);
    let curr_user = users[request.session.identifier];
    let name = sanitizeHtml(request.body['queue-name']);

    let admin_user = {}
    admin_user.name = "admin";
    admin_user.user_token = request.session.identifier;
    admin_user.socket_id = null;

    let new_queue = new Queue(name, queue_identifier, curr_user, admin_user, io);
    new_queue.track();

    queues[queue_identifier] = new_queue;

    response.cookie('user_id', admin_user.name);
    response.cookie('user_token', admin_user.user_token);
    response.redirect('party/' + queue_identifier);
  }else{
    response.redirect("/");
  }
});

app.get('/party/:party_code', function (request, response) {
  let queue_identifier = request.params.party_code;
  let queue = queues[queue_identifier];
  if(queue){
    response.render('party-queue', queue);
  }else{
    response.redirect("/");
  }
});

app.get('/subscribe/:party_code/:user_id', function (request, response) {
  let queue_identifier = request.params.party_code;
  let user_id = request.params.user_id;

  if(!queues[queue_identifier]){
    response.send("Problem:D");
  }

  // Check user password somehow

  request.session.subscribing_to = queue_identifier;
  request.session.user_id = user_id;
  var scope = 'user-read-private user-read-email user-modify-playback-state user-read-recently-played user-read-currently-playing user-read-playback-state playlist-modify-public playlist-modify-private user-top-read';
  response.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.CLIENT_ID,
      scope: scope,
      redirect_uri: 'http://'+process.env.HOST+':'+port+'/subscribe-callback',
      //state: state
    }));
});

app.get('/subscribe-callback', function (request, response) {
  let queue_identifier = request.session.subscribing_to;
  let queue = queues[queue_identifier];

  if(request.session.subscribing_to && request.session.user_id && request.query.code){
    new_user = new UserHandler(request.session.user_id, 'http://'+process.env.HOST+':'+port+'/subscribe-callback');
    new_user.initializeAPI(request.query.code);
    queue.addSubscriber(new_user);
    response.redirect('party/' + queue_identifier);
  }else{
    response.send("Error!");
  }
});



app.get('/search/:queue/:term', function (request, response) {
  let queue = queues[request.params.queue];
  let term = request.params.term;
  queue.owner.spotifyApi.searchTracks(term, {limit: 8}).then(
    function(data) {
      response.send(data.body);
    },
    function(err) {
      console.log('Something went wrong!', err);
    }
  );

});

http.listen(port, function(){
  console.log('listening on '+process.env.HOST+':' + port);
});

io.on('connection', function(socket){
  console.log('User connected');

  socket.on('im here', function(data){
    let user_id = sanitizeHtml(data.user_id);
    let user_token = data.user_token;
    let queue_id = data.queue;

    let queue = queues[queue_id];

    if(queue.users[user_id] && queue.users[user_id].token == user_token){
      queue.users[user_id].socket_id = socket.id;
    }else{
      let new_user = {}
      new_user.user_id = user_id;
      new_user.token = user_token;
      new_user.socket_id = socket.id;
      queue.users[user_id] = new_user;
    }

    subscriber_ids = [];
    for(var i=0; i<queue.subscribers.length; i++){
      subscriber_ids[i] = queue.subscribers[i].identifier;
    }

    io.to(socket.id).emit("song list", queue.songs);
    io.to(socket.id).emit("queue info", { admin: queue.admin.name, subscribers:subscriber_ids });
    io.to(socket.id).emit("now playing", {song: queue.nowPlaying, playing: queue.isPlaying});
  });

  socket.on('add song', function(data){
    let queue = queues[data.queue];
    if(!queue){
      return;
    }
    let added_by = data.added_by;

    for(var song_index = 0; song_index<queue.songs.length; song_index++){
      let curr_song = queue.songs[song_index];
      // Don't allow duplicates in queue
      if(data.song.id == curr_song.id){
        return;
      }
      // Don't allow several songs added by same person
      // if(added_by == curr_song.added_by){
      //   return;
      // }
    }

    queue.addSong(data.song, added_by);
    io.to(socket.id).emit("song list", queue.songs);

  });

  socket.on('delete song', function(data){
    let queue = queues[data.queue];
    if(!queue){
      return;
    }
    let deleter_id = sanitizeHtml(data.user_id);
    let deleter_token = data.user_token;

    let admin_user = queue.admin;
    let isAdmin = (admin_user.name == deleter_id && admin_user.user_token == deleter_token);

    if(queue.users[deleter_id].user_token != deleter_token && !isAdmin){
      return;
    }

    for(var song_index = 0; song_index<queue.songs.length; song_index++){
      let curr_song = queue.songs[song_index];
      // Don't allow duplicates in queue
      if(data.song.id == curr_song.id){
        if(data.song.added_by == deleter_id || isAdmin){
          queue.songs.splice(song_index, 1);
        }
      }
    }
    io.to(socket.id).emit("song list", queue.songs);

  });

  socket.on('pause', function(data){
    queue = queues[data.queue];
    if(socket_is_admin(data)){
      queue.pause();
      update_all_users_in_queue(queue)
    }
  });

  socket.on('play', function(data){
    queue = queues[data.queue];
    if(socket_is_admin(data)){
      queue.play();
      update_all_users_in_queue(queue)
    }
  });

  socket.on('next', function(data){
    queue = queues[data.queue];
    if(socket_is_admin(data)){
      queue.next();
      update_all_users_in_queue(queue)
    }
  });

  socket.on('delete', function(data){
    queue = queues[data.queue];
    if(socket_is_admin(data)){
      console.log("deleting queue now")
      let remove_user = queue.admin.user_id;
      queue.delete();
      delete users[remove_user];
      delete queues[data.queue];
    }
  });

  socket.on('unsubscribe', function(data){
    let queue = queues[data.queue];
    let subscribers = queue.subscribers;
    console.log("user "+ data.user_id +" unsubscribed");
    for(var i=0; i<subscribers.length; i++){
      subscribers[i].stop();
      subscribers.splice(i, 1);
    }
  });

  socket.on('upvote song', function(data){
    queue = queues[data.queue];

    let user_id = sanitizeHtml(data.user_id);
    let user_token = data.user_token;

    if(queue.users[user_id].user_token != user_token && !socket_is_admin(data)){
      return;
    }else{
      queue.upvoteSong(data.song.id, user_id)
    }
  });

  socket.on('downvote song', function(data){
    queue = queues[data.queue];

    let user_id = sanitizeHtml(data.user_id);
    let user_token = data.user_token;

    if(queue.users[user_id].user_token != user_token && !socket_is_admin(data)){
      return;
    }else{
      queue.downvoteSong(data.song.id, user_id)
    }
  });

});

function update_all_users_in_queue(queue){
  for (var user_id in queue.users) {
    io.to(queue.users[user_id].socket_id).emit("now playing", {song:queue.nowPlaying, playing:queue.isPlaying});
  }
}

function socket_is_admin(data){
  let queue = queues[data.queue];
  if(!queue){
    return false;
  }
  let socket_id = data.user_id;
  let socket_token = data.user_token;
  let admin_user = queue.admin;
  if(admin_user.name == socket_id && admin_user.user_token == socket_token){
    return true;
  }
  return false;

}

function makeid(length) {
  var text = "";
  var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
