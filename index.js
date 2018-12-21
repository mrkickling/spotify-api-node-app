// Imports
var UserHandler = require("./userHandler.js");
var Queue = require("./queueHandler.js");
require('dotenv').config();

const fs = require('fs');
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

if(process.env.HOST != "http://localhost:3000"){
  function requireHTTPS(req, res, next) {
    // The 'x-forwarded-proto' check is for Heroku
    if (!req.secure && req.get('x-forwarded-proto') !== 'https' && process.env.NODE_ENV !== "development") {
      return res.redirect(process.env.HOST + req.url);
    }
    next();
  }
  app.use(requireHTTPS);

  // Certificate
  const privateKey = fs.readFileSync('/etc/letsencrypt/live/partyqueue.co/privkey.pem', 'utf8');
  const certificate = fs.readFileSync('/etc/letsencrypt/live/partyqueue.co/cert.pem', 'utf8');
  const ca = fs.readFileSync('/etc/letsencrypt/live/partyqueue.co/chain.pem', 'utf8');

  const credentials = {
  	key: privateKey,
  	cert: certificate,
  	ca: ca
  };

  var https = require('https').Server(credentials, app);
  io = require('socket.io')(https);

  https.listen(443, () => {
  	console.log('HTTPS Server running on port 443');
  });
}


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
    console.log('Something went wrong when retrieving an access token for app', err.message);
  });

// API REQUESTS
app.get("/", function (request, response) {
  let admin_for = false;
  let not_logged_in = true;
  if(request.session.user_id && users[request.session.user_id]){
    let user = users[request.session.user_id];
    not_logged_in = false;
    console.log("User exists, adding info to frontpage");
    if(user && user.is_admin_for){
      admin_for = queues[user.is_admin_for];
    }
  }
  response.render('index', {queues:queues, admin_for:admin_for, not_logged_in:not_logged_in});
});

app.get('/login', function (request, response) {
    // your application requests authorization
    if(!request.query.code){
      var scope = 'user-read-private user-read-birthdate user-read-email user-modify-playback-state user-read-recently-played user-read-currently-playing user-read-playback-state playlist-modify-public playlist-modify-private user-top-read';
      response.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
          response_type: 'code',
          client_id: process.env.CLIENT_ID,
          scope: scope,
          redirect_uri: process.env.HOST+'/login',
        }));
    }else if(request.query.code){
      new_user = new UserHandler(process.env.HOST + '/login');
      new_user.initializeAPI(request.query.code, function(){
        request.session.user_id = new_user.user_id;
        if(users[new_user.user_id]){
            request.session.user_token = users[new_user.user_id].user_token;
            response.cookie('user_id', new_user.user_id, { path: '/party/' });
            response.cookie('user_token', users[new_user.user_id].user_token, { path: '/party/' });
            response.redirect('/');
            return;
          }else
          if(!request.session.user_token){
            request.session.user_token = makeid(16);
          }
          new_user.user_token = request.session.user_token;
          console.log(new_user.user_id + " is new spotify account user");
          users[request.session.user_id] = new_user;
          response.redirect('/');
      });
    }
});

app.get('/logout', function (request, response) {
  request.session.destroy();
  response.clearCookie("user_id", { path: '/party/' });
  response.clearCookie("user_token", { path: '/party/' });
  response.redirect('/');
});

app.get('/get_access', function (request, response) {
    // your application requests authorization
    if(!request.query.code){
      var scope = 'user-read-private user-read-birthdate user-read-email user-modify-playback-state user-read-recently-played user-read-currently-playing user-read-playback-state playlist-modify-public playlist-modify-private user-top-read';
      response.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
          response_type: 'code',
          client_id: process.env.CLIENT_ID,
          scope: scope,
          redirect_uri: process.env.HOST+'/get_access',
        }));
    }else if(request.query.code){
      new_user = new UserHandler(process.env.HOST+'/get_access');
      new_user.initializeAPI(request.query.code, function(){
        request.session.user_id = new_user.user_id;
        if(users[new_user.user_id]){
          request.session.user_token = users[new_user.user_id].user_token;
          response.redirect('/create-new-queue');
          return;
        }else if(!request.session.user_token){
          request.session.user_token = makeid(16);
        }
        new_user.user_token = request.session.user_token;
        console.log(new_user.user_id + " is new spotify account user");
        users[request.session.user_id] = new_user;
        response.redirect('/create-new-queue');
      });
    }
});

