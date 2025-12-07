// ---------------------------
// script.js — original app logic plus touch/overlay fixes
// ---------------------------

/* Patterns (default non-Nadi) */
const patterns = {
  easy: { Inhale: 8, Hold: 16, Exhale: 8, Relax: 10 },
  medium: { Inhale: 16, Hold: 32, Exhale: 22, Relax: 10 },
  hard: { Inhale: 16, Hold: 64, Exhale: 32, Relax: 10 }
};

const patternInfoData = {
    easy: "<strong>Adhama (Novice)</strong><br>A gentle introduction to breath retention. Helps reduce anxiety and activates the parasympathetic nervous system.",
    medium: "<strong>Madhyama (Intermediate)</strong><br>Increases lung capacity and focus. The longer hold builds CO2 tolerance, calming the mind deeply.",
    hard: "<strong>Uttama (Advanced)</strong><br>For experienced practitioners. The extended hold (64s) triggers deep meditative states and high energy efficiency.",
    custom: "<strong>Custom Pattern</strong><br>Your personalized rhythm. Ensure you are comfortable with the hold duration."
};

/* ---------------------------
   DOM references
   --------------------------- */
const circle = document.getElementById('visualCircle');
const numberEl = document.getElementById('mainNumber');
const phaseTitle = document.getElementById('mainPhase');
const patternDisplay = document.getElementById('patternDisplay');
const capsuleDot = document.getElementById('capsuleDot');

const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const elapsedEl = document.getElementById('elapsed');
const cyclesEl = document.getElementById('cycles');
const difficultySel = document.getElementById('difficulty');
const customControls = document.getElementById('customControls');
const themeToggle = document.getElementById('themeToggle');

const savePresetBtn = document.getElementById('savePresetBtn');
const savedPresetsList = document.getElementById('savedPresetsList');

const ambientSelect = document.getElementById('ambientSelect');
const ambientVol = document.getElementById('ambientVol');
const infoBtn = document.getElementById('patternInfoBtn');
const infoModal = document.getElementById('infoModalOverlay');
const closeModalBtn = document.getElementById('closeModalBtn');

const nadiToggle = document.getElementById('nadiToggle'); // Nadi switch

// Compact panel DOM refs (new)
const nostrilPanel = document.getElementById('nostrilPanel');
const nostrilLeftP = document.getElementById('nostrilLeftP');
const nostrilRightP = document.getElementById('nostrilRightP');
const nostrilLeftDot = document.getElementById('nostrilLeftDot');
const nostrilRightDot = document.getElementById('nostrilRightDot');

/* ---------------------------
   State
   --------------------------- */
let running = false;
let paused = false;
let animationFrameId = null;
let lastFrameTime = 0;
let timeLeft = 0;
let lastTotalDuration = 1;
let currentPhase = 'Inhale';
let cycleCount = 0;
let totalSecondsPlayed = 0;
let currentPatternName = 'Adhama';
let currentNostril = 'Left'; // Nadi: Start Left
let isNadiShodhana = false;

/* --------------------------- Small helper: compute whether Nadi should be active */
function computeIsNadiActive() {
  const useCustom = (difficultySel.value === 'custom' || difficultySel.value === 'preset_active');
  return (nadiToggle && nadiToggle.checked) && !useCustom;
}

/* --------------------------- Modal helper (short, consistent message) */
function showNadiDisabledModal(contextLabel) {
  const modalTitle = 'Nadi Shodhana Disabled';
  const modalBody = `
    <strong>Nadi Shodhana is disabled for Custom & Saved Presets.</strong>
    <p style="margin-top:8px;">
      You’re using <strong>${contextLabel}</strong>.
    </p>
    <p style="margin-top:10px;">
      Switch to <em>Easy / Medium / Hard</em> to enable Nadi.
    </p>
  `;
  document.getElementById('modalTitle').textContent = modalTitle;
  document.getElementById('modalBody').innerHTML = modalBody;
  infoModal.classList.add('open');
}

