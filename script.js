const audio = document.getElementById("audio");
const playPauseBtn = document.getElementById("playPause");
const progressBar = document.getElementById("progressBar");
const progressBarContainer = document.querySelector(".progress-bar-container");
const fileInput = document.getElementById("fileInput");
const dropArea = document.getElementById("dropArea");
const coverImage = document.getElementById("coverImage");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const playPauseIcon = document.getElementById("playPauseIcon");

const shuffleBtn = document.getElementById("shuffleBtn");
const repeatBtn = document.getElementById("repeatBtn");
const shuffleIcon = document.getElementById("shuffleIcon");
const repeatIcon = document.getElementById("repeatIcon");

const currentTimeEl = document.getElementById("currentTime");
const totalTimeEl = document.getElementById("totalTime");

const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");

let playlist = [];
let currentIndex = -1;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;

let shuffleOrder = [];
let shufflePosition = 0;

/* ---------- VISUALIZER SETTINGS ---------- */
let visualizerSensitivity = 0.6;
let visualizerHeight = 45; // shorter visualizer (was 90)


let audioContext;
let analyser;
let source;
let dataArray;
let bufferLength;
let animationId;

/* ---------- COVER IMAGES ---------- */

const coverImages = [
  "default-cover.png",
  "default-cover1.png",
  "default-cover2.png",
  "default-cover3.png",
  "default-cover4.png",
  "default-cover5.png",
  "default-cover6.png",
  "default-cover7.png"
];

/* ---------- TIME FORMATTER ---------- */

function formatTime(time) {
  if (isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

/* ---------- TITLE AUTO SCROLL (FIXED) ---------- */

let titleAnimationFrame;
let titleOffset = 0;

function handleTitleScroll() {
  const title = document.querySelector(".song-title");
  const wrapper = document.querySelector(".song-title-wrapper");

  if (!title || !wrapper) return;

  cancelAnimationFrame(titleAnimationFrame);
  titleOffset = 0;
  title.style.transform = "translateX(0px)";

  const wrapperWidth = wrapper.offsetWidth;
  const titleWidth = title.scrollWidth;

  const overflow = titleWidth - wrapperWidth;

  if (overflow <= 0) return;

  function animate() {
    titleOffset -= 0.5;

    if (Math.abs(titleOffset) > overflow) {
      titleOffset = 0;
    }

    title.style.transform = `translateX(${titleOffset}px)`;
    titleAnimationFrame = requestAnimationFrame(animate);
  }

  setTimeout(() => {
    animate();
  }, 800);
}

/* ---------- VISUALIZER SETUP ---------- */

function initVisualizer() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();

    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    analyser.fftSize = 1024;
    bufferLength = analyser.fftSize;
    dataArray = new Uint8Array(bufferLength);
  }

  resizeCanvas();
  drawVisualizer();
}

function resizeCanvas() {
  const width = progressBarContainer.offsetWidth;

  canvas.style.width = width + "px";
  canvas.width = width;

  canvas.height = visualizerHeight;
}

window.addEventListener("resize", resizeCanvas);

// smoothing buffer
let smoothData = new Array(61).fill(0);

function drawVisualizer() {
  animationId = requestAnimationFrame(drawVisualizer);

  analyser.getByteFrequencyData(dataArray);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bands = 61;
  const centerY = canvas.height / 2;
  const sliceWidth = canvas.width / bands;

  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "#7b2cff");
  gradient.addColorStop(1, "#ffffff");
  ctx.strokeStyle = gradient;

  ctx.beginPath();
  ctx.moveTo(0, centerY);

  let direction = 1;

  for (let i = 0; i < bands; i++) {

    // use same style scaling as CurveH
    let raw = dataArray[i] / 255;

    // smoothing like AverageSize
    smoothData[i] += (raw - smoothData[i]) * 0.25;

    const amplitude = smoothData[i] * visualizerHeight;

    const x = i * sliceWidth;
    const nextX = (i + 1) * sliceWidth;

    const controlX = x + sliceWidth / 2;
    const controlY = centerY + amplitude * direction;

    ctx.quadraticCurveTo(controlX, controlY, nextX, centerY);

    direction *= -1; // alternate up/down like Rainmeter
  }

  ctx.stroke();
}


/* ---------- FILE HANDLING ---------- */

function handleFiles(files) {
  for (const file of files) {
    if (!file || !file.type.startsWith("audio/")) continue;

    playlist.push({
      name: file.name.replace(/\.[^/.]+$/, ""),
      url: URL.createObjectURL(file),
    });
  }

  if (currentIndex === -1 && playlist.length > 0) {
    currentIndex = 0;
    loadSong(currentIndex, true);
  }

  if (isShuffle) generateShuffleOrder();
}

/* ---------- LOAD SONG ---------- */

function getSequentialCover(index) {
  return coverImages[index % coverImages.length];
}

