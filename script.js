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
const volumeSlider = document.getElementById("volume-slider");
const volumeToggleBtn = document.getElementById("volume-toggle-btn");
const volumeOnIcon = document.getElementById("volume-on-icon");
const volumeOffIcon = document.getElementById("volume-off-icon");
const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
const visualizerWave = document.getElementById("visualizer-wave");
const visualizerSparkle = document.getElementById("visualizer-sparkle");
const visualizerBurst = document.getElementById("visualizer-burst");
const visualizerGrid = document.getElementById("visualizer-grid");
const visualizerInterrobang = document.getElementById("visualizer-interrobang");

let audioCtx, analyser, source, dataArray, animationId;
let tracks = [];
let currentTrack = 0;
let isPlaying = false;
let audioSetup = false;
let isShuffling = false;
let shuffleOrder = [];
let fadeOut = false;
let fadeLevel = 1;
let bassPulse = 0;

let particles = [];
let lastParticleTime = 0;

let visualizerModes = ['waveform', 'radialSpikes', 'particleBurst', 'plasmaGrid', 'plasmaGlobe', 'random'];
let visualizerMode = visualizerModes.indexOf('random');
let trackVisualizerMap = {};

const sidebarThumb = document.createElement("div");
sidebarThumb.id = "sidebar-scrollbar-thumb";
sidebarScrollbar.appendChild(sidebarThumb);

let lastVolume = volumeSlider.value;

let hasStarted = false;

// Set the correct icon for random mode on load
if (visualizerSparkle && visualizerInterrobang) {
  if (visualizerModes[visualizerMode] === 'random') {
    visualizerSparkle.style.display = 'none';
    visualizerInterrobang.style.display = '';
  } else {
    visualizerSparkle.style.display = '';
    visualizerInterrobang.style.display = 'none';
  }
}

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