/* ---------------------------
   Drawer / UI logic
   --------------------------- */
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
function openSettings() {
    overlay.classList.add('open');
    drawer.classList.add('open');
    loadSavedPresets();
    document.body.style.overflow = 'hidden';
}
function closeSettings() {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
}
document.getElementById('settingsToggle').onclick = openSettings;
document.getElementById('closeDrawer').onclick = closeSettings;
overlay.onclick = (e) => { if (e.target === overlay) closeSettings(); };

infoBtn.onclick = () => {
    const key = difficultySel.value === 'preset_active' ? 'custom' : difficultySel.value;
    let modalContent = patternInfoData[key] || patternInfoData['custom'];
    if (nadiToggle && nadiToggle.checked && ! (difficultySel.value === 'custom' || difficultySel.value === 'preset_active')) {
        modalContent += `<hr style="margin: 10px 0; border-color: rgba(255,255,255,0.1);"><p><strong>Nadi Shodhana</strong> ratios active. Beginner/Intermediate/Advanced mappings apply (default inhale 4s for standard Nadi patterns).</p>`;
    } else if (nadiToggle && nadiToggle.checked) {
        modalContent += `<hr style="margin: 10px 0; border-color: rgba(255,255,255,0.1);"><p><strong>Nadi Shodhana</strong> is ON but will be ignored for Custom & Saved Presets.</p>`;
    }
    document.getElementById('modalBody').innerHTML = modalContent;
    infoModal.classList.add('open');
};
closeModalBtn.onclick = () => infoModal.classList.remove('open');
infoModal.onclick = (e) => { if(e.target === infoModal) infoModal.classList.remove('open'); };

document.querySelector('.circle-wrap').addEventListener('click', () => { if(running) document.body.classList.toggle('zen-active'); });
function exitZenMode() { document.body.classList.remove('zen-active'); }

/* ---------------------------
   Audio / ambient functions
   --------------------------- */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let ambientNode = null;
let ambientGain = null;

function createBrownNoise() {
    const bufferSize = 4096; const node = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    let lastOut = 0;
    node.onaudioprocess = function(e) {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i]; output[i] *= 3.5;
        }
    };
    return node;
}
function createPinkNoise() {
    const bufferSize = 4096; const node = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    node.onaudioprocess = function(e) {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759; b2 = 0.96900 * b2 + white * 0.1538520; b3 = 0.86650 * b3 + white * 0.3104856; b4 = 0.55000 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362; output[i] *= 0.11; b6 = white * 0.115926;
        }
    };
    return node;
}
function createWhiteNoise() {
    const bufferSize = 4096; const node = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    node.onaudioprocess = function(e) { const output = e.outputBuffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1; };
    return node;
}
function playAmbient() {
    stopAmbient(); if(ambientSelect.value === 'none') return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if(ambientSelect.value === 'rain') ambientNode = createBrownNoise();
    else if(ambientSelect.value === 'wind') ambientNode = createPinkNoise();
    else if(ambientSelect.value === 'white') ambientNode = createWhiteNoise();
    ambientGain = audioCtx.createGain(); ambientGain.gain.value = ambientVol.value * 0.15;
    ambientNode.connect(ambientGain); ambientGain.connect(audioCtx.destination);
}
function stopAmbient() {
    if(ambientNode) { ambientNode.disconnect(); ambientNode = null; }
    if(ambientGain) { ambientGain.disconnect(); ambientGain = null; }
}
ambientSelect.onchange = () => { if(running && !paused) playAmbient(); };
ambientVol.oninput = () => { if(ambientGain) ambientGain.gain.value = ambientVol.value * 0.15; };

