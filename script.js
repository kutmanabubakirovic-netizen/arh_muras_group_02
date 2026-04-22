/* ============================================
   ARH_MURAS_GROUP — script.js v2.0
   ИСПРАВЛЕНИЕ: фото хранятся в base64 (не blob:)
   ============================================ */

let db = JSON.parse(localStorage.getItem('archidata_projects_v2') || '[]');
let isLoggedIn = localStorage.getItem('archidata_logged_in') === 'true';
let currentUser = localStorage.getItem('archidata_user') || '';

/* ---- СОТРУДНИКИ ---- */
const employees = {
    'admin':      'admin2026',
    'architect1': 'archi2026',
    'architect2': 'archi2026',
    'geodesy':    'geo2026',
    'designer':   'design2026',
    'landscape':  'land2026',
    'manager':    'manager2026'
};

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    renderAll();
    setupFilters();
    setupDragDrop();
    checkEmpty();
});

function saveDB() {
    try {
        localStorage.setItem('archidata_projects_v2', JSON.stringify(db));
    } catch (e) {
        // localStorage full — слишком много фото
        alert('⚠️ Недостаточно места в браузере. Попробуйте удалить старые проекты.');
    }
}

/* ============================================
   АУТЕНТИФИКАЦИЯ
   ============================================ */
function loginPrompt() {
    const username = prompt('Логин сотрудника:');
    if (!username) return;
    const password = prompt('Пароль:');
    if (!password) return;

    if (employees[username] && employees[username] === password) {
        isLoggedIn = true;
        currentUser = username;
        localStorage.setItem('archidata_logged_in', 'true');
        localStorage.setItem('archidata_user', username);
        updateAuthUI();
        alert(`✓ Добро пожаловать, ${username}!`);
    } else {
        alert('❌ Неверный логин или пароль');
    }
}

function logout() {
    if (!confirm('Выйти из системы?')) return;
    isLoggedIn = false;
    currentUser = '';
    localStorage.removeItem('archidata_logged_in');
    localStorage.removeItem('archidata_user');
    updateAuthUI();
}

function updateAuthUI() {
    const adminControls = document.getElementById('adminControls');
    const staffBtn = document.getElementById('staffLoginBtn');

    if (isLoggedIn) {
        if (adminControls) adminControls.style.display = 'flex';
        if (staffBtn) {
            staffBtn.textContent = `${currentUser} · Выйти`;
            staffBtn.onclick = logout;
            staffBtn.style.color = 'var(--accent)';
        }
    } else {
        if (adminControls) adminControls.style.display = 'none';
        if (staffBtn) {
            staffBtn.textContent = 'только для сотрудников ›';
            staffBtn.onclick = loginPrompt;
            staffBtn.style.color = '';
        }
    }
}

/* ============================================
   ФОРМА ДОБАВЛЕНИЯ
   ============================================ */
function openForm() {
    if (!isLoggedIn) { loginPrompt(); return; }
    document.getElementById('formModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeForm() {
    const modal = document.getElementById('formModal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    // Сброс полей
    ['pName','pCat','pDesc','pYear','pArea'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const fInp = document.getElementById('fInp');
    if (fInp) fInp.value = '';
    const strip = document.getElementById('previewStrip');
    if (strip) strip.innerHTML = '';
    const dz = document.getElementById('dropZone');
    if (dz) {
        const p = dz.querySelector('p');
        if (p) p.textContent = 'Перетащите фото сюда или нажмите для выбора';
    }
}

/* ============================================
   ФАЙЛЫ → BASE64 (КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ)
   Blob URL живут только до закрытия вкладки.
   Base64 хранится в localStorage постоянно.
   ============================================ */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result); // data:image/...;base64,...
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function previewFiles(files) {
    const strip = document.getElementById('previewStrip');
    strip.innerHTML = '';
    const limit = Math.min(files.length, 20);
    for (let i = 0; i < limit; i++) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(files[i]);
        strip.appendChild(img);
    }
    const dz = document.getElementById('dropZone');
    if (dz) {
        const p = dz.querySelector('p');
        if (p) p.textContent = `Выбрано: ${limit} фото`;
    }
}

function setupDragDrop() {
    const dz = document.getElementById('dropZone');
    if (!dz) return;
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; });
    dz.addEventListener('dragleave', () => { dz.style.borderColor = ''; });
    dz.addEventListener('drop', e => {
        e.preventDefault(); dz.style.borderColor = '';
        document.getElementById('fInp').files = e.dataTransfer.files;
        previewFiles(e.dataTransfer.files);
    });
}

