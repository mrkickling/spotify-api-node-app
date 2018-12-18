var SpotifyWebApi = require('spotify-web-api-node');
var request = require('request');

// Initializing a class definition
module.exports = class Queue {

  constructor(name, id, owner, admin, io) {
    this.name = name;
    this.nowPlaying = {};
    this.id = id;
    this.owner = owner;
    this.admin = admin;
    this.songs = [];
    this.users = [];
    this.timeToNextSong = 0;
    this.io = io;
    this.isPlaying = false;
    this.subscribers = [];

    this.decrementSeconds();
  }

  decrementSeconds(){
    this.timeToNextSong--;
    setTimeout(this.decrementSeconds.bind(this), 1000);
  }

  track(){
    if(this.owner == null){
      return;
    }
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
          this.nowPlaying = this.songs[0];
          this.timeToNextSong = this.songs[0].duration_ms/1000;
          this.songs.splice(0, 1);
        }
      }.bind(this), function(err) {
        console.log('Could not get "now playing" for ' + this.owner.identifier, err);
      });

      this.playForSubs(uriObject);

    }else{
      this.owner.spotifyApi.getMyCurrentPlaybackState({})
      .then(function(data) {

        this.isPlaying = data.body.is_playing;
        this.nowPlaying = data.body.item;

        for(let i = 0; i<this.songs.length; i++){
          if(this.songs[i].id == this.nowPlaying.id){
            this.songs.splice(i, 1);
          }
        }

        if(data.body.item){
          if(this.timeToNextSong>2 || this.songs.length<1){
            this.timeToNextSong = (data.body.item.duration_ms - data.body.progress_ms)/1000;
          }
        }
      }.bind(this), function(err) {
        console.log('Could not get current playback for ' + this.owner.identifier, err);
      });
    }
    // Output items
    for (var user_id in this.users) {
      this.io.to(this.users[user_id].socket_id).emit("song list", this.songs);
      this.io.to(this.users[user_id].socket_id).emit("now playing", {song:this.nowPlaying, playing:this.isPlaying});
    }

    setTimeout(this.track.bind(this), 1500);
  }
  addSong(song, added_by){
    song.added_by = added_by;
    song.upvotes = [];
    song.downvotes = [];
    song.points = 0;
    this.songs[this.songs.length] = song;
    this.songs.sort(compare);
  }

  pause(){
    this.owner.spotifyApi.pause({})
    .then(function(data){

    }.bind(this), function(err) {
      console.log('Could not pause!', err);
    });
  }

  play(){
    this.owner.spotifyApi.play({})
    .then(function(data){

    }.bind(this), function(err) {
      console.log('Could not play!', err);
    });
  }

  next(){
    this.timeToNextSong = 0;
  }

  upvoteSong(song_id, user_id){
    for(let i = 0; i<this.songs.length; i++){
      let curr_song = this.songs[i];
      if(curr_song.id == song_id){
        if(curr_song.upvotes.includes(user_id)){
          console.log("Already upvoted!");
          return;
        }
        curr_song.upvotes[curr_song.upvotes.length] = user_id;
        curr_song.points = curr_song.upvotes.length - curr_song.downvotes.length;
        this.songs.sort(compare);
        this.io.to(this.users[user_id].socket_id).emit("song list", this.songs);
        return;
      }
    }
  }

  downvoteSong(song_id, user_id){
    for(let i = 0; i<this.songs.length; i++){
      let curr_song = this.songs[i];
      if(curr_song.id == song_id){
        if(curr_song.downvotes.includes(user_id)){
          console.log("Already downvoted!");
          return;
        }
        curr_song.downvotes[curr_song.downvotes.length] = user_id;
        curr_song.points = curr_song.upvotes.length - curr_song.downvotes.length;
        this.songs.sort(compare);
        this.io.to(this.users[user_id].socket_id).emit("song list", this.songs);
        return;
      }
    }
  }


  delete(){
    for (var user_id in this.users) {
      this.io.to(this.users[user_id].socket_id).emit("deleted", "Sorry <3");
    }

    this.owner.stop();
    this.owner = null;
  }

  playForSubs(uriObject){
    for(var i=0; i<this.subscribers.length; i++){
      let curr = this.subscribers[i];
      curr.spotifyApi.play(uriObject)
      .then(function(data){
        console.log('Played for subscribed user: '+curr.identifier+'!');
      }, function(err) {
        console.log('Could not get "now playing" for user'+curr.identifier+'!', err);
      });
    }
  }

  addSubscriber(user){
    this.subscribers[this.subscribers.length] = user;
    user.spotifyApi.play([this.nowPlaying.uri])
    .then(function(data){
      console.log('Played for subscribed user: '+user.identifier+'!');
    }, function(err) {
      console.log('Could not get "now playing" for user'+user.identifier+'!', err);
    });

  }

}

function compare(a,b) {
  if (a.points > b.points)
    return -1;
  if (a.points < b.points)
    return 1;
  return 0;
}
