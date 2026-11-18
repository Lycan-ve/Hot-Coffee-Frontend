(() => {
  const source = location.hostname === "music.youtube.com" ? "youtube_music" : "youtube";

  function text(selector) {
    const node = document.querySelector(selector);
    return node?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function readTrack() {
    const video = document.querySelector("video.html5-main-video, video");
    if (!video) return null;

    const isMusic = source === "youtube_music";
    const title = isMusic
      ? (text("ytmusic-player-bar .title") || text("ytmusic-player-bar .content-info-wrapper .title"))
      : (text("h1.ytd-watch-metadata yt-formatted-string") || text("h1.title") || document.title.replace(/\s+-\s+YouTube$/, ""));

    if (!title) return null;

    const artist = isMusic
      ? (text("ytmusic-player-bar .byline") || text("ytmusic-player-bar .subtitle"))
      : (text("ytd-video-owner-renderer #channel-name a") || text("ytd-video-owner-renderer #channel-name yt-formatted-string"));

    const artworkUrl = document.querySelector('meta[property="og:image"]')?.content || "";
    const trackUrl = location.href.split("&list=")[0];

    return {
      source,
      title: title.slice(0, 180),
      artist: artist.slice(0, 180),
      artworkUrl,
      trackUrl,
      durationMs: Number.isFinite(video.duration) ? Math.floor(video.duration * 1000) : 0,
      progressMs: Number.isFinite(video.currentTime) ? Math.floor(video.currentTime * 1000) : 0,
      isPlaying: !video.paused && !video.ended
    };
  }

  let previousFingerprint = "";
  let lastSentAt = 0;

  function publish() {
    const payload = readTrack();
    if (!payload) return;

    const fingerprint = [
      payload.source,
      payload.title,
      payload.artist,
      payload.artworkUrl,
      payload.isPlaying
    ].join("|");

    const now = Date.now();
    if (fingerprint === previousFingerprint && now - lastSentAt < 1400) return;
    previousFingerprint = fingerprint;
    lastSentAt = now;

    chrome.runtime.sendMessage({ type: "HOT_COFFEE_MUSIC_STATE", payload }).catch(() => {});
  }

  publish();
  window.setInterval(publish, 1000);

  document.addEventListener("yt-navigate-finish", () => {
    previousFingerprint = "";
    window.setTimeout(publish, 700);
  });
})();