async function uploadProject() {
    if (!isLoggedIn) { alert('❌ Войдите в систему'); return; }

    const name  = document.getElementById('pName')?.value.trim();
    const cat   = document.getElementById('pCat')?.value;
    const desc  = document.getElementById('pDesc')?.value.trim();
    const year  = document.getElementById('pYear')?.value.trim();
    const area  = document.getElementById('pArea')?.value.trim();
    const files = document.getElementById('fInp')?.files;

    if (!name)         { alert('Укажите название объекта'); return; }
    if (!cat)          { alert('Выберите категорию'); return; }
    if (!files || files.length === 0) { alert('Добавьте хотя бы одно фото'); return; }

    const btn = document.querySelector('.btn-submit');
    if (btn) { btn.textContent = 'ЗАГРУЖАЕМ...'; btn.disabled = true; }

    try {
        const limit = Math.min(files.length, 20);
        // Конвертируем все файлы в base64 — они будут храниться постоянно
        const base64Urls = [];
        for (let i = 0; i < limit; i++) {
            const b64 = await fileToBase64(files[i]);
            base64Urls.push(b64);
        }

        const project = {
            id: Date.now(),
            name, cat, desc, year, area,
            urls: base64Urls,
            uploadedBy: currentUser,
            uploadDate: new Date().toLocaleDateString('ru-RU')
        };

        db.push(project);
        saveDB();
        renderCard(project);
        closeForm();
        checkEmpty();
        alert('✓ Проект успешно опубликован!');
    } catch(e) {
        alert('Ошибка загрузки: ' + e.message);
    } finally {
        if (btn) { btn.textContent = 'ОПУБЛИКОВАТЬ ПРОЕКТ'; btn.disabled = false; }
    }
}

/* ============================================
   ФИЛЬТРЫ И ПОИСК
   ============================================ */
let activeFilter = 'all';

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            applyFilterSearch();
        });
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilterSearch);
    }
}

function applyFilterSearch() {
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    document.querySelectorAll('.album-card').forEach(card => {
        const cat   = card.dataset.cat || '';
        const title = (card.querySelector('.card-title')?.textContent || '').toLowerCase();
        const catOk = activeFilter === 'all' || cat === activeFilter;
        const qOk   = !q || title.includes(q) || cat.toLowerCase().includes(q);
        card.style.display = (catOk && qOk) ? '' : 'none';
    });
}

/* ============================================
   РЕНДЕР КАРТОЧЕК
   ============================================ */
function renderAll() {
    const gal = document.getElementById('gal');
    if (!gal) return;
    db.forEach(p => renderCard(p));
}

function renderCard(p) {
    const gal = document.getElementById('gal');
    if (!gal) return;

    const card = document.createElement('div');
    card.className = 'album-card';
    card.id = `item-${p.id}`;
    card.dataset.cat = p.cat;

    const imgs = p.urls.map((u, i) =>
        `<img src="${u}" class="${i === 0 ? 'active' : ''}" alt="Фото ${i+1}" loading="lazy">`
    ).join('');

    const dots = p.urls.length > 1
        ? `<div class="slide-dots">${p.urls.map((_, i) =>
            `<span class="slide-dot ${i===0?'active':''}" data-idx="${i}"></span>`).join('')}</div>`
        : '';

    const arrows = p.urls.length > 1
        ? `<button class="slide-arrow prev" onclick="slideCard(event,${p.id},-1)">‹</button>
           <button class="slide-arrow next" onclick="slideCard(event,${p.id},1)">›</button>`
        : '';

    const canDelete = isLoggedIn && (currentUser === p.uploadedBy || currentUser === 'admin');
    const deleteBtn = canDelete
        ? `<button class="delete-btn" title="Удалить" onclick="deleteProj(event,${p.id})">×</button>`
        : '';

    const metaInfo = p.uploadedBy
        ? `<span class="card-meta-info">Добавил: ${p.uploadedBy} · ${p.uploadDate || ''}</span>`
        : '';

    card.innerHTML = `
        ${deleteBtn}
        <div class="slider-wrap" id="sw-${p.id}">
            <span class="card-cat-badge">${p.cat}</span>
            ${imgs}
            <span class="img-count">${p.urls.length} фото</span>
            ${dots}
            ${arrows}
        </div>
        <div class="card-content" onclick="openProj(${p.id})">
            <div class="card-title">${p.name}</div>
            <div class="card-meta">
                <span>${p.cat}</span>
                ${p.year ? `<span>${p.year}</span>` : ''}
                ${p.area ? `<span>${p.area}</span>` : ''}
            </div>
            ${metaInfo}
        </div>
    `;

    gal.appendChild(card);

    card.querySelectorAll('.slide-dot').forEach(dot => {
        dot.addEventListener('click', e => {
            e.stopPropagation();
            goToSlide(p.id, parseInt(dot.dataset.idx));
        });
    });
}

