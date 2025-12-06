/* --- LOGIC ENGINE & REFINEMENTS --- */
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

// --- TARGET ELEMENTS ---
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
const visualToggle = document.getElementById('visualToggle'); 

const ambientSelect = document.getElementById('ambientSelect');
const ambientVol = document.getElementById('ambientVol');
const infoBtn = document.getElementById('patternInfoBtn');
const infoModal = document.getElementById('infoModalOverlay');
const closeModalBtn = document.getElementById('closeModalBtn');

// --- STATE MANAGEMENT ---
let running = false;
let paused = false;
let animationFrameId = null;
let lastFrameTime = 0;
let timeLeft = 0;
let lastTotalDuration = 1;
let currentPhase = 'PURAKA';
let cycleCount = 0;
let totalSecondsPlayed = 0;
let currentPatternName = 'Adhama';

// --- DRAWER LOGIC ---
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
function openSettings() { overlay.classList.add('open'); drawer.classList.add('open'); loadSavedPresets(); }
function closeSettings() { overlay.classList.remove('open'); drawer.classList.remove('open'); }

document.getElementById('settingsToggle').onclick = openSettings;
document.getElementById('closeDrawer').onclick = closeSettings;
overlay.onclick = (e) => { if (e.target === overlay) closeSettings(); };

// --- LEARN MODAL LOGIC ---
infoBtn.onclick = () => {
    const key = difficultySel.value === 'preset_active' ? 'custom' : difficultySel.value;
    document.getElementById('modalBody').innerHTML = patternInfoData[key] || patternInfoData['custom'];
    infoModal.classList.add('open');
};
closeModalBtn.onclick = () => infoModal.classList.remove('open');
infoModal.onclick = (e) => { if(e.target === infoModal) infoModal.classList.remove('open'); };

// --- AUDIO SYSTEM (SYNTHESIZED AMBIENT SOUND) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let ambientNode = null;
let ambientGain = null;

function createNoiseBuffer(type) {
    const bufferSize = audioCtx.sampleRate * 2; // 2 seconds buffer
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if(type === 'white') {
            data[i] = white;
        } else if (type === 'pink') {
            // Approximation of Pink Noise
            const b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            // (Simulated pink noise filter logic simplified for brevity)
            data[i] = (Math.random() * 2 - 1) * 0.5; 
        } else {
            // Brown noise (Rain-like)
            const lastOut = 0;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            data[i] *= 3.5; 
        }
    }
    return buffer;
}

// Simple noise generators
function createBrownNoise() { // Heavy Rain
    const bufferSize = 4096;
    const node = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    let lastOut = 0;
    node.onaudioprocess = function(e) {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; // Gain compensation
        }
    };
    return node;
}

function createPinkNoise() { // Wind
    const bufferSize = 4096;
    const node = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    node.onaudioprocess = function(e) {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            output[i] *= 0.11; 
            b6 = white * 0.115926;
        }
    };
    return node;
}

function createWhiteNoise() { // Focus
    const bufferSize = 4096;
    const node = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    node.onaudioprocess = function(e) {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    };
    return node;
}

function playAmbient() {
    stopAmbient(); // Clear previous
    if(ambientSelect.value === 'none') return;
    
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    if(ambientSelect.value === 'rain') ambientNode = createBrownNoise();
    else if(ambientSelect.value === 'wind') ambientNode = createPinkNoise();
    else if(ambientSelect.value === 'white') ambientNode = createWhiteNoise();
    
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = ambientVol.value * 0.15; // Normalize volume
    
    ambientNode.connect(ambientGain);
    ambientGain.connect(audioCtx.destination);
}

function stopAmbient() {
    if(ambientNode) {
        ambientNode.disconnect();
        ambientNode = null;
    }
    if(ambientGain) {
        ambientGain.disconnect();
        ambientGain = null;
    }
}

ambientSelect.onchange = () => { if(running && !paused) playAmbient(); };
ambientVol.oninput = () => { if(ambientGain) ambientGain.gain.value = ambientVol.value * 0.15; };

// --- WAKE LOCK ---
let wakeLock = null;
async function requestWakeLock() { if ('wakeLock' in navigator) { try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {} } }
async function releaseWakeLock() { if (wakeLock !== null) { try { await wakeLock.release(); wakeLock = null; } catch (err) {} } }
document.addEventListener('visibilitychange', async () => { if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock(); });

