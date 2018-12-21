app.factory('webSDK', function ($rootScope) {
  var player = null;
  var play = null;
  var is_ready = false;
  var is_playing = false;

  window.onSpotifyWebPlaybackSDKReady = () => {
      const token = accessToken;
      player = new Spotify.Player({
        name: 'Web Playback Party Queue',
        getOAuthToken: cb => { cb(token); }
      });

      play = ({
        spotify_uri,
        position_ms,
        playerInstance: {
          _options: {
            getOAuthToken,
            id
          }
        }
      }) => {
        getOAuthToken(access_token => {
          fetch(`https://api.spotify.com/v1/me/player/play?device_id=${id}`, {
            method: 'PUT',
            body: JSON.stringify({ uris: [spotify_uri], position_ms: position_ms}),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${access_token}`
            },
          });
        });
      };


      pause = ({
        playerInstance: {
          _options: {
            getOAuthToken,
            id
          }
        }
      }) => {
        getOAuthToken(access_token => {
          fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${access_token}`
            },
          });
        });
      };

      // Error handling
      player.addListener('initialization_error', ({ message }) => { console.error(message); });
      player.addListener('authentication_error', ({ message }) => { console.error(message); });
      player.addListener('account_error', ({ message }) => { console.error(message); });
      player.addListener('playback_error', ({ message }) => { console.error(message); });

      // Playback status updates
      player.addListener('player_state_changed', state => { console.log(state); });

      // Ready
      player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        is_ready = true;
        is_playing = false;
      });

      // Not Ready
      player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
      });

      // Connect to the player!
      player.connect();
    }
      return{
          ready: function(){
            return is_ready;
          },
          playing: function(){
            return is_playing;
          },
          play: function(track, position){
            play({
              playerInstance: player,
              spotify_uri: track,
              position_ms: position
            });
            is_playing = true;
          },
          pause: function(track, position){
            pause({
              playerInstance: player
            });
            is_playing = false;
          }
        }
    });
