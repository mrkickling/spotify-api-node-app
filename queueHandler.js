var SpotifyWebApi = require('spotify-web-api-node');
var request = require('request');

// Initializing a class definition
module.exports = class Queue {

  constructor(name, id, admin, io) {
    this.io = io;
    this.name = name;
    this.id = id;
    this.admin = admin;

    this.nowPlaying = {};
    this.songs = [];
    this.users = [];
    this.subscribers = [];

    this.timeToNextSong = 0;
    this.isPlaying = false;
    this.inactiveTime = 0;
    this.isActive = true;

    this.decrementSeconds();
  }

  decrementSeconds(){
    this.timeToNextSong--;

    if(this.songs.length>0 && (this.timeToNextSong < 1 || !this.nowPlaying)){
      this.playNextInQueue();
    }

    setTimeout(this.decrementSeconds.bind(this), 1000);
  }

  track(){
    if(!this.admin){
      return;
    }
    if(!this.isActive){
      this.inactiveTime += 5;
    }else{
      this.inactiveTime = 0;
    }

    this.admin.spotifyApi.getMyCurrentPlaybackState({})
    .then(function(data) {
      console.log((new Date().toLocaleTimeString()) + ": Got current playback state for queue: " + this.name);
      this.isActive = data.body.device && data.body.device.is_active;
      this.isPlaying = data.body.is_playing;
      this.nowPlaying = data.body.item;

      if(this.nowPlaying){
        this.nowPlaying.progress_ms = data.body.progress_ms;
      }
      // Output items
      for (var user_id in this.users) {
        this.io.to(this.users[user_id].socket_id).emit("song list", this.songs);
        this.io.to(this.users[user_id].socket_id).emit("now playing", {song:this.nowPlaying, playing:this.isPlaying});
      }

      // Remove song from queue if it's playing now
      for(let i = 0; i<this.songs.length; i++){
        if(this.nowPlaying && this.songs[i].id == this.nowPlaying.id){
          this.songs.splice(i, 1);
        }
      }

      // If song is playing
      if(data.body.item){
        if(this.timeToNextSong>2 || this.songs.length<1){
          this.timeToNextSong = (data.body.item.duration_ms - data.body.progress_ms)/1000;
        }
      }
      setTimeout(this.track.bind(this), 5000);
    }.bind(this), function(err) {
      console.log('Could not get current playback for ' + this.admin.identifier, err);
      setTimeout(this.track.bind(this), 5000);
    }.bind(this));

  }

  playNextInQueue(){
    if(!this.admin){
      return;
    }
    let songToPlay = this.songs[0];
    let uriObject = {};
    uriObject.uris = [];
    for(let i = 0; i<this.songs.length; i++){
      uriObject.uris[i] = this.songs[i].uri;
    }
    this.admin.spotifyApi.play(uriObject)
    .then(function(data){
      if(songToPlay){
        this.nowPlaying = songToPlay;
        this.timeToNextSong = songToPlay.duration_ms/1000;
        this.songs.splice(0, 1);
        // Output items
        for (var user_id in this.users) {
          this.io.to(this.users[user_id].socket_id).emit("song list", this.songs);
          this.io.to(this.users[user_id].socket_id).emit("now playing", {song:this.nowPlaying, playing:this.isPlaying});
        }
      }
    }.bind(this), function(err) {
      console.log('Could not get "now playing" for ' + this.admin.identifier, err);
    });
  }

  addSong(song, added_by){
    song.added_by = added_by;
    song.upvotes = [];
    song.downvotes = [];
    song.points = 0;
    this.songs[this.songs.length] = song;
    this.songs.sort(compare);
    for (var user_id in this.users) {
      this.io.to(this.users[user_id].socket_id).emit("song list", this.songs);
    }
  }

  pause(socket, callback){
    if(!this || !this.admin){
      return;
    }
    if(!this.isActive){
      this.io.to(socket.id).emit("error", "Can not pause track while user is not active on any device on spotify, please start playing a track on spotify on a device.");
      return;
    }
    this.admin.spotifyApi.pause()
    .then(function(data){
      console.log(this.name + ' paused!');
      this.isPlaying = false;
      callback();
    }.bind(this), function(err) {
      console.log('Could not pause!', err);
      callback();
    });
  }

  play(socket, callback){
    if(!this || !this.admin){
      return;
    }
    if(!this.isActive){
      this.io.to(socket.id).emit("error", "Can not play track while user is not active on any device on spotify, please start playing a track on spotify on a device.");
      return;
    }
    this.admin.spotifyApi.play()
    .then(function(data){
      console.log(this.name + ' started playing!');
      this.isPlaying = true;
      callback();
    }.bind(this), function(err) {
      console.log('Could not play!', err);
      callback();
    });
  }

  next(){
    this.timeToNextSong = 0;
    this.playNextInQueue();
  }

  upvoteSong(song_id, user){
    for(let i = 0; i<this.songs.length; i++){
      let curr_song = this.songs[i];
      if(curr_song.id == song_id){
        if(curr_song.upvotes.includes(user.user_id)){
          console.log("Already upvoted!");
          return;
        }
        curr_song.upvotes[curr_song.upvotes.length] = user.user_id;
        curr_song.points = curr_song.upvotes.length - curr_song.downvotes.length;
        this.songs.sort(compare);
        this.io.to(user.socket_id).emit("song list", this.songs);
        return;
      }
    }
  }

  downvoteSong(song_id, user){
    for(let i = 0; i<this.songs.length; i++){
      let curr_song = this.songs[i];
      if(curr_song.id == song_id){
        if(curr_song.downvotes.includes(user.user_id)){
          console.log("Already downvoted!");
          return;
        }
        curr_song.downvotes[curr_song.downvotes.length] = user.user_id;
        curr_song.points = curr_song.upvotes.length - curr_song.downvotes.length;
        this.songs.sort(compare);
        this.io.to(user.socket_id).emit("song list", this.songs);
        return;
      }
    }
  }


  delete(){
    for (var user_id in this.users) {
      this.io.to(this.users[user_id].socket_id).emit("deleted", "Sorry <3");
    }

    this.admin.is_admin_for = false;
    this.admin = null;
  }

  removeUser(user_id, user_token){
    for (var user_index in this.users) {
      if(this.users[user_index].user_id == user_id
      && this.users[user_index].user_token == user_token){
        this.users.splice(i, 1);
      }
    }
  }

  addSubscriber(user){
    this.users[this.users.length] = user;
    this.subscribers[this.subscribers.length] = user;
    console.log(this.nowPlaying.uri);

    var access_token = user.spotifyApi.getAccessToken();

  }
}

function compare(a,b) {
  if (a.points > b.points)
    return -1;
  if (a.points < b.points)
    return 1;
  return 0;
}