app.get('/create-new-queue', function (request, response) {
  response.render('create-new-queue', {});
});

app.post('/create-queue', function (request, response) {
  if(request.session.user_id && request.session.user_token){
    let user_id = request.session.user_id;
    let user_token = request.session.user_token;
    if(users[user_id] && users[user_id].user_token == user_token){
      if(users[user_id].subscribed_to){
        let error_msg = "You are already subscribed to a queue. Unsubscribe from that queue to administrate a new one. <a href='/party/" +users[user_id].subscribed_to+ "'>Go back to that queue</a>";
        response.render('error-page', {error:error_msg});
        return;
      }
      if(users[user_id].is_admin_for){
        let error_msg = "You are already admin in a queue that you have to delete if you want to create a new one! <a href='/party/" +users[user_id].is_admin_for+ "'>Go back to that queue</a>.";
        response.render('error-page', {error:error_msg});
        return;
      }
    }
  }

  if(request.session.user_id){
    let queue_identifier = makeid(6);
    let curr_user = users[request.session.user_id];
    curr_user.is_admin_for = queue_identifier;
    let name = sanitizeHtml(request.body['queue-name']);
    let is_public = sanitizeHtml(request.body['public']);
    console.log(is_public);

    let new_queue = new Queue(name, queue_identifier, curr_user, io);
    new_queue.track();
    if(is_public == "public"){
      new_queue.is_public = true;
      console.log("The queue will be public.")
    }
    queues[queue_identifier] = new_queue;

    response.cookie('user_id', curr_user.user_id, { path: '/party/' });
    response.cookie('user_token', curr_user.user_token, { path: '/party/' });
    response.redirect('party/' + queue_identifier);
  }else{
    response.redirect("/");
  }
});

app.get('/party/:party_code', function (request, response) {
  let queue_identifier = request.params.party_code;
  let queue = queues[queue_identifier];
  if(!queue){
    response.redirect("/");
  }else{
    let admin_user = queue.admin;

    if(request.session.user_id && request.session.user_token){
      let access_token = undefined;
      let current_user = users[request.session.user_id];
      if(current_user.spotifyApi.getAccessToken()){
        access_token = current_user.spotifyApi.getAccessToken()
      }

      if(request.session.user_id == admin_user.user_id &&
        request.session.user_token == admin_user.user_token){
        response.render('party-queue-admin', {queue: queue, access_token: access_token});
      }
      else{
        response.render('party-queue', {queue: queue, access_token: access_token});
      }
    }
    else{
      response.render('party-queue', {queue: queue});
    }
  }
});

app.post('/subscribe/:party_code', function (request, response) {
  let queue_identifier = request.params.party_code;
  let queue = queues[queue_identifier];
  if(!queue){
    let error_msg = "That queue that your trying to subscribe to doesn't exist. I'm very sorry about this. You will make it through, i promise. <3";
    response.render('error-page', {error:error_msg});
  }

  let user_id = sanitizeHtml(request.body['user_id']);
  let user_token = sanitizeHtml(request.body['user_token']);

  // Remove user from queue if exists
  queue.removeUser(user_id, user_token);
  delete users[user_id];

  request.session.subscribing_to = queue_identifier;
  var scope = 'streaming user-read-private user-read-email user-modify-playback-state user-read-recently-played user-read-currently-playing user-read-playback-state playlist-modify-public playlist-modify-private user-top-read';
  response.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.CLIENT_ID,
      scope: scope,
      redirect_uri: process.env.HOST+'/subscribe-callback',
      //state: state
    }));
});

