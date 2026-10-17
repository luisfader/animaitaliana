// Testo sincronizzato: il verso che si sta cantando si illumina.
//
// Ogni canzone in tracks.js può avere un campo "times": un elenco di secondi,
// uno per ogni riga (non vuota) del testo, nell'ordine in cui appaiono.
// Le canzoni senza "times" mostrano il testo normale.
//
// Per creare i tempi, apri il sito con ?sincronizar alla fine dell'indirizzo
// (es. https://luisfader.github.io/animaitaliana/?sincronizar) e premi Invio
// all'inizio di ogni verso mentre la canzone suona.
(() => {
  const audio = document.getElementById('audio');
  const box = document.getElementById('lyricsText');
  if (!audio || !box) return;

  const syncMode = /[?&]sincronizar\b/.test(location.search);
  let track = null;
  let lines = [];
  let times = null;
  let active = -1;
  let userScrollUntil = 0;
  let raf = 0;
  let marks = [];
  let panel = null;

  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const round = n => Math.round(n * 100) / 100;

  function setTrack(t) {
    track = t;
    active = -1;
    const blocks = String(t.lyrics || '').trim().split(/\n\s*\n/).filter(Boolean);
    let n = 0;
    box.innerHTML = blocks.map(b =>
      '<p>' + b.split('\n')
        .filter(l => l.trim())
        .map(l => `<span class="lyric-line" data-i="${n++}">${esc(l.trim())}</span>`)
        .join('<br>') + '</p>'
    ).join('');
    lines = [...box.querySelectorAll('.lyric-line')];

    times = Array.isArray(t.times) && t.times.length ? t.times.slice() : null;
    if (syncMode) {
      marks = loadMarks();
      if (marks.length) times = marks.slice();
    }
    box.classList.toggle('synced', !!times || syncMode);
    box.scrollTop = 0;
    update(true);
    if (syncMode) renderPanel();
  }

  function currentIndex(t) {
    if (!times) return -1;
    let idx = -1;
    for (let i = 0; i < times.length && i < lines.length; i++) {
      if (times[i] <= t + 0.05) idx = i;
      else break;
    }
    return idx;
  }

  function update(force) {
    const i = currentIndex(audio.currentTime || 0);
    if (i === active && !force) return;
    active = i;
    lines.forEach((el, n) => {
      el.classList.toggle('active', n === i);
      el.classList.toggle('sung', i >= 0 && n < i);
      el.classList.toggle('next-mark', syncMode && n === marks.length);
    });
    if (i >= 0 && Date.now() > userScrollUntil) centerOn(lines[i]);
  }

  function centerOn(el) {
    const top = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function loop() {
    update();
    raf = requestAnimationFrame(loop);
  }
  audio.addEventListener('play', () => { cancelAnimationFrame(raf); loop(); });
  audio.addEventListener('pause', () => cancelAnimationFrame(raf));
  audio.addEventListener('seeked', () => update(true));
  audio.addEventListener('timeupdate', () => { if (audio.paused) update(); });

  // Se l'utente scorre il testo a mano, per qualche secondo non lo spostiamo noi.
  ['wheel', 'touchstart'].forEach(ev =>
    box.addEventListener(ev, () => { userScrollUntil = Date.now() + 4000; }, { passive: true })
  );

  // Clic su un verso: salta a quel punto della canzone.
  box.addEventListener('click', e => {
    const el = e.target.closest('.lyric-line');
    if (!el || !times) return;
    const t = times[Number(el.dataset.i)];
    if (t == null) return;
    audio.currentTime = t;
    userScrollUntil = 0;
    update(true);
  });

  // ---------- Modo sincronizar (solo para el autor) ----------
  function storeKey() { return 'karaoke_marks_' + (track.id || track.title); }
  function loadMarks() {
    try { return JSON.parse(localStorage.getItem(storeKey())) || []; } catch (e) { return []; }
  }
  function saveMarks() {
    try { localStorage.setItem(storeKey(), JSON.stringify(marks)); } catch (e) {}
  }

  function mark() {
    if (!track || marks.length >= lines.length) return;
    marks.push(round(audio.currentTime || 0));
    afterChange();
  }
  function undo() {
    if (!marks.length) return;
    const t = marks.pop();
    audio.currentTime = Math.max(0, t - 3);
    afterChange();
  }
  function reset() {
    if (!confirm('¿Borrar todos los tiempos marcados de esta canción?')) return;
    marks = [];
    audio.currentTime = 0;
    afterChange();
  }
  function afterChange() {
    saveMarks();
    times = marks.length ? marks.slice() : (Array.isArray(track.times) ? track.times.slice() : null);
    update(true);
    renderPanel();
  }

  function renderPanel() {
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'sync-panel';
      box.parentNode.insertBefore(panel, box);
      panel.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        ({ mark, undo, reset, copy })[b.dataset.act]();
      });
    }
    const done = marks.length >= lines.length && lines.length > 0;
    const snippet = `"times": [${marks.join(', ')}]`;
    panel.innerHTML = `
      <p class="sync-title">Modo sincronizar · ${esc(track.title)}</p>
      <p class="sync-help">Dale a reproducir y pulsa <b>Intro</b> (o el botón) justo cuando empieza cada verso.
        <b>Retroceso</b> deshace el último y vuelve 3 segundos atrás. Lo marcado se guarda en este navegador.</p>
      <div class="sync-actions">
        <button class="ui-btn small sync-main" data-act="mark" ${done ? 'disabled' : ''}>Marcar verso</button>
        <button class="ui-btn small" data-act="undo" ${marks.length ? '' : 'disabled'}>Deshacer</button>
        <button class="ui-btn small" data-act="reset" ${marks.length ? '' : 'disabled'}>Empezar de nuevo</button>
        <span class="sync-count">${marks.length} / ${lines.length} versos</span>
      </div>
      ${marks.length ? `
        <p class="sync-help">${done ? '¡Listo! ' : ''}Copia esto y pégamelo en el chat (o añádelo a la canción en tracks.js):</p>
        <textarea class="sync-out" readonly rows="3">${snippet}</textarea>
        <button class="ui-btn small" data-act="copy">Copiar</button>` : ''}`;
  }

  function copy() {
    const ta = panel.querySelector('.sync-out');
    if (!ta) return;
    ta.select();
    (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject())
      .catch(() => document.execCommand('copy'));
  }

  if (syncMode) {
    window.addEventListener('keydown', e => {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'Enter') { e.preventDefault(); mark(); }
      else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
    });
  }

  window.Karaoke = { setTrack };
})();
