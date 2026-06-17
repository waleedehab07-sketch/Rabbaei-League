const AIRTABLE_BASE_ID = 'appyj28JrILxWr0Qy'; 
const AIRTABLE_TOKEN = 'pat7CEru8NzGmfpCv.6d4c230697996999ba3e8f7952c3c5baf9fbcedf557397bde357179db86bd303';
const MANAGERS_TABLE = 'tblm7fEWUMG15MbCU'; 
const RESULTS_TABLE = 'tblbjo6Dg8BTseU0D';   

async function fetchAllRecords(tableId: string) {
    let allRecords: any[] = [];
    let offset = '';
    do {
        let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`;
        if (offset) url += `?offset=${offset}`; 
        
        const response = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        if (!response.ok) throw new Error(`فشل الاتصال بجدول ${tableId}`);
        
        const data = await response.json();
        if (data.records) allRecords = allRecords.concat(data.records);
        offset = data.offset; 
    } while (offset);
    
    return allRecords;
}

async function initDashboard() {
    const tbody = document.querySelector('.leaderboard-table tbody');
    const tourneyContainer = document.getElementById('tournaments-container');

    try {
        const [mRecords, rRecords] = await Promise.all([
            fetchAllRecords(MANAGERS_TABLE),
            fetchAllRecords(RESULTS_TABLE)
        ]);

        renderLeaderboardTable(mRecords);
        renderSeasonsAndTournaments(rRecords);
        setupScoreHistoryChart(mRecords, rRecords); // 🔥 بناء وتحضير الرسم البياني التاريخي
        handleAutoNavigation();

    } catch (error) {
        console.error(error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444;">❌ حدث خطأ أثناء جلب البيانات.</td></tr>`;
        if (tourneyContainer) tourneyContainer.innerHTML = `<div style="text-align:center; color:#ef4444;">❌ فشل تحميل جداول البطولات.</div>`;
    }
}

function getFieldValue(fields: any, possibleNames: string[]) {
    const keys = Object.keys(fields);
    for (let name of possibleNames) {
        const match = keys.find(k => k.toLowerCase().trim() === name.toLowerCase().trim());
        if (match) return fields[match];
    }
    return null;
}

function calculateBallonDor(value: any) {
    if (value === undefined || value === null) return 0;
    if (Array.isArray(value)) return value.reduce((sum, v) => sum + (Number(v) || 0), 0);
    return Number(value) || 0;
}

