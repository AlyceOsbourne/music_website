const trackListEl = document.getElementById("track-list");
const player = document.getElementById("player");
const canvas = document.getElementById("waveform");
const ctx = canvas.getContext("2d");
const sidebar = document.getElementById("sidebar");
const sidebarScrollbar = document.getElementById("sidebar-scrollbar");

const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const progress = document.getElementById("progress");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");
const playIcon = document.getElementById("play-icon");
const pauseIcon = document.getElementById("pause-icon");
const shuffleBtn = document.getElementById("shuffle-btn");
const stopBtn = document.getElementById("stop-btn");

let audioCtx, analyser, source, dataArray, animationId;
let tracks = [];
let currentTrack = 0;
let isPlaying = false;
let audioSetup = false;
let isShuffling = false;
let shuffleOrder = [];
let fadeOut = false;
let fadeLevel = 1;

// Create the thumb element
const sidebarThumb = document.createElement("div");
sidebarThumb.id = "sidebar-scrollbar-thumb";
sidebarScrollbar.appendChild(sidebarThumb);

function setupAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.fftSize);
    source = audioCtx.createMediaElementSource(player);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    audioSetup = true;
  }
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawWaveform() {
  if (fadeOut) {
    fadeLevel -= 0.05;
    if (fadeLevel <= 0) {
      fadeLevel = 0;
      fadeOut = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
  } else {
    fadeLevel = 1;
  }
  animationId = requestAnimationFrame(drawWaveform);
  analyser.getByteTimeDomainData(dataArray);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalAlpha = fadeLevel;
  ctx.beginPath();
  let grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, '#00ffe7');
  grad.addColorStop(0.5, '#ff00cc');
  grad.addColorStop(1, '#00ff88');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  let sliceWidth = canvas.width / analyser.fftSize;
  let x = 0;
  for (let i = 0; i < analyser.fftSize; i++) {
    let v = dataArray[i] / 128.0;
    let y = (v * canvas.height) / 2;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
  ctx.restore();
}

function formatTime(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function loadTrack(index) {
  if (index < 0) index = tracks.length - 1;
  if (index >= tracks.length) index = 0;
  currentTrack = index;
  player.src = tracks[currentTrack].file;
  if (isPlaying) {
    player.play();
  }
  updateTrackButtons();
}

function updateTrackButtons() {
  // Optionally highlight the current track button
  Array.from(trackListEl.children).forEach((btn, idx) => {
    btn.style.boxShadow = idx === currentTrack ? '0 0 16px #ff00cc, 0 0 8px #00ffe7' : '';
    btn.style.background = idx === currentTrack ? '#00ffe7' : '#23233a';
    btn.style.color = idx === currentTrack ? '#181828' : '#00ffe7';
  });
}

function shuffleArray(array) {
  // Fisher-Yates shuffle with crypto randomness if available
  let arr = array.slice();
  let random;
  for (let i = arr.length - 1; i > 0; i--) {
    if (window.crypto && window.crypto.getRandomValues) {
      // Use crypto for better randomness
      const uint32 = new Uint32Array(1);
      window.crypto.getRandomValues(uint32);
      random = uint32[0] / (0xFFFFFFFF + 1);
    } else {
      random = Math.random();
    }
    const j = Math.floor(random * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

shuffleBtn.addEventListener('click', () => {
  isShuffling = !isShuffling;
  shuffleBtn.classList.toggle('active', isShuffling);
  if (isShuffling) {
    shuffleOrder = shuffleArray([...Array(tracks.length).keys()]);
    // Start shuffle from current track
    const idx = shuffleOrder.indexOf(currentTrack);
    if (idx > 0) {
      [shuffleOrder[0], shuffleOrder[idx]] = [shuffleOrder[idx], shuffleOrder[0]];
    }
  } else {
    shuffleOrder = [];
  }
});

function getNextTrackIndex() {
  if (isShuffling && shuffleOrder.length > 0) {
    const idx = shuffleOrder.indexOf(currentTrack);
    if (idx < shuffleOrder.length - 1) {
      return shuffleOrder[idx + 1];
    } else {
      return shuffleOrder[0];
    }
  } else {
    return (currentTrack + 1) % tracks.length;
  }
}

function getPrevTrackIndex() {
  if (isShuffling && shuffleOrder.length > 0) {
    const idx = shuffleOrder.indexOf(currentTrack);
    if (idx > 0) {
      return shuffleOrder[idx - 1];
    } else {
      return shuffleOrder[shuffleOrder.length - 1];
    }
  } else {
    return (currentTrack - 1 + tracks.length) % tracks.length;
  }
}

playBtn.addEventListener('click', () => {
  if (player.paused) {
    player.play();
  } else {
    player.pause();
  }
});

prevBtn.addEventListener('click', () => {
  loadTrack(getPrevTrackIndex());
});

nextBtn.addEventListener('click', () => {
  loadTrack(getNextTrackIndex());
});

progress.addEventListener('input', () => {
  player.currentTime = (progress.value / 100) * player.duration;
});

player.addEventListener('play', () => {
  if (!audioSetup) setupAudioContext();
  audioCtx.resume();
  fadeOut = false;
  fadeLevel = 1;
  drawWaveform();
  isPlaying = true;
  playIcon.style.display = 'none';
  pauseIcon.style.display = '';
  playBtn.classList.add('glow');
});

player.addEventListener('pause', () => {
  fadeOut = true;
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(drawWaveform);
  isPlaying = false;
  playIcon.style.display = '';
  pauseIcon.style.display = 'none';
  playBtn.classList.remove('glow');
});

player.addEventListener('ended', () => {
  fadeOut = true;
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(drawWaveform);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  isPlaying = false;
  playIcon.style.display = '';
  pauseIcon.style.display = '';
  loadTrack(getNextTrackIndex());
});

player.addEventListener('timeupdate', () => {
  if (player.duration) {
    progress.value = (player.currentTime / player.duration) * 100;
    currentTimeEl.textContent = formatTime(player.currentTime);
  }
});

stopBtn.addEventListener('click', () => {
  player.pause();
  player.currentTime = 0;
  playIcon.style.display = '';
  pauseIcon.style.display = 'none';
  playBtn.classList.remove('glow');
});

fetch("tracks.json")
  .then(res => res.json())
  .then(trackData => {
    tracks = trackData;
    tracks.forEach((track, index) => {
      const btn = document.createElement("button");
      btn.textContent = track.title
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      btn.onclick = () => {
        loadTrack(index);
        player.play();
      };
      trackListEl.appendChild(btn);
    });
    loadTrack(0);
  });

function updateSidebarScrollbar() {
  const visible = trackListEl.clientHeight;
  const content = trackListEl.scrollHeight;
  const scrollTop = trackListEl.scrollTop;
  if (content <= visible) {
    sidebarThumb.style.display = "none";
    return;
  }
  sidebarThumb.style.display = "block";
  const thumbHeight = Math.max((visible / content) * visible, 32);
  const thumbTop = (scrollTop / (content - visible)) * (visible - thumbHeight);
  sidebarThumb.style.height = `${thumbHeight}px`;
  sidebarThumb.style.top = `${trackListEl.offsetTop + thumbTop}px`;
}

trackListEl.addEventListener("scroll", updateSidebarScrollbar);
window.addEventListener("resize", updateSidebarScrollbar);

// Drag to scroll
let isDragging = false;
let dragStartY = 0;
let dragStartScroll = 0;
sidebarThumb.addEventListener("mousedown", (e) => {
  isDragging = true;
  dragStartY = e.clientY;
  dragStartScroll = trackListEl.scrollTop;
  document.body.style.userSelect = "none";
});
document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const visible = trackListEl.clientHeight;
  const content = trackListEl.scrollHeight;
  const thumbHeight = sidebarThumb.offsetHeight;
  const deltaY = e.clientY - dragStartY;
  const maxScroll = content - visible;
  const maxThumbMove = visible - thumbHeight;
  const scrollRatio = maxScroll / maxThumbMove;
  trackListEl.scrollTop = dragStartScroll + deltaY * scrollRatio;
});
document.addEventListener("mouseup", () => {
  isDragging = false;
  document.body.style.userSelect = "";
});

// Initial update
window.addEventListener("DOMContentLoaded", updateSidebarScrollbar);