/* Wake lock */
let wakeLock = null;
async function requestWakeLock() { if ('wakeLock' in navigator) { try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {} } }
async function releaseWakeLock() { if (wakeLock !== null) { try { await wakeLock.release(); wakeLock = null; } catch (err) {} } }
document.addEventListener('visibilitychange', async () => { if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock(); });

/* ---------------------------
   Preset logic
   --------------------------- */
function savePreset() {
    const p = getPattern();
    const defaultName = `Custom ${p.Inhale}-${p.Hold}-${p.Exhale}`;
    const name = prompt("Enter a name for this custom pattern:", defaultName);
    if (!name || name.trim() === "") return;
    const newPreset = { name: name, Inhale: p.Inhale, Hold: p.Hold, Exhale: p.Exhale, Relax: p.Relax };
    let presets = JSON.parse(localStorage.getItem('pranaPresets') || '[]');
    if (presets.some(preset => preset.name === name)) {
        if (!confirm(`Preset "${name}" already exists. Overwrite it?`)) return;
        presets = presets.filter(preset => preset.name !== name);
    }
    presets.push(newPreset);
    localStorage.setItem('pranaPresets', JSON.stringify(presets));
    loadSavedPresets();
    difficultySel.value = 'easy'; customControls.style.display = 'none';
    currentPatternName = 'Adhama'; updatePatternDisplay(); fullReset();
}
function deletePreset(name) {
    if (!confirm(`Are you sure you want to delete preset "${name}"?`)) return;
    let presets = JSON.parse(localStorage.getItem('pranaPresets') || '[]');
    presets = presets.filter(preset => preset.name !== name);
    localStorage.setItem('pranaPresets', JSON.stringify(presets));
    if (currentPatternName === name) { difficultySel.value = 'easy'; fullReset(); }
    loadSavedPresets();
}
function loadSavedPresets() {
    const presets = JSON.parse(localStorage.getItem('pranaPresets') || '[]');
    savedPresetsList.innerHTML = '';
    if (presets.length === 0) { savedPresetsList.innerHTML = `<div style="text-align:center; padding:15px; border:1px dashed #334155; border-radius:12px; color:#64748b; font-size:0.9rem;">No custom presets saved.</div>`; return; }
    presets.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        const patternStr = `${preset.Inhale}-${preset.Hold}-${preset.Exhale}`;
        item.innerHTML = `<div class="preset-info"><span class="preset-name">${preset.name}</span><span class="preset-pattern">${patternStr}</span></div><div class="preset-actions"><button class="btn-use">Use</button><button class="btn-del">×</button></div>`;

        item.querySelector('.btn-use').onclick = () => {
            // If Nadi is ON, turning to a saved preset must disable it and show modal
            if (nadiToggle && nadiToggle.checked) {
                nadiToggle.checked = false;
                showNadiDisabledModal(`Saved Preset (${preset.name})`);
            }

            document.getElementById('inhaleRange').value = preset.Inhale;
            document.getElementById('holdRange').value = preset.Hold;
            document.getElementById('exhaleRange').value = preset.Exhale;
            document.getElementById('relaxRange').value = preset.Relax;
            ['inhaleRange', 'holdRange', 'exhaleRange', 'relaxRange'].forEach(id => document.getElementById(id).dispatchEvent(new Event('input')));

            // Create or update a temporary "Active preset" option and mark it as preset_active
            let tempOpt = document.getElementById('tempPresetOption');
            if (!tempOpt) {
                tempOpt = document.createElement('option');
                tempOpt.id = 'tempPresetOption';
                tempOpt.value = 'preset_active';
                difficultySel.appendChild(tempOpt);
            }
            tempOpt.textContent = `Active: ${preset.name}`;
            tempOpt.dataset.presetName = preset.name;
            difficultySel.value = 'preset_active';
            currentPatternName = preset.name;
            customControls.style.display = 'none';
            updatePatternDisplay();
            closeSettings();
            fullReset();
        };
        item.querySelector('.btn-del').onclick = () => deletePreset(preset.name);
        savedPresetsList.appendChild(item);
    });
}