function renderLeaderboardTable(records: any[]) {
    const tbody = document.querySelector('.leaderboard-table tbody');
    if (!tbody) return;

    let validCoaches: any[] = [];

    records.forEach(record => {
        const id = record.id; 
        const name = record.fields['Name']; 
        
        if (name && String(name).trim() !== '') {
            let scoreVal = record.fields['Total Score'];
            if (Array.isArray(scoreVal)) scoreVal = scoreVal[0];
            let score = Number(scoreVal) || 0;

            let goldVal = record.fields['Gold Medals'];
            if (Array.isArray(goldVal)) goldVal = goldVal[0];
            let gold = Number(goldVal) || 0;

            let silverVal = record.fields['Silver Medals'];
            if (Array.isArray(silverVal)) silverVal = silverVal[0];
            let silver = Number(silverVal) || 0;

            let bronzeVal = record.fields['Bronze Medals'];
            if (Array.isArray(bronzeVal)) bronzeVal = bronzeVal[0];
            let bronze = Number(bronzeVal) || 0;
            
            let ballonDorRaw = getFieldValue(record.fields, ['Manager of the Season', 'Manager of the season', 'Manager_of_the_Season']);
            let ballonDor = calculateBallonDor(ballonDorRaw);

            validCoaches.push({ id, name, score, gold, silver, bronze, ballonDor });
        }
    });

    validCoaches.sort((a, b) => b.score - a.score);

    if (validCoaches.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding: 2rem;">لا يوجد مدربين مسجلين بعد.</td></tr>`;
        return;
    }

    let isExpanded = false;
    const INITIAL_LIMIT = 6; 

    function drawTable() {
        tbody!.innerHTML = ''; 
        
        const limit = isExpanded ? validCoaches.length : Math.min(INITIAL_LIMIT, validCoaches.length);
        const visibleCoaches = validCoaches.slice(0, limit);

        visibleCoaches.forEach((coach, index) => {
            const rank = index + 1; 
            let rowClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';

            tbody!.innerHTML += `
                <tr class="${rowClass}" onclick="window.location.href='/profile.html?id=${coach.id}'" title="عرض ملف المدرب">
                    <td class="rank">${rank}</td>
                    <td class="coach-name"><b>${coach.name}</b></td>
                    <td class="score">${coach.score.toFixed(3)}</td>
                    <td class="medals">
                        <span title="مدرب الموسم">🏆 ${coach.ballonDor}</span>
                        <span title="ميدالية ذهبية">🥇 ${coach.gold}</span>
                        <span title="ميدالية فضية">🥈 ${coach.silver}</span>
                        <span title="ميدالية برونزية">🥉 ${coach.bronze}</span>
                    </td>
                </tr>
            `;
        });

        if (validCoaches.length > INITIAL_LIMIT) {
            if (!isExpanded) {
                const remaining = validCoaches.length - INITIAL_LIMIT;
                tbody!.innerHTML += `
                    <tr id="toggle-list-btn" style="background: rgba(56, 189, 248, 0.08); transition: 0.3s ease;">
                        <td colspan="4" style="text-align:center; color:#38bdf8; font-weight:900; padding:1.2rem; cursor:pointer; font-size:1.1rem; border-radius:12px;">
                            🔽 عرض باقي المدربين (${remaining})
                        </td>
                    </tr>
                `;
            } else {
                tbody!.innerHTML += `
                    <tr id="toggle-list-btn" style="background: rgba(239, 68, 68, 0.08); transition: 0.3s ease;">
                        <td colspan="4" style="text-align:center; color:#f87171; font-weight:900; padding:1.2rem; cursor:pointer; font-size:1.1rem; border-radius:12px;">
                            🔼 طي القائمة
                        </td>
                    </tr>
                `;
            }

            const toggleBtn = document.getElementById('toggle-list-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    isExpanded = !isExpanded;
                    drawTable(); 
                });
                
                toggleBtn.addEventListener('mouseenter', () => toggleBtn.style.background = isExpanded ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)');
                toggleBtn.addEventListener('mouseleave', () => toggleBtn.style.background = isExpanded ? 'rgba(239, 68, 68, 0.08)' : 'rgba(56, 189, 248, 0.08)');
            }
        }
    }

    drawTable();
}

