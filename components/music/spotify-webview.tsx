'use client'

import React from 'react';

const SpotifyWebView: React.FC = () => {
  return (
    <iframe
      src="https://open.spotify.com/"
      title="Spotify Web Player"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
};

export default SpotifyWebView;