/* ---------------------------
   Pattern resolution (Nadi mapping)
   --------------------------- */
function getPattern() {
    const useCustom = (difficultySel.value === 'custom' || difficultySel.value === 'preset_active');
    const nadiActiveNow = nadiToggle && nadiToggle.checked;

    // If custom/preset_active => return slider values (Nadi must NOT override)
    if (useCustom) {
        return {
            Inhale: +document.getElementById('inhaleRange').value,
            Hold:   +document.getElementById('holdRange').value,
            Exhale: +document.getElementById('exhaleRange').value,
            Relax:  +document.getElementById('relaxRange').value
        };
    }

    // Not custom: if Nadi toggle is on, map easy/medium/hard to Nadi ratios
    if (nadiActiveNow) {
        if (difficultySel.value === 'easy') {
            return { Inhale: 4, Hold: 0, Exhale: 4, Relax: 0 };
        } else if (difficultySel.value === 'medium') {
            return { Inhale: 4, Hold: 4, Exhale: 8, Relax: 0 };
        } else if (difficultySel.value === 'hard') {
            return { Inhale: 4, Hold: 16, Exhale: 8, Relax: 0 };
        }
    }

    // Default fallback to app patterns (safeguard)
    return patterns[difficultySel.value] || patterns['easy'];
}

/* ---------------------------
   Visual helpers & nostril indicator
   --------------------------- */
function formatTime(s) { const mm = Math.floor(s / 60).toString().padStart(2, '0'); const ss = Math.floor(s % 60).toString().padStart(2, '0'); return `${mm}:${ss}`; }
function getColor(phase) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (phase === 'Inhale') return '#08fc34';
    if (phase === 'Hold') return '#fc0303';
    if (phase === 'Exhale') return '#fbbf24';
    return isLight ? '#3b82f6' : '#60a5fa';
}

/* Update nostril indicator visibility + active classes (compact panel) */
function updateNostrilIndicator() {
    if (!nostrilPanel || !nostrilLeftP || !nostrilRightP) return;

    // Only show nostril panel when Nadi is actually active (computed)
    const nadi = computeIsNadiActive();

    const host = document.querySelector('.glass-card') || document.body;
    if (!nadi) {
        // hide
        host.classList.add('nadi-hidden');
        nostrilPanel.classList.add('nadi-hidden');
        // clear active classes
        nostrilLeftP.classList.remove('nostril-active','nostril-inhale','nostril-exhale','nostril-hold');
        nostrilRightP.classList.remove('nostril-active','nostril-inhale','nostril-exhale','nostril-hold');
        return;
    }

    // ensure visible
    host.classList.remove('nadi-hidden');
    nostrilPanel.classList.remove('nadi-hidden');

    // clear all states
    nostrilLeftP.classList.remove('nostril-active','nostril-inhale','nostril-exhale','nostril-hold');
    nostrilRightP.classList.remove('nostril-active','nostril-inhale','nostril-exhale','nostril-hold');

    // Decide which side to highlight
    if (currentPhase === 'Inhale') {
        if (currentNostril === 'Left') nostrilLeftP.classList.add('nostril-active','nostril-inhale');
        else nostrilRightP.classList.add('nostril-active','nostril-inhale');
    } else if (currentPhase === 'Exhale') {
        if (currentNostril === 'Left') nostrilRightP.classList.add('nostril-active','nostril-exhale');
        else nostrilLeftP.classList.add('nostril-active','nostril-exhale');
    } else if (currentPhase === 'Hold') {
        nostrilLeftP.classList.add('nostril-active','nostril-hold');
        nostrilRightP.classList.add('nostril-active','nostril-hold');
    }
}

