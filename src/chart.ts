const AIRTABLE_BASE_ID = 'appyj28JrILxWr0Qy';
const AIRTABLE_TOKEN =
  'pat7CEru8NzGmfpCv.6d4c230697996999ba3e8f7952c3c5baf9fbcedf557397bde357179db86bd303';
const MANAGERS_TABLE = 'tblm7fEWUMG15MbCU';
const RESULTS_TABLE = 'tblbjo6Dg8BTseU0D';

async function fetchAllRecords(tableId: string) {
  let allRecords: any[] = [];
  let offset = '';
  do {
    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`;
    if (offset) url += `?offset=${offset}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });
    if (!response.ok) throw new Error(`فشل الاتصال بقاعدة البيانات.`);

    const data = await response.json();
    if (data.records) allRecords = allRecords.concat(data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

function getFieldValue(fields: any, possibleNames: string[]) {
  const keys = Object.keys(fields);
  for (let name of possibleNames) {
    const match = keys.find((k) =>
      k.toLowerCase().includes(name.toLowerCase())
    );
    if (match) return fields[match];
  }
  return null;
}

async function initChartPage() {
  const loadingMsg = document.getElementById('loading-msg');
  const filtersBox = document.getElementById('filters-box');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const raceSection = document.getElementById('race-section');

  try {
    const [mRecords, rRecords] = await Promise.all([
      fetchAllRecords(MANAGERS_TABLE),
      fetchAllRecords(RESULTS_TABLE),
    ]);

    if (loadingMsg) loadingMsg.style.display = 'none';
    if (filtersBox) filtersBox.style.display = 'flex';
    if (canvasWrapper) canvasWrapper.style.display = 'block';
    if (raceSection) raceSection.style.display = 'block';

    buildChart(mRecords, rRecords);
  } catch (error: any) {
    console.error('Error fetching data:', error);
    if (loadingMsg) {
      loadingMsg.style.display = 'block';
      loadingMsg.innerHTML = `❌ حدث خطأ أثناء جلب البيانات: <br> <span style="font-size:0.9rem; color:#ef4444;">${error.message}</span>`;
    }
  }
}

function buildChart(managers: any[], results: any[]) {
  const filtersContainer = document.getElementById('filters-box');
  const canvas = document.getElementById('scoreHistoryChart') as HTMLCanvasElement;
  if (!filtersContainer || !canvas) return;

  const ChartJS = (window as any).Chart;
  if (!ChartJS) return;

  const milestoneOrder = [
    '2018 World Cup',
    '2018/2019 Premier League',
    '2018/2019 Champions League',
    '2019/2020 Premier League',
    '2019/2020 Champions League',
    '2020/2021 Premier League',
    '2020/2021 Champions League',
    'Euro 2020 (Played in 2021)',
    '2021/2022 Premier League',
    '2021/2022 Champions League',
    '2022 World Cup',
    '2022/2023 Premier League',
    '2022/2023 Champions League',
    '2023/2024 Premier League',
    '2023/2024 Champions League',
    'Euro 2024',
    '2024/2025 Premier League',
    '2024/2025 Champions League',
    '2025 FIFA Club World Cup',
    '2025/2026 Premier League',
    '2025/2026 Champions League',
    '2026 World Cup',
  ];

  function getMilestoneLabel(season: string, tournament: string): string | null {
    let tLower = String(tournament).toLowerCase();
    let sStr = String(season).replace('-', '/').trim();

    if (tLower.includes('manager of') || tLower.includes('مدرب الموسم')) return null;

    if (
      tLower.includes('fpl') || tLower.includes('rabbaei') || tLower.includes('h2h') ||
      tLower.includes('draft') || tLower.includes('end of') || tLower.includes('premier') ||
      (tLower.includes('cup') && !tLower.includes('world') && !tLower.includes('ucl') && !tLower.includes('euro'))
    ) {
      return `${sStr} Premier League`;
    }

    if (tLower.includes('ucl') || tLower.includes('champions')) return `${sStr} Champions League`;
    if (tLower.includes('club world cup')) return `2025 FIFA Club World Cup`;
    if (tLower.includes('world cup') && sStr.split('/')[0]=='2025') return `${'2026'} World Cup`;
    if (tLower.includes('world cup')) return `${sStr.split('/')[0]} World Cup`;

    if (tLower.includes('euro')) {
      if (sStr.includes('2020') || sStr.includes('2021')) return 'Euro 2020 (Played in 2021)';
      if (sStr.includes('2024')) return 'Euro 2024';
      return `Euro ${sStr}`;
    }

    return `${sStr} ${tournament}`;
  }

  // 🛡️ التعديل: تخزين الـ date بجانب اللابل لتحديد وقت السباق
  let timelineNodes = new Map<string, { label: string; matches: any[], date?: Date }>();

  results.forEach((r) => {
    let tNameRaw = r.fields['Tournament_Name (from Tournaments)'];
    let tName = Array.isArray(tNameRaw) ? tNameRaw[0] : tNameRaw;
    let seasonRaw = r.fields['Season (from Tournaments)'];
    let season = Array.isArray(seasonRaw) ? seasonRaw[0] : seasonRaw;

    // استخراج التاريخ الفعلي للجولة من جدول النتائج (أو المرتبط من جدول البطولات)
    let dateRaw = getFieldValue(r.fields, ['Date (from Tournaments)', 'Date', 'تاريخ']);
    let dateVal = Array.isArray(dateRaw) ? dateRaw[0] : dateRaw;

    if (season && tName) {
      let label = getMilestoneLabel(String(season), String(tName));
      if (!label) return;

      if (!timelineNodes.has(label)) {
        timelineNodes.set(label, { label: label, matches: [] });
      }
      timelineNodes.get(label)!.matches.push(r);

      // حفظ أقدم تاريخ لهذه المحطة لتحديد وقت البداية الحقيقي لها
      if (dateVal) {
          let parsedDate = new Date(dateVal);
          if (!isNaN(parsedDate.getTime())) {
              let existingDate = timelineNodes.get(label)!.date;
              if (!existingDate || parsedDate < existingDate) {
                  timelineNodes.get(label)!.date = parsedDate;
              }
          }
      }
    }
  });

  let timeline = Array.from(timelineNodes.values()).sort((a, b) => {
    let indexA = milestoneOrder.indexOf(a.label);
    let indexB = milestoneOrder.indexOf(b.label);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    if (indexA !== indexB) return indexA - indexB;
    return a.label.localeCompare(b.label);
  });

  let labels = timeline.map((t) => t.label);

  let managerMap = new Map<string, { name: string; totalCurrentScore: number }>();
  managers.forEach((m) => {
    if (m.fields['Name'] && String(m.fields['Name']).trim() !== '') {
      let scoreVal = m.fields['Total Score'];
      if (Array.isArray(scoreVal)) scoreVal = scoreVal[0];
      managerMap.set(m.id, { name: m.fields['Name'], totalCurrentScore: Number(scoreVal) || 0 });
    }
  });

  let managerScores: { [id: string]: number[] } = {};
  let runningScores: { [id: string]: number } = {};

  managerMap.forEach((data, id) => {
    managerScores[id] = [];
    runningScores[id] = 0;
  });

  timeline.forEach((node) => {
    node.matches.forEach((match) => {
      let mIds = match.fields['Manager_ID'];
      if (Array.isArray(mIds)) {
        mIds.forEach((mId) => {
          let scoreRaw = getFieldValue(match.fields, ['Calculated_Score', 'سكور']);
          if (Array.isArray(scoreRaw)) scoreRaw = scoreRaw[0];
          let scoreToAdd = parseFloat(String(scoreRaw));
          if (isNaN(scoreToAdd)) scoreToAdd = 0;
          if (runningScores[mId] !== undefined) {
            runningScores[mId] += scoreToAdd;
          }
        });
      }
    });

    managerMap.forEach((data, id) => {
      managerScores[id].push(Number(runningScores[id].toFixed(3)));
    });
  });

  let sortedManagers = Array.from(managerMap.entries()).sort(
    (a, b) => b[1].totalCurrentScore - a[1].totalCurrentScore
  );

  let datasets: any[] = [];
  let hueStep = 360 / Math.max(sortedManagers.length, 1);

  sortedManagers.forEach(([id, data], index) => {
    let hue = Math.floor(index * hueStep * 2.5) % 360;
    let color = `hsl(${hue}, 85%, 60%)`;
    let bgColor = `hsla(${hue}, 85%, 60%, 0.1)`;

    datasets.push({
      id: id, label: data.name, data: managerScores[id],
      borderColor: color, backgroundColor: bgColor, tension: 0.3,
      borderWidth: 3, pointRadius: 4, pointHoverRadius: 8,
      pointBackgroundColor: color, hidden: index >= 5,
    });
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const chart = new ChartJS(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)', titleColor: '#38bdf8',
          bodyColor: '#fff', borderColor: 'rgba(56, 189, 248, 0.4)',
          borderWidth: 1, padding: 15, bodyFont: { family: 'Cairo', size: 14 },
          titleFont: { family: 'Cairo', weight: 'bold', size: 15 },
          callbacks: {
            label: function (context: any) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) label += Number(context.parsed.y).toFixed(3) + ' Score';
              return label;
            },
          },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { family: 'Cairo', size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#cbd5e1', font: { family: 'Cairo', weight: 'bold' } } },
      },
    },
  });

  filtersContainer.innerHTML = '';
  datasets.forEach((dataset, i) => {
    const label = document.createElement('label');
    label.className = 'manager-checkbox-label';
    if (!dataset.hidden) label.classList.add('active');

    label.style.borderColor = dataset.hidden ? 'var(--glass-border)' : dataset.borderColor;
    label.style.background = dataset.hidden ? 'rgba(255,255,255,0.04)' : dataset.backgroundColor;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !dataset.hidden;
    checkbox.style.cssText = 'cursor: pointer; width: 16px; height: 16px; margin: 0;';

    checkbox.addEventListener('change', () => {
      chart.data.datasets[i].hidden = !checkbox.checked;
      if (checkbox.checked) {
        label.classList.add('active');
        label.style.borderColor = dataset.borderColor;
        label.style.background = dataset.backgroundColor;
      } else {
        label.classList.remove('active');
        label.style.borderColor = 'var(--glass-border)';
        label.style.background = 'rgba(255,255,255,0.04)';
      }
      chart.update();
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(dataset.label));
    filtersContainer.appendChild(label);
  });

  // =========================================
  // 🏁 محرك سباق الأعمدة (مع التوقيت الديناميكي المبني على التواريخ الحقيقية)
  // =========================================
  initRaceEngine(sortedManagers, managerScores, labels, hueStep, timeline);
}

