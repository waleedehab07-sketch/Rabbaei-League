const AIRTABLE_BASE_ID = 'appyj28JrILxWr0Qy'; 
const AIRTABLE_TOKEN = 'pat7CEru8NzGmfpCv.6d4c230697996999ba3e8f7952c3c5baf9fbcedf557397bde357179db86bd303';

const MANAGERS_TABLE = 'tblm7fEWUMG15MbCU'; 
const RESULTS_TABLE = 'tblbjo6Dg8BTseU0D'; 

const urlParams = new URLSearchParams(window.location.search);
const coachId = urlParams.get('id');

const profileContent = document.getElementById('profile-content');

async function fetchCoachData() {
    if (!coachId) {
        if(profileContent) profileContent.innerHTML = `<a href="/" class="back-btn">← العودة للترتيب</a><h2 style="color:#ef4444;">لم يتم العثور على المدرب!</h2>`;
        return;
    }

    const managerUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${MANAGERS_TABLE}/${coachId}`;

    try {
        const response = await fetch(managerUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        if (!response.ok) throw new Error('فشل الاتصال');
        
        const record = await response.json();
        
        renderProfileBase(record);
        await fetchCoachHistory(coachId);

    } catch (error) {
        if(profileContent) profileContent.innerHTML = `<a href="/" class="back-btn">← العودة للترتيب</a><h2 style="color:#ef4444;">❌ خطأ في جلب البيانات</h2>`;
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
    if (Array.isArray(value)) {
        return value.reduce((sum, v) => sum + (Number(v) || 0), 0);
    }
    return Number(value) || 0;
}

function renderProfileBase(record: any) {
    if (!profileContent) return;

    const name = record.fields['Name'] || 'مدرب مجهول';
    let gold = record.fields['Gold Medals'] || 0;
    let silver = record.fields['Silver Medals'] || 0;
    let bronze = record.fields['Bronze Medals'] || 0;
    
    let ballonDorRaw = getFieldValue(record.fields, ['Manager of the Season', 'Manager of the season', 'Manager_of_the_Season']);
    let ballonDor = calculateBallonDor(ballonDorRaw);

    if (Array.isArray(gold)) gold = gold[0];
    if (Array.isArray(silver)) silver = silver[0];
    if (Array.isArray(bronze)) bronze = bronze[0];

    profileContent.innerHTML = `
        <a href="/" class="back-btn">← العودة للصفحة الرئيسية</a>
        <div class="coach-icon">👤</div>
        <h1 class="coach-name">${name}</h1>
        
        <div class="medals-box">
            <div class="medal-item"><span>🏆</span> ${ballonDor} مدرب الموسم</div>
            <div class="medal-item"><span>🥇</span> ${Number(gold)} ذهبية</div>
            <div class="medal-item"><span>🥈</span> ${Number(silver)} فضية</div>
            <div class="medal-item"><span>🥉</span> ${Number(bronze)} برونزية</div>
        </div>

        <div class="history-section">
            <h3>🏆 السجل التاريخي للبطولات والتشكيلات</h3>
            <div id="history-body">
                <div style="text-align:center; color:#38bdf8; padding: 2rem;">جاري جلب تفاصيل البطولات... ⏱️</div>
            </div>
        </div>
    `;
}

async function fetchCoachHistory(id: string) {
    const historyBody = document.getElementById('history-body');
    let allResults: any[] = [];
    let offset = '';
    
    try {
        do {
            let fetchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${RESULTS_TABLE}`;
            if (offset) fetchUrl += `?offset=${offset}`;
            
            const response = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
            const data = await response.json();
            
            if (data.records) allResults = allResults.concat(data.records);
            offset = data.offset; 
        } while (offset);
        
        const coachTournaments = allResults.filter(r => {
            const managerIds = r.fields['Manager_ID']; 
            return managerIds && managerIds.includes(id);
        });

        coachTournaments.sort((a, b) => (b.fields['Result_ID'] || 0) - (a.fields['Result_ID'] || 0));
        
        renderSeasonCards(coachTournaments);
        
    } catch (error) {
        if(historyBody) historyBody.innerHTML = `<div style="color:#ef4444; text-align:center;">❌ فشل جلب تاريخ البطولات</div>`;
    }
}