/* update visuals (keeps circle style as-is, updates arc + central content) */
function drawProgressArc(progressPct, colorHex) {
  const bgDark = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim() || '#111';
  const arc = `conic-gradient(${colorHex} 0 ${progressPct}%, ${bgDark} ${progressPct}% 100%)`;
  circle.style.background = arc;
}

function updateVisuals(progress, duration) {
    const pct = Math.max(0, Math.min(1, progress)) * 100;
    const color = getColor(currentPhase);
    drawProgressArc(pct, color);

    numberEl.textContent = Math.ceil(duration);
    numberEl.style.color = color;

    // Use computeIsNadiActive to decide label behavior
    if (computeIsNadiActive()) {
        if (currentPhase === 'Inhale') phaseTitle.textContent = `Inhale (${currentNostril})`;
        else if (currentPhase === 'Hold') phaseTitle.textContent = 'Hold (Both)';
        else if (currentPhase === 'Exhale') phaseTitle.textContent = `Exhale (${currentNostril === 'Left' ? 'Right' : 'Left'})`;
        else phaseTitle.textContent = 'Pause';
    } else {
        if (currentPhase === 'Inhale') phaseTitle.textContent = 'Inhale';
        else if (currentPhase === 'Hold') phaseTitle.textContent = 'Hold';
        else if (currentPhase === 'Exhale') phaseTitle.textContent = 'Exhale';
        else phaseTitle.textContent = 'Relax';
    }

    phaseTitle.style.color = color;

    capsuleDot.style.backgroundColor = color;
    capsuleDot.style.boxShadow = `0 6px 22px ${color}33`;

    updateNostrilIndicator();
}

/* ---------------------------
   Main loop & transitions
   --------------------------- */
function tick() {
    if (!running || paused) return;
    const now = Date.now();
    const deltaTime = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    timeLeft -= deltaTime;
    totalSecondsPlayed += deltaTime;
    if (Math.floor(totalSecondsPlayed) > Math.floor(totalSecondsPlayed - deltaTime)) elapsedEl.textContent = formatTime(totalSecondsPlayed);
    if (timeLeft <= 0) { const overflow = Math.abs(timeLeft); nextPhase(overflow); }
    else {
        const p = getPattern();
        const totalPhaseTime = (currentPhase === 'Inhale' ? p.Inhale : currentPhase === 'Hold' ? p.Hold : currentPhase === 'Exhale' ? p.Exhale : p.Relax);
        lastTotalDuration = Math.max(0.001, totalPhaseTime);
        updateVisuals(1 - (timeLeft / lastTotalDuration), timeLeft);
        animationFrameId = requestAnimationFrame(tick);
    }
}

function nextPhase(overflow = 0) {
    const p = getPattern();
    let nextPhaseName;

    // Use centralized boolean so Nadi flow is consistent
    isNadiShodhana = computeIsNadiActive();

    if (isNadiShodhana) {
        if (currentPhase === 'Inhale') {
            nextPhaseName = (p.Hold && p.Hold > 0) ? 'Hold' : 'Exhale';
        } else if (currentPhase === 'Hold') {
            nextPhaseName = 'Exhale';
        } else if (currentPhase === 'Exhale') {
            currentNostril = (currentNostril === 'Left') ? 'Right' : 'Left';
            cycleCount++;
            cyclesEl.textContent = cycleCount;
            nextPhaseName = 'Inhale';
        } else {
            nextPhaseName = 'Inhale';
        }

        currentPhase = nextPhaseName;

        if (currentPhase === 'Inhale') timeLeft = p.Inhale - overflow;
        else if (currentPhase === 'Hold') timeLeft = p.Hold - overflow;
        else if (currentPhase === 'Exhale') timeLeft = p.Exhale - overflow;
        else timeLeft = 0.001;

    } else {
        if (currentPhase === 'Inhale') nextPhaseName = 'Hold';
        else if (currentPhase === 'Hold') nextPhaseName = 'Exhale';
        else if (currentPhase === 'Exhale') nextPhaseName = 'Relax';
        else { nextPhaseName = 'Inhale'; cycleCount++; cyclesEl.textContent = cycleCount; }

        currentPhase = nextPhaseName;

        let dur = (currentPhase === 'Inhale') ? p.Inhale : (currentPhase === 'Hold') ? p.Hold : (currentPhase === 'Exhale') ? p.Exhale : p.Relax;
        timeLeft = dur - overflow;
    }

    if (document.getElementById('soundToggle').checked) beep();
    if (document.getElementById('voiceToggle').checked) {
        let voiceText = currentPhase;
        if (isNadiShodhana) {
            if (currentPhase === 'Inhale') voiceText = `Inhale ${currentNostril}`;
            else if (currentPhase === 'Exhale') voiceText = `Exhale ${currentNostril === 'Left' ? 'Right' : 'Left'}`;
            else if (currentPhase === 'Hold') voiceText = `Hold`;
        }
        speak(voiceText);
    }
    if (document.getElementById('vibeToggle').checked && navigator.vibrate) {
        if (currentPhase === 'Inhale') navigator.vibrate([100, 50, 100]);
        else if (currentPhase === 'Hold') navigator.vibrate(200);
        else if (currentPhase === 'Exhale') navigator.vibrate(50);
    }

    updateNostrilIndicator();
    tick();
}