app.get('/subscribe-callback', function (request, response){
  let queue_identifier = request.session.subscribing_to;
  let queue = queues[queue_identifier];

  if(queue && request.query.code){
    let new_user = new UserHandler(process.env.HOST+'/subscribe-callback');
    new_user.initializeAPI(request.query.code, function(){
      request.session.user_id = new_user.user_id;
      if(users[new_user.user_id]){
          console.log(new_user.user_id + " is already a user, logging in");
          request.session.user_token = users[new_user.user_id].user_token;
          response.cookie('user_id', new_user.user_id, { path: '/party/' });
          response.cookie('user_token', users[new_user.user_id].user_token, { path: '/party/' });
        }else{
          request.session.user_token = makeid(16);
          new_user.user_token = request.session.user_token;
          console.log(new_user.user_id + " is new spotify account user - subscriber");
          users[request.session.user_id] = new_user;
          response.cookie('user_id', new_user.user_id, { path: '/party/' });
          response.cookie('user_token', new_user.user_token, { path: '/party/' });
        }
      queue.addSubscriber(users[request.session.user_id])
      response.redirect('/party/' + queue_identifier);

    });
  }else{
    let error_msg = "Error subscribing! No queue found or no login found. <a href='party/"+ queue_identifier +"'>Go back to queue</a> ";
    response.render('error-page', {error:error_msg});
  }
});