function drawWaveformShape(alpha = 1) {
  analyser.getByteTimeDomainData(dataArray);
  ctx.save();
  ctx.globalAlpha = alpha * fadeLevel;
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

function drawRadialSpikesShape(alpha = 1) {
  analyser.getByteFrequencyData(dataArray);
  ctx.save();
  ctx.globalAlpha = alpha * fadeLevel;
  let centerX = canvas.width / 2;
  let centerY = canvas.height / 2;
  let radius = Math.min(canvas.width, canvas.height) / 7;
  let spikes = 96;
  let angleStep = (Math.PI * 2) / spikes;
  let time = Date.now() * 0.001;
  let minSpike = 1; // Minimum spike length in pixels (most subtle)
  for (let i = 0; i < spikes; i++) {
    let value = dataArray[i % dataArray.length] / 255;
    let spikeLength = minSpike + radius * 0.3 + value * radius * 0.7;
    let angle = i * angleStep;
    let x1 = centerX + Math.cos(angle) * radius;
    let y1 = centerY + Math.sin(angle) * radius;
    let x2 = centerX + Math.cos(angle) * (radius + spikeLength);
    let y2 = centerY + Math.sin(angle) * (radius + spikeLength);
    ctx.save();
    ctx.shadowColor = `hsl(${(time * 60 + i * 4) % 360}, 100%, 60%)`;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.strokeStyle = `hsl(${(time * 60 + i * 4) % 360}, 100%, 60%)`;
    ctx.lineWidth = 3 + value * 4;
    ctx.lineCap = 'round';
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawParticleBurstShape(alpha = 1) {
  analyser.getByteFrequencyData(dataArray);
  ctx.save();
  ctx.globalAlpha = alpha * fadeLevel;
  let centerX = canvas.width / 2;
  let centerY = canvas.height / 2;
  let time = Date.now() * 0.001;
  const N = dataArray.length;
  let low = 0, mid = 0, high = 0;
  let lowCount = Math.floor(N / 8);
  let midCount = Math.floor(N / 3) - lowCount;
  let highCount = N - (lowCount + midCount);
  for (let i = 0; i < lowCount; i++) low += dataArray[i];
  for (let i = lowCount; i < lowCount + midCount; i++) mid += dataArray[i];
  for (let i = lowCount + midCount; i < N; i++) high += dataArray[i];
  low = (low / lowCount) / 255;
  mid = (mid / midCount) / 255;
  high = (high / highCount) / 255;
  let energy = 0.85 * low + 0.05 * mid + 1.1 * high;
  if (energy > 0.38 && Date.now() - lastParticleTime > 60) {
    for (let i = 0; i < 16; i++) {
      let angle = Math.random() * Math.PI * 2;
      let speed = 3 + Math.random() * 3 + (1.0 * low + 1.0 * high) * 8;
      let hue = (time * 120 + angle * 180 / Math.PI + high * 180) % 360;
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 32 + Math.random() * 24,
        hue,
      });
    }
    lastParticleTime = Date.now();
  }
  let newParticles = [];
  for (let p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life++;
    let alphaP = Math.max(0, 1 - p.life / p.maxLife);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + 8 * alphaP, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${0.18 + 0.5 * alphaP})`;
    ctx.shadowColor = `hsl(${p.hue}, 100%, 60%)`;
    ctx.shadowBlur = 16 + 24 * alphaP;
    ctx.fill();
    ctx.restore();
    if (p.life < p.maxLife) newParticles.push(p);
  }
  particles = newParticles;
  ctx.restore();
}

function drawPlasmaGridShape(alpha = 1) {
  analyser.getByteFrequencyData(dataArray);
  ctx.save();
  ctx.globalAlpha = alpha * fadeLevel;
  let cols = 18;
  let rows = 10;
  let cellW = canvas.width / cols;
  let cellH = canvas.height / rows;
  let time = Date.now() * 0.001;
  let globalEnergy = 0;
  for (let i = 0; i < 32; i++) globalEnergy += dataArray[i];
  globalEnergy = (globalEnergy / 32) / 255;
  let gridPulse = 1 + 0.18 * Math.sin(time * 8) + (globalEnergy > 0.55 ? 0.25 * Math.sin(time * 24) : 0);
  let colorWave = (time * 60) % 360;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let idx = Math.floor((x + y * cols) / (cols * rows) * dataArray.length);
      let energy = dataArray[idx] / 255;
      let flicker = Math.abs(Math.sin(time * (1.2 + x * 0.1 + y * 0.13) + idx));
      let intensity = Math.max(energy, flicker * 0.5);
      let breathe = 1 + 0.18 * Math.sin(time * 4 + x * 0.7 + y * 0.9 + intensity * 2);
      let cx = x * cellW + cellW / 2;
      let cy = y * cellH + cellH / 2;
      let hue = (colorWave + x * 24 + y * 12 + Math.sin(time + x * 0.2) * 24) % 360;
      ctx.save();
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.shadowBlur = 16 + 28 * intensity * gridPulse;
      ctx.beginPath();
      ctx.arc(cx, cy, (5 + 18 * intensity) * breathe * gridPulse, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${hue}, 100%, ${40 + 40 * intensity}%)`;
      ctx.globalAlpha = 0.7 + 0.3 * intensity;
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

function getVisualizerForTrack(index) {
  if (visualizerModes[visualizerMode] !== 'random') return visualizerModes[visualizerMode];
  if (!trackVisualizerMap[index]) {
    // Exclude 'random' from possible choices
    const choices = visualizerModes.filter(m => m !== 'random');
    let prevForThisTrack = trackVisualizerMap[index];
    let prevForPrevTrack = index > 0 ? trackVisualizerMap[index - 1] : undefined;
    let newChoices = choices.filter(c => c !== prevForThisTrack && c !== prevForPrevTrack);
    if (newChoices.length === 0) newChoices = choices; // fallback if all are filtered
    let newChoice = newChoices[Math.floor(Math.random() * newChoices.length)];
    trackVisualizerMap[index] = newChoice;
  }
  return trackVisualizerMap[index];
}

function pickNewRandomVisualizerForTrack(index) {
  const choices = visualizerModes.filter(m => m !== 'random');
  const prevForThisTrack = trackVisualizerMap[index];
  const prevForPrevTrack = index > 0 ? trackVisualizerMap[index - 1] : undefined;
  let newChoices = choices.filter(c => c !== prevForThisTrack && c !== prevForPrevTrack);
  if (newChoices.length === 0) newChoices = choices; // fallback if all are filtered
  let newChoice = newChoices[Math.floor(Math.random() * newChoices.length)];
  trackVisualizerMap[index] = newChoice;
}

// --- Plasma Globe Visualizer ---
let plasmaGlobes = [];
function drawPlasmaGlobeShape(alpha = 1) {
  analyser.getByteFrequencyData(dataArray);
  ctx.save();
  ctx.globalAlpha = alpha * fadeLevel;
  let centerX = canvas.width / 2;
  let centerY = canvas.height / 2;
  let time = Date.now() * 0.001;
  // Globe border
  let globeRadius = Math.min(canvas.width, canvas.height) * 0.36;
  // --- Stylish, flickering, pulsing ring ---
  let bassPulse = 0;
  for (let i = 0; i < 16; i++) bassPulse += dataArray[i];
  bassPulse = (bassPulse / 16) / 255;
  // Flicker: time-based random
  let flicker = 0.92 + 0.08 * Math.sin(time * 8 + Math.sin(time * 2)) + (Math.random() - 0.5) * 0.04;
  // Pulse: based on bass
  let pulse = 1 + 0.13 * Math.sin(time * 4 + bassPulse * 2) + 0.18 * bassPulse;
  let ringThickness = 6 * flicker * pulse;

  // --- Animated gradient, mean color of bolts ---
  // Calculate mean hue of active bolts
  let meanHue = 200;
  if (plasmaGlobes.length > 0) {
    let sum = 0;
    for (let p of plasmaGlobes) {
      // Extract hue from color string: hsl(hue, ...
      let match = /hsl\((\d+)/.exec(p.color);
      if (match) sum += parseFloat(match[1]);
    }
    meanHue = sum / plasmaGlobes.length;
  }
  // Animate gradient stops
  let gradShift = (Math.sin(time * 0.5) + 1) * 60; // -60 to +60
  let hue1 = (meanHue - 40 + gradShift) % 360;
  let hue2 = (meanHue + gradShift) % 360;
  let hue3 = (meanHue + 40 + gradShift) % 360;
  let grad = ctx.createLinearGradient(centerX - globeRadius, centerY, centerX + globeRadius, centerY);
  grad.addColorStop(0, `hsl(${hue1}, 100%, 65%)`);
  grad.addColorStop(0.5, `hsl(${hue2}, 100%, 60%)`);
  grad.addColorStop(1, `hsl(${hue3}, 100%, 65%)`);

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, globeRadius, 0, Math.PI * 2);
  ctx.strokeStyle = grad;
  ctx.lineWidth = ringThickness;
  ctx.shadowColor = `hsl(${meanHue}, 100%, 60%)`;
  ctx.shadowBlur = 32 * pulse;
  ctx.globalAlpha = 0.32 + 0.18 * bassPulse;
  ctx.stroke();
  ctx.restore();
  // Calculate bass energy
  let bass = 0;
  for (let i = 0; i < 16; i++) bass += dataArray[i];
  bass = (bass / 16) / 255;
  // On strong bass, spawn new plasma bolt
  if (bass > 0.38 && Math.random() < 0.18) {
    let angle = Math.random() * Math.PI * 2;
    let color = `hsl(${180 + bass * 120 + Math.random() * 60}, 100%, 60%)`;
    let waviness = 0.7 + Math.random() * 1.2;
    let freq = 1.2 + Math.random() * 1.8;
    plasmaGlobes.push({
      x: centerX,
      y: centerY,
      angle,
      color,
      waviness,
      freq,
      phase: Math.random() * Math.PI * 2,
      life: 0,
      maxLife: 38 + Math.random() * 28,
      globeRadius,
      bass
    });
  }
  // Store impact points for glow
  let impactPoints = [];
  // Fractal bolt drawing function
  function drawBolt(x1, y1, x2, y2, depth, maxDepth, color, mainAlpha, baseThickness) {
    if (depth > maxDepth) return;
    let dx = x2 - x1;
    let dy = y2 - y1;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 8) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.globalAlpha = mainAlpha;
      ctx.lineWidth = baseThickness * (1.2 + (maxDepth - depth) * 0.7);
      ctx.shadowColor = color;
      ctx.shadowBlur = 10 + (maxDepth - depth) * 6;
      ctx.stroke();
      // If this is the final segment and at the border, add to impact points
      if (depth === 0 || depth === 1) {
        impactPoints.push({ x: x2, y: y2, color, alpha: mainAlpha, thickness: baseThickness });
      }
      return;
    }
    // Midpoint with random offset for fractal effect
    let mx = (x1 + x2) / 2;
    let my = (y1 + y2) / 2;
    let normal = { x: -(y2 - y1), y: x2 - x1 };
    let normLen = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    if (normLen > 0) {
      normal.x /= normLen;
      normal.y /= normLen;
    }
    let offset = (Math.random() - 0.5) * dist * 0.22 * (1 - depth / maxDepth);
    mx += normal.x * offset;
    my += normal.y * offset;
    // Draw main branch
    drawBolt(x1, y1, mx, my, depth + 1, maxDepth, color, mainAlpha, baseThickness);
    drawBolt(mx, my, x2, y2, depth + 1, maxDepth, color, mainAlpha, baseThickness);
    // Branching
    if (depth > 1 && Math.random() < 0.28 && depth < maxDepth - 1) {
      let branchAngle = Math.atan2(my - y1, mx - x1) + (Math.random() - 0.5) * Math.PI / 2;
      let branchLen = dist * (0.3 + Math.random() * 0.22);
      let bx = mx + Math.cos(branchAngle) * branchLen;
      let by = my + Math.sin(branchAngle) * branchLen;
      // Ensure branch stays inside globe
      let dFromCenter = Math.sqrt((bx - centerX) ** 2 + (by - centerY) ** 2);
      if (dFromCenter < globeRadius - 8) {
        drawBolt(mx, my, bx, by, depth + 2, maxDepth, color, mainAlpha * 0.7, baseThickness * 0.6);
      }
    }
  }
  // Animate and draw plasma bolts
  let newPlasmaGlobes = [];
  for (let p of plasmaGlobes) {
    // End point on border
    let endAngle = p.angle;
    let ex = centerX + Math.cos(endAngle) * globeRadius;
    let ey = centerY + Math.sin(endAngle) * globeRadius;
    // Animate waviness by modulating the end point
    let mod = Math.sin(time * 2 + p.phase) * 0.08 * globeRadius;
    ex += Math.cos(endAngle + Math.PI / 2) * mod;
    ey += Math.sin(endAngle + Math.PI / 2) * mod;
    ctx.save();
    let intensity = Math.max(0.5, p.bass || bass);
    ctx.globalAlpha = alpha * fadeLevel * (1 - p.life / p.maxLife);
    // Thinner bolts, only thick at extremes
    let baseThickness = 1.2 + 5 * Math.pow(Math.max(0, intensity - 0.7), 2);
    drawBolt(p.x, p.y, ex, ey, 0, 5 + Math.floor(Math.random() * 2), p.color, ctx.globalAlpha, baseThickness);
    ctx.restore();
    p.life++;
    if (p.life < p.maxLife) newPlasmaGlobes.push(p);
  }
  plasmaGlobes = newPlasmaGlobes;
  // Draw glow at impact points
  for (let pt of impactPoints) {
    ctx.save();
    let glowRadius = 18 + 32 * (pt.thickness / 6);
    let grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, glowRadius);
    grad.addColorStop(0, pt.color.replace('60%', '80%').replace('1)', '0.7)'));
    grad.addColorStop(0.3, pt.color.replace('60%', '70%').replace('1)', '0.3)'));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.22 + 0.18 * (pt.thickness / 6);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowColor = pt.color;
    ctx.shadowBlur = 32 + 32 * (pt.thickness / 6);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawVisualizer() {
  let mode = getVisualizerForTrack(currentTrack);
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
  animationId = requestAnimationFrame(drawVisualizer);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (mode === 'waveform') {
    drawWaveformShape(1);
  } else if (mode === 'radialSpikes') {
    drawRadialSpikesShape(1);
  } else if (mode === 'particleBurst') {
    drawParticleBurstShape(1);
  } else if (mode === 'plasmaGrid') {
    drawPlasmaGridShape(1);
  } else if (mode === 'plasmaGlobe') {
    drawPlasmaGlobeShape(1);
  }
}

function formatTime(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Centralized fade transition for visualizer changes
function fadeToVisualizer(prevVisualizer, newVisualizer, onComplete) {
  let fade = 1;
  const fadeStep = 0.08;
  function fadeOutStep() {
    fade -= fadeStep;
    ctx.globalAlpha = Math.max(0, fade);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (prevVisualizer === 'waveform') drawWaveformShape(fade);
    else if (prevVisualizer === 'radialSpikes') drawRadialSpikesShape(fade);
    else if (prevVisualizer === 'particleBurst') drawParticleBurstShape(fade);
    else if (prevVisualizer === 'plasmaGrid') drawPlasmaGridShape(fade);
    else if (prevVisualizer === 'plasmaGlobe') drawPlasmaGlobeShape(fade);
    if (fade > 0) {
      requestAnimationFrame(fadeOutStep);
    } else {
      let fadeIn = 0;
      function fadeInStep() {
        fadeIn += fadeStep;
        ctx.globalAlpha = Math.min(1, fadeIn);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (newVisualizer === 'waveform') drawWaveformShape(fadeIn);
        else if (newVisualizer === 'radialSpikes') drawRadialSpikesShape(fadeIn);
        else if (newVisualizer === 'particleBurst') drawParticleBurstShape(fadeIn);
        else if (newVisualizer === 'plasmaGrid') drawPlasmaGridShape(fadeIn);
        else if (newVisualizer === 'plasmaGlobe') drawPlasmaGlobeShape(fadeIn);
        if (fadeIn < 1) {
          requestAnimationFrame(fadeInStep);
        } else {
          ctx.globalAlpha = 1;
          if (onComplete) onComplete();
        }
      }
      requestAnimationFrame(fadeInStep);
    }
  }
  requestAnimationFrame(fadeOutStep);
}

// Update loadTrack to use fadeToVisualizer
function loadTrack(index) {
  if (index < 0) index = tracks.length - 1;
  if (index >= tracks.length) index = 0;
  const prevVisualizer = getVisualizerForTrack(currentTrack);
  currentTrack = index;
  player.src = tracks[currentTrack].file;
  cancelAnimationFrame(animationId);
  let newVisualizer = prevVisualizer;
  if (visualizerModes[visualizerMode] === 'random') {
    pickNewRandomVisualizerForTrack(currentTrack);
    newVisualizer = getVisualizerForTrack(currentTrack);
  }
  if (prevVisualizer !== newVisualizer) {
    fadeToVisualizer(prevVisualizer, newVisualizer, () => {
      if (isPlaying) player.play();
    });
  } else {
    if (isPlaying) {
      player.play();
    }
  }
  updateTrackButtons();
}

function updateTrackButtons() {
  Array.from(trackListEl.children).forEach((btn, idx) => {
    btn.style.boxShadow = idx === currentTrack ? '0 0 16px #ff00cc, 0 0 8px #00ffe7' : '';
    btn.style.background = idx === currentTrack ? '#00ffe7' : '#23233a';
    btn.style.color = idx === currentTrack ? '#181828' : '#00ffe7';
  });
}

function shuffleArray(array) {
  let arr = array.slice();
  let random;
  for (let i = arr.length - 1; i > 0; i--) {
    if (window.crypto && window.crypto.getRandomValues) {
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
    if (!hasStarted && isShuffling && shuffleOrder.length > 0) {
      // Pick a random track from shuffle order (not always the first)
      const randomIdx = Math.floor(Math.random() * shuffleOrder.length);
      loadTrack(shuffleOrder[randomIdx]);
    }
    player.play();
    hasStarted = true;
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
  drawVisualizer();
  isPlaying = true;
  playIcon.style.display = 'none';
  pauseIcon.style.display = '';
  playBtn.classList.add('glow');
});

player.addEventListener('pause', () => {
  fadeOut = true;
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(drawVisualizer);
  isPlaying = false;
  playIcon.style.display = '';
  pauseIcon.style.display = 'none';
  playBtn.classList.remove('glow');
});

player.addEventListener('ended', () => {
  fadeOut = true;
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(drawVisualizer);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  isPlaying = false;
  playIcon.style.display = '';
  pauseIcon.style.display = '';
  loadTrack(getNextTrackIndex());
  player.play();
});

player.addEventListener('timeupdate', () => {
  if (player.duration) {
    progress.value = (player.currentTime / player.duration) * 100;
    currentTimeEl.textContent = formatTime(player.currentTime);
  }
});

player.addEventListener('stop', () => {
  hasStarted = false;
});

stopBtn.addEventListener('click', () => {
  player.pause();
  player.currentTime = 0;
  playIcon.style.display = '';
  pauseIcon.style.display = 'none';
  playBtn.classList.remove('glow');
  hasStarted = false;
});

// Set initial volume
player.volume = volumeSlider.value;

volumeToggleBtn.addEventListener("click", () => {
  if (player.muted || player.volume === 0) {
    player.muted = false;
    player.volume = lastVolume > 0 ? lastVolume : 1;
    volumeSlider.value = player.volume;
    volumeOnIcon.style.display = "";
    volumeOffIcon.style.display = "none";
  } else {
    player.muted = true;
    lastVolume = player.volume;
    player.volume = 0;
    volumeSlider.value = 0;
    volumeOnIcon.style.display = "none";
    volumeOffIcon.style.display = "";
  }
});

volumeSlider.addEventListener("input", () => {
  player.volume = volumeSlider.value;
  player.muted = player.volume == 0;
  if (player.volume == 0) {
    volumeOnIcon.style.display = "none";
    volumeOffIcon.style.display = "";
  } else {
    volumeOnIcon.style.display = "";
    volumeOffIcon.style.display = "none";
    lastVolume = player.volume;
  }
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

window.addEventListener("DOMContentLoaded", updateSidebarScrollbar);

// Cycle visualizer mode and update icon
const cycleVisualizerBtn = document.getElementById('cycle-visualizer-btn');
cycleVisualizerBtn.addEventListener('click', () => {
  const prevVisualizer = getVisualizerForTrack(currentTrack);
  visualizerMode = (visualizerMode + 1) % visualizerModes.length;
  // Reset trackVisualizerMap if entering random mode
  if (visualizerModes[visualizerMode] === 'random') {
    trackVisualizerMap = {};
  }
  updateVisualizerIcon();
  const newVisualizer = getVisualizerForTrack(currentTrack);
  fadeToVisualizer(prevVisualizer, newVisualizer);
});

function handleSidebarToggle() {
  if (window.innerWidth >= 900) {
    sidebar.classList.toggle("collapsed");
    updateSidebarChevron();
  }
}
if (sidebarToggleBtn) {
  sidebarToggleBtn.addEventListener("click", handleSidebarToggle);
}
window.addEventListener("resize", () => {
  if (window.innerWidth < 900) {
    sidebar.classList.remove("collapsed");
    updateSidebarChevron();
  }
});

// Start with sidebar collapsed on large screens
window.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth >= 900) {
    sidebar.classList.add('collapsed');
  }
  updateSidebarChevron();
});

function updateSidebarChevron() {
  const chevron = document.getElementById('sidebar-chevron');
  if (!chevron) return;
  if (sidebar.classList.contains('collapsed')) {
    chevron.style.transform = 'rotate(180deg)'; // Point right (expand)
  } else {
    chevron.style.transform = 'rotate(0deg)'; // Point left (collapse)
  }
  chevron.style.stroke = '#b266ff'; // Always purple
}

function updateVisualizerIcon() {
  visualizerWave.style.display = 'none';
  visualizerSparkle.style.display = 'none';
  visualizerBurst.style.display = 'none';
  visualizerGrid.style.display = 'none';
  visualizerInterrobang.style.display = 'none';
  const plasmaGlobeIcon = document.getElementById('visualizer-plasmaglobe');
  if (plasmaGlobeIcon) plasmaGlobeIcon.style.display = 'none';
  const mode = visualizerModes[visualizerMode];
  if (mode === 'waveform') visualizerWave.style.display = '';
  else if (mode === 'radialSpikes') visualizerSparkle.style.display = '';
  else if (mode === 'particleBurst') visualizerBurst.style.display = '';
  else if (mode === 'plasmaGrid') visualizerGrid.style.display = '';
  else if (mode === 'plasmaGlobe' && plasmaGlobeIcon) plasmaGlobeIcon.style.display = '';
  else if (mode === 'random') visualizerInterrobang.style.display = '';
}

// Set the correct icon for the default mode on load
updateVisualizerIcon();
