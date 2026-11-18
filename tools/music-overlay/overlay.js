const overlay = document.getElementById("music-overlay");
const card = overlay.querySelector(".music-card");
const cover = document.getElementById("cover");
const coverFallback = document.getElementById("cover-fallback");
const sourceLabel = document.getElementById("source-label");
const playbackText = document.getElementById("playback-text");
const titleNode = document.getElementById("track-title");
const artistNode = document.getElementById("track-artist");
const progressFill = document.getElementById("progress-fill");
const timeLabel = document.getElementById("time-label");
const equalizer = document.getElementById("equalizer");

const demo = new URLSearchParams(window.location.search).get("demo") === "1";
const demoTrack = {
  source: "youtube_music",
  title: "Midnight Circuit",
  artist: "Hot Coffee Radio",
  artworkUrl: "",
  durationMs: 214000,
  progressMs: 82000,
  isPlaying: true,
  updatedAt: Date.now()
};

let currentTrackKey = "";

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

function showCover(url) {
  cover.classList.remove("loaded");
  coverFallback.hidden = false;
  cover.removeAttribute("src");
  if (!url) return;
  cover.onload = () => {
    cover.classList.add("loaded");
    coverFallback.hidden = true;
  };
  cover.onerror = () => {
    cover.classList.remove("loaded");
    coverFallback.hidden = false;
  };
  cover.src = url;
}

function render(track) {
  if (!track || !track.title) {
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
    currentTrackKey = "";
    return;
  }

  const key = [track.source, track.title, track.artist, track.artworkUrl].join("|");
  if (key !== currentTrackKey) {
    currentTrackKey = key;
    titleNode.textContent = track.title;
    artistNode.textContent = track.artist || "Artista no disponible";
    showCover(track.artworkUrl || "");
  }

  sourceLabel.textContent = track.source === "youtube_music" ? "YOUTUBE MUSIC" : "YOUTUBE";
  const playing = track.isPlaying === true;
  card.classList.toggle("paused", !playing);
  playbackText.textContent = playing ? "REPRODUCIENDO" : "EN PAUSA";
  equalizer.hidden = !playing;

  const duration = Math.max(0, Number(track.durationMs) || 0);
  const baseProgress = Math.max(0, Number(track.progressMs) || 0);
  const elapsedSinceUpdate = playing && Number.isFinite(track.updatedAt)
    ? Math.max(0, Date.now() - track.updatedAt)
    : 0;
  const progress = Math.min(duration, baseProgress + elapsedSinceUpdate);
  progressFill.style.width = duration > 0 ? Math.min(100, progress / duration * 100) + "%" : "0%";
  timeLabel.textContent = duration > 0 ? formatTime(progress) + " / " + formatTime(duration) : "";
  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
}

async function poll() {
  if (demo) {
    render(demoTrack);
    return;
  }

  try {
    const response = await fetch("/api/now-playing", { cache: "no-store" });
    if (!response.ok) throw new Error("bridge_unavailable");
    const data = await response.json();
    render(data.track);
  } catch {
    render(null);
  }
}

poll();
window.setInterval(poll, demo ? 4000 : 1200);
