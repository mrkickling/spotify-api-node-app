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

// Store users and queues in these arrays
var users = [];
var queues = [];

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

// The object we'll use to interact with the API
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
  response.render('index', {});
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
          redirect_uri: 'http://localhost:'+port+'/get_access',
          //state: state
        }));
    }else if(request.query.code){
      request.session.identifier = makeid(16);
      new_user = new UserHandler(request.session.identifier);
      new_user.initializeAPI(request.query.code);
      users[request.session.identifier] = new_user;
      response.render('create-new-queue', {});
    }
});

app.post('/create-queue', function (request, response) {
  if(request.session.identifier){
    let queue_identifier = makeid(6);
    let curr_user = users[request.session.identifier];
    let name = request.body['queue-name'];

    let new_queue = new Queue(name, queue_identifier, curr_user, io);
    new_queue.track();

    queues[queue_identifier] = new_queue;

    response.redirect('party/' + queue_identifier);
  }else{
    response.redirect("/");
  }
});

app.get('/party/:party_code', function (request, response) {
  let queue_identifier = request.params.party_code;
  let queue = queues[queue_identifier];
  if(queue){
    response.cookie('current_queue', queue_identifier);
    response.render('party-queue', queue);
  }else{
    response.redirect("/");
  }
});

app.get('/search/:term', function (request, response) {
  let term = request.params.term;
  spotifyApi.searchTracks(term, {limit: 5}).then(
    function(data) {
      response.send(data.body);
    },
    function(err) {
      console.log('Something went wrong!', err);
    }
  );

});

http.listen(port, function(){
  console.log('listening on *:' + port);
});

io.on('connection', function(socket){
  console.log('User connected');

  socket.on('im here', function(data){
    let user_id = data.user_id;
    let queue_id = data.queue;

    let queue = queues[queue_id];

    if(queue.users[user_id]){
      queue.users[user_id].socket_id = socket.id;
    }else{
      let new_user = {}
      new_user.user_id = user_id;
      new_user.socket_id = socket.id;
      queue.users[user_id] = new_user;
    }
    io.to(socket.id).emit("song list", queue.songs);
    io.to(socket.id).emit("now playing", queue.nowPlaying);
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

    data.song.added_by = added_by;
    queue.songs[queue.songs.length] = data.song;

    // Send new song list to each user in queue
    for (var user_id in queue.users) {
      io.to(queue.users[user_id].socket_id).emit("song list", queue.songs);
      io.to(queue.users[user_id].socket_id).emit("now playing", queue.nowPlaying);
    }

  });

  socket.on('delete song', function(data){
    let queue = queues[data.queue];
    if(!queue){
      return;
    }
    let deleter_id = data.user_id;

    for(var song_index = 0; song_index<queue.songs.length; song_index++){
      let curr_song = queue.songs[song_index];
      // Don't allow duplicates in queue
      if(data.song.id == curr_song.id){
        if(data.song.added_by == deleter_id){
          queue.songs.splice(song_index, 1);
        }
      }
    }

    // Send new song list to each user in queue
    for (var user_id in queue.users) {
      io.to(queue.users[user_id].socket_id).emit("song list", queue.songs);
      io.to(queue.users[user_id].socket_id).emit("now playing", queue.nowPlaying);
    }

  });
});

function makeid(length) {
  var text = "";
  var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
