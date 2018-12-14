var SpotifyWebApi = require('spotify-web-api-node');
var request = require('request');

// Initializing a class definition
module.exports = class Queue {

  constructor(name, id, owner, io) {
    this.name = name;
    this.nowPlaying = {};
    this.id = id;
    this.owner = owner;
    this.songs = [];
    this.users = [];
    this.timeToNextSong = 0;
    this.io = io;

    this.decrementSeconds();
  }

  decrementSeconds(){
    this.timeToNextSong--;
    console.log(this.timeToNextSong + " seconds left till song is done");
    setTimeout(this.decrementSeconds.bind(this), 1000);
  }

  track(){
    if(this.timeToNextSong < 1 && this.songs.length>0){
      let songToPlay = this.songs[0];
      let uriObject = {};
      uriObject.uris = [];
      for(let i = 0; i<this.songs.length; i++){
        uriObject.uris[i] = this.songs[i].uri;
      }

      this.owner.spotifyApi.play(uriObject)
      .then(function(data){
        if(this.songs[0]){
          console.log("playing " + data);
          this.timeToNextSong = this.songs[0].duration_ms/1000;
          this.songs.splice(0, 1);
        }
      }.bind(this), function(err) {
        console.log('Something went wrong!', err);
      });
    }else{
      this.owner.spotifyApi.getMyCurrentPlaybackState({})
      .then(function(data) {
        this.nowPlaying = data.body.item;
        if(data.body.item){
          if(this.timeToNextSong>2 || this.songs.length<1){
            this.timeToNextSong = (data.body.item.duration_ms - data.body.progress_ms)/1000;
            console.log(this.timeToNextSong + " seconds left till song is done");
          }
        }
        // Output items
        for (var user_id in this.users) {
          this.io.to(this.users[user_id].socket_id).emit("song list", this.songs);
          this.io.to(this.users[user_id].socket_id).emit("now playing", this.nowPlaying);
        }
      }.bind(this), function(err) {
        console.log('Something went wrong!', err);
      });
    }
    setTimeout(this.track.bind(this), 2000);
  }

}
