var app = angular.module("spotifyApiApp", ['ngCookies']);

app.controller("SearchController", ['$scope', '$http', '$cookies', 'socket', function($scope, $http, $cookies, socket) {

  if(!$cookies.get('user_id')){
    $cookies.put('user_id', makeid(16));
  }
  $scope.user_id = $cookies.get('user_id');

  socket.emit('im here', {queue:$cookies.get('current_queue'), user_id:$cookies.get('user_id')});

  $scope.search = function(){
     $http({method: "GET", url: "/search/" + $scope.search_input}).
       then(function(response) {
         $scope.search_results = response.data.tracks.items;
         console.log(response.data);
       }, function(response) {
         console.log(esponse.data || 'Request failed');
         console.log(response.data);
     });
   }

   $scope.addSong = function(song){
     socket.emit('add song', { queue: $cookies.get('current_queue'), song: song, added_by: $scope.user_id});
     $scope.focus=false;
   }

   $scope.deleteSong = function(song){
     socket.emit('delete song', { queue: $cookies.get('current_queue'), song: song, user_id: $scope.user_id});
     $scope.focus=false;
   }

   socket.on("song list", function(data){
     $scope.song_queue = data;
   })

   socket.on("now playing", function(data){
     $scope.nowPlaying = data;
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
