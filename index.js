// Imports
require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT;
const querystring = require('querystring');

app.use(express.static('public'));
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

// Initialize Spotify API wrapper
var SpotifyWebApi = require('spotify-web-api-node');
var redirect_uri = "http://localhost:3000/callback"
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
        redirect_uri: redirect_uri,
        //state: state
      }));
});

app.get('/callback', function (request, response) {
  response.send(response);
});

var listener = app.listen(port, function(){
  console.log(`Example app listening on port ${port}!`);
});
