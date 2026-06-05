const YTMusic = require('ytmusic-api').default;

async function test() {
  const ytmusic = new YTMusic();
  await ytmusic.initialize();
  const songs = await ytmusic.searchSongs('Golden Harry Styles');
  console.log(JSON.stringify(songs[0], null, 2));
}

test();
