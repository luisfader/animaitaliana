
(() => {
  const tracks = window.TRACKS || [];
  const $ = (id) => document.getElementById(id);
  const els = {
    audio: $('audio'),
    bgImage: $('bgImage'),
    coverImage: $('coverImage'),
    spectrum: $('spectrumCanvas'),
    trackTitle: $('trackTitle'),
    trackMood: $('trackMood'),
    trackDescription: $('trackDescription'),
    trackArtist: $('trackArtist'),
    trackIndexLabel: $('trackIndexLabel'),
    statusLabel: $('statusLabel'),
    artTitle: $('artTitle'),
    artArtist: $('artArtist'),
    dockTitle: $('dockTitle'),
    dockArtist: $('dockArtist'),
    lyricsText: $('lyricsText'),
    playlistPanel: $('playlistPanel'),
    playlistHandle: $('playlistHandle'),
    playlistList: $('playlistList'),
    playBtn: $('playBtn'),
    prevBtn: $('prevBtn'),
    nextBtn: $('nextBtn'),
    muteBtn: $('muteBtn'),
    progressBar: $('progressBar'),
    volumeBar: $('volumeBar'),
    currentTime: $('currentTime'),
    durationTime: $('durationTime'),
    focusBtn: $('focusBtn'),
    wideLyricsBtn: $('wideLyricsBtn'),
    togglePlaylistBtn: $('togglePlaylistBtn'),
    collapsePlaylistBtn: $('collapsePlaylistBtn')
  };

  const key = 'italian_mood_site_state_v3';
  const state = {
    index: 0,
    volume: 0.9,
    muted: false,
    currentTimes: {},
    wantsPlay: false,
    playlistHidden: false,
    playlistPos: null,
    audioCtx: null,
    analyser: null,
    source: null,
    buffer: null,
    raf: 0
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Number.isInteger(s.index) && s.index >= 0 && s.index < tracks.length) state.index = s.index;
      if (typeof s.volume === 'number') state.volume = Math.min(1, Math.max(0, s.volume));
      if (typeof s.muted === 'boolean') state.muted = s.muted;
      if (s.currentTimes && typeof s.currentTimes === 'object') state.currentTimes = s.currentTimes;
      if (typeof s.wantsPlay === 'boolean') state.wantsPlay = s.wantsPlay;
      if (typeof s.playlistHidden === 'boolean') state.playlistHidden = s.playlistHidden;
      if (s.playlistPos && typeof s.playlistPos === 'object') state.playlistPos = s.playlistPos;
    } catch (e) {}
  }
  function saveState() {
    localStorage.setItem(key, JSON.stringify({
      index: state.index,
      volume: state.volume,
      muted: state.muted,
      currentTimes: state.currentTimes,
      wantsPlay: !els.audio.paused && !els.audio.ended,
      playlistHidden: state.playlistHidden,
      playlistPos: state.playlistPos
    }));
  }

  function fmt(sec) {
    if (!Number.isFinite(sec)) return '0:00';
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function setStatus(text) {
    els.statusLabel.textContent = text;
  }

  function renderLyrics(text) {
    const blocks = String(text || '').trim().split(/\n\s*\n/).filter(Boolean);
    els.lyricsText.innerHTML = blocks.map(x => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('');
  }

  function updateTexts(track) {
    els.trackTitle.textContent = track.title;
    els.trackMood.textContent = track.mood;
    els.trackDescription.textContent = track.description;
    els.trackArtist.textContent = track.artist;
    els.trackIndexLabel.textContent = `${String(state.index + 1).padStart(2, '0')} / ${String(tracks.length).padStart(2, '0')}`;
    els.artTitle.textContent = track.title;
    els.artArtist.textContent = track.artist;
    els.dockTitle.textContent = track.title;
    els.dockArtist.textContent = track.artist;
    renderLyrics(track.lyrics);
  }

  function switchImage(imgEl, src) {
    imgEl.classList.add('switching');
    const pre = new Image();
    pre.onload = () => {
      imgEl.src = src;
      requestAnimationFrame(() => imgEl.classList.remove('switching'));
    };
    pre.onerror = () => {
      imgEl.src = src;
      imgEl.classList.remove('switching');
    };
    pre.src = src;
  }

  function switchImages(track) {
    switchImage(els.bgImage, track.image);
    switchImage(els.coverImage, track.image);
  }

  function updateButtons() {
    els.playBtn.textContent = els.audio.paused ? '▶' : '❚❚';
    els.muteBtn.textContent = state.muted || els.audio.volume === 0 ? '🔇' : (els.audio.volume < 0.45 ? '🔉' : '🔊');
  }

  function updatePlaylistActive() {
    els.playlistList.querySelectorAll('.playlist__button').forEach((btn, i) => btn.classList.toggle('active', i === state.index));
  }

  function buildPlaylist() {
    els.playlistList.innerHTML = '';
    tracks.forEach((track, i) => {
      const li = document.createElement('li');
      li.className = 'playlist__item';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'playlist__button';
      btn.innerHTML = `
        <img class="playlist__thumb" src="${track.image}" alt="">
        <div class="playlist__meta">
          <p class="playlist__num">track ${String(i + 1).padStart(2, '0')}</p>
          <p class="playlist__title">${track.title}</p>
          <p class="playlist__mood">${track.mood}</p>
        </div>
        <span class="playlist__time">${fmt(track.duration_seconds || 0)}</span>
      `;
      btn.addEventListener('click', () => loadTrack(i, true));
      li.appendChild(btn);
      els.playlistList.appendChild(li);
    });
    updatePlaylistActive();
  }

  function initAudioGraph() {
    if (state.audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    state.audioCtx = new AC();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 512;
    state.analyser.smoothingTimeConstant = 0.82;
    state.buffer = new Uint8Array(state.analyser.frequencyBinCount);
    state.source = state.audioCtx.createMediaElementSource(els.audio);
    state.source.connect(state.analyser);
    state.analyser.connect(state.audioCtx.destination);
  }

  async function safePlay() {
    try {
      initAudioGraph();
      if (state.audioCtx && state.audioCtx.state === 'suspended') await state.audioCtx.resume();
      await els.audio.play();
      setStatus('Reproduciendo');
    } catch (err) {
      setStatus('Pulsa play para iniciar');
    }
    updateButtons();
    saveState();
  }

  function loadTrack(index, autoplay = false) {
    if (!tracks.length) return;
    if (index < 0) index = tracks.length - 1;
    if (index >= tracks.length) index = 0;

    const prev = tracks[state.index];
    if (prev) state.currentTimes[prev.id] = els.audio.currentTime || 0;

    state.index = index;
    const track = tracks[state.index];
    updateTexts(track);
    switchImages(track);
    updatePlaylistActive();
    setStatus('Cargando…');

    const restoreAt = Number(state.currentTimes[track.id] || 0);
    els.audio.pause();
    els.audio.src = track.audio;
    els.audio.load();

    const onMeta = () => {
      if (restoreAt > 0 && restoreAt < (els.audio.duration || Infinity)) {
        try { els.audio.currentTime = restoreAt; } catch (e) {}
      }
      els.durationTime.textContent = fmt(els.audio.duration || 0);
      els.currentTime.textContent = fmt(els.audio.currentTime || 0);
      els.progressBar.value = els.audio.duration ? (els.audio.currentTime / els.audio.duration) * 100 : 0;
      els.audio.volume = state.volume;
      els.audio.muted = state.muted;
      updateButtons();
      setStatus('Listo');
      els.audio.removeEventListener('loadedmetadata', onMeta);
      if (autoplay) safePlay();
      saveState();
    };
    els.audio.addEventListener('loadedmetadata', onMeta);
  }

  function applyPlaylistVisibility() {
    els.playlistPanel.classList.toggle('hidden', state.playlistHidden);
  }

  function defaultPlaylistPos() {
    return { left: 20, top: 112 };
  }

  function applyPlaylistPosition() {
    if (window.innerWidth <= 980) {
      els.playlistPanel.style.left = '';
      els.playlistPanel.style.top = '';
      return;
    }
    const pos = state.playlistPos || defaultPlaylistPos();
    const rect = els.playlistPanel.getBoundingClientRect();
    const maxLeft = Math.max(12, window.innerWidth - rect.width - 12);
    const maxTop = Math.max(12, window.innerHeight - rect.height - 150);
    const left = Math.min(maxLeft, Math.max(12, pos.left));
    const top = Math.min(maxTop, Math.max(12, pos.top));
    els.playlistPanel.style.left = `${left}px`;
    els.playlistPanel.style.top = `${top}px`;
    state.playlistPos = { left, top };
  }

  function makePlaylistDraggable() {
    let dragging = false;
    let dx = 0, dy = 0;

    const start = (x, y) => {
      if (window.innerWidth <= 980) return;
      dragging = true;
      const rect = els.playlistPanel.getBoundingClientRect();
      dx = x - rect.left;
      dy = y - rect.top;
    };

    const move = (x, y) => {
      if (!dragging) return;
      const rect = els.playlistPanel.getBoundingClientRect();
      const maxLeft = Math.max(12, window.innerWidth - rect.width - 12);
      const maxTop = Math.max(12, window.innerHeight - rect.height - 150);
      const left = Math.min(maxLeft, Math.max(12, x - dx));
      const top = Math.min(maxTop, Math.max(12, y - dy));
      els.playlistPanel.style.left = `${left}px`;
      els.playlistPanel.style.top = `${top}px`;
      state.playlistPos = { left, top };
    };

    const stop = () => { if (dragging) { dragging = false; saveState(); } };

    els.playlistHandle.addEventListener('mousedown', (e) => { start(e.clientX, e.clientY); e.preventDefault(); });
    document.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
    document.addEventListener('mouseup', stop);

    els.playlistHandle.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener('touchend', stop);

    window.addEventListener('resize', () => {
      if (!isDesktop()) {
        panel.style.left = '';
        panel.style.top = '';
      } else {
        applyPlaylistPosition();
      }
    });
  }

  function drawSpectrum() {
    const canvas = els.spectrum;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    if (!state.analyser || !state.buffer) {
      // idle glow line
      ctx.strokeStyle = 'rgba(56, 213, 222, 0.58)';
      ctx.lineWidth = 2 * dpr;
      ctx.shadowColor = 'rgba(56, 213, 222, 0.9)';
      ctx.shadowBlur = 18 * dpr;
      ctx.beginPath();
      const baseY = height * 0.72;
      for (let x = 0; x <= width; x += width / 24) {
        const y = baseY + Math.sin((x / width) * Math.PI * 3) * (height * 0.02);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      state.raf = requestAnimationFrame(drawSpectrum);
      return;
    }

    state.analyser.getByteFrequencyData(state.buffer);
    const points = 48;
    const step = Math.max(1, Math.floor(state.buffer.length / points));
    const baseY = height * 0.72;

    ctx.strokeStyle = 'rgba(56, 213, 222, 0.98)';
    ctx.lineWidth = 3 * dpr;
    ctx.shadowColor = 'rgba(56, 213, 222, 0.95)';
    ctx.shadowBlur = 24 * dpr;
    ctx.beginPath();

    for (let i = 0; i < points; i++) {
      const v = state.buffer[i * step] / 255;
      const x = (i / (points - 1)) * width;
      const y = baseY - (v * height * 0.34) + Math.sin(i * 0.55) * height * 0.01;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const prevX = ((i - 1) / (points - 1)) * width;
        const cx = (prevX + x) / 2;
        const prevV = state.buffer[Math.max(0, (i - 1) * step)] / 255;
        const prevY = baseY - (prevV * height * 0.34) + Math.sin((i - 1) * 0.55) * height * 0.01;
        ctx.quadraticCurveTo(prevX, prevY, cx, (prevY + y) / 2);
      }
    }
    ctx.lineTo(width, baseY);
    ctx.stroke();

    // soft fill under line
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(56, 213, 222, 0.14)';
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    state.raf = requestAnimationFrame(drawSpectrum);
  }

  function attachEvents() {
    els.playBtn.addEventListener('click', () => els.audio.paused ? safePlay() : els.audio.pause());
    els.prevBtn.addEventListener('click', () => loadTrack(state.index - 1, true));
    els.nextBtn.addEventListener('click', () => loadTrack(state.index + 1, true));

    els.audio.addEventListener('play', () => { setStatus('Reproduciendo'); updateButtons(); saveState(); });
    els.audio.addEventListener('pause', () => { setStatus('Pausado'); updateButtons(); saveState(); });
    els.audio.addEventListener('timeupdate', () => {
      const t = tracks[state.index];
      if (t) state.currentTimes[t.id] = els.audio.currentTime || 0;
      els.currentTime.textContent = fmt(els.audio.currentTime || 0);
      els.durationTime.textContent = fmt(els.audio.duration || 0);
      els.progressBar.value = els.audio.duration ? (els.audio.currentTime / els.audio.duration) * 100 : 0;
      saveState();
    });
    els.audio.addEventListener('ended', () => loadTrack(state.index + 1, true));
    els.audio.addEventListener('error', () => setStatus('Error de audio'));

    els.progressBar.addEventListener('input', () => {
      if (!Number.isFinite(els.audio.duration)) return;
      els.audio.currentTime = (Number(els.progressBar.value) / 100) * els.audio.duration;
    });

    els.volumeBar.addEventListener('input', () => {
      state.volume = Number(els.volumeBar.value);
      els.audio.volume = state.volume;
      if (state.volume > 0) state.muted = false;
      els.audio.muted = state.muted;
      updateButtons();
      saveState();
    });

    els.muteBtn.addEventListener('click', () => {
      state.muted = !state.muted;
      els.audio.muted = state.muted;
      updateButtons();
      saveState();
    });

    els.focusBtn.addEventListener('click', () => document.body.classList.toggle('focus'));
    els.wideLyricsBtn.addEventListener('click', () => document.body.classList.toggle('wide-lyrics'));
    els.togglePlaylistBtn.addEventListener('click', () => {
      state.playlistHidden = !state.playlistHidden;
      applyPlaylistVisibility();
      saveState();
    });
    els.collapsePlaylistBtn.addEventListener('click', () => {
      state.playlistHidden = true;
      applyPlaylistVisibility();
      saveState();
    });

    window.addEventListener('resize', applyPlaylistPosition);
  }

  function init() {
    loadState();
    buildPlaylist();
    attachEvents();
    makePlaylistDraggable();
    applyPlaylistVisibility();
    requestAnimationFrame(() => {
      applyPlaylistPosition();
      drawSpectrum();
    });

    els.volumeBar.value = String(state.volume);
    loadTrack(state.index, false);

    // Try to resume only after user gesture if browser blocks autoplay.
    if (state.wantsPlay) {
      const resumeOnce = () => {
        safePlay();
        window.removeEventListener('pointerdown', resumeOnce);
        window.removeEventListener('keydown', resumeOnce);
      };
      window.addEventListener('pointerdown', resumeOnce, { once: true });
      window.addEventListener('keydown', resumeOnce, { once: true });
    }
  }

  init();
})();