function renderSeasonCards(results: any[]) {
    const historyBody = document.getElementById('history-body');
    if (!historyBody) return;
    
    historyBody.innerHTML = ''; 
    
    if (results.length === 0) {
        historyBody.innerHTML = `<div style="text-align:center; color:#94a3b8; padding: 2rem;">لم يشارك المدرب في أي بطولة معتمدة حتى الآن.</div>`;
        return;
    }
    
    const groupedBySeason: { [key: string]: any[] } = {};
    
    results.forEach(record => {
        let season = record.fields['Season (from Tournaments)'] || ['موسم غير محدد'];
        if (Array.isArray(season)) season = season[0];
        
        if (!groupedBySeason[season]) {
            groupedBySeason[season] = [];
        }
        groupedBySeason[season].push(record);
    });

    const sortedSeasons = Object.keys(groupedBySeason).sort((a, b) => b.localeCompare(a));

    let htmlContent = '<div class="history-grid">';

    sortedSeasons.forEach(season => {
        htmlContent += `
            <div class="season-card">
                <div class="season-header">📅 موسم ${season}</div>
        `;
        
        groupedBySeason[season].forEach(record => {
            let tournament = record.fields['Tournament_Name (from Tournaments)'] || ['بطولة'];
            if (Array.isArray(tournament)) tournament = tournament[0];
            
            let rank = record.fields['Rank'] || '-';
            let points = record.fields['Points'] || '0'; 
            
            let tNameLower = tournament.toString().toLowerCase();
            let isManagerOfSeason = tNameLower.includes('manager of the season') || tNameLower.includes('مدرب الموسم');
            
            let formattedPoints = '';
            if (isManagerOfSeason) {
                let numPoints = Number(points);
                if (numPoints > 0 && numPoints <= 1 && !points.toString().includes('%')) {
                    formattedPoints = (numPoints * 100).toFixed(1) + '%';
                } else {
                    formattedPoints = points.toString().includes('%') ? points : `${points}%`;
                }
            } else {
                formattedPoints = `${points} نقطة`;
            }

            let rankBadge = `#${rank}`;
            let colorStyle = 'color: #94a3b8;'; 
            
            if (isManagerOfSeason) {
                if (rank === 1) { rankBadge = `🏆 الأول`; colorStyle = `color: #FFD700; text-shadow: 0 0 10px rgba(255,215,0,0.3);`; }
                else if (rank === 2) { rankBadge = `الثاني`; colorStyle = `color: #E3E4E5;`; }
                else if (rank === 3) { rankBadge = `الثالث`; colorStyle = `color: #CD7F32;`; }
                else { rankBadge = `المركز ${rank}`; }
            } else {
                if (rank === 1) { rankBadge = `🥇 الأول`; colorStyle = `color: #FFD700; text-shadow: 0 0 10px rgba(255,215,0,0.3);`; }
                else if (rank === 2) { rankBadge = `🥈 الثاني`; colorStyle = `color: #E3E4E5;`; }
                else if (rank === 3) { rankBadge = `🥉 الثالث`; colorStyle = `color: #CD7F32;`; }
            }
            
            // 🔥 جلب صور/فيديوهات التشكيلة مع تحديد نوع الملف
            let squadImagesRaw = getFieldValue(record.fields, ['صورة التشكيلة', 'Squad Image', 'Squad Images', 'Lineup', 'Lineup Image']);
            let squadMedia: {url: string, type: string}[] = [];
            
            if (Array.isArray(squadImagesRaw)) {
                squadImagesRaw.forEach(attachment => {
                    if (attachment.url && attachment.type && (attachment.type.startsWith('image/') || attachment.type.startsWith('video/'))) {
                        squadMedia.push({ url: attachment.url, type: attachment.type });
                    } else if (typeof attachment === 'string' && attachment.startsWith('http')) {
                        let isVideo = attachment.match(/\.(mp4|webm|mov|ogg)$/i) ? 'video/mp4' : 'image/jpeg';
                        squadMedia.push({ url: attachment, type: isVideo });
                    }
                });
            } else if (typeof squadImagesRaw === 'string' && squadImagesRaw.startsWith('http')) {
                let isVideo = squadImagesRaw.match(/\.(mp4|webm|mov|ogg)$/i) ? 'video/mp4' : 'image/jpeg';
                squadMedia.push({ url: squadImagesRaw, type: isVideo });
            }

            let safeMediaParam = encodeURIComponent(JSON.stringify(squadMedia));
            let redirectToMain = `window.location.href='/?season=${encodeURIComponent(season)}&tournament=${encodeURIComponent(tournament)}'`;

            htmlContent += `
                <div class="t-item" style="position: relative;">
                    <div style="cursor: pointer; width: 80%;" onclick="${redirectToMain}" title="الانتقال إلى جدول البطولة في الرئيسية">
                        <div class="t-name">${tournament}</div>
                        <div class="t-stats">
                            <div class="t-points">${formattedPoints}</div>
                            <div class="t-rank-badge" style="${colorStyle}">${rankBadge}</div>
                        </div>
                    </div>

                    ${squadMedia.length > 0 ? `
                        <button onclick="event.stopPropagation(); window.showSquadImages('${safeMediaParam}')" 
                            style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); background: rgba(56, 189, 248, 0.1); border: 1px solid #38bdf8; color: #38bdf8; border-radius: 8px; padding: 6px 12px; font-size: 0.85rem; cursor: pointer; transition: all 0.3s; font-family: inherit; font-weight: bold; display:flex; align-items:center; gap:5px; z-index: 10;"
                            onmouseover="this.style.background='#38bdf8'; this.style.color='#fff';" 
                            onmouseout="this.style.background='rgba(56, 189, 248, 0.1)'; this.style.color='#38bdf8';">
                            📋 التشكيلة ${squadMedia.length > 1 ? `(${squadMedia.length})` : ''}
                        </button>
                    ` : ''}
                </div>
            `;
        });

        htmlContent += `</div>`;
    });

    htmlContent += '</div>';
    historyBody.innerHTML = htmlContent;
}

