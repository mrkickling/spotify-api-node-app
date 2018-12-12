// Imports
var UserHandler = require("./userHandler.js");
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

// Session settings for server
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: { maxAge: false },
  resave: false,
  saveUninitialized: true
}))
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
      var scope = 'user-read-private user-read-email user-read-recently-played user-read-currently-playing playlist-modify-public playlist-modify-private user-top-read';
      response.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
          response_type: 'code',
          client_id: process.env.CLIENT_ID,
          scope: scope,
          redirect_uri: 'http://localhost:3000/get_access',
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
    let hash = bcrypt.hashSync(request.body['queue-password'], 10);

    let new_queue = {};
    new_queue.name = name;
    new_queue.id = queue_identifier;
    new_queue.admin = curr_user;
    new_queue.songs = [];
    new_queue.users = [];

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

http.listen(3000, function(){
  console.log('listening on *:3000');
});

io.on('connection', function(socket){
  console.log('a user connected');

  socket.on('im here', function(queue_id){
    let queue = queues[queue_id];
    queue.users[queue.users.length] = socket.id;
    io.to(socket.id).emit("song list", queue.songs);
  });

  socket.on('add song', function(data){
    let queue = queues[data.queue];
    queue.songs[queue.songs.length] = data.id;
    for(var i=0; i<queue.users.length; i++){
      let curr_user = queue.users[i];
      io.to(curr_user).emit("song list", queue.songs);
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
