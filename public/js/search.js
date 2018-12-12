var app = angular.module("spotifyApiApp", []);

app.controller("SearchController", ['$scope', '$http', function($scope, $http) {
  socket.emit('my queue', $scope.queue_id);
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

   $scope.addSong = function(){
     $http({method: "GET", url: "/add-to-queue/" + $scope.queue + ""}).
       then(function(response) {
         $scope.search_results = response.data.tracks.items;
         console.log(response.data);
       }, function(response) {
         console.log(esponse.data || 'Request failed');
         console.log(response.data);
     });
   }

}]);

app.config(function($interpolateProvider) {
  $interpolateProvider.startSymbol('[[[');
  $interpolateProvider.endSymbol(']]]');
});
