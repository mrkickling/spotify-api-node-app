var app = angular.module("spotifyApiApp", ['ngCookies']);
var previousPlayed = null;

app.controller("SearchController", ['$scope', '$http', '$cookies', '$window', 'socket', 'webSDK', function($scope, $http, $cookies, $window, socket, webSDK) {
  $scope.webPlayerActive = false;
  $scope.onMobile = mobileCheck();
  $scope.chat_messages = [];
  $scope.scrollDownChat = 0;

  if($cookies.get('user_id') && $cookies.get('user_token')){
    $scope.user_id = $cookies.get('user_id');
    $scope.user_token = $cookies.get('user_token');
    socket.emit('im here', {queue: queue_id, user_id: $scope.user_id, user_token: $scope.user_token});
    socket.emit('chat message', { queue: queue_id, user_id: $scope.user_id, user_token:$scope.user_token, message:"Joined chat"});
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
     $cookies.put('user_id', name + "-" + makenumid(5), { path: '/party/' });
     $cookies.put('user_token', makeid(16), { path: '/party/' });
     $scope.user_id = $cookies.get('user_id');
     $scope.user_token = $cookies.get('user_token');
     console.log($scope.user_id);
     socket.emit('im here', {queue: queue_id, user_token: $cookies.get('user_token'), user_id: $scope.user_id});
     socket.emit('chat message', { queue: queue_id, user_id: $scope.user_id, user_token:$scope.user_token, message:"Joined chat"});
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

   $scope.sendChatMessage = function(){
     if($scope.input_message.length>1){
       socket.emit('chat message', { queue: queue_id, user_id: $scope.user_id, user_token:$scope.user_token, message:$scope.input_message});
       $scope.input_message = "";
     }
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

   socket.on("new chat message", function(data){
     $scope.chat_messages[$scope.chat_messages.length] = data;
     $scope.scrollDownChat += 1;
   })

   socket.on("error", function(data){
     alert(data);
   })

   socket.on("wrong token", function(data){
     $scope.song_queue = data;
     $cookies.remove('user_id', { path: '/party/' });
     $cookies.remove('user_token', { path: '/party/' });
     $cookies.remove('user_id', { path: '/' });
     $cookies.remove('user_token', { path: '/' });
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

app.directive('scroll', function($timeout) {
  return {
    restrict: 'A',
    link: function(scope, element, attr) {
      scope.$watchCollection(attr.scroll, function(newVal) {
        $timeout(function() {
         element[0].scrollTop = element[0].scrollHeight;
        });
      });
    }
  }
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

mobileCheck = function() {
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};