function renderSeasonsAndTournaments(results: any[]) {
    const container = document.getElementById('tournaments-container');
    if (!container) return;
    container.innerHTML = '';

    if (!results || results.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding: 2rem;">لا توجد بطولات مسجلة في الأرشيف حالياً.</div>`;
        return;
    }

    const groupedData: { [season: string]: { [tourney: string]: any[] } } = {};
    
    results.forEach(r => {
        let season = r.fields['Season (from Tournaments)'] || ['موسم غير محدد'];
        if (Array.isArray(season)) season = season[0];
        if (!season) return; 
        
        let tName = r.fields['Tournament_Name (from Tournaments)'] || ['بطولة غير معرفة'];
        if (Array.isArray(tName)) tName = tName[0];
        
        if (!groupedData[season]) groupedData[season] = {};
        if (!groupedData[season][tName]) groupedData[season][tName] = [];
        groupedData[season][tName].push(r);
    });

    const sortedSeasons = Object.keys(groupedData).sort((a, b) => b.localeCompare(a));

    let tabsHtml = `<div class="tabs-header">`;
    let contentHtml = `<div class="tabs-body">`;

    sortedSeasons.forEach((season, index) => {
        const isActive = index === 0 ? 'active' : '';
        const seasonId = `season-${season.replace(/\s+/g, '-').replace(/\//g, '-')}`;

        tabsHtml += `<button class="tab-btn ${isActive}" data-target="${seasonId}">موسم ${season}</button>`;
        
        contentHtml += `<div class="tab-content ${isActive}" id="${seasonId}">
            <div class="tournaments-grid">`;
        
        const tournaments = groupedData[season];
        Object.keys(tournaments).forEach(tName => {
            const participants = tournaments[tName].sort((a, b) => (a.fields['Rank'] || 99) - (b.fields['Rank'] || 99));
            const boxId = `box-${season.replace(/\s+/g, '-').replace(/\//g, '-')}-${tName.replace(/\s+/g, '-').replace(/\//g, '-')}`;

            let proofImageRaw = getFieldValue(participants[0].fields, ['صورة التوثيق (from Tournaments)', 'Image (from Tournaments)', 'Screenshot (from Tournaments)', 'Screenshot', 'Image', 'صورة التوثيق', 'Proof']);
            let attachments: {url: string, name: string, type: string}[] = [];
            
            if (Array.isArray(proofImageRaw)) {
                proofImageRaw.forEach(attachment => {
                    if (attachment.url && attachment.type && (attachment.type.startsWith('image/') || attachment.type.startsWith('video/'))) {
                        attachments.push({ url: attachment.url, name: attachment.filename || '', type: attachment.type });
                    } else if (typeof attachment === 'string' && attachment.startsWith('http')) {
                        let isVideo = attachment.match(/\.(mp4|webm|mov|ogg)$/i) ? 'video/mp4' : 'image/jpeg';
                        attachments.push({ url: attachment, name: attachment, type: isVideo });
                    }
                });
            } else if (typeof proofImageRaw === 'string' && proofImageRaw.startsWith('http')) {
                let isVideo = proofImageRaw.match(/\.(mp4|webm|mov|ogg)$/i) ? 'video/mp4' : 'image/jpeg';
                attachments.push({ url: proofImageRaw, name: proofImageRaw, type: isVideo });
            }

            attachments.sort((a, b) => {
                const getWeight = (str: string) => {
                    let n = str.toLowerCase().replace(/20\d{2}/g, '');
                    if (n.includes('end')) return 1000;
                    if (n.includes('final') && !n.includes('semi') && !n.includes('quarter')) return 500;
                    if (n.includes('3rd') || n.includes('third')) return 450;
                    if (n.includes('semi')) return 400;
                    if (n.includes('quarter')) return 300;
                    if (n.includes('r16') || n.includes('16')) return 200;
                    if (n.includes('may')) return 99;
                    if (n.includes('apr')) return 98;
                    if (n.includes('mar')) return 97;
                    if (n.includes('feb')) return 96;
                    if (n.includes('jan')) return 95;
                    if (n.includes('dec')) return 94;
                    if (n.includes('nov')) return 93;
                    if (n.includes('oct')) return 92;
                    if (n.includes('sep')) return 91;
                    if (n.includes('aug')) return 90;
                    let gwMatch = n.match(/(?:gw|round|جولة|stage|week)\s*(\d+)/);
                    if (gwMatch) return parseInt(gwMatch[1]);
                    let match = n.match(/\d+/);
                    if (match) return parseInt(match[0]);
                    return 0; 
                };
                return getWeight(b.name) - getWeight(a.name);
            });

            let safeMediaParam = encodeURIComponent(JSON.stringify(attachments));

            contentHtml += `
                <div class="tournament-box" id="${boxId}">
                    <div class="tournament-title" style="display:flex; justify-content:space-between; align-items:center;">
                        <span>🏆 ${tName}</span>
                        ${attachments.length > 0 ? `
                            <button onclick="window.showSliderModal('${safeMediaParam}')" 
                                style="background: rgba(56, 189, 248, 0.1); border: 1px solid #38bdf8; color: #38bdf8; border-radius: 6px; padding: 4px 10px; font-size: 0.85rem; cursor: pointer; transition: all 0.3s; font-family: inherit; font-weight: bold; display:flex; align-items:center; gap:5px;"
                                onmouseover="this.style.background='#38bdf8'; this.style.color='#fff';" 
                                onmouseout="this.style.background='rgba(56, 189, 248, 0.1)'; this.style.color='#38bdf8';">
                                📷 توثيق ${attachments.length > 1 ? `(${attachments.length})` : ''}
                            </button>
                        ` : ''}
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 20%; padding:0.5rem;">المركز</th>
                                <th style="width: 50%; padding:0.5rem; text-align:right;">المدرب</th>
                                <th style="width: 30%; padding:0.5rem;">النقاط</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            participants.forEach(p => {
                let coachName = p.fields['Name (from Managers)'] || ['مدرب'];
                if (Array.isArray(coachName)) coachName = coachName[0];
                let coachId = p.fields['Manager_ID'] || '';
                if (Array.isArray(coachId)) coachId = coachId[0];
                let rank = p.fields['Rank'] || '-';
                let points = p.fields['Points'] || '0';
                
                let rankDisplay = `#${rank}`;
                let rowGlow = 'color: #cbd5e1;';
                if (rank === 1) { rankDisplay = `🥇 1`; rowGlow = 'color: #FFD700; font-weight: 900;'; }
                else if (rank === 2) { rankDisplay = `🥈 2`; rowGlow = 'color: #E3E4E5; font-weight: bold;'; }
                else if (rank === 3) { rankDisplay = `🥉 3`; rowGlow = 'color: #CD7F32; font-weight: bold;'; }

                let clickAction = coachId ? `onclick="window.location.href='/profile.html?id=${coachId}'" style="cursor: pointer;"` : '';

                contentHtml += `
                    <tr ${clickAction} class="tournament-row-link">
                        <td style="${rowGlow} padding:0.5rem;">${rankDisplay}</td>
                        <td style="font-weight:bold; padding:0.5rem; text-align:right; color: #fff;">${coachName}</td>
                        <td style="color: #38bdf8; font-weight: bold; padding:0.5rem;">${points}</td>
                    </tr>
                `;
            });

            contentHtml += `</tbody></table></div>`;
        });
        
        contentHtml += `</div></div>`; 
    });

    tabsHtml += `</div>`; 
    contentHtml += `</div>`; 
    container.innerHTML = tabsHtml + contentHtml;

    const tabBtns = container.querySelectorAll('.tab-btn');
    const tabContents = container.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            if (targetId) {
                const targetContent = document.getElementById(targetId);
                if (targetContent) targetContent.classList.add('active');
            }
        });
    });
}

