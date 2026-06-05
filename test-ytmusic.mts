import YTMusic from "ytmusic-api";

async function test() {
  const ytmusic = new YTMusic();
  await ytmusic.initialize();
  const artists = await ytmusic.searchArtists("top pop artists");
  const albums = await ytmusic.searchAlbums("top hits");
  
  console.log("Artists:", JSON.stringify(artists.slice(0, 2), null, 2));
  console.log("Albums:", JSON.stringify(albums.slice(0, 2), null, 2));
}

test().catch(console.error);