/* ---------------------------
   Beep / speak helpers
   --------------------------- */
function beep() {
    try {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = 600;
        g.gain.value = 0.0001;
        o.connect(g); g.connect(audioCtx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.02, audioCtx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.18);
        o.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
}
function speak(text) {
    try {
        if ('speechSynthesis' in window) {
            const ut = new SpeechSynthesisUtterance(text);
            speechSynthesis.cancel();
            speechSynthesis.speak(ut);
        }
    } catch (e) {}
}

/* ---------------------------
   Full reset helper
   --------------------------- */
function fullReset() {
    running = false;
    paused = false;
    cancelAnimationFrame(animationFrameId);
    releaseWakeLock();
    stopAmbient();
    try { speechSynthesis.cancel(); } catch(e) {}

    startBtn.textContent = 'Start';
    currentPhase = 'Inhale';
    const p = getPattern();
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim();
    const txt = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
    circle.style.background = `conic-gradient(${bg} 0%, ${bg} 100%)`;
    circle.style.opacity = "1";
    numberEl.textContent = p.Inhale;
    numberEl.style.color = txt;
    phaseTitle.textContent = 'Ready';
    phaseTitle.style.color = txt;
    cyclesEl.textContent = '0';
    elapsedEl.textContent = '00:00';
    cycleCount = 0;
    totalSecondsPlayed = 0;
    capsuleDot.style.backgroundColor = 'var(--text-muted)';
    capsuleDot.style.boxShadow = 'none';

    currentNostril = 'Left';
    // Use the centralized computation so Nadi is disabled for custom/preset_active
    isNadiShodhana = computeIsNadiActive();
    updatePatternDisplay();
    updateNostrilIndicator();
}

/* ---------------------------
   Start / Pause / Reset handlers
   --------------------------- */
startBtn.onclick = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // compute at start so actual session respects the rule
    isNadiShodhana = computeIsNadiActive();

    if (!running) {
        if ('speechSynthesis' in window && speechSynthesis.paused) speechSynthesis.resume();
        running = true; paused = false; totalSecondsPlayed = 0;
        startBtn.textContent = 'Pause';
        if (isNadiShodhana) currentNostril = 'Left';
        const p = getPattern();
        currentPhase = 'Inhale';
        timeLeft = p.Inhale;
        if (document.getElementById('voiceToggle').checked) {
             let voiceText = 'Inhale';
             if (isNadiShodhana) voiceText = `Inhale ${currentNostril}`;
             speak(voiceText);
        }
        playAmbient();
        requestWakeLock();
        lastFrameTime = Date.now();
        tick();
    } else {
        paused = !paused;
        startBtn.textContent = paused ? 'Resume' : 'Pause';
        if (paused) {
            saveSession();
            cancelAnimationFrame(animationFrameId);
            capsuleDot.style.backgroundColor = 'var(--text-muted)';
            speechSynthesis.cancel();
            releaseWakeLock();
            stopAmbient();
        } else {
            requestWakeLock();
            lastFrameTime = Date.now();
            playAmbient();
            tick();
        }
    }
};