function handleAutoNavigation() {
    const params = new URLSearchParams(window.location.search);
    const paramSeason = params.get('season');
    const paramTournament = params.get('tournament');

    if (paramSeason) {
        const seasonId = `season-${paramSeason.replace(/\s+/g, '-').replace(/\//g, '-')}`;
        const tabBtn = document.querySelector(`.tab-btn[data-target="${seasonId}"]`) as HTMLButtonElement;
        if (tabBtn) {
            tabBtn.click();
            if (paramTournament) {
                const boxId = `box-${paramSeason.replace(/\s+/g, '-').replace(/\//g, '-')}-${paramTournament.replace(/\s+/g, '-').replace(/\//g, '-')}`;
                setTimeout(() => {
                    const targetBox = document.getElementById(boxId);
                    if (targetBox) {
                        targetBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetBox.style.borderColor = '#38bdf8';
                        targetBox.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.4)';
                        targetBox.style.transition = 'all 0.5s ease';
                    }
                }, 300);
            }
        }
    }
}

// 🔥 حساب المسار التاريخي للـ Score وبناء الخطوط البيانية
function setupScoreHistoryChart(managers: any[], results: any[]) {
    const toggleBtn = document.getElementById('toggle-chart-btn');
    const chartSection = document.getElementById('chart-section');
    const filtersContainer = document.getElementById('manager-filters-container');
    const canvas = document.getElementById('scoreHistoryChart') as HTMLCanvasElement;

    if (!toggleBtn || !chartSection || !filtersContainer || !canvas) return;

    // 1. استخراج الهيكل الزمني الفريد للبطولات (ترتيب تصاعدي من الأقدم للأحدث)
    let tournamentMap = new Map<string, { season: string, name: string, id: number }>();
    results.forEach(r => {
        let season = r.fields['Season (from Tournaments)'];
        if (Array.isArray(season)) season = season[0];
        let tName = r.fields['Tournament_Name (from Tournaments)'];
        if (Array.isArray(tName)) tName = tName[0];
        let resultId = Number(r.fields['Result_ID']) || 0;

        if (season && tName) {
            let key = `${season} - ${tName}`;
            if (!tournamentMap.has(key) || resultId > tournamentMap.get(key)!.id) {
                tournamentMap.set(key, { season, name: tName, id: resultId });
            }
        }
    });

    // ترتيب تصاعدي من أول بطولة في التاريخ لآخر بطولة
    let timeline = Array.from(tournamentMap.values()).sort((a, b) => {
        let sCompare = a.season.localeCompare(b.season);
        return sCompare !== 0 ? sCompare : a.id - b.id;
    });

    let labels = timeline.map(t => `${t.name} (${t.season})`);

    // 2. خريطة بأسماء المدربين ومصادقة معرفاتهم
    let managerMap = new Map<string, string>();
    managers.forEach(m => {
        if (m.fields['Name'] && String(m.fields['Name']).trim() !== '') {
            managerMap.set(m.id, m.fields['Name']);
        }
    });

    // 3. حساب النقاط التراكمية (Running Total) خطوة بخطوة عبر جدول الخط الزمني
    let managerScores: { [id: string]: number[] } = {};
    let runningScores: { [id: string]: number } = {};

    managerMap.forEach((name, id) => {
        managerScores[id] = [];
        runningScores[id] = 0;
    });

    timeline.forEach(t => {
        // العثور على جميع نتائج هذه البطولة المحددة
        let currentMatches = results.filter(r => {
            let s = r.fields['Season (from Tournaments)'];
            if (Array.isArray(s)) s = s[0];
            let n = r.fields['Tournament_Name (from Tournaments)'];
            if (Array.isArray(n)) n = n[0];
            return s === t.season && n === t.name;
        });

        // إضافة نقاط هذه البطولة للمجموع التراكمي الخاص بالمدربين
        currentMatches.forEach(match => {
            let mIds = match.fields['Manager_ID'];
            if (Array.isArray(mIds)) {
                mIds.forEach(mId => {
                    let pts = Number(match.fields['Points']) || 0;
                    if (runningScores[mId] !== undefined) {
                        runningScores[mId] += pts;
                    }
                });
            }
        });

        // حفظ قيمة المجموع التراكمي لكل المدربين عند هذه النقطة الزمنية
        managerMap.forEach((name, id) => {
            managerScores[id].push(Number(runningScores[id].toFixed(3)));
        });
    });

    // 4. صياغة الـ Datasets الخاصة بـ Chart.js مع توليد ألوان مضيئة متناسقة
    let datasets: any[] = [];
    let idx = 0;

    managerMap.forEach((name, id) => {
        let hue = (idx * 145) % 360; // توزيع زوايا الألوان لضمان اختلاف الخطوط بصرياً
        let color = `hsla(${hue}, 85%, 60%, 1)`;

        datasets.push({
            label: name,
            data: managerScores[id],
            borderColor: color,
            backgroundColor: color.replace('1)', '0.08)'),
            tension: 0.25,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            hidden: idx >= 4 // إظهار أول 4 مدربين فقط بشكل افتراضي لمنع تداخل القنوات بصرياً
        });
        idx++;
    });

    // 5. تهيئة وإنشاء مجسم الرسم البياني
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if ((window as any).scoreChart) (window as any).scoreChart.destroy();

    // @ts-ignore
    (window as any).scoreChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, // إخفاء الليجند التقليدي لاستبداله بالتشيك بوكس
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#111827',
                    titleColor: '#38bdf8',
                    bodyColor: '#fff',
                    borderColor: 'rgba(56, 189, 248, 0.2)',
                    borderWidth: 1,
                    bodyFont: { family: 'Cairo' },
                    titleFont: { family: 'Cairo', weight: 'bold' }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#94a3b8', font: { family: 'Cairo', size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#cbd5e1', font: { family: 'Cairo' } }
                }
            }
        }
    });

    // 6. صناعة وتوليد أزرار الـ Checkboxes ديناميكياً لتصفية المدربين
    filtersContainer.innerHTML = '';
    datasets.forEach((dataset, i) => {
        const label = document.createElement('label');
        label.className = 'manager-checkbox-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !dataset.hidden;
        checkbox.style.cssText = 'cursor: pointer; accent-color: #38bdf8;';

        checkbox.addEventListener('change', () => {
            if ((window as any).scoreChart) {
                (window as any).scoreChart.data.datasets[i].hidden = !checkbox.checked;
                (window as any).scoreChart.update();
            }
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(dataset.label));
        filtersContainer.appendChild(label);
    });

    // 7. ربط حدث زر التفعيل (Toggle Button) لإظهار وإخفاء المساحة بالكامل
    toggleBtn.onclick = () => {
        if (chartSection.style.display === 'none') {
            chartSection.style.display = 'block';
            toggleBtn.style.background = 'rgba(251, 191, 36, 0.25)';
            // إجبار الكانفاس على إعادة حساب أبعاده لتفادي مشاكل العرض المفاجئ
            if ((window as any).scoreChart) (window as any).scoreChart.resize();
        } else {
            chartSection.style.display = 'none';
            toggleBtn.style.background = 'rgba(251, 191, 36, 0.1)';
        }
    };
}

