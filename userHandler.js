var SpotifyWebApi = require('spotify-web-api-node');
var request = require('request');
require('dotenv').config();

var REDIRECT_URI = "http://"+process.env.HOST+":"+process.env.PORT+"/get_access";

// Initializing a class definition
module.exports = class User {

  constructor(identifier) {
    this.identifier = identifier;
    this.spotifyApi = new SpotifyWebApi({
      clientId : process.env.CLIENT_ID,
      clientSecret : process.env.CLIENT_SECRET,
      redirectUri: REDIRECT_URI
    });
  }

  // Adding a method to the constructor
  initializeAPI(code) {
    this.spotifyApi.authorizationCodeGrant(code).then(
      function(data) {
        // Set the access token on the API object to use it in later calls
        this.spotifyApi.setAccessToken(data.body['access_token']);
        this.spotifyApi.setRefreshToken(data.body['refresh_token']);
        setTimeout(this.refreshToken.bind(this), 5000);
      }.bind(this),
      function(err) {
        console.log('Something went wrong when authorizing user!', err);
      }
    );
  }

  refreshToken(){
    this.spotifyApi.refreshAccessToken().then(
      function(data) {
        console.log('The access token has been refreshed!');
        // Save the access token so that it's used in future calls
        this.spotifyApi.setAccessToken(data.body['access_token']);
        this.spotifyApi.setRefreshToken(data.body['refresh_token']);
        this.expires_in = data.body['expires_in'];
        setTimeout(this.refreshToken.bind(this), 900*this.expires_in);
      }.bind(this),
      function(err) {
        console.log('Could not refresh access token', err);
      }
    );

  }
}

function makeid(length) {
  var text = "";
  var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