resetBtn.onclick = () => {
    exitZenMode();
    saveSession();
    fullReset();
};

/* ---------------------------
   Toggle & difficulty listeners
   --------------------------- */
if (nadiToggle) {
    nadiToggle.onchange = () => {
        const attemptedOn = nadiToggle.checked;
        const modeIsCustom = (difficultySel.value === 'custom' || difficultySel.value === 'preset_active');

        // If attempted to enable Nadi while in Custom or a saved preset -> show modal and revert
        if (attemptedOn && modeIsCustom) {
            nadiToggle.checked = false;
            showNadiDisabledModal(`${modeIsCustom ? (difficultySel.value === 'custom' ? 'Custom' : `Saved Preset (${currentPatternName})`) : ''}`);
            return;
        }

        // Otherwise allow normal behavior: recompute Nadi active state and reset the session
        currentNostril = 'Left';
        isNadiShodhana = computeIsNadiActive();
        fullReset();
    };
}

difficultySel.onchange = () => {
    const val = difficultySel.value;
    const isPresetOrCustom = (val === 'custom' || val === 'preset_active');

    // If Nadi is ON and user switched to Custom or Saved Preset -> turn Nadi OFF and show modal
    if (nadiToggle && nadiToggle.checked && isPresetOrCustom) {
        nadiToggle.checked = false;
        showNadiDisabledModal(`${isPresetOrCustom ? (val === 'custom' ? 'Custom' : `Saved Preset (${currentPatternName})`) : ''}`);
    }

    if (val === 'custom') { customControls.style.display = 'block'; } else if (val !== 'preset_active') { customControls.style.display = 'none'; currentPatternName = difficultySel.options[difficultySel.selectedIndex].text.split(' ')[0]; }
    if (val !== 'preset_active') { const temp = document.getElementById('tempPresetOption'); if (temp) temp.remove(); }
    // fullReset() will recompute isNadiShodhana from computeIsNadiActive()
    fullReset();
};

/* Slider wiring */
['inhale', 'hold', 'exhale', 'relax'].forEach(k => {
    const r = document.getElementById(k + 'Range');
    const v = document.getElementById(k + 'Val');
    if (r && v) r.addEventListener('input', () => {
        v.textContent = r.value + 's';
        if (difficultySel.value === 'custom') {
            updatePatternDisplay();
            if (!running) {
                const p = getPattern();
                numberEl.textContent = p.Inhale;
            } else {
                fullReset();
            }
        }
    });
});

/* ---------------------------
   updatePatternDisplay & theme
   --------------------------- */
function updatePatternDisplay() {
    const val = difficultySel.value;
    // Update isNadiShodhana using the centralized rule so display is accurate
    isNadiShodhana = computeIsNadiActive();
    const getSliderVals = () => `${document.getElementById('inhaleRange').value}-${document.getElementById('holdRange').value}-${document.getElementById('exhaleRange').value}`;
    let baseText;
    if (val === 'custom') baseText = `Custom (${getSliderVals()})`;
    else if (val === 'preset_active') baseText = `${currentPatternName} (${getSliderVals()})`;
    else baseText = difficultySel.options[difficultySel.selectedIndex].text;

    if (isNadiShodhana) {
        const p = getPattern();
        const ratioParts = [p.Inhale];
        if (p.Hold && p.Hold > 0) ratioParts.push(p.Hold);
        ratioParts.push(p.Exhale);

        // NEW: simplified display (with bullet point) — no trailing dash pattern
        patternDisplay.textContent = `NADI SHODHANA (${ratioParts.join(':')})`;
    } else {
        patternDisplay.textContent = baseText;
    }
}

