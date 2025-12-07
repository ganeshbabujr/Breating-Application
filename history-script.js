let practiceChartInstance = null;
let currentView = 'week'; 
let dateOffset = 0;       

(function synchronizeTheme() {
    const savedTheme = localStorage.getItem('pranaTheme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

function initHistory() {
    renderDashboard();
    document.querySelectorAll('.tab').forEach(t => {
        t.addEventListener('click', (e) => {
            document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
            e.target.classList.add('active');
            const newView = e.target.dataset.view;
            if (currentView !== newView) { currentView = newView; dateOffset = 0; renderDashboard(); }
        });
    });
    document.getElementById('backBtn').onclick = (e) => { e.preventDefault(); window.location.href = 'index.html'; };
    document.getElementById('prevPeriodBtn').onclick = () => { dateOffset--; renderDashboard(); };
    document.getElementById('nextPeriodBtn').onclick = () => { dateOffset++; renderDashboard(); };
    document.getElementById('clearHistoryBtn').onclick = () => { if(confirm("Are you sure you want to clear ALL practice history?")) { localStorage.removeItem('pranaHistory'); renderDashboard(); } };
    document.getElementById('exportBtn').onclick = exportData;
    document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
    document.getElementById('importFile').onchange = (e) => importData(e.target);
}

function exportData() {
    const data = { history: JSON.parse(localStorage.getItem('pranaHistory') || '[]'), presets: JSON.parse(localStorage.getItem('pranaPresets') || '[]'), theme: localStorage.getItem('pranaTheme') || 'dark' };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "pranayamam_backup_" + new Date().toISOString().split('T')[0] + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importData(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { try { const data = JSON.parse(e.target.result); if (data.history) localStorage.setItem('pranaHistory', JSON.stringify(data.history)); if (data.presets) localStorage.setItem('pranaPresets', JSON.stringify(data.presets)); if (data.theme) localStorage.setItem('pranaTheme', data.theme); alert("Data restored successfully! Page will reload."); location.reload(); } catch (err) { alert("Error reading file."); } };
    reader.readAsText(file);
}

function renderDashboard() {
    const history = JSON.parse(localStorage.getItem('pranaHistory') || '[]');
    const totalSessions = history.length;
    const totalSeconds = history.reduce((acc, curr) => acc + curr.duration, 0);
    document.getElementById('statSessions').textContent = totalSessions;
    document.getElementById('statDurationNumeric').textContent = (totalSeconds / 60).toFixed(1);

    // --- SANSKRIT MONTHLY CHALLENGE ---
    const now = new Date();
    const currentMonthIdx = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
    const monthlySessions = history.filter(s => { const d = new Date(s.date); return d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear; });
    const monthlySeconds = monthlySessions.reduce((acc, curr) => acc + curr.duration, 0);
    const monthlyMinutes = Math.round(monthlySeconds / 60);
    const monthlyGoal = 50 * daysInMonth; 
    const levels = [
        { pct: 0,   title: "Arambha",      icon: "🌱" },
        { pct: 25,  title: "Sadhaka",      icon: "🌿" },
        { pct: 50,  title: "Abhyasi",      icon: "🧘" },
        { pct: 75,  title: "Sthira",       icon: "🔥" },
        { pct: 100, title: "Siddha",       icon: "👑" },
        { pct: 120, title: "Mahayogi",     icon: "✨" }
    ];
    const currentPct = (monthlyMinutes / monthlyGoal) * 100;
    let currentLevel = levels[0]; let nextLevel = levels[1];
    for (let i = 0; i < levels.length; i++) { if (currentPct >= levels[i].pct) { currentLevel = levels[i]; nextLevel = levels[i+1] || null; } }
    
    document.getElementById('levelTitle').textContent = currentLevel.title;
    document.getElementById('levelIcon').textContent = currentLevel.icon;
    const bar = document.getElementById('levelBar');
    const nextText = document.getElementById('levelNext');
    const badge = document.getElementById('levelPercentBadge');

    if (nextLevel) {
        const nextLevelMins = Math.round((nextLevel.pct / 100) * monthlyGoal);
        const minsLeft = Math.max(0, nextLevelMins - monthlyMinutes);
        const currentLevelMins = Math.round((currentLevel.pct / 100) * monthlyGoal);
        const range = nextLevelMins - currentLevelMins;
        const progressInTier = monthlyMinutes - currentLevelMins;
        const barPercent = Math.min(100, Math.max(0, (progressInTier / range) * 100));
        bar.style.width = `${barPercent}%`;
        nextText.textContent = `${minsLeft} mins to ${nextLevel.title}`;
        badge.textContent = `${Math.round(currentPct)}%`;
    } else {
        bar.style.width = '100%';
        nextText.textContent = "Siddha State Achieved! 🕉️";
        badge.textContent = "100%";
        badge.style.backgroundColor = "rgba(52, 211, 153, 0.2)";
        badge.style.color = "#34d399";
        badge.style.borderColor = "#34d399";
    }

    // Chart Data logic
    const { start, end, labels } = getDateRangeAndBuckets(currentView, dateOffset);
    const dateOpts = { month: 'short', day: 'numeric', year: 'numeric' };
    let rangeText = "";
    if (currentView === 'day') rangeText = start.toLocaleDateString('en-US', { ...dateOpts, weekday: 'short' });
    else if (currentView === 'year') rangeText = start.getFullYear().toString();
    else rangeText = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', dateOpts)}`;
    document.getElementById('dateRangeDisplay').textContent = rangeText;

    const filteredData = history.filter(s => { const d = new Date(s.date); return d >= start && d <= end; });
    const dataPoints = new Array(labels.length).fill(0);
    filteredData.forEach(s => {
        const d = new Date(s.date);
        let index = -1;
        if (currentView === 'day') index = Math.floor(d.getHours() / 4);
        else if (currentView === 'week') { index = d.getDay() - 1; if (index === -1) index = 6; }
        else if (currentView === 'month') index = d.getDate() - 1;
        else if (currentView === 'year') index = d.getMonth();
        if (index >= 0 && index < dataPoints.length) { dataPoints[index] += (s.duration / 60); }
    });

    const periodTotalMin = Math.round(dataPoints.reduce((a,b) => a+b, 0));
    let activeDays = 1;
    if (currentView !== 'day') activeDays = new Set(filteredData.map(s => new Date(s.date).toDateString())).size || 1;
    const periodAvg = Math.round(periodTotalMin / activeDays);

    document.getElementById('chartTotalDisplay').textContent = `${periodTotalMin} MIN`;
    document.getElementById('chartAvgDisplay').textContent = `AVG ${periodAvg} MIN/DAY`;

    renderBarChart(labels, dataPoints);
    renderMissedDays(start, end, history);
    renderDetailedLog(history);
}

function renderDetailedLog(history) {
    const listEl = document.getElementById('detailedLogList'); if (!listEl) return; listEl.innerHTML = '';
    const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sorted.length === 0) { listEl.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:0.9rem;">No sessions recorded yet.</div>`; return; }
    sorted.forEach(session => {
        const dateObj = new Date(session.date);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const mins = Math.max(1, Math.round(session.duration / 60));
        const div = document.createElement('div'); div.className = 'log-item';
        div.innerHTML = `<div><span class="log-date">${dateStr}</span><div class="log-sub">${timeStr} • ${session.pattern || 'Breath Work'}</div></div><div class="log-duration">${mins} min</div>`;
        listEl.appendChild(div);
    });
}

function renderMissedDays(startDate, endDate, history) {
    const listEl = document.getElementById('missedDaysList'); const calEl = document.getElementById('calendarViewContainer'); const legendEl = document.getElementById('calendarLegend'); const badgeEl = document.getElementById('missedCountBadge'); const titleEl = document.getElementById('missedCardTitle');
    if (!listEl || !calEl) return;
    const practicedDates = new Set(history.map(s => { const d = new Date(s.date); return d.toLocaleDateString('en-CA'); }));
    if (currentView === 'month') {
        listEl.style.display = 'none'; badgeEl.style.display = 'none'; calEl.style.display = 'block'; legendEl.style.display = 'flex'; titleEl.textContent = "Monthly Overview"; titleEl.style.color = "var(--text-main)"; renderCalendarGrid(calEl, startDate, practicedDates);
    } else if (currentView === 'week') {
        calEl.style.display = 'none'; legendEl.style.display = 'none'; listEl.style.display = 'flex'; listEl.style.flexDirection = 'column'; badgeEl.style.display = 'none'; titleEl.textContent = "Weekly Overview"; titleEl.style.color = "var(--text-main)";
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; let html = '<div class="week-view-container"><div class="week-strip">'; let activeDays = 0; let totalWeekMins = 0; const today = new Date(); today.setHours(0,0,0,0); let loopDay = new Date(startDate);
        for (let i = 0; i < 7; i++) {
            const dateStr = loopDay.toLocaleDateString('en-CA'); const dayLabel = days[i]; const daySessions = history.filter(s => { const d = new Date(s.date); return d.toLocaleDateString('en-CA') === dateStr; }); const isPracticed = daySessions.length > 0; const isFuture = loopDay > today;
            let cardClass = ''; let icon = ''; let val = '';
            if (isPracticed) { activeDays++; const mins = Math.round(daySessions.reduce((acc, s) => acc + (s.duration || 0), 0) / 60); totalWeekMins += mins; cardClass = 'done'; icon = '✓'; val = `${mins}m`; } else if (isFuture) { cardClass = 'future'; icon = '-'; val = '--'; } else { const isToday = loopDay.toDateString() === today.toDateString(); if (isToday) { cardClass = 'future'; icon = '⏳'; val = 'Pending'; } else { cardClass = 'missed'; icon = '✕'; val = 'Missed'; } }
            html += `<div class="week-day-card ${cardClass}"><span class="wd-label">${dayLabel}</span><span class="wd-icon">${icon}</span><span class="wd-val">${val}</span></div>`; loopDay.setDate(loopDay.getDate() + 1);
        }
        html += '</div>'; const consistency = Math.round((activeDays / 7) * 100); html += `<div class="week-summary-row"><div class="ws-item"><div class="ws-val">${activeDays}/7</div><div class="ws-lbl">Days Active</div></div><div class="ws-item"><div class="ws-val">${totalWeekMins}m</div><div class="ws-lbl">Total Time</div></div><div class="ws-item"><div class="ws-val" style="color: ${consistency > 70 ? 'var(--cal-success)' : 'var(--text-muted)'}">${consistency}%</div><div class="ws-lbl">Score</div></div></div></div>`; listEl.innerHTML = html;
    } else if (currentView === 'day') {
         calEl.style.display = 'none'; legendEl.style.display = 'none'; listEl.style.display = 'flex'; listEl.style.flexDirection = 'column'; badgeEl.style.display = 'none'; titleEl.textContent = "Daily Targets"; titleEl.style.color = "var(--text-main)";
         const daySessions = history.filter(s => { const d = new Date(s.date); return d.toDateString() === startDate.toDateString(); });
         let morningDone = false; let nightDone = false; daySessions.forEach(s => { const h = new Date(s.date).getHours(); if (h >= 4 && h < 12) morningDone = true; if (h >= 18) nightDone = true; });
         const now = new Date(); const isToday = startDate.toDateString() === now.toDateString(); const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const viewDateMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()); const isPast = viewDateMidnight < todayMidnight;
         let mStatus = 'Pending'; let mClass = ''; let mCheck = ''; if (morningDone) { mStatus = 'Completed'; mClass = 'done'; mCheck = '✓ '; } else { if (isPast || (isToday && now.getHours() >= 12)) { mStatus = 'Missed'; mClass = 'missed'; mCheck = '✕ '; } }
         let nStatus = 'Pending'; let nClass = ''; let nCheck = ''; if (nightDone) { nStatus = 'Completed'; nClass = 'done'; nCheck = '✓ '; } else { if (isPast) { nStatus = 'Missed'; nClass = 'missed'; nCheck = '✕ '; } }
         const renderCard = (statusClass, label, icon, statusText, check) => { return `<div class="target-card ${statusClass}"><div class="target-icon">${icon}</div><div class="target-label">${label}</div><div class="target-status">${check}${statusText}</div></div>`; };
         const totalCycles = daySessions.reduce((acc, s) => acc + (s.cycles || 0), 0); const totalMins = Math.round(daySessions.reduce((acc, s) => acc + (s.duration || 0), 0) / 60);
         listEl.innerHTML = `<div class="year-summary-container"><div class="targets-row">${renderCard(mClass, "Morning", "☀️", mStatus, mCheck)}${renderCard(nClass, "Night", "🌙", nStatus, nCheck)}</div><div class="year-stat-row"><div class="year-stat-box"><div class="year-stat-val">${totalMins}m</div><div class="year-stat-label" style="color:var(--accent)">Duration</div></div><div class="year-stat-box"><div class="year-stat-val">${totalCycles}</div><div class="year-stat-label" style="color:var(--text-muted)">Breaths</div></div></div></div>`;
    } else if (currentView === 'year') {
         calEl.style.display = 'none'; legendEl.style.display = 'none'; listEl.style.display = 'flex'; listEl.style.flexDirection = 'column'; badgeEl.style.display = 'none'; titleEl.textContent = "Yearly Performance"; titleEl.style.color = "var(--text-main)";
         const year = startDate.getFullYear(); const daysInYear = ((year % 4 === 0 && year % 100 > 0) || year % 400 === 0) ? 366 : 365;
         let activeDaysCount = 0; const sortedDates = []; practicedDates.forEach(d => { if(d.startsWith(year.toString())) { activeDaysCount++; sortedDates.push(d); } }); sortedDates.sort();
         let maxStreak = 0; let currStreak = 0; let prevDate = null;
         if (sortedDates.length > 0) { sortedDates.forEach(dateStr => { const parts = dateStr.split('-'); const d = new Date(parts[0], parts[1] - 1, parts[2]); if (prevDate) { const diffTime = Math.abs(d - prevDate); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if (diffDays === 1) currStreak++; else currStreak = 1; } else { currStreak = 1; } if(currStreak > maxStreak) maxStreak = currStreak; prevDate = d; }); }
         const now = new Date(); const currentYear = now.getFullYear(); let totalDaysToCount = 0; if (year < currentYear) totalDaysToCount = daysInYear; else if (year === currentYear) { const startOfYear = new Date(year, 0, 0); const diff = now - startOfYear; const oneDay = 1000 * 60 * 60 * 24; totalDaysToCount = Math.floor(diff / oneDay); } else totalDaysToCount = 0;
         const missedCount = Math.max(0, totalDaysToCount - activeDaysCount); const completionRate = totalDaysToCount > 0 ? Math.round((activeDaysCount / totalDaysToCount) * 100) : 0;
         listEl.innerHTML = `<div class="year-summary-container"><div class="year-stat-row"><div class="year-stat-box"><div class="year-stat-val">${activeDaysCount}</div><div class="year-stat-label" style="color:var(--cal-success)">Active Days</div></div><div class="year-stat-box"><div class="year-stat-val">${missedCount}</div><div class="year-stat-label" style="color:var(--cal-missed)">Missed</div></div><div class="year-stat-box"><div class="year-stat-val">${maxStreak}</div><div class="year-stat-label" style="color:var(--accent)">Best Streak</div></div></div><div class="year-progress-section"><div class="progress-labels"><span>Consistency Rate</span><span>${completionRate}%</span></div><div class="year-progress-bar"><div class="year-progress-fill" style="width: ${completionRate}%"></div></div></div></div>`;
    }
}

function renderCalendarGrid(container, dateInMonth, practicedSet) {
    const year = dateInMonth.getFullYear(); const month = dateInMonth.getMonth(); const today = new Date(); today.setHours(0,0,0,0); const todayStr = today.toLocaleDateString('en-CA');
    const firstDayOfMonth = new Date(year, month, 1); const daysInMonth = new Date(year, month + 1, 0).getDate(); const startDayOffset = firstDayOfMonth.getDay(); 
    let html = '<div class="cal-grid">'; ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => { html += `<div class="cal-header">${day}</div>`; });
    for (let i = 0; i < startDayOffset; i++) { html += `<div class="cal-day empty"></div>`; }
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) { const currentDay = new Date(year, month, dayNum); const dateStr = currentDay.toLocaleDateString('en-CA'); const isPracticed = practicedSet.has(dateStr); const isToday = dateStr === todayStr; const isPast = currentDay < today; let classes = 'cal-day'; if (isPracticed) classes += ' practiced'; else if (isPast) classes += ' missed'; if (isToday) classes += ' today-indicator'; html += `<div class="${classes}">${dayNum}</div>`; }
    html += '</div>'; container.innerHTML = html;
}

function getDateRangeAndBuckets(view, offset) {
    const now = new Date(); let start = new Date(); let end = new Date(); let labels = [];
    if (view === 'day') { start.setDate(now.getDate() + offset); start.setHours(0,0,0,0); end = new Date(start); end.setHours(23,59,59,999); labels = ['Early', 'Morn', 'Noon', 'Aft', 'Eve', 'Night']; } 
    else if (view === 'week') { const day = now.getDay(); const diff = now.getDate() - day + (day == 0 ? -6 : 1); start.setDate(diff + (offset * 7)); start.setHours(0,0,0,0); end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999); labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; } 
    else if (view === 'month') { start.setDate(1); start.setMonth(now.getMonth() + offset); start.setHours(0,0,0,0); end = new Date(start); end.setMonth(start.getMonth() + 1); end.setDate(0); end.setHours(23,59,59,999); labels = Array.from({length: end.getDate()}, (_, i) => (i + 1).toString()); } 
    else if (view === 'year') { start.setFullYear(now.getFullYear() + offset); start.setMonth(0, 1); start.setHours(0,0,0,0); end = new Date(start); end.setFullYear(start.getFullYear() + 1); end.setDate(0); end.setHours(23,59,59,999); labels = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']; }
    return { start, end, labels };
}

function renderBarChart(labels, data) {
    const ctx = document.getElementById('practiceChart'); if(!ctx) return; if (practiceChartInstance) practiceChartInstance.destroy();
    const isLight = document.documentElement.getAttribute('data-theme') === 'light'; const accentColor = isLight ? '#06b6d4' : '#22d3ee'; const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'; const tickColor = isLight ? '#64748b' : '#94a3b8'; const barThickness = labels.length > 15 ? 6 : 12;
    practiceChartInstance = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ data: data, backgroundColor: accentColor, borderRadius: 50, barThickness: barThickness, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true } }, scales: { y: { beginAtZero: true, suggestedMax: 30, border: { display: false }, grid: { color: gridColor, drawTicks: false }, ticks: { color: tickColor, font: { size: 10, family: "'Inter', sans-serif" }, padding: 10, callback: function(val) { return val + 'm'; } } }, x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10, family: "'Inter', sans-serif" }, autoSkip: true, maxTicksLimit: 15 } } } } });
}