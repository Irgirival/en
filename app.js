(function(){
  const GRADE_LABELS_GROUP = {
    sd: "Sekolah Dasar",
    smp: "Sekolah Menengah Pertama"
  };

  let state = {
    grade: GRADE_ORDER[0],
    semester: 1,
    query: "",
    openWeeks: new Set(),
    collapsedMonths: new Set(),
  };

  const root = document.documentElement;
  const gradeTabsEl = document.getElementById('gradeTabs');
  const gradeTitleEl = document.getElementById('gradeTitle');
  const gradeLevelTagEl = document.getElementById('gradeLevelTag');
  const monthsWrapEl = document.getElementById('monthsWrap');
  const searchInputEl = document.getElementById('searchInput');
  const progressTagEl = document.getElementById('progressTag');
  const printSheetEl = document.getElementById('printSheet');

  function buildTabs(){
    let html = '';
    ['sd','smp'].forEach(level => {
      html += `<div class="tab-group-label">${GRADE_LABELS_GROUP[level]}</div>`;
      GRADE_ORDER.filter(k => PLANNER_DATA[k].level === level).forEach(k => {
        const g = PLANNER_DATA[k];
        html += `<button class="tab-btn" data-key="${k}" data-level="${level}">
          <span class="dot"></span>${g.label}
        </button>`;
      });
    });
    gradeTabsEl.innerHTML = html;
    gradeTabsEl.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.grade = btn.dataset.key;
        state.openWeeks.clear();
        render();
      });
    });
  }

  function setAccent(level){
    if(level === 'smp'){
      root.style.setProperty('--accent', 'var(--smp)');
      root.style.setProperty('--accent-soft', 'var(--smp-soft)');
    } else {
      root.style.setProperty('--accent', 'var(--sd)');
      root.style.setProperty('--accent-soft', 'var(--sd-soft)');
    }
  }

  function weekMatchesQuery(w, q){
    if(!q) return true;
    q = q.toLowerCase();
    return (w.tema + ' ' + w.tujuan + ' ' + w.materi).toLowerCase().includes(q);
  }

  function render(){
    const g = PLANNER_DATA[state.grade];
    setAccent(g.level);

    gradeTabsEl.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.key === state.grade);
    });

    gradeLevelTagEl.textContent = g.level === 'sd' ? 'Sekolah Dasar' : 'Sekolah Menengah Pertama';
    gradeTitleEl.textContent = g.label + ' — Bahasa Inggris';

    const weeksAll = g.weeks.filter(w => w.semester === state.semester);
    const weeks = weeksAll.filter(w => weekMatchesQuery(w, state.query));

    const fullCount = weeksAll.filter(w => w.detail).length;
    progressTagEl.textContent = `${fullCount} dari ${weeksAll.length} minggu berisi RPP lengkap · sisanya kerangka tema siap dikembangkan`;

    // group by bulan, preserve order of first appearance
    const monthOrder = [];
    const byMonth = {};
    weeks.forEach(w => {
      if(!byMonth[w.bulan]){ byMonth[w.bulan] = []; monthOrder.push(w.bulan); }
      byMonth[w.bulan].push(w);
    });

    if(monthOrder.length === 0){
      monthsWrapEl.innerHTML = `<div class="empty-state"><h2>Tidak ada hasil</h2><p>Coba kata kunci pencarian lain.</p></div>`;
      return;
    }

    let html = '';
    monthOrder.forEach(month => {
      const monthKey = state.grade + '-' + state.semester + '-' + month;
      const collapsed = state.collapsedMonths.has(monthKey);
      html += `<section class="month-block ${collapsed ? 'collapsed' : ''}" data-monthkey="${monthKey}">
        <button class="month-header">
          <h3>${month}</h3>
          <span class="count">${byMonth[month].length} minggu</span>
          <span class="chev">&#9660;</span>
        </button>
        <div class="month-weeks">
          ${byMonth[month].map(renderWeekCard).join('')}
        </div>
      </section>`;
    });
    monthsWrapEl.innerHTML = html;

    monthsWrapEl.querySelectorAll('.month-header').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.closest('.month-block').dataset.monthkey;
        if(state.collapsedMonths.has(key)) state.collapsedMonths.delete(key);
        else state.collapsedMonths.add(key);
        render();
      });
    });

    monthsWrapEl.querySelectorAll('.week-card').forEach(card => {
      const wk = card.dataset.wk;
      card.querySelector('.week-toggle').addEventListener('click', () => {
        const setKey = state.grade + '-' + state.semester + '-' + wk;
        if(state.openWeeks.has(setKey)){ state.openWeeks.delete(setKey); }
        else{ state.openWeeks.add(setKey); }
        render();
      });
      const printBtn = card.querySelector('.week-print-btn');
      if(printBtn){
        printBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          printSingleWeek(g, weeksAll.find(w => String(w.week) === wk));
        });
      }
    });
  }

  function renderWeekCard(w){
    const setKey = state.grade + '-' + state.semester + '-' + w.week;
    const open = state.openWeeks.has(setKey);
    return `<article class="week-card ${open ? 'open' : ''}" data-wk="${w.week}">
      <span class="week-tab">Minggu ${w.week}</span>
      <div class="week-card-top">
        <div class="week-tema">${escapeHtml(w.tema)}</div>
        <span class="status-tag ${w.detail ? 'full' : 'outline'}">${w.detail ? 'RPP Lengkap' : 'Kerangka'}</span>
      </div>
      <button class="week-toggle">${open ? '– Sembunyikan detail' : '+ Lihat detail rencana'}</button>
      <div class="week-detail">
        <h4>Tujuan Pembelajaran</h4>
        <p>${escapeHtml(w.tujuan)}</p>
        <h4>Materi &amp; Kosakata</h4>
        <p>${escapeHtml(w.materi)}</p>
        <h4>Aktivitas Kelas</h4>
        <p>${escapeHtml(w.aktivitas)}</p>
        <h4>Tugas</h4>
        <p>${escapeHtml(w.tugas)}</p>
        <h4>Catatan Guru</h4>
        <div class="catatan-block">${escapeHtml(w.catatan)}</div>
        <button class="week-print-btn" type="button">Cetak RPP minggu ini</button>
      </div>
    </article>`;
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function printSingleWeek(g, w){
    if(!w) return;
    printSheetEl.innerHTML = `
      <h1>${g.label} — Bahasa Inggris</h1>
      <p><strong>Semester ${w.semester} · ${w.bulan} · Minggu ${w.week}</strong></p>
      <h4>Tema</h4><p>${w.tema}</p>
      <h4>Tujuan Pembelajaran</h4><p>${w.tujuan}</p>
      <h4>Materi &amp; Kosakata</h4><p>${w.materi}</p>
      <h4>Aktivitas Kelas</h4><p>${w.aktivitas}</p>
      <h4>Tugas</h4><p>${w.tugas}</p>
      <h4>Catatan Guru</h4><p>${w.catatan}</p>
    `;
    window.print();
  }

  function printYearCalendar(){
    const g = PLANNER_DATA[state.grade];
    let rows = g.weeks.map(w => `<p><strong>Minggu ${w.week} (${w.bulan}, Semester ${w.semester}):</strong> ${w.tema}</p>`).join('');
    printSheetEl.innerHTML = `<h1>${g.label} — Kalender Tema Satu Tahun</h1>${rows}`;
    window.print();
  }

  searchInputEl.addEventListener('input', (e) => {
    state.query = e.target.value;
    render();
  });

  document.getElementById('semesterToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.sem-btn');
    if(!btn) return;
    document.querySelectorAll('.sem-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.semester = Number(btn.dataset.sem);
    render();
  });

  document.getElementById('printYearBtn').addEventListener('click', printYearCalendar);

  buildTabs();
  render();
})();
