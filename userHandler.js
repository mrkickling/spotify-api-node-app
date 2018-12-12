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
  }
}