themeToggle.onclick = () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    let newTheme = current === 'light' ? 'dark' : 'light';
    themeToggle.textContent = newTheme === 'dark' ? '☀' : '☾';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('pranaTheme', newTheme);
    if (running) {
        updateVisuals(1 - (timeLeft / lastTotalDuration), timeLeft);
    } else {
        fullReset();
    }
};
(function loadInitialTheme() {
    const savedTheme = localStorage.getItem('pranaTheme');
    if (savedTheme) { document.documentElement.setAttribute('data-theme', savedTheme); themeToggle.textContent = savedTheme === 'dark' ? '☀' : '☾'; }
})();

/* ---------------------------
   Save session
   --------------------------- */
function saveSession() {
    if (cycleCount > 0) {
        let name = patternDisplay.textContent;
        if (isNadiShodhana) name += " (Nadi Shodhana)";
        const session = { date: new Date().toISOString(), cycles: cycleCount, duration: Math.round(totalSecondsPlayed), pattern: name, isCustom: difficultySel.value === 'custom' || difficultySel.value === 'preset_active' };
        const history = JSON.parse(localStorage.getItem('pranaHistory') || '[]');
        history.push(session);
        localStorage.setItem('pranaHistory', JSON.stringify(history));
    }
}

/* ---------------------------
   Wire save preset & initial boot
   --------------------------- */
savePresetBtn.onclick = savePreset;
fullReset();
updatePatternDisplay();
updateNostrilIndicator();

/* =========================
   Additional touch/overlay improvements
   ========================= */

// 1) Ensure overlay pointer-events are synced with the 'open' class (prevents hidden overlay from blocking taps)
(function syncOverlayPointerEvents() {
  try {
    const ov = document.getElementById('overlay');
    if (!ov) return;
    const applyState = () => {
      if (ov.classList.contains('open')) {
        ov.style.pointerEvents = 'auto';
        ov.style.visibility = 'visible';
      } else {
        ov.style.pointerEvents = 'none';
        ov.style.visibility = 'hidden';
      }
    };
    // initial
    applyState();
    // watch for class changes
    const mo = new MutationObserver(applyState);
    mo.observe(ov, { attributes: true, attributeFilter: ['class'] });
    // also ensure modal overlay (infoModal) follows same rule
    const modal = document.getElementById('infoModalOverlay');
    if (modal) {
      const applyModal = () => {
        if (modal.classList.contains('open')) { modal.style.pointerEvents = 'auto'; modal.style.visibility = 'visible'; }
        else { modal.style.pointerEvents = 'none'; modal.style.visibility = 'hidden'; }
      };
      applyModal();
      const mo2 = new MutationObserver(applyModal);
      mo2.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
  } catch (e) { console.warn('Overlay pointer sync failed', e); }
})();

// 2) Fast-touch shim: add touch handlers so small icon buttons and main buttons respond reliably on WebView
(function addFastTouchHandlers() {
  try {
    const touchable = document.querySelectorAll('.icon-btn, .btn, .preset-item .btn-use, .preset-item .btn-del');
    touchable.forEach(el => {
      // avoid adding twice
      if (el.__fastTouchAdded) return;
      el.__fastTouchAdded = true;

      el.addEventListener('touchstart', function onTouchStart() {
        el.classList.add('touching');
      }, { passive: true });

      el.addEventListener('touchend', function onTouchEnd() {
        el.classList.remove('touching');
        // let normal click event handle action — we avoid calling click() manually to keep semantics intact
      }, { passive: true });
    });
  } catch (e) { console.warn('Fast touch handlers failed', e); }
})();
