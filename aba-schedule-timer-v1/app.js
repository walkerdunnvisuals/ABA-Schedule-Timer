"use strict";

const ABA_TIMER = (() => {
  const VARIABLE_STEPS = 12;
  const UNIT_MULTIPLIERS = Object.freeze({
    seconds: 1000,
    minutes: 60_000,
    hours: 3_600_000,
  });

  /**
   * Fleshler–Hoffman (1962) progression.
   *
   * t(i) = mean × [1 + ln(N) + (N-i)ln(N-i)
   *                  - (N-i+1)ln(N-i+1)]
   *
   * The 0 × ln(0) term is defined as 0. The returned positive values are
   * strictly increasing and their arithmetic mean equals meanMs (within
   * floating-point precision).
   */
  function generateFleshlerHoffman(meanMs, steps = VARIABLE_STEPS) {
    if (!Number.isFinite(meanMs) || meanMs <= 0) {
      throw new RangeError("The target mean must be a positive number.");
    }

    if (!Number.isInteger(steps) || steps < 2) {
      throw new RangeError("The progression must contain at least two steps.");
    }

    const xLogX = (value) => (value === 0 ? 0 : value * Math.log(value));

    return Array.from({ length: steps }, (_, index) => {
      const i = index + 1;
      const remaining = steps - i;
      const factor =
        1 +
        Math.log(steps) +
        xLogX(remaining) -
        xLogX(remaining + 1);
      return meanMs * factor;
    });
  }

  function arithmeticMean(values) {
    if (!values.length) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  function secureRandom() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const randomValue = new Uint32Array(1);
      crypto.getRandomValues(randomValue);
      return randomValue[0] / 4_294_967_296;
    }
    return Math.random();
  }

  function shuffle(values, random = secureRandom) {
    const shuffled = [...values];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function toMilliseconds(value, unit) {
    if (!UNIT_MULTIPLIERS[unit]) {
      throw new RangeError("Unknown time unit.");
    }
    return Number(value) * UNIT_MULTIPLIERS[unit];
  }

  function formatCountdown(milliseconds) {
    const safeMs = Math.max(0, milliseconds);
    const totalSeconds = Math.ceil(safeMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const twoDigits = (value) => String(value).padStart(2, "0");

    if (hours > 0) {
      return `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
    }
    return `${twoDigits(minutes)}:${twoDigits(seconds)}`;
  }

  function formatDuration(milliseconds, options = {}) {
    const { compact = true } = options;
    const safeMs = Math.max(0, milliseconds);

    if (safeMs < 10_000 && safeMs % 1000 !== 0) {
      const seconds = Math.max(0.01, safeMs / 1000);
      return `${seconds.toFixed(seconds < 1 ? 2 : 1)}${compact ? "s" : " seconds"}`;
    }

    const totalSeconds = Math.round(safeMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];

    if (hours) parts.push(`${hours}${compact ? "h" : hours === 1 ? " hour" : " hours"}`);
    if (minutes) parts.push(`${minutes}${compact ? "m" : minutes === 1 ? " minute" : " minutes"}`);
    if (seconds || parts.length === 0) {
      parts.push(`${seconds}${compact ? "s" : seconds === 1 ? " second" : " seconds"}`);
    }
    return parts.join(" ");
  }

  function spokenDuration(milliseconds) {
    return formatDuration(milliseconds, { compact: false });
  }

  return {
    VARIABLE_STEPS,
    UNIT_MULTIPLIERS,
    arithmeticMean,
    formatCountdown,
    formatDuration,
    generateFleshlerHoffman,
    shuffle,
    spokenDuration,
    toMilliseconds,
  };
})();

function initializeApp() {
  const elements = {
    activeTime: document.querySelector("#active-time"),
    alertTestStatus: document.querySelector("#alert-test-status"),
    completedCount: document.querySelector("#completed-count"),
    countdown: document.querySelector("#countdown"),
    historyBody: document.querySelector("#history-body"),
    historyCaption: document.querySelector("#history-caption"),
    historyEmpty: document.querySelector("#history-empty"),
    historyTableWrap: document.querySelector("#history-table-wrap"),
    intervalDuration: document.querySelector("#interval-duration"),
    intervalNumber: document.querySelector("#interval-number"),
    liveRegion: document.querySelector("#live-region"),
    lockNote: document.querySelector("#lock-note"),
    modeHelp: document.querySelector("#mode-help"),
    modeInputs: [...document.querySelectorAll('input[name="mode"]')],
    obtainedMean: document.querySelector("#obtained-mean"),
    pauseButton: document.querySelector("#pause-button"),
    progressFill: document.querySelector("#progress-fill"),
    progressTrack: document.querySelector("#progress-track"),
    resetButton: document.querySelector("#reset-button"),
    scheduleSummary: document.querySelector("#schedule-summary"),
    soundToggle: document.querySelector("#sound-toggle"),
    soundSupport: document.querySelector("#sound-support"),
    startButton: document.querySelector("#start-button"),
    startLabel: document.querySelector("#start-label"),
    statusPill: document.querySelector("#status-pill"),
    statusText: document.querySelector("#status-text"),
    targetHelp: document.querySelector("#target-help"),
    testAlertButton: document.querySelector("#test-alert-button"),
    timeError: document.querySelector("#time-error"),
    timeUnit: document.querySelector("#time-unit"),
    timeValue: document.querySelector("#time-value"),
    vibrationRow: document.querySelector("#vibration-row"),
    vibrationSupport: document.querySelector("#vibration-support"),
    vibrationToggle: document.querySelector("#vibration-toggle"),
  };

  const state = {
    status: "ready",
    mode: "FT",
    targetMs: 300_000,
    currentIntervalMs: 300_000,
    remainingMs: 300_000,
    deadline: 0,
    intervalNumber: 1,
    variablePool: [],
    history: [],
    completedDurationTotal: 0,
    activeElapsedMs: 0,
    runningSince: 0,
    tickHandle: null,
    audioContext: null,
  };
  const supportsAudio = Boolean(window.AudioContext || window.webkitAudioContext);
  const supportsVibration = "vibrate" in navigator;

  function selectedMode() {
    return elements.modeInputs.find((input) => input.checked)?.value || "FT";
  }

  function validateSettings() {
    const value = Number(elements.timeValue.value);
    const valid = Number.isFinite(value) && value >= 1 && value <= 999;

    elements.timeValue.setAttribute("aria-invalid", String(!valid));
    elements.timeError.textContent = valid ? "" : "Enter a value from 1 to 999.";
    elements.startButton.disabled = !valid && state.status === "ready";
    return valid;
  }

  function readTargetMs() {
    return ABA_TIMER.toMilliseconds(elements.timeValue.value, elements.timeUnit.value);
  }

  function settingsDurationText() {
    const value = Number(elements.timeValue.value);
    const unit = elements.timeUnit.value;
    const singular = value === 1 ? unit.slice(0, -1) : unit;
    return `${value} ${singular}`;
  }

  function updateSettingsPreview() {
    if (!validateSettings()) return;

    const mode = selectedMode();
    const targetMs = readTargetMs();
    const targetText = settingsDurationText();
    state.mode = mode;
    state.targetMs = targetMs;

    if (state.status === "ready") {
      state.currentIntervalMs = targetMs;
      state.remainingMs = targetMs;
    }

    elements.modeHelp.textContent =
      mode === "FT"
        ? "Every interval uses the same duration."
        : "A randomized 12-interval block averages exactly to your target.";
    elements.targetHelp.textContent =
      mode === "FT"
        ? `Fixed intervals repeat every ${targetText}.`
        : `${targetText} is the mean; individual intervals can be much shorter or longer.`;
    elements.scheduleSummary.textContent = `${mode} · ${targetText}`;
    renderTimer();
  }

  function setConfigurationLocked(locked) {
    elements.modeInputs.forEach((input) => {
      input.disabled = locked;
    });
    elements.timeValue.disabled = locked;
    elements.timeUnit.disabled = locked;
    elements.soundToggle.disabled = locked || !supportsAudio;
    elements.vibrationToggle.disabled = locked || !supportsVibration;
    elements.lockNote.hidden = !locked;
  }

  function nextInterval() {
    if (state.mode === "FT") return state.targetMs;

    if (state.variablePool.length === 0) {
      state.variablePool = ABA_TIMER.shuffle(
        ABA_TIMER.generateFleshlerHoffman(state.targetMs, ABA_TIMER.VARIABLE_STEPS),
      );
    }
    return state.variablePool.shift();
  }

  function setStatus(status) {
    state.status = status;
    const label = status[0].toUpperCase() + status.slice(1);
    elements.statusText.textContent = label;
    elements.statusPill.dataset.status = status;
  }

  function startTicking() {
    stopTicking();
    state.tickHandle = window.setInterval(tick, 100);
    tick();
  }

  function stopTicking() {
    if (state.tickHandle !== null) {
      window.clearInterval(state.tickHandle);
      state.tickHandle = null;
    }
  }

  function prepareAudio() {
    if (!elements.soundToggle.checked || !supportsAudio) {
      return Promise.resolve(false);
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!state.audioContext) {
      state.audioContext = new AudioContextClass();
    }

    const context = state.audioContext;

    // Queueing a silent buffer during a direct tap reliably unlocks Web Audio
    // on mobile Safari without adding an extra audible sound at timer start.
    try {
      const silentBuffer = context.createBuffer(1, 1, context.sampleRate);
      const silentSource = context.createBufferSource();
      silentSource.buffer = silentBuffer;
      silentSource.connect(context.destination);
      silentSource.start(0);
    } catch (_error) {
      // The resume attempt below can still unlock audio.
    }

    if (context.state === "running") return Promise.resolve(true);
    return context
      .resume()
      .then(() => context.state === "running")
      .catch(() => false);
  }

  async function playChime() {
    if (!elements.soundToggle.checked || !supportsAudio) return false;
    const ready = await prepareAudio();
    if (!ready || !state.audioContext) return false;

    const context = state.audioContext;
    const startAt = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.72);
    gain.connect(context.destination);

    [659.25, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(startAt + index * 0.11);
      oscillator.stop(startAt + 0.72);
    });
    return true;
  }

  async function testAlerts() {
    const soundRequested = elements.soundToggle.checked && supportsAudio;
    const vibrationRequested = elements.vibrationToggle.checked && supportsVibration;

    if (!soundRequested && !vibrationRequested) {
      elements.alertTestStatus.textContent = "Turn on an available alert first.";
      return;
    }

    elements.testAlertButton.disabled = true;

    // Vibration is attempted before awaiting audio so it stays inside the
    // button's user-activation event on browsers that require that.
    const vibrationAccepted = vibrationRequested
      ? navigator.vibrate([160, 80, 160])
      : false;
    const soundPlayed = soundRequested ? await playChime() : false;

    if (soundRequested && !soundPlayed) {
      elements.alertTestStatus.textContent =
        "Sound was blocked. Tap again, turn off Silent Mode, and raise media volume.";
    } else if (soundRequested && vibrationRequested && vibrationAccepted) {
      elements.alertTestStatus.textContent = "Tone and vibration test sent.";
    } else if (soundRequested) {
      elements.alertTestStatus.textContent =
        "Tone test sent. If silent, check Silent Mode and media volume.";
    } else if (vibrationAccepted) {
      elements.alertTestStatus.textContent = "Vibration test sent.";
    } else {
      elements.alertTestStatus.textContent = "This browser did not accept the vibration test.";
    }

    window.setTimeout(() => {
      elements.testAlertButton.disabled = false;
    }, 750);
  }

  function signalInterval() {
    void playChime();
    if (elements.vibrationToggle.checked && supportsVibration) {
      navigator.vibrate([160, 80, 160]);
    }
    elements.liveRegion.textContent = `Interval ${state.intervalNumber} complete.`;
  }

  function startTimer() {
    if (state.status === "running" || !validateSettings()) return;
    void prepareAudio();

    if (state.status === "ready") {
      state.mode = selectedMode();
      state.targetMs = readTargetMs();
      state.currentIntervalMs = nextInterval();
      state.remainingMs = state.currentIntervalMs;
      state.intervalNumber = 1;
      setConfigurationLocked(true);
    }

    const now = Date.now();
    state.deadline = now + state.remainingMs;
    state.runningSince = now;
    setStatus("running");
    elements.startButton.disabled = true;
    elements.startLabel.textContent = "Resume";
    elements.pauseButton.disabled = false;
    elements.resetButton.disabled = false;
    startTicking();
    renderTimer();
  }

  function pauseTimer() {
    if (state.status !== "running") return;
    const now = Date.now();
    state.remainingMs = Math.max(0, state.deadline - now);
    state.activeElapsedMs += now - state.runningSince;
    state.runningSince = 0;
    setStatus("paused");
    stopTicking();
    elements.startButton.disabled = false;
    elements.pauseButton.disabled = true;
    renderAll();
  }

  function resetTimer() {
    stopTicking();
    if (supportsVibration) navigator.vibrate(0);

    state.status = "ready";
    state.mode = selectedMode();
    state.targetMs = readTargetMs();
    state.currentIntervalMs = state.targetMs;
    state.remainingMs = state.targetMs;
    state.deadline = 0;
    state.intervalNumber = 1;
    state.variablePool = [];
    state.history = [];
    state.completedDurationTotal = 0;
    state.activeElapsedMs = 0;
    state.runningSince = 0;

    setStatus("ready");
    setConfigurationLocked(false);
    elements.startButton.disabled = false;
    elements.startLabel.textContent = "Start";
    elements.pauseButton.disabled = true;
    elements.resetButton.disabled = true;
    elements.liveRegion.textContent = "Timer reset.";
    renderAll();
  }

  function completeInterval(now) {
    const completedNumber = state.intervalNumber;
    const completedDuration = state.currentIntervalMs;
    state.history.unshift({
      number: completedNumber,
      mode: state.mode,
      durationMs: completedDuration,
      completedAt: new Date(now),
    });
    state.completedDurationTotal += completedDuration;

    signalInterval();
    state.intervalNumber += 1;
    state.currentIntervalMs = nextInterval();
    state.remainingMs = state.currentIntervalMs;
    state.deadline = now + state.currentIntervalMs;
    renderHistory();
  }

  function tick() {
    if (state.status !== "running") return;
    const now = Date.now();
    state.remainingMs = state.deadline - now;

    if (state.remainingMs <= 0) {
      completeInterval(now);
    }
    renderTimer();
    renderActiveTime(now);
  }

  function renderTimer() {
    const remaining = Math.max(0, state.remainingMs);
    const duration = Math.max(1, state.currentIntervalMs);
    const completedRatio = Math.min(1, Math.max(0, 1 - remaining / duration));
    const countdownText = ABA_TIMER.formatCountdown(remaining);

    elements.countdown.textContent = countdownText;
    elements.countdown.setAttribute(
      "aria-label",
      `${ABA_TIMER.spokenDuration(remaining)} remaining`,
    );
    elements.progressFill.style.width = `${completedRatio * 100}%`;
    elements.progressTrack.setAttribute("aria-valuenow", String(Math.round(completedRatio * 100)));
    elements.intervalNumber.textContent = `Interval ${state.intervalNumber}`;
    elements.intervalDuration.textContent = `Scheduled for ${ABA_TIMER.formatDuration(duration)}`;
  }

  function renderActiveTime(now = Date.now()) {
    const runningTime = state.status === "running" ? now - state.runningSince : 0;
    elements.activeTime.textContent = ABA_TIMER.formatCountdown(
      state.activeElapsedMs + runningTime,
    );
  }

  function renderHistory() {
    const count = state.history.length;
    elements.completedCount.textContent = String(count);
    elements.obtainedMean.textContent =
      count === 0
        ? "—"
        : ABA_TIMER.formatDuration(state.completedDurationTotal / count);
    elements.historyEmpty.hidden = count > 0;
    elements.historyTableWrap.hidden = count === 0;

    if (count === 0) {
      elements.historyCaption.textContent = "No completed intervals yet";
      elements.historyBody.replaceChildren();
      return;
    }

    const shown = state.history.slice(0, 30);
    elements.historyCaption.textContent =
      count > 30 ? `Showing latest 30 of ${count}` : `${count} completed interval${count === 1 ? "" : "s"}`;

    const rows = shown.map((entry) => {
      const row = document.createElement("tr");
      const intervalCell = document.createElement("td");
      const modeCell = document.createElement("td");
      const durationCell = document.createElement("td");
      const completedCell = document.createElement("td");
      const modeChip = document.createElement("span");

      intervalCell.textContent = `#${entry.number}`;
      modeChip.className = "mode-chip";
      modeChip.textContent = entry.mode;
      modeCell.append(modeChip);
      durationCell.textContent = ABA_TIMER.formatDuration(entry.durationMs);
      completedCell.textContent = entry.completedAt.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      });
      row.append(intervalCell, modeCell, durationCell, completedCell);
      return row;
    });
    elements.historyBody.replaceChildren(...rows);
  }

  function renderAll() {
    renderTimer();
    renderActiveTime();
    renderHistory();
  }

  function handleVisibilityChange() {
    if (!document.hidden && state.status === "running") {
      tick();
    }
  }

  elements.modeInputs.forEach((input) => input.addEventListener("change", updateSettingsPreview));
  elements.timeValue.addEventListener("input", updateSettingsPreview);
  elements.timeUnit.addEventListener("change", updateSettingsPreview);
  elements.startButton.addEventListener("click", startTimer);
  elements.testAlertButton.addEventListener("click", testAlerts);
  elements.pauseButton.addEventListener("click", pauseTimer);
  elements.resetButton.addEventListener("click", resetTimer);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  if (!supportsAudio) {
    elements.soundToggle.checked = false;
    elements.soundToggle.disabled = true;
    elements.soundSupport.textContent = "Not supported by this browser";
  }

  if (!supportsVibration) {
    elements.vibrationToggle.checked = false;
    elements.vibrationToggle.disabled = true;
    elements.vibrationSupport.textContent = "Unavailable here (including on iPhone/iPad)";
    elements.vibrationRow.title = "Vibration is unavailable in this browser.";
  }

  updateSettingsPreview();
  renderAll();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initializeApp);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ABA_TIMER;
}