// 🔥 نظام السلايدر المتطور لصور/فيديوهات التشكيلة (بدون سكرول)
(window as any).showSquadImages = function(encodedMedia: string) {
    let mediaList: {url: string, type: string}[] = [];
    try {
        mediaList = JSON.parse(decodeURIComponent(encodedMedia));
    } catch (e) { return; }

    if (mediaList.length === 0) return;

    let currentIndex = 0;
    let modal = document.getElementById('squad-slider-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'squad-slider-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(11, 15, 25, 0.95); backdrop-filter: blur(8px); z-index: 10000; display: flex; justify-content: center; align-items: center; opacity: 0; transition: opacity 0.3s ease; flex-direction: column;';
        
        const topBar = document.createElement('div');
        topBar.style.cssText = 'position: absolute; top: 20px; width: 100%; max-width: 900px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; box-sizing: border-box; z-index: 10002;';
        
        const counter = document.createElement('div');
        counter.id = 'squad-slider-counter';
        counter.style.cssText = 'color: #38bdf8; font-weight: bold; font-size: 1.1rem; background: rgba(56,189,248,0.1); padding: 5px 15px; border-radius: 20px; border: 1px solid rgba(56,189,248,0.3);';
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✖ إغلاق';
        closeBtn.style.cssText = 'color: #fff; font-weight: bold; background: #ef4444; padding: 8px 20px; border-radius: 20px; border: none; cursor: pointer; font-family: inherit; font-size: 1rem; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); transition: transform 0.2s;';
        closeBtn.onmouseover = () => closeBtn.style.transform = 'scale(1.05)';
        closeBtn.onmouseout = () => closeBtn.style.transform = 'scale(1)';

        topBar.appendChild(counter);
        topBar.appendChild(closeBtn);

        const mediaContainer = document.createElement('div');
        mediaContainer.id = 'squad-media-container';
        mediaContainer.style.cssText = 'position: relative; max-width: 90%; max-height: 80vh; display: flex; justify-content: center; align-items: center; transition: opacity 0.3s ease;';
        
        const prevBtn = document.createElement('button');
        prevBtn.id = 'squad-prev-btn';
        prevBtn.innerHTML = '❮';
        prevBtn.style.cssText = 'position: absolute; left: -50px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.1); border: none; color: white; font-size: 2rem; width: 40px; height: 60px; border-radius: 8px; cursor: pointer; backdrop-filter: blur(4px); transition: background 0.3s; z-index: 10001;';
        
        const nextBtn = document.createElement('button');
        nextBtn.id = 'squad-next-btn';
        nextBtn.innerHTML = '❯';
        nextBtn.style.cssText = 'position: absolute; right: -50px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.1); border: none; color: white; font-size: 2rem; width: 40px; height: 60px; border-radius: 8px; cursor: pointer; backdrop-filter: blur(4px); transition: background 0.3s; z-index: 10001;';

        const hoverStyle = (btn: HTMLButtonElement) => {
            btn.onmouseover = () => btn.style.background = 'rgba(56,189,248,0.5)';
            btn.onmouseout = () => btn.style.background = 'rgba(255,255,255,0.1)';
        };
        hoverStyle(prevBtn); hoverStyle(nextBtn);

        mediaContainer.appendChild(prevBtn);
        mediaContainer.appendChild(nextBtn);
        
        modal.appendChild(topBar);
        modal.appendChild(mediaContainer);
        document.body.appendChild(modal);

        const closeModal = (e: any) => {
            if (e.target !== modal && e.target !== closeBtn) return;
            modal!.style.opacity = '0';
            setTimeout(() => { 
                modal!.style.display = 'none'; 
                const activeVideo = document.getElementById('squad-main-video') as HTMLVideoElement;
                if(activeVideo) activeVideo.pause();
            }, 300);
            document.removeEventListener('keydown', keyNavigation); 
        };

        modal.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
    }

    const updateView = () => {
        const mediaContainer = document.getElementById('squad-media-container') as HTMLDivElement;
        const counter = document.getElementById('squad-slider-counter') as HTMLDivElement;
        const prevBtn = document.getElementById('squad-prev-btn') as HTMLButtonElement;
        const nextBtn = document.getElementById('squad-next-btn') as HTMLButtonElement;

        mediaContainer.style.opacity = '0.5';
        
        setTimeout(() => {
            const oldImg = document.getElementById('squad-main-img');
            const oldVideo = document.getElementById('squad-main-video') as HTMLVideoElement;
            if (oldImg) oldImg.remove();
            if (oldVideo) { oldVideo.pause(); oldVideo.remove(); }

            const currentMedia = mediaList[currentIndex];
            
            if (currentMedia.type && currentMedia.type.startsWith('video/')) {
                const videoEl = document.createElement('video');
                videoEl.id = 'squad-main-video';
                videoEl.controls = true;
                videoEl.autoplay = true; 
                videoEl.style.cssText = 'max-width: 100%; max-height: 80vh; border-radius: 12px; border: 2px solid #38bdf8; box-shadow: 0 10px 40px rgba(56, 189, 248, 0.2); background: #000;';
                
                const sourceEl = document.createElement('source');
                sourceEl.src = currentMedia.url;
                sourceEl.type = currentMedia.type;
                videoEl.appendChild(sourceEl);
                
                mediaContainer.insertBefore(videoEl, nextBtn);
            } else {
                const imgEl = document.createElement('img');
                imgEl.id = 'squad-main-img';
                imgEl.src = currentMedia.url;
                imgEl.style.cssText = 'max-width: 100%; max-height: 80vh; border-radius: 12px; border: 2px solid #38bdf8; box-shadow: 0 10px 40px rgba(56, 189, 248, 0.2); object-fit: contain; background: #000;';
                mediaContainer.insertBefore(imgEl, nextBtn);
            }

            mediaContainer.style.opacity = '1';
        }, 150);

        counter.innerHTML = `التشكيلة ${currentIndex + 1} من ${mediaList.length}`;
        
        prevBtn.style.display = currentIndex === 0 ? 'none' : 'block';
        nextBtn.style.display = currentIndex === mediaList.length - 1 ? 'none' : 'block';
        
        if(mediaList.length <= 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            counter.style.display = 'none';
        } else {
            counter.style.display = 'block';
        }
    };

    document.getElementById('squad-prev-btn')!.onclick = (e) => {
        e.stopPropagation();
        if (currentIndex > 0) { currentIndex--; updateView(); }
    };
    document.getElementById('squad-next-btn')!.onclick = (e) => {
        e.stopPropagation();
        if (currentIndex < mediaList.length - 1) { currentIndex++; updateView(); }
    };

    const keyNavigation = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' && document.dir === 'rtl') { 
            if (currentIndex < mediaList.length - 1) { currentIndex++; updateView(); }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' && document.dir === 'rtl') { 
            if (currentIndex > 0) { currentIndex--; updateView(); }
        } else if (e.key === 'Escape') {
            document.getElementById('squad-slider-modal')!.click(); 
        }
    };
    
    document.removeEventListener('keydown', keyNavigation);
    document.addEventListener('keydown', keyNavigation);

    currentIndex = 0;
    updateView();
    modal.style.display = 'flex';
    setTimeout(() => { modal!.style.opacity = '1'; }, 10);
};

fetchCoachData();