function initRaceEngine(sortedManagers: any[], managerScores: any, labels: string[], hueStep: number, timeline: any[]) {
    const raceBarsContainer = document.getElementById('race-bars');
    const milestoneDisplay = document.getElementById('race-milestone-display');
    const playBtn = document.getElementById('race-play');
    const pauseBtn = document.getElementById('race-pause');
    const replayBtn = document.getElementById('race-replay');

    if (!raceBarsContainer || !milestoneDisplay || !playBtn || !pauseBtn || !replayBtn) return;

    // حساب المدد الزمنية الديناميكية (Durations) بين كل جولة والجولة التي تليها
    let durations: number[] = [];
    for (let i = 0; i < timeline.length; i++) {
        let currentDt = timeline[i].date;
        let nextDt = (i + 1 < timeline.length) ? timeline[i+1].date : null;
        let duration = 1500; // السرعة الافتراضية
        
        if (currentDt && nextDt) {
            let diffDays = Math.abs(nextDt.getTime() - currentDt.getTime()) / (1000 * 60 * 60 * 24);
            // المعادلة: 800 ملي ثانية كأساس + 15 ملي ثانية لكل يوم مسافة بينهم (كل ما طالت المدة، يبطئ السباق ليكون واقعي)
            duration = 800 + (diffDays * 15);
            if (duration < 800) duration = 800;
            if (duration > 4500) duration = 4500; // سقف السرعة البطيئة (مثل التوقف الصيفي ما يتعدى 4.5 ثواني)
        }
        durations.push(duration);
    }

    const BAR_HEIGHT_SPACING = 50;
    raceBarsContainer.style.height = `${sortedManagers.length * BAR_HEIGHT_SPACING}px`;

    let currentStep = 0;
    let raceTimeout: any;
    let isPlaying = false;

    const barElements = new Map<string, HTMLDivElement>();
    const barScoreElements = new Map<string, HTMLSpanElement>();

    sortedManagers.forEach(([id, data], index) => {
        const hue = Math.floor(index * hueStep * 2.5) % 360;
        const color = `hsl(${hue}, 85%, 55%)`;

        const bar = document.createElement('div');
        bar.className = 'race-bar';
        bar.style.backgroundColor = color;
        bar.style.width = '0%';
        bar.style.transform = `translateY(${index * BAR_HEIGHT_SPACING}px)`; 

        const nameSpan = document.createElement('span');
        nameSpan.className = 'race-name';
        nameSpan.textContent = data.name;

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'race-score';
        scoreSpan.textContent = '0.000';

        bar.appendChild(nameSpan);
        bar.appendChild(scoreSpan);
        raceBarsContainer.appendChild(bar);

        barElements.set(id, bar);
        barScoreElements.set(id, scoreSpan);
    });

    function renderRaceStep(step: number) {
        milestoneDisplay.innerHTML = labels[step].replace(' ', '<br>');

        let stepScores: { id: string, score: number, name: string }[] = [];
        sortedManagers.forEach(([id, data]) => {
            stepScores.push({ id, score: managerScores[id][step] || 0, name: data.name });
        });

        stepScores.sort((a, b) => b.score - a.score);

        let maxScore = stepScores[0].score;
        if (maxScore === 0) maxScore = 1;

        stepScores.forEach((item, rank) => {
            const bar = barElements.get(item.id)!;
            const scoreSpan = barScoreElements.get(item.id)!;

            let widthPercent = (item.score / maxScore) * 100;
            if (widthPercent < 15) widthPercent = 15; 

            bar.style.width = `${widthPercent}%`;
            bar.style.transform = `translateY(${rank * BAR_HEIGHT_SPACING}px)`; 
            scoreSpan.textContent = item.score.toFixed(3);
        });

        currentStep++;
    }

    // المُحرك المعتمد على الـ Timeouts للحفاظ على المسافات الزمنية الواقعية
    function runNextStep() {
        if (!isPlaying) return;
        if (currentStep >= labels.length) {
            pauseRace();
            return;
        }

        let currentDuration = durations[currentStep] || 1500;
        let animDuration = currentDuration * 0.85; // جعل الأنيميشن يأخذ 85% من الوقت المحسوب ليترك مساحة بسيطة لتهدئة العين
        
        barElements.forEach(bar => {
            bar.style.transition = `transform ${animDuration}ms ease-in-out, width ${animDuration}ms ease-in-out`;
        });
        
        renderRaceStep(currentStep); 
        
        raceTimeout = setTimeout(() => {
            runNextStep();
        }, currentDuration);
    }

    function playRace() {
        if (currentStep >= labels.length) currentStep = 0; 
        isPlaying = true;
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-flex';
        runNextStep();
    }

    function pauseRace() {
        isPlaying = false;
        clearTimeout(raceTimeout);
        playBtn.style.display = 'inline-flex';
        pauseBtn.style.display = 'none';
    }

    function replayRace() {
        pauseRace();
        currentStep = 0;
        
        // الانتقال السريع للمرحلة صفر بدون وقت طويل
        barElements.forEach(bar => {
            bar.style.transition = `transform 300ms ease-in-out, width 300ms ease-in-out`;
        });
        renderRaceStep(currentStep);
        setTimeout(playRace, 400); // بدء السباق بعد رجوع الأعمدة
    }

    playBtn.addEventListener('click', playRace);
    pauseBtn.addEventListener('click', pauseRace);
    replayBtn.addEventListener('click', replayRace);

    // تجهيز المشهد الأول (الجولة 0) فور تحميل الصفحة
    setTimeout(() => renderRaceStep(0), 100);
}

try {
  initChartPage();
} catch (e) {
  console.error('Critical Execution Error: ', e);
}