// --- PRESET LOGIC ---
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
    currentPatternName = 'Adhama'; updatePatternDisplay(); resetBtn.click();
}
function deletePreset(name) {
    if (!confirm(`Are you sure you want to delete preset "${name}"?`)) return;
    let presets = JSON.parse(localStorage.getItem('pranaPresets') || '[]');
    presets = presets.filter(preset => preset.name !== name);
    localStorage.setItem('pranaPresets', JSON.stringify(presets));
    if (currentPatternName === name) { difficultySel.value = 'easy'; resetBtn.click(); }
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
            document.getElementById('inhaleRange').value = preset.Inhale;
            document.getElementById('holdRange').value = preset.Hold;
            document.getElementById('exhaleRange').value = preset.Exhale;
            document.getElementById('relaxRange').value = preset.Relax;
            ['inhaleRange', 'holdRange', 'exhaleRange', 'relaxRange'].forEach(id => document.getElementById(id).dispatchEvent(new Event('input')));
            let tempOpt = document.getElementById('tempPresetOption');
            if (!tempOpt) { tempOpt = document.createElement('option'); tempOpt.id = 'tempPresetOption'; tempOpt.value = 'preset_active'; difficultySel.appendChild(tempOpt); }
            tempOpt.textContent = `Active: ${preset.name}`;
            difficultySel.value = 'preset_active'; currentPatternName = preset.name; customControls.style.display = 'none'; updatePatternDisplay(); closeSettings(); resetBtn.click();
        };
        item.querySelector('.btn-del').onclick = () => deletePreset(preset.name);
        savedPresetsList.appendChild(item);
    });
}

// --- CORE LOGIC ---
themeToggle.onclick = () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    let newTheme = current === 'light' ? 'dark' : 'light';
    themeToggle.textContent = newTheme === 'dark' ? '☀' : '☾';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('pranaTheme', newTheme);
    if (!running && timeLeft > 0) updateVisuals(1 - (timeLeft / lastTotalDuration), timeLeft); else if (!running) resetBtn.click();
};
(function loadInitialTheme() {
    const savedTheme = localStorage.getItem('pranaTheme');
    if (savedTheme) { document.documentElement.setAttribute('data-theme', savedTheme); themeToggle.textContent = savedTheme === 'dark' ? '☀' : '☾'; }
})();
function saveSession() {
    if (cycleCount > 0) {
        let name = patternDisplay.textContent;
        const session = { date: new Date().toISOString(), cycles: cycleCount, duration: Math.round(totalSecondsPlayed), pattern: name, isCustom: difficultySel.value === 'custom' || difficultySel.value === 'preset_active' };
        const history = JSON.parse(localStorage.getItem('pranaHistory') || '[]');
        history.push(session);
        localStorage.setItem('pranaHistory', JSON.stringify(history));
    }
}
function updatePatternDisplay() {
    const val = difficultySel.value;
    const getSliderVals = () => { return `${document.getElementById('inhaleRange').value}-${document.getElementById('holdRange').value}-${document.getElementById('exhaleRange').value}`; };
    if (val === 'custom') patternDisplay.textContent = `Custom (${getSliderVals()})`;
    else if (val === 'preset_active') patternDisplay.textContent = `${currentPatternName} (${getSliderVals()})`;
    else patternDisplay.textContent = difficultySel.options[difficultySel.selectedIndex].text;
}
function getPattern() {
    if (difficultySel.value === 'custom' || difficultySel.value === 'preset_active') {
        return { Inhale: +document.getElementById('inhaleRange').value, Hold: +document.getElementById('holdRange').value, Exhale: +document.getElementById('exhaleRange').value, Relax: +document.getElementById('relaxRange').value };
    }
    return patterns[difficultySel.value];
}
function formatTime(s) { const mm = Math.floor(s / 60).toString().padStart(2, '0'); const ss = Math.floor(s % 60).toString().padStart(2, '0'); return `${mm}:${ss}`; }
function getColor(phase) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (phase === 'PURAKA') return '#08fc34'; // Green
    if (phase === 'ANTARA') return '#fc0303'; // Red
    if (phase === 'RECHAKA') return '#fbbf24'; // Yellow
    return isLight ? '#3b82f6' : '#60a5fa'; // Blue (Bahya)
}
function updateVisuals(progress, duration) {
    const isVisualOn = visualToggle ? visualToggle.checked : true;
    const pct = Math.min(100, Math.max(0, progress * 100));
    const color = getColor(currentPhase);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim();
    if (isVisualOn) { circle.style.background = `conic-gradient(${color} ${pct}%, ${bg} 0%)`; circle.style.opacity = "1"; capsuleDot.style.opacity = "1"; } 
    else { circle.style.background = bg; circle.style.opacity = "0.3"; capsuleDot.style.opacity = "0"; }
    const displaySec = Math.ceil(duration);
    if (numberEl.textContent != displaySec) numberEl.textContent = displaySec;
    if (phaseTitle.textContent !== currentPhase) phaseTitle.textContent = currentPhase;
    if (numberEl.style.color !== color) {
        numberEl.style.color = color; phaseTitle.style.color = color;
        if (running && !paused && isVisualOn) { capsuleDot.style.backgroundColor = color; capsuleDot.style.boxShadow = `0 0 10px ${color}`; }
    }
}
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
        const totalPhaseTime = (currentPhase === 'PURAKA' ? p.Inhale : currentPhase === 'ANTARA' ? p.Hold : currentPhase === 'RECHAKA' ? p.Exhale : p.Relax);
        lastTotalDuration = totalPhaseTime;
        updateVisuals(1 - (timeLeft / totalPhaseTime), timeLeft);
        animationFrameId = requestAnimationFrame(tick);
    }
}
function nextPhase(overflow = 0) {
    const p = getPattern();
    if (currentPhase === 'PURAKA') currentPhase = 'ANTARA';
    else if (currentPhase === 'ANTARA') currentPhase = 'RECHAKA';
    else if (currentPhase === 'RECHAKA') currentPhase = 'BAHYA';
    else { currentPhase = 'PURAKA'; cycleCount++; cyclesEl.textContent = cycleCount; }
    let dur = (currentPhase === 'PURAKA') ? p.Inhale : (currentPhase === 'ANTARA') ? p.Hold : (currentPhase === 'RECHAKA') ? p.Exhale : p.Relax;
    timeLeft = dur - overflow;
    if (document.getElementById('soundToggle').checked) beep();
    if (document.getElementById('voiceToggle').checked) speak(currentPhase);
    if (document.getElementById('vibeToggle').checked && navigator.vibrate) navigator.vibrate(50);
    tick();
}
function beep() { try { const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.type = 'sine'; o.frequency.value = 440; g.gain.value = 0.05; o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3); o.stop(audioCtx.currentTime + 0.3); } catch (e) { } }
function speak(txt) { if (!('speechSynthesis' in window)) return; speechSynthesis.cancel(); const utt = new SpeechSynthesisUtterance(txt.toLowerCase()); utt.rate = 0.9; utt.lang = 'en-US'; speechSynthesis.speak(utt); }

