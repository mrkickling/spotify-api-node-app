// Imports
var helperFunctions = require("./helperFunctions.js");
import {User} from "./userHandler.js";
require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT;
const querystring = require('querystring');
var session = require('express-session');
var users = [];

app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: { maxAge: false },
  resave: false,
  saveUninitialized: true
}))

app.use(express.static('public'));
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

// Initialize Spotify API wrapper
var SpotifyWebApi = require('spotify-web-api-node');
var REDIRECT_URI = "http://localhost:3000/callback";

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
    console.log('Got an access token: ' + spotifyApi.getAccessToken());

  }, function(err) {
    console.log('Something went wrong when retrieving an access token', err.message);
  });

// API REQUESTS
app.get('/get_access', function (request, response) {
    // your application requests authorization
    if(!request.query.code){
      var scope = 'user-read-private user-read-email user-read-recently-played user-read-currently-playing playlist-modify-public playlist-modify-private';
      response.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
          response_type: 'code',
          client_id: process.env.CLIENT_ID,
          scope: scope,
          redirect_uri: 'http://localhost:3000/get_access',
          //state: state
        }));
    }else if(request.query.code){
      request.session.identifier = makeid();
      new_user = new User(request.session.identifier);
      users[request.session.identifier] = new_user;
    }
});

app.get('/auth_callback', function (request, response) {
  response.send(request.query.code);
});

app.get('/token_callback', function (request, response) {

});

app.get('/my_top_tracks', function (request, response) {

});

app.get('/get_code', function (request, response) {
  response.send(request.session.code);
});

var listener = app.listen(port, function(){
  console.log(`Example app listening on port ${port}!`);
});

function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 16; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}