app.get('/search/:queue/:term', function (request, response) {
  let queue = queues[request.params.queue];
  if(!queue){
    request.send("[{name: 'Error on search!'}]");
  }
  let term = request.params.term;
  queue.admin.spotifyApi.searchTracks(term, {limit: 8}).then(
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

  socket.on('im here', function(data){
    let user_id = sanitizeHtml(data.user_id);
    let user_token = data.user_token;
    let queue_id = data.queue;
    let queue = queues[queue_id];

    if(!queue){
      console.log("No queue exists with this name");
      return;
    }

    if(users[user_id]){
      if(users[user_id].user_token == user_token){
        console.log("Adding user " + user_id + " with token " + user_token + " to queue " + queue.name);
        users[user_id].socket_id = socket.id;
        if(get_user(user_id, queue.users)){
          for(i in queue.users){
            if(queue.users[i].user_id == user_id){
              queue.users[i] = users[user_id];
            }
          }
        }else{
          queue.users[queue.users.length] = users[user_id];
        }
      }else{
        console.log(user_token + " is wrong, should be " + get_user(user_id, queue.users).user_token);
        io.to(socket.id).emit("wrong token", queue.songs);
      }

    }else{
      console.log("Creating user " + user_id + " with token " + user_token + " to queue " + queue.name);
      let new_user = new UserHandler(process.env.HOST+'/subscribe-callback');
      new_user.user_id = user_id;
      new_user.user_token = user_token;
      new_user.socket_id = socket.id;
      queue.users[queue.users.length] = new_user;
      users[user_id] = new_user;
    }

    subscriber_ids = [];
    for(var i=0; i<queue.subscribers.length; i++){
      subscriber_ids[i] = queue.subscribers[i].user_id;
    }

    if(users[user_id].spotifyApi.getAccessToken()){
      console.log("Sending access token");
      io.to(socket.id).emit("access token", users[user_id].spotifyApi.getAccessToken());
    }

    io.to(socket.id).emit("song list", queue.songs);
    io.to(socket.id).emit("queue info", { admin: queue.admin.name, subscribers:subscriber_ids });
    io.to(socket.id).emit("now playing", {song: queue.nowPlaying, playing: queue.isPlaying});
  });

  socket.on('add song', function(data){
    let queue = queues[data.queue];
    let added_by = data.added_by;
    let added_by_token = data.user_token;
    let added_by_user = get_user(added_by, queue.users);

    if(!queue || !added_by_user || added_by_token != added_by_user.user_token){
      console.log("Problem with auth");
      return;
    }

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
  });

  socket.on('delete song', function(data){
    let queue = queues[data.queue];
    if(!queue){
      return;
    }
    let deleter_id = sanitizeHtml(data.user_id);
    let deleter_token = data.user_token;
    let deleter_user = get_user(deleter_id, queue.users)

    let admin_user = queue.admin;
    let isAdmin = (admin_user.user_id == deleter_id && admin_user.user_token == deleter_token);

    if(deleter_user.user_token != deleter_token && !isAdmin){
      return;
    }

    for(var song_index = 0; song_index<queue.songs.length; song_index++){
      let curr_song = queue.songs[song_index];
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
      queue.pause(socket, function(){
        update_all_users_in_queue(queue);
      });
    }
  });

  socket.on('play', function(data){
    queue = queues[data.queue];
    if(socket_is_admin(data)){
      queue.play(socket, function(){
        update_all_users_in_queue(queue);
      });
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
      queue.delete();
      delete queues[data.queue];
    }
  });

  socket.on('unsubscribe', function(data){
    let queue = queues[data.queue];
    let subscribers = queue.subscribers;
    console.log("user "+ data.user_id +" unsubscribed");
    for(var i=0; i<subscribers.length; i++){
      if(data.user_id == subscribers[i].user_id){
        subscribers[i].stop();
        subscribers.splice(i, 1);
      }
    }
  });

  socket.on('upvote song', function(data){
    queue = queues[data.queue];

    let user_id = data.user_id;
    let user_token = data.user_token;
    let upvoter_user = get_user(user_id, queue.users);
    console.log(user_id + " trying to upvote");
    console.log(user_token + " is token");
    console.log("should be " + upvoter_user.user_token);
    if(upvoter_user.user_token != user_token && !socket_is_admin(data)){
      return;
    }else{
      queue.upvoteSong(data.song.id, upvoter_user);
      update_all_users_in_queue(queue);
    }
  });

  socket.on('downvote song', function(data){
    queue = queues[data.queue];

    let user_id = sanitizeHtml(data.user_id);
    let user_token = data.user_token;
    let downvoter_user = get_user(user_id, queue.users);

    if(downvoter_user.user_token != user_token && !socket_is_admin(data)){
      return;
    }else{
      queue.downvoteSong(data.song.id, downvoter_user);
      update_all_users_in_queue(queue);
    }
  });

});

function get_user(user_id, users_list){
  for(let i=0; i<users_list.length; i++){
    if(users_list[i].user_id == user_id){
      return users_list[i];
    }
  }
  return false;
}

function update_all_users_in_queue(queue){
  io.to(queue.admin.socket_id).emit("now playing", {song:queue.nowPlaying, playing:queue.isPlaying});
  io.to(queue.admin.socket_id).emit("song list", queue.songs);

  for (var user_id in queue.users) {
    io.to(queue.users[user_id].socket_id).emit("now playing", {song:queue.nowPlaying, playing:queue.isPlaying});
    io.to(queue.users[user_id].socket_id).emit("song list", queue.songs);
  }
}

function socket_is_admin(data){
  let queue = queues[data.queue];
  if(!queue){
    return false;
  }
  let cookie_id = data.user_id;
  let cokie_token = data.user_token;
  let admin_user = queue.admin;
  if(admin_user.user_id == cookie_id && admin_user.user_token == cokie_token){
    return true;
  }
  return false;
}

function remove_inactive_queues(){
  let keys = Object.keys(queues)
  for(let i=0; i<keys.length; i++) {
    let key = keys[i];
    let curr_queue = queues[key];
    if(curr_queue.inactiveTime > 2000){
      console.log(curr_queue.name + " was inactive for too long! Deleting.");
      curr_queue.delete();
      delete queues[key];
    }
  }
  setTimeout(remove_inactive_queues, 60000);
}

function makeid(length) {
  var text = "";
  var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

// Start helper function
remove_inactive_queues();