startBtn.onclick = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (!running) {
        if ('speechSynthesis' in window && speechSynthesis.paused) speechSynthesis.resume();
        running = true; paused = false; totalSecondsPlayed = 0; startBtn.textContent = 'Pause';
        const p = getPattern(); timeLeft = p.Inhale; currentPhase = 'PURAKA';
        if (document.getElementById('voiceToggle').checked) speak('Puraka');
        playAmbient(); // START SOUNDS
        requestWakeLock(); lastFrameTime = Date.now(); tick();
    } else {
        paused = !paused; startBtn.textContent = paused ? 'Resume' : 'Pause';
        if (paused) { saveSession(); cancelAnimationFrame(animationFrameId); capsuleDot.style.backgroundColor = 'var(--text-muted)'; speechSynthesis.cancel(); releaseWakeLock(); stopAmbient(); } // STOP SOUNDS
        else { requestWakeLock(); lastFrameTime = Date.now(); playAmbient(); tick(); }
    }
};
resetBtn.onclick = () => {
    saveSession(); running = false; paused = false; cancelAnimationFrame(animationFrameId); releaseWakeLock(); stopAmbient(); // STOP SOUNDS
    startBtn.textContent = 'Start'; currentPhase = 'PURAKA'; const p = getPattern(); const bg = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim(); const txt = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
    const isVisualOn = visualToggle ? visualToggle.checked : true;
    if (isVisualOn) { circle.style.background = `conic-gradient(${bg} 0%, ${bg} 100%)`; circle.style.opacity = "1"; } else { circle.style.background = bg; circle.style.opacity = "0.3"; }
    numberEl.textContent = p.Inhale; numberEl.style.color = txt; phaseTitle.textContent = 'Ready'; phaseTitle.style.color = txt; cyclesEl.textContent = '0'; elapsedEl.textContent = '00:00'; cycleCount = 0; totalSecondsPlayed = 0; capsuleDot.style.backgroundColor = 'var(--text-muted)'; capsuleDot.style.boxShadow = 'none'; speechSynthesis.cancel();
};
difficultySel.onchange = () => {
    const val = difficultySel.value;
    if (val === 'custom') { customControls.style.display = 'block'; updatePatternDisplay(); }
    else if (val !== 'preset_active') { customControls.style.display = 'none'; currentPatternName = val; updatePatternDisplay(); }
    if (val !== 'preset_active') { const temp = document.getElementById('tempPresetOption'); if (temp) temp.remove(); }
    if (!running) resetBtn.click();
};
['inhale', 'hold', 'exhale', 'relax'].forEach(k => { const r = document.getElementById(k + 'Range'); const v = document.getElementById(k + 'Val'); r.addEventListener('input', () => { v.textContent = r.value + 's'; if (difficultySel.value === 'custom') { updatePatternDisplay(); if (!running) { const p = getPattern(); numberEl.textContent = p.Inhale; } } }); });
savePresetBtn.onclick = savePreset; resetBtn.click(); updatePatternDisplay();