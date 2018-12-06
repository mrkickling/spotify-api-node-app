// Imports
var helperFunctions = require("./helperFunctions.js");
require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT;
const querystring = require('querystring');
var session = require('express-session');

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
    var scope = 'user-read-private user-read-email user-read-recently-played user-read-currently-playing playlist-modify-public playlist-modify-private';
    response.redirect('https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: process.env.CLIENT_ID,
        scope: scope,
        redirect_uri: REDIRECT_URI,
        //state: state
      }));
});

app.get('/auth_callback', function (request, response) {
  request.session.code = request.query.code;
  response.send(request.query.code);

  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: authToken,
      redirect_uri: "https://music-timeline.glitch.me/tracking",
      grant_type: 'authorization_code'
    },
    headers: {
      'Authorization': 'Basic ' + (new Buffer(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      var refresh_token = body.refresh_token;

      spotifyApi.setAccessToken(access_token);
      spotifyApi.setRefreshToken(refresh_token);
    }
    else{
      console.log("error: " + error);
    }
  });

});

app.get('/token_callback', function (request, response) {

}

app.get('/my_top_tracks', function (request, response) {

}

app.get('/get_code', function (request, response) {
  response.send(request.session.code);
});

var listener = app.listen(port, function(){
  console.log(`Example app listening on port ${port}!`);
});
