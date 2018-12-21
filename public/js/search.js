var app = angular.module("spotifyApiApp", ['ngCookies']);
var previousPlayed = null;
app.controller("SearchController", ['$scope', '$http', '$cookies', '$window', 'socket', 'webSDK', function($scope, $http, $cookies, $window, socket, webSDK) {
  $scope.webPlayerActive = false;
  if($cookies.get('user_id') && $cookies.get('user_token')){
    $scope.user_id = $cookies.get('user_id');
    $scope.user_token = $cookies.get('user_token');
    socket.emit('im here', {queue: queue_id, user_id: $scope.user_id, user_token: $scope.user_token});
  }

  $scope.search = function(){
     $http({method: "GET", url: "/search/" + queue_id + "/" + $scope.search_input}).
       then(function(response) {
         $scope.search_results = response.data.tracks.items;
         console.log(response.data);
       }, function(response) {
         console.log(esponse.data || 'Request failed');
         console.log(response.data);
     });
   }
   $scope.enterUsername = function(name){
     $cookies.put('user_id', name + "-" + makenumid(5));
     $cookies.put('user_token', makeid(16));
     $scope.user_id = $cookies.get('user_id');
     console.log($scope.user_id);
     socket.emit('im here', {queue: queue_id, user_token: $cookies.get('user_token'), user_id: $scope.user_id});
   }

   $scope.addSong = function(song){
     socket.emit('add song', { queue: queue_id, song: song, added_by: $scope.user_id, user_token:$scope.user_token});
     $scope.focus=false;
   }

   $scope.upvote = function(song){
     if(!song.upvotes.includes($scope.user_id)){
       console.log("Upvoting!");
       socket.emit('upvote song', { queue: queue_id, song: song, user_id: $scope.user_id, user_token:$scope.user_token});
       $scope.focus=false;
     }
   }

   $scope.downvote = function(song){
     if(!song.downvotes.includes($scope.user_id)){
       socket.emit('downvote song', { queue: queue_id, song: song, user_id: $scope.user_id, user_token:$scope.user_token});
       $scope.focus=false;
     }
   }

   $scope.deleteSong = function(song){
     socket.emit('delete song', { queue: queue_id, song: song, user_id: $scope.user_id, user_token:$scope.user_token});
   }

   $scope.play = function(song){
     socket.emit('play', { queue: queue_id, user_id: $scope.user_id, user_token:$scope.user_token});
   }

   $scope.pause = function(song){
     socket.emit('pause', { queue: queue_id, user_id: $scope.user_id, user_token:$scope.user_token});
   }

   $scope.next = function(){
     socket.emit('next', { queue: queue_id, user_id: $scope.user_id, user_token:$scope.user_token});
   }

   $scope.remove = function(){
     socket.emit('delete', { queue: queue_id, user_id: $scope.user_id, user_token:$scope.user_token});
   }

   $scope.unsubscribe = function(){
     socket.emit('unsubscribe', { queue: queue_id, user_id: $scope.user_id, user_token:$scope.user_token});
     $window.location.href = '/party/' + queue_id;
   }

   socket.on("song list", function(data){
     $scope.song_queue = data;
   })

   socket.on("error", function(data){
     alert(data);
   })

   socket.on("wrong token", function(data){
     $scope.song_queue = data;
     $cookies.remove('user_id');
     $cookies.remove('user_token');
     alert("Invalid credentials! Please create a new user.");
     $window.location.href = '/party/' + queue_id;
   })

   socket.on("queue info", function(data){
     $scope.admin = data.admin;
     $scope.subscribers = data.subscribers;
   })

   socket.on("now playing", function(data){
     console.log("Current track: " + data.song.name);
     $scope.nowPlaying = data.song;
     $scope.isPlaying = data.playing;
     if(webSDK.ready() && !admin && $scope.subscribers.includes($scope.user_id)){
       $scope.webPlayerActive = true;
       if(previousPlayed != $scope.nowPlaying.id){
         // If song changed from last iteration
         console.log("Changing song");
         webSDK.play($scope.nowPlaying.uri,  $scope.nowPlaying.progress_ms);
       }else if(!webSDK.playing() && $scope.isPlaying){
         // If song is playing but the SDK is not playing
         console.log("Starting playing");
         webSDK.play($scope.nowPlaying.uri,  $scope.nowPlaying.progress_ms);
       }else if(webSDK.playing() && !$scope.isPlaying){
         // If song is paused but SDK is playing
         console.log("Paused");
         webSDK.pause();
       }
     }
     previousPlayed = $scope.nowPlaying.id;
   })

   socket.on("deleted", function(data){
     alert("Sorry, this queue was just deleted by the administrator!");
     $window.location.href = '/';
   })

}]);

app.config(function($interpolateProvider) {
  $interpolateProvider.startSymbol('[[[');
  $interpolateProvider.endSymbol(']]]');
});

function makeid(length) {
  var text = "";
  var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

function makenumid(length) {
  var text = "";
  var possible = "0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