/* ---- СЛАЙДЕР ---- */
const slideIndexes = {};

function slideCard(e, id, dir) {
    e.stopPropagation();
    const p = db.find(x => x.id === id);
    if (!p) return;
    const cur  = slideIndexes[id] || 0;
    const next = (cur + dir + p.urls.length) % p.urls.length;
    goToSlide(id, next);
}

function goToSlide(id, idx) {
    slideIndexes[id] = idx;
    const sw = document.getElementById(`sw-${id}`);
    if (!sw) return;
    sw.querySelectorAll('img').forEach((img, i) => img.classList.toggle('active', i === idx));
    sw.querySelectorAll('.slide-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

/* ---- ПРОСМОТР ПРОЕКТА ---- */
function openProj(id) {
    const p = db.find(x => x.id === id);
    if (!p) return;

    document.getElementById('vTitle').textContent = p.name;
    document.getElementById('vCatBadge').textContent = p.cat;
    document.getElementById('vCat').textContent = p.cat;
    document.getElementById('vDesc').textContent = p.desc || 'Описание не добавлено.';

    const yw = document.getElementById('vYearWrap');
    if (p.year) { yw.style.display = ''; document.getElementById('vYear').textContent = p.year; }
    else        { yw.style.display = 'none'; }

    const aw = document.getElementById('vAreaWrap');
    if (p.area) { aw.style.display = ''; document.getElementById('vArea').textContent = p.area; }
    else        { aw.style.display = 'none'; }

    const photosEl = document.getElementById('vPhotos');
    photosEl.innerHTML = p.urls.map(u => `<img src="${u}" alt="${p.name}" loading="lazy">`).join('');

    const modal = document.getElementById('viewModal');
    modal.classList.add('open');
    modal.scrollTop = 0;
    document.body.style.overflow = 'hidden';
}

function closeProject() {
    document.getElementById('viewModal')?.classList.remove('open');
    document.body.style.overflow = '';
}

/* ---- УДАЛЕНИЕ ---- */
function deleteProj(e, id) {
    e.stopPropagation();
    if (!isLoggedIn) { alert('❌ Нет доступа'); return; }
    const project = db.find(x => x.id === id);
    if (project && currentUser !== project.uploadedBy && currentUser !== 'admin') {
        alert('❌ Вы можете удалять только свои проекты'); return;
    }
    if (!confirm('Удалить этот проект?')) return;
    document.getElementById(`item-${id}`)?.remove();
    db = db.filter(x => x.id !== id);
    saveDB();
    checkEmpty();
}

/* ---- ПУСТОЙ STATE ---- */
function checkEmpty() {
    const empty = document.getElementById('emptyState');
    if (!empty) return;
    empty.classList.toggle('visible', db.length === 0);
}

/* ---- ФОРМА ЗАЯВКИ (главная) ---- */
function submitForm(e) {
    e.preventDefault();
    const name  = document.getElementById('cName')?.value.trim();
    const phone = document.getElementById('cPhone')?.value.trim();
    if (!name || !phone) { alert('Заполните имя и телефон'); return; }

    const btn = document.querySelector('.btn-submit-form');
    if (btn) { btn.textContent = 'ОТПРАВЛЯЕМ...'; btn.disabled = true; }

    setTimeout(() => {
        if (btn) { btn.textContent = 'ОТПРАВИТЬ ЗАЯВКУ →'; btn.disabled = false; }
        const success = document.getElementById('formSuccess');
        if (success) { success.classList.add('visible'); }
        document.getElementById('contactForm')?.reset();
        setTimeout(() => success?.classList.remove('visible'), 6000);
    }, 1200);
}

/* ---- KEYBOARD ---- */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeProject(); closeForm(); }
});
