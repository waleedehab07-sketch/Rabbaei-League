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

  try {
    const [mRecords, rRecords] = await Promise.all([
      fetchAllRecords(MANAGERS_TABLE),
      fetchAllRecords(RESULTS_TABLE),
    ]);

    if (loadingMsg) loadingMsg.style.display = 'none';
    if (filtersBox) filtersBox.style.display = 'flex';
    if (canvasWrapper) canvasWrapper.style.display = 'block';

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
  const canvas = document.getElementById(
    'scoreHistoryChart'
  ) as HTMLCanvasElement;
  if (!filtersContainer || !canvas) return;

  const ChartJS = (window as any).Chart;
  if (!ChartJS) return;

  // 🔥 الترتيب الزمني الصارم (Hardcoded) المأخوذ من رسالتك حرفياً 🔥
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

  // دالة لدمج البطولات الفرعية تحت الأسماء الرئيسية في قائمتك أعلاه
  function getMilestoneLabel(
    season: string,
    tournament: string
  ): string | null {
    let tLower = String(tournament).toLowerCase();
    let sStr = String(season).replace('-', '/').trim();

    // ⛔ استبعاد قطعي لجائزة مدرب الموسم من حسابات الـ Score التراكمي
    if (tLower.includes('manager of') || tLower.includes('مدرب الموسم')) {
      return null;
    }

    if (
      tLower.includes('fpl') ||
      tLower.includes('rabbaei') ||
      tLower.includes('h2h') ||
      tLower.includes('draft') ||
      tLower.includes('end of') ||
      tLower.includes('premier') ||
      (tLower.includes('cup') &&
        !tLower.includes('world') &&
        !tLower.includes('ucl') &&
        !tLower.includes('euro'))
    ) {
      return `${sStr} Premier League`;
    }

    if (tLower.includes('ucl') || tLower.includes('champions'))
      return `${sStr} Champions League`;
    if (tLower.includes('club world cup')) return `2025 FIFA Club World Cup`;
    if (tLower.includes('world cup') && sStr.split('/')[0]=='2025') return `${'2026'} World Cup`;
    if (tLower.includes('world cup')) return `${sStr.split('/')[0]} World Cup`;

    if (tLower.includes('euro')) {
      if (sStr.includes('2020') || sStr.includes('2021'))
        return 'Euro 2020 (Played in 2021)';
      if (sStr.includes('2024')) return 'Euro 2024';
      return `Euro ${sStr}`;
    }

    return `${sStr} ${tournament}`;
  }

  let timelineNodes = new Map<string, { label: string; matches: any[] }>();

  // 1. تجميع كل المباريات والبطولات تحت اسم المحطة الصحيح
  results.forEach((r) => {
    let tNameRaw = r.fields['Tournament_Name (from Tournaments)'];
    let tName = Array.isArray(tNameRaw) ? tNameRaw[0] : tNameRaw;

    let seasonRaw = r.fields['Season (from Tournaments)'];
    let season = Array.isArray(seasonRaw) ? seasonRaw[0] : seasonRaw;

    if (season && tName) {
      let label = getMilestoneLabel(String(season), String(tName));

      // إذا كانت البطولة هي مدرب الموسم، سيتم تجاهلها ولن تضاف للقائمة
      if (!label) return;

      if (!timelineNodes.has(label)) {
        timelineNodes.set(label, { label: label, matches: [] });
      }

      timelineNodes.get(label)!.matches.push(r);
    }
  });

  // 2. الفرز الصارم بناءً على الترتيب الذي حددته أنت 🔥
  let timeline = Array.from(timelineNodes.values()).sort((a, b) => {
    let indexA = milestoneOrder.indexOf(a.label);
    let indexB = milestoneOrder.indexOf(b.label);

    // إذا أضفت بطولة جديدة غير موجودة في القائمة، ضعها في النهاية مؤقتاً
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;

    if (indexA !== indexB) return indexA - indexB;
    return a.label.localeCompare(b.label);
  });

  let labels = timeline.map((t) => t.label);

  let managerMap = new Map<
    string,
    { name: string; totalCurrentScore: number }
  >();
  managers.forEach((m) => {
    if (m.fields['Name'] && String(m.fields['Name']).trim() !== '') {
      let scoreVal = m.fields['Total Score'];
      if (Array.isArray(scoreVal)) scoreVal = scoreVal[0];
      managerMap.set(m.id, {
        name: m.fields['Name'],
        totalCurrentScore: Number(scoreVal) || 0,
      });
    }
  });

  let managerScores: { [id: string]: number[] } = {};
  let runningScores: { [id: string]: number } = {};

  managerMap.forEach((data, id) => {
    managerScores[id] = [];
    runningScores[id] = 0;
  });

  // 3. حساب المسار التراكمي للـ Score
  timeline.forEach((node) => {
    node.matches.forEach((match) => {
      let mIds = match.fields['Manager_ID'];
      if (Array.isArray(mIds)) {
        mIds.forEach((mId) => {
          let scoreRaw = getFieldValue(match.fields, ['Calculated_Score', 'سكور']);

          if (Array.isArray(scoreRaw)) {
            scoreRaw = scoreRaw[0];
          }

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

  // ترتيب المدربين في الفلاتر بناءً على أقوى Score حالي
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
      id: id,
      label: data.name,
      data: managerScores[id],
      borderColor: color,
      backgroundColor: bgColor,
      tension: 0.3,
      borderWidth: 3,
      pointRadius: 4,
      pointHoverRadius: 8,
      pointBackgroundColor: color,
      hidden: index >= 5,
    });
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 4. التصميم الفخم المعتمد
  const chart = new ChartJS(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#38bdf8',
          bodyColor: '#fff',
          borderColor: 'rgba(56, 189, 248, 0.4)',
          borderWidth: 1,
          padding: 15,
          bodyFont: { family: 'Cairo', size: 14 },
          titleFont: { family: 'Cairo', weight: 'bold', size: 15 },
          callbacks: {
            label: function (context: any) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += Number(context.parsed.y).toFixed(3) + ' Score';
              }
              return label;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Cairo', size: 11 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#cbd5e1',
            font: { family: 'Cairo', weight: 'bold' },
          },
        },
      },
    },
  });

  // 5. الفلاتر الأنيقة
  filtersContainer.innerHTML = '';
  datasets.forEach((dataset, i) => {
    const label = document.createElement('label');
    label.className = 'manager-checkbox-label';

    if (!dataset.hidden) {
      label.classList.add('active');
    }

    label.style.borderColor = dataset.hidden
      ? 'var(--glass-border)'
      : dataset.borderColor;
    label.style.background = dataset.hidden
      ? 'rgba(255,255,255,0.04)'
      : dataset.backgroundColor;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !dataset.hidden;
    checkbox.style.cssText =
      'cursor: pointer; width: 16px; height: 16px; margin: 0;';

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
}

try {
  initChartPage();
} catch (e) {
  console.error('Critical Execution Error: ', e);
}
