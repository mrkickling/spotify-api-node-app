var app = angular.module("spotifyApiApp", ['ngCookies']);

app.controller("SearchController", ['$scope', '$http', '$cookies', 'socket', function($scope, $http, $cookies, socket) {
  socket.emit('im here', $cookies.get('current_queue'));
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

   $scope.addSong = function(id){
     socket.emit('add song', { queue: $cookies.get('current_queue'), id: id});
     $scope.focus=false;
   }

   socket.on("song list", function(data){
     $scope.song_queue = data;
   })

}]);

app.config(function($interpolateProvider) {
  $interpolateProvider.startSymbol('[[[');
  $interpolateProvider.endSymbol(']]]');
});