function loadSong(index, autoplay = false) {
  const song = playlist[index];
  if (!song) return;

  currentIndex = index;
  audio.src = song.url;

  const titleEl = document.querySelector(".song-title");
  titleEl.textContent = song.name;
  handleTitleScroll();

  coverImage.src = getSequentialCover(index);
  coverImage.style.display = "block";

  if (autoplay) {
    audio.play();
    playPauseIcon.src = "btn-pause.png";
    isPlaying = true;

    if (!audioContext) initVisualizer();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
  } else {
    playPauseIcon.src = "btn-play.png";
    isPlaying = false;
  }
}

/* ---------- SHUFFLE LOGIC ---------- */

function generateShuffleOrder() {
  shuffleOrder = playlist.map((_, index) => index);

  for (let i = shuffleOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffleOrder[i], shuffleOrder[j]] =
      [shuffleOrder[j], shuffleOrder[i]];
  }

  shufflePosition = shuffleOrder.indexOf(currentIndex);
}

/* ---------- NEXT / PREV ---------- */

function playNextSong() {
  if (playlist.length === 0) return;

  if (isShuffle) {
    if (shuffleOrder.length !== playlist.length) {
      generateShuffleOrder();
    }

    shufflePosition++;

    if (shufflePosition >= shuffleOrder.length) {
      generateShuffleOrder();
      shufflePosition = 0;
    }

    currentIndex = shuffleOrder[shufflePosition];
  } else {
    currentIndex = (currentIndex + 1) % playlist.length;
  }

  loadSong(currentIndex, true);
}

function playPrevSong() {
  if (playlist.length === 0) return;

  if (isShuffle) {
    shufflePosition--;
    if (shufflePosition < 0) {
      shufflePosition = shuffleOrder.length - 1;
    }
    currentIndex = shuffleOrder[shufflePosition];
  } else {
    currentIndex =
      (currentIndex - 1 + playlist.length) % playlist.length;
  }

  loadSong(currentIndex, true);
}

nextBtn.addEventListener("click", playNextSong);
prevBtn.addEventListener("click", playPrevSong);

/* ---------- SHUFFLE BUTTON ---------- */

shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;

  shuffleIcon.src = isShuffle
    ? "btn-shuffle-on.png"
    : "btn-shuffle-off.png";

  shuffleBtn.classList.toggle("active", isShuffle);

  if (isShuffle) generateShuffleOrder();
});

/* ---------- REPEAT BUTTON ---------- */

repeatBtn.addEventListener("click", () => {
  isRepeat = !isRepeat;

  repeatIcon.src = isRepeat
    ? "btn-repeat-on.png"
    : "btn-repeat-off.png";

  repeatBtn.classList.toggle("active", isRepeat);
});

/* ---------- AUTO PLAY ---------- */

audio.addEventListener("ended", () => {
  if (isRepeat) {
    audio.currentTime = 0;
    audio.play();
  } else {
    playNextSong();
  }
});

/* ---------- PLAY / PAUSE ---------- */

playPauseBtn.addEventListener("click", () => {
  if (!audio.src) return;

  if (isPlaying) {
    audio.pause();
    playPauseIcon.src = "btn-play.png";
  } else {
    audio.play();
    playPauseIcon.src = "btn-pause.png";

    if (!audioContext) initVisualizer();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
  }

  isPlaying = !isPlaying;
});

/* ---------- PROGRESS ---------- */

audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;

  progressBar.style.width =
    `${(audio.currentTime / audio.duration) * 100}%`;

  if (currentTimeEl)
    currentTimeEl.textContent = formatTime(audio.currentTime);
});

progressBarContainer.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!audio.duration) return;

  const rect = progressBarContainer.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const width = rect.width;

  audio.currentTime = (clickX / width) * audio.duration;
});

/* ---------- DRAG & DROP ---------- */

fileInput.addEventListener("change", () =>
  handleFiles(fileInput.files)
);

dropArea.addEventListener("click", (e) => {
  // If clicking controls or progress bar, do nothing
  if (
    e.target.closest("button") ||
    e.target.closest(".progress-bar-container") ||
    e.target.closest("#progressBar")
  ) {
    return;
  }

  fileInput.click();
});

dropArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropArea.classList.add("dragover");
});

dropArea.addEventListener("dragleave", () => {
  dropArea.classList.remove("dragover");
});

dropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  dropArea.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});

/* ---------- ELECTRON WINDOW CONTROLS ---------- */

window.addEventListener("DOMContentLoaded", () => {
  const minBtn = document.querySelector(".min-btn");
  const closeBtn = document.querySelector(".close-btn");

  if (minBtn && window.electronAPI) {
    minBtn.addEventListener("click", () => {
      window.electronAPI.minimizeWindow();
    });
  }

  if (closeBtn && window.electronAPI) {
    closeBtn.addEventListener("click", () => {
      window.electronAPI.closeWindow();
    });
  }
});