// 🌐 نظام معارض الصور (Sliders) - محدث لدعم الجوال
(window as any).showSliderModal = function(encodedMedia: string) {
    let mediaList: {url: string, type: string}[] = [];
    try { mediaList = JSON.parse(decodeURIComponent(encodedMedia)); } catch (e) { return; }
    if (mediaList.length === 0) return;

    let currentIndex = 0;
    let modal = document.getElementById('slider-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'slider-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(11, 15, 25, 0.95); backdrop-filter: blur(8px); z-index: 10000; display: flex; justify-content: center; align-items: center; opacity: 0; transition: opacity 0.3s ease; flex-direction: column;';
        
        // 🔥 الحل السحري للجوال: حقن كود CSS هنا لترتيب الأزرار
        const mobileStyles = document.createElement('style');
        mobileStyles.innerHTML = `
            @media (max-width: 768px) {
                #slider-prev-btn { left: 10px !important; width: 35px !important; height: 50px !important; font-size: 1.5rem !important; background: rgba(0,0,0,0.6) !important; }
                #slider-next-btn { right: 10px !important; width: 35px !important; height: 50px !important; font-size: 1.5rem !important; background: rgba(0,0,0,0.6) !important; }
                #slider-media-container { max-width: 95% !important; }
                #slider-main-img, #slider-main-video { max-height: 70vh !important; }
            }
        `;
        modal.appendChild(mobileStyles);

        const topBar = document.createElement('div');
        topBar.style.cssText = 'position: absolute; top: 20px; width: 100%; max-width: 900px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; box-sizing: border-box; z-index: 10002;';
        
        const counter = document.createElement('div');
        counter.id = 'slider-counter';
        counter.style.cssText = 'color: #38bdf8; font-weight: bold; font-size: 1.1rem; background: rgba(56,189,248,0.1); padding: 5px 15px; border-radius: 20px; border: 1px solid rgba(56,189,248,0.3);';
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✖ إغلاق';
        closeBtn.style.cssText = 'color: #fff; font-weight: bold; background: #ef4444; padding: 8px 20px; border-radius: 20px; border: none; cursor: pointer; font-family: inherit; font-size: 1rem; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); transition: transform 0.2s;';

        topBar.appendChild(counter);
        topBar.appendChild(closeBtn);

        const mediaContainer = document.createElement('div');
        mediaContainer.id = 'slider-media-container';
        mediaContainer.style.cssText = 'position: relative; max-width: 90%; max-height: 80vh; display: flex; justify-content: center; align-items: center; transition: opacity 0.3s ease;';
        
        const prevBtn = document.createElement('button');
        prevBtn.id = 'slider-prev-btn';
        prevBtn.innerHTML = '❮';
        prevBtn.style.cssText = 'position: absolute; left: -50px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.1); border: none; color: white; font-size: 2rem; width: 40px; height: 60px; border-radius: 8px; cursor: pointer; backdrop-filter: blur(4px); transition: background 0.3s; z-index: 10001;';
        
        const nextBtn = document.createElement('button');
        nextBtn.id = 'slider-next-btn';
        nextBtn.innerHTML = '❯';
        nextBtn.style.cssText = 'position: absolute; right: -50px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.1); border: none; color: white; font-size: 2rem; width: 40px; height: 60px; border-radius: 8px; cursor: pointer; backdrop-filter: blur(4px); transition: background 0.3s; z-index: 10001;';

        mediaContainer.appendChild(prevBtn);
        mediaContainer.appendChild(nextBtn);
        modal.appendChild(topBar);
        modal.appendChild(mediaContainer);
        document.body.appendChild(modal);

        const closeModal = (e: any) => {
            if (e.target !== modal && e.target !== closeBtn && e.target !== mediaContainer) return;
            modal!.style.opacity = '0';
            setTimeout(() => { 
                modal!.style.display = 'none'; 
                const activeVideo = document.getElementById('slider-main-video') as HTMLVideoElement;
                if(activeVideo) activeVideo.pause();
            }, 300);
        };
        modal.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
    }

    const updateView = () => {
        const mediaContainer = document.getElementById('slider-media-container') as HTMLDivElement;
        const counter = document.getElementById('slider-counter') as HTMLDivElement;
        const prevBtn = document.getElementById('slider-prev-btn') as HTMLButtonElement;
        const nextBtn = document.getElementById('slider-next-btn') as HTMLButtonElement;

        mediaContainer.style.opacity = '0.5';
        setTimeout(() => {
            const oldImg = document.getElementById('slider-main-img');
            const oldVideo = document.getElementById('slider-main-video') as HTMLVideoElement;
            if (oldImg) oldImg.remove();
            if (oldVideo) { oldVideo.pause(); oldVideo.remove(); }

            const currentMedia = mediaList[currentIndex];
            if (currentMedia.type && currentMedia.type.startsWith('video/')) {
                const videoEl = document.createElement('video');
                videoEl.id = 'slider-main-video'; videoEl.controls = true; videoEl.autoplay = true;
                videoEl.style.cssText = 'max-width: 100%; max-height: 80vh; border-radius: 12px; border: 2px solid #38bdf8; box-shadow: 0 10px 40px rgba(56, 189, 248, 0.2); background: #000;';
                const sourceEl = document.createElement('source');
                sourceEl.src = currentMedia.url; sourceEl.type = currentMedia.type;
                videoEl.appendChild(sourceEl);
                mediaContainer.insertBefore(videoEl, nextBtn);
            } else {
                const imgEl = document.createElement('img');
                imgEl.id = 'slider-main-img'; imgEl.src = currentMedia.url;
                imgEl.style.cssText = 'max-width: 100%; max-height: 80vh; border-radius: 12px; border: 2px solid #38bdf8; box-shadow: 0 10px 40px rgba(56, 189, 248, 0.2); object-fit: contain; background: #000;';
                mediaContainer.insertBefore(imgEl, nextBtn);
            }
            mediaContainer.style.opacity = '1';
        }, 150);

        counter.innerHTML = `مرفق ${currentIndex + 1} من ${mediaList.length}`;
        prevBtn.style.display = currentIndex === 0 ? 'none' : 'block';
        nextBtn.style.display = currentIndex === mediaList.length - 1 ? 'none' : 'block';
    };

    document.getElementById('slider-prev-btn')!.onclick = (e) => { e.stopPropagation(); if (currentIndex > 0) { currentIndex--; updateView(); } };
    document.getElementById('slider-next-btn')!.onclick = (e) => { e.stopPropagation(); if (currentIndex < mediaList.length - 1) { currentIndex++; updateView(); } };

    currentIndex = 0;
    updateView();
    modal.style.display = 'flex';
    setTimeout(() => { modal!.style.opacity = '1'; }, 10);
};

initDashboard();
