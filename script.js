// ChatGPT5 Desktop fit-to-viewport scaling (uniform, no scrollbars)
(function() {
  const BASE = { w: 1200, h: 800 };
  const root = document.getElementById('game-container');
  if (!root) return;

  function fit() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / BASE.w, vh / BASE.h);

    root.style.transform = `scale(${scale})`;
    const left = (vw - BASE.w * scale) / 2;
    const top  = (vh - BASE.h * scale) / 2;
    root.style.left = `${Math.round(left)}px`
    root.style.top  = `${Math.round(top)}px`
  }

  // rAF-throttled resize
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; fit(); });
  }

  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule, { passive: true });

  // Initial
  fit();
})();

// ---- Keep your existing game logic below this line ----
document.addEventListener('DOMContentLoaded', () => {
  const logEl = document.getElementById('game-log');
  const input = document.getElementById('command-input');
  const enter = document.getElementById('enter-button');

  function appendLog(text) {
    if (!logEl) return;
    const p = document.createElement('p');
    p.textContent = text;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }

  if (enter && input) {
    enter.addEventListener('click', () => {
      if (!input.value.trim()) return;
      appendLog('> ' + input.value.trim());
      input.value = '';
      input.focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        enter.click();
      }
    });
  }
});
