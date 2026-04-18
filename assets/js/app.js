
const sections = window.NOVEL_DATA.sections;
const tracks = window.NOVEL_DATA.tracks;

const chapterGrid = document.getElementById('chapterGrid');
const chapterList = document.getElementById('chapterList');
const chapterCount = document.getElementById('chapterCount');
const readerTitle = document.getElementById('readerTitle');
const readerContent = document.getElementById('readerContent');
const searchInput = document.getElementById('chapterSearch');

const prevChapterBtn = document.getElementById('prevChapter');
const nextChapterBtn = document.getElementById('nextChapter');
const fontUpBtn = document.getElementById('fontUp');
const fontDownBtn = document.getElementById('fontDown');
const openRandomBtn = document.getElementById('openRandom');
const openSoundtrackBtn = document.getElementById('openSoundtrack');
const toggleThemeBtn = document.getElementById('toggleTheme');

const soundtrackWindow = document.getElementById('soundtrackWindow');
const minimizeSoundtrackBtn = document.getElementById('minimizeSoundtrack');
const restoreSoundtrackBtn = document.getElementById('restoreSoundtrack');
const dragHandle = soundtrackWindow.querySelector('.drag-handle');

const audio = document.getElementById('audio');
const playlistEl = document.getElementById('playlist');
const playPauseBtn = document.getElementById('playPause');
const prevTrackBtn = document.getElementById('prevTrack');
const nextTrackBtn = document.getElementById('nextTrack');
const seekBar = document.getElementById('seekBar');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const nowTitle = document.getElementById('nowTitle');
const nowArtist = document.getElementById('nowArtist');
const playlistNote = document.getElementById('playlistNote');

let currentChapter = 0;
let currentTrack = 0;
let fontSize = Number(localStorage.getItem('reader-font-size') || 1.08);

chapterCount.textContent = sections.filter(s => s.title.startsWith('Глава')).length.toString();

function getChapterIndexFromHash() {
  const slug = location.hash.replace('#', '');
  const idx = sections.findIndex(s => s.slug === slug);
  if (idx >= 0) return idx;
  return 0;
}

function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function renderCatalog(filter = '') {
  const q = filter.trim().toLowerCase();
  chapterGrid.innerHTML = '';
  sections
    .filter(section => section.title.toLowerCase().includes(q))
    .forEach((section, index) => {
      const card = document.createElement('button');
      card.className = 'chapter-card';
      card.innerHTML = `
        <div class="num">${section.title.startsWith('Эпилог') ? 'финал' : 'глава'}</div>
        <h3>${section.title}</h3>
        <p>${section.excerpt}</p>
      `;
      card.addEventListener('click', () => openChapter(index));
      chapterGrid.appendChild(card);
    });
}

function renderSidebar() {
  chapterList.innerHTML = '';
  sections.forEach((section, index) => {
    const btn = document.createElement('button');
    btn.className = `chapter-link ${index === currentChapter ? 'active' : ''}`;
    btn.textContent = section.title;
    btn.addEventListener('click', () => openChapter(index));
    chapterList.appendChild(btn);
  });
}

function renderReader() {
  const section = sections[currentChapter];
  if (!section) return;
  readerTitle.textContent = section.title;
  readerContent.innerHTML = '';
  section.paras.forEach((para, idx) => {
    const p = document.createElement('p');
    if (idx === 0) p.classList.add('dropcap');
    p.textContent = para;
    readerContent.appendChild(p);
  });
  renderSidebar();
  location.hash = section.slug;
}

function openChapter(index) {
  currentChapter = index;
  renderReader();
  document.getElementById('reader').scrollIntoView({behavior: 'smooth', block: 'start'});
}

prevChapterBtn.addEventListener('click', () => {
  currentChapter = (currentChapter - 1 + sections.length) % sections.length;
  renderReader();
});

nextChapterBtn.addEventListener('click', () => {
  currentChapter = (currentChapter + 1) % sections.length;
  renderReader();
});

searchInput.addEventListener('input', (e) => renderCatalog(e.target.value));

fontUpBtn.addEventListener('click', () => {
  fontSize = Math.min(fontSize + 0.08, 1.72);
  document.documentElement.style.setProperty('--reader-size', `${fontSize}rem`);
  localStorage.setItem('reader-font-size', fontSize.toFixed(2));
});
fontDownBtn.addEventListener('click', () => {
  fontSize = Math.max(fontSize - 0.08, 0.92);
  document.documentElement.style.setProperty('--reader-size', `${fontSize}rem`);
  localStorage.setItem('reader-font-size', fontSize.toFixed(2));
});
openRandomBtn.addEventListener('click', () => {
  const randomIndex = Math.floor(Math.random() * sections.length);
  openChapter(randomIndex);
});
openSoundtrackBtn.addEventListener('click', () => {
  soundtrackWindow.classList.remove('minimized');
  restoreSoundtrackBtn.classList.add('hidden');
});

