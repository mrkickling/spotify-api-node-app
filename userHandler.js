var SpotifyWebApi = require('spotify-web-api-node');
var request = require('request');
var REDIRECT_URI = "http://localhost:3000/get_access";

// Initializing a class definition
module.exports = class User {

  constructor(identifier) {
    this.identifier = identifier;
    this.spotifyApi = new SpotifyWebApi();
  }

  // Adding a method to the constructor
  initializeAPI(code) {
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: REDIRECT_URI,
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

        this.spotifyApi.setAccessToken(access_token);
        this.spotifyApi.setRefreshToken(refresh_token);
      }
      else{
        console.log("error: " + error + response.statusCode);
      }
    }.bind(this));
    setTimeout(this.refreshToken.bind(this), 5000);
  }

  refreshToken(){
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        grant_type: 'refresh_token',
        refresh_token: this.spotifyApi.getRefreshToken()
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
      },
      json: true
    };
    request.post(authOptions, function(error, response, body) {
      if (response.statusCode == 200) {
        var access_token = body.access_token;
        var refresh_token = body.refresh_token;
        console.log("Got new access token!");
        this.spotifyApi.setAccessToken(access_token);
        this.spotifyApi.setRefreshToken(refresh_token);
        this.expires_in = body.expires_in;
        console.log("Expires in " + this.expires_in + "seconds");
      }
      else{
        console.log("error: " + error + response.statusCode);
      }
    }.bind(this));
    setTimeout(this.refreshToken.bind(this), 900*this.expires_in);
  }
}

function makeid(length) {
  var text = "";
  var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
