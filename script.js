(() => {
  const $ = (id) => document.getElementById(id);
  const ui = {
    app: $("timerApp"), surface: $("timerSurface"), main: $("mainTime"), sub: $("subTime"),
    status: $("status"), hint: $("touchHint"), cycle: $("cycleNote"), progress: $("progressFill"),
    subBlock: $("subTimerBlock"), toggle: $("toggleButton"), reset: $("resetButton"),
    mute: $("muteButton"), fullscreen: $("fullscreenButton"), sound: $("soundState")
  };

  let running = false;
  let mainElapsed = 0;
  let mainStartedAt = 0;
  let subStartedAt = 0;
  let subElapsedWhenPaused = 0;
  let beepPlayed = false;
  let muted = false;
  let frameId = null;
  let audioContext = null;

  const now = () => performance.now();
  const format = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };
  const activeMainElapsed = (time = now()) => mainElapsed + (running ? time - mainStartedAt : 0);
  const activeSubElapsed = (time = now()) => running ? time - subStartedAt : subElapsedWhenPaused;

  function setStatus(label, state = "ready") {
    ui.status.textContent = label;
    ui.status.dataset.state = state;
    ui.app.dataset.state = state;
  }

  function updateDisplay(time = now()) {
    const mainMs = activeMainElapsed(time);
    const subMs = Math.min(activeSubElapsed(time), 30000);
    const reachedLimit = subMs >= 30000;
    ui.main.textContent = format(mainMs);
    ui.sub.textContent = format(subMs);
    ui.progress.style.width = `${(subMs / 30000) * 100}%`;
    ui.subBlock.classList.toggle("time-up", reachedLimit);
    ui.cycle.textContent = reachedLimit ? "30 SECONDS" : running ? "IN PROGRESS" : "NEW CYCLE";
  }

  function playBeep() {
    if (muted || !audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime;
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(940, start);
    oscillator.frequency.setValueAtTime(780, start + 1);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.48, start + 0.025);
    gain.gain.setValueAtTime(0.48, start + 1.82);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 2);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(start + 2);
  }

  function ensureAudio() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    if (!audioContext) audioContext = new AudioContextConstructor();
    if (audioContext.state === "suspended") audioContext.resume();
  }

  function tick(time) {
    if (!running) return;
    const subMs = activeSubElapsed(time);
    if (subMs >= 30000 && !beepPlayed) {
      beepPlayed = true;
      playBeep();
      setStatus("TIME UP", "time-up");
    }
    updateDisplay(time);
    frameId = requestAnimationFrame(tick);
  }

  function startOrResume() {
    if (running) return;
    ensureAudio();
    const time = now();
    mainStartedAt = time;
    subStartedAt = time;
    subElapsedWhenPaused = 0;
    beepPlayed = false;
    running = true;
    setStatus("RUNNING", "running");
    ui.hint.textContent = "Touch anywhere to pause";
    ui.toggle.textContent = "Pause";
    updateDisplay(time);
    if (frameId === null) frameId = requestAnimationFrame(tick);
  }

  function pause() {
    if (!running) return;
    const time = now();
    mainElapsed += time - mainStartedAt;
    subElapsedWhenPaused = Math.min(time - subStartedAt, 30000);
    running = false;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    setStatus("PAUSED", "paused");
    ui.hint.textContent = "Touch anywhere to resume";
    ui.toggle.textContent = "Resume";
    updateDisplay(time);
  }

  function toggleTimer() { running ? pause() : startOrResume(); }

  function reset() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    running = false;
    mainElapsed = 0;
    mainStartedAt = 0;
    subStartedAt = 0;
    subElapsedWhenPaused = 0;
    beepPlayed = false;
    setStatus("READY", "ready");
    ui.hint.textContent = "Touch anywhere to start";
    ui.toggle.textContent = "Start";
    updateDisplay(0);
  }

  // The entire app is the touch target; controls are deliberately excluded.
  // Pointer events cover touch, pen, and mouse. The click fallback supports older browsers.
  function activateTimer(event) {
    if (event.target.closest("button")) return;
    event.preventDefault();
    toggleTimer();
  }
  if (window.PointerEvent) {
    ui.app.addEventListener("pointerup", activateTimer);
  } else {
    ui.app.addEventListener("click", activateTimer);
  }

  ui.toggle.addEventListener("click", (event) => { event.stopPropagation(); toggleTimer(); });
  ui.reset.addEventListener("click", (event) => { event.stopPropagation(); reset(); });
  ui.mute.addEventListener("click", (event) => {
    event.stopPropagation();
    muted = !muted;
    ui.mute.textContent = muted ? "Unmute" : "Mute";
    ui.mute.setAttribute("aria-pressed", String(muted));
    ui.sound.textContent = muted ? "SOUND OFF" : "SOUND ON";
    ui.sound.classList.toggle("is-muted", muted);
  });
  ui.fullscreen.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (!document.fullscreenElement) await ui.app.requestFullscreen?.();
    else await document.exitFullscreen?.();
  });
  document.addEventListener("fullscreenchange", () => {
    ui.fullscreen.textContent = document.fullscreenElement ? "Exit full screen" : "Fullscreen";
  });
  ui.surface.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggleTimer(); }
  });

  reset();
})();