function updateThemeLabel(){
  toggleThemeBtn.textContent = document.body.classList.contains('light') ? 'Темнее' : 'Светлее';
}

toggleThemeBtn.addEventListener('click', () => {
  document.body.classList.toggle('light');
  localStorage.setItem('site-theme', document.body.classList.contains('light') ? 'light' : 'dark');
  updateThemeLabel();
});

function renderPlaylist() {
  playlistEl.innerHTML = '';
  tracks.forEach((track, index) => {
    const btn = document.createElement('button');
    btn.className = `track ${index === currentTrack ? 'active' : ''}`;
    btn.innerHTML = `
      <div>
        <strong>${track.title}</strong>
        <small>${track.artist}</small>
      </div>
      <span>${track.duration}</span>
    `;
    btn.addEventListener('click', () => loadTrack(index, true));
    playlistEl.appendChild(btn);
  });
}

async function loadTrack(index, autoplay = false) {
  currentTrack = index;
  const track = tracks[index];
  nowTitle.textContent = track.title;
  nowArtist.textContent = track.artist;
  audio.src = track.file;
  renderPlaylist();

  if (autoplay) {
    try {
      await audio.play();
      playPauseBtn.textContent = '⏸';
      playlistNote.textContent = 'Если файл существует в папке assets/audio, воспроизведение начнётся сразу.';
    } catch (err) {
      playPauseBtn.textContent = '▶';
      playlistNote.innerHTML = 'Аудиофайл не найден. Добавьте трек в папку <code>assets/audio</code> с уже подготовленным именем файла.';
    }
  } else {
    playPauseBtn.textContent = '▶';
  }
}

playPauseBtn.addEventListener('click', async () => {
  if (!audio.src) {
    loadTrack(currentTrack, true);
    return;
  }
  if (audio.paused) {
    try {
      await audio.play();
      playPauseBtn.textContent = '⏸';
    } catch (err) {
      playlistNote.innerHTML = 'Пока файлов внутри нет. Скопируйте MP3 в <code>assets/audio</code>, и плеер заработает.';
    }
  } else {
    audio.pause();
    playPauseBtn.textContent = '▶';
  }
});

prevTrackBtn.addEventListener('click', () => loadTrack((currentTrack - 1 + tracks.length) % tracks.length, true));
nextTrackBtn.addEventListener('click', () => loadTrack((currentTrack + 1) % tracks.length, true));

audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  currentTimeEl.textContent = formatTime(audio.currentTime);
  totalTimeEl.textContent = formatTime(audio.duration);
  seekBar.value = (audio.currentTime / audio.duration) * 100;
});
audio.addEventListener('loadedmetadata', () => {
  totalTimeEl.textContent = formatTime(audio.duration);
});
audio.addEventListener('ended', () => loadTrack((currentTrack + 1) % tracks.length, true));
seekBar.addEventListener('input', (e) => {
  if (!audio.duration) return;
  audio.currentTime = (Number(e.target.value) / 100) * audio.duration;
});

minimizeSoundtrackBtn.addEventListener('click', () => {
  soundtrackWindow.classList.add('minimized');
  restoreSoundtrackBtn.classList.remove('hidden');
});
restoreSoundtrackBtn.addEventListener('click', () => {
  soundtrackWindow.classList.remove('minimized');
  restoreSoundtrackBtn.classList.add('hidden');
});


window.addEventListener('hashchange', () => {
  const idx = getChapterIndexFromHash();
  if (idx !== currentChapter) {
    currentChapter = idx;
    renderReader();
  }
});

function init() {
  const savedTheme = localStorage.getItem('site-theme');
  if (savedTheme === 'dark') {
    document.body.classList.remove('light');
  } else {
    document.body.classList.add('light');
  }
  updateThemeLabel();
  document.documentElement.style.setProperty('--reader-size', `${fontSize}rem`);
  currentChapter = getChapterIndexFromHash();
  renderCatalog();
  renderReader();
  renderPlaylist();
  loadTrack(0, false);
  soundtrackWindow.classList.add('minimized');
  restoreSoundtrackBtn.classList.remove('hidden');
}
init();
