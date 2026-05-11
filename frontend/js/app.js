// app.js - Логика главной страницы (редактор, анализ, рекомендации)

const textInput = document.getElementById('textInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const saveBtn = document.getElementById('saveBtn');
const statusIndicator = document.getElementById('statusIndicator');
const rewriteBtn = document.getElementById('rewriteBtn');
const rewriteStyleSelect = document.getElementById('rewriteStyleSelect');
const modifiedColumn = document.getElementById('modifiedColumn');
const modifiedInput = document.getElementById('modifiedInput');
const acceptFixesBtn = document.getElementById('acceptFixesBtn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const saveModal = document.getElementById('saveModal');
const textTitleInput = document.getElementById('textTitle');
const confirmSaveBtn = document.getElementById('confirmSaveBtn');
const cancelSaveBtn = document.getElementById('cancelSaveBtn');
const modalCloseBtns = document.querySelectorAll('.modal-close');

let isRewriteMode = false;
let lastAnalysisResult = null;

document.addEventListener('DOMContentLoaded', () => {
    // Загрузка текста из истории (если пришли из history.html)
    const savedText = localStorage.getItem('chistovik_open_text');
    if (savedText) {
        try {
            const { content } = JSON.parse(savedText);
            textInput.value = content;
            localStorage.removeItem('chistovik_open_text');
        } catch(e) {}
        updateStatsInRealTime();
    }

    textInput.addEventListener('input', updateStatsInRealTime);
    updateStatsInRealTime();

    analyzeBtn.addEventListener('click', analyzeText);
    saveBtn.addEventListener('click', openSaveModal);
    rewriteBtn.addEventListener('click', handleRewrite);

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    confirmSaveBtn.addEventListener('click', saveCurrentText);
    cancelSaveBtn.addEventListener('click', closeSaveModal);
    modalCloseBtns.forEach(btn => btn.addEventListener('click', closeSaveModal));
    window.addEventListener('click', (e) => { if (e.target === saveModal) closeSaveModal(); });
});

function updateStatsInRealTime() {
    const text = textInput.value;
    document.getElementById('charCount').textContent = text.length;
    document.getElementById('wordCount').textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
    document.getElementById('sentenceCount').textContent = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
}

function getSelectedFunctions() {
    return Array.from(document.querySelectorAll('.functions-grid input[type="checkbox"]:checked')).map(cb => cb.value);
}

function switchTab(tabId) {
    tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
    tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === `${tabId}Tab`));
}

async function analyzeText() {
    const text = textInput.value.trim();
    if (!text) { showNotification('Введите текст для анализа', 'warning'); return; }
    const selectedFunctions = getSelectedFunctions();
    if (selectedFunctions.length === 0) { showNotification('Выберите хотя бы одну функцию', 'warning'); return; }

    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="loading-spinner"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 22v-4M4 12H2M22 12h-2M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83M16.24 7.76l2.83-2.83M4.93 19.07l2.83-2.83"/></svg> Анализируем...`;

    try {
        const result = await API.analyzeText(text, selectedFunctions);
        lastAnalysisResult = result;
        
        // Обновить статистику и читаемость
        if (result.stats) {
            document.getElementById('charCount').textContent = result.stats.characters;
            document.getElementById('wordCount').textContent = result.stats.words;
            document.getElementById('sentenceCount').textContent = result.stats.sentences;
        }
        document.getElementById('readabilityScore').textContent = result.readability_score;
        document.getElementById('readabilityFill').style.width = `${result.readability_score}%`;
        document.getElementById('readabilityLevel').textContent = result.readability_level;
        
        // Рекомендации
        if (window.Components) {
            Components.displayRecommendations({ recommendations: result.recommendations });
            Components.displayResultsSummary(result.summary || {}, selectedFunctions);
        }
        
        showNotification('Анализ завершён', 'success');
        
        // Разблокировать кнопку применения исправлений, если есть что исправлять
        if (applyFixesBtn) {
            const hasFixes = (result.spelling_errors && result.spelling_errors.length > 0) ||
                             (result.water_phrases && result.water_phrases.length > 0);
            applyFixesBtn.disabled = !hasFixes;
        }
        
    } catch (err) {
        console.error(err);
        showNotification('Ошибка при анализе', 'error');
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> Анализировать`;
    }
}

async function handleRewrite() {
    const text = textInput.value.trim();
    if (!text) { showNotification('Введите текст для переработки', 'warning'); return; }
    const style = rewriteStyleSelect.value;
    const styleName = rewriteStyleSelect.options[rewriteStyleSelect.selectedIndex]?.text || style;
    
    rewriteBtn.disabled = true;
    rewriteBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="loading-spinner"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 22v-4M4 12H2M22 12h-2M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83M16.24 7.76l2.83-2.83M4.93 19.07l2.83-2.83"/></svg> Обработка...`;
    
    try {
        const rewritten = await API.rewriteText(text, style);
        modifiedColumn.style.display = 'block';
        modifiedInput.value = rewritten;
        isRewriteMode = true;
        modifiedColumn.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showNotification(`Текст переписан в стиле «${styleName}»`, 'success');
    } catch (err) {
        showNotification('Ошибка переработки', 'error');
    } finally {
        rewriteBtn.disabled = false;
        rewriteBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg> Переписать текст`;
    }
}


function openSaveModal() {
    if (!textInput.value.trim()) { showNotification('Нечего сохранять', 'warning'); return; }
    textTitleInput.value = '';
    saveModal.classList.add('active');
}

function closeSaveModal() { saveModal.classList.remove('active'); }

async function saveCurrentText() {
    const title = textTitleInput.value.trim();
    if (!title) { showNotification('Введите название', 'warning'); return; }
    const content = textInput.value.trim();
    statusIndicator.textContent = 'Сохранение...';
    try {
        await API.saveText(title, content, lastAnalysisResult);
        showNotification('Текст сохранён', 'success');
        closeSaveModal();
    } catch (err) {
        showNotification(err.message || 'Ошибка сохранения', 'error');
    } finally {
        statusIndicator.textContent = '';
    }
}

function showNotification(msg, type) {
    if (window.Components) Components.showNotification(msg, type);
    else alert(msg);
}

// Кнопка применения исправлений
const applyFixesBtn = document.getElementById('applyFixesBtn');

if (applyFixesBtn) {
    applyFixesBtn.addEventListener('click', applyFixes);
}

function applyFixes() {
    if (!lastAnalysisResult) {
        showNotification('Сначала выполните анализ текста', 'warning');
        return;
    }
    
    // Блокируем кнопку на время обработки
    applyFixesBtn.disabled = true;
    
    const text = textInput.value;
    
    // Собираем все исправления из орфографии и воды
    const fixes = [];
    
    // Орфографические ошибки
    if (lastAnalysisResult.spelling_errors) {
        for (const err of lastAnalysisResult.spelling_errors) {
            if (err.suggestions && err.suggestions.length > 0) {
                fixes.push({
                    position: err.position,
                    length: err.word.length,
                    original: err.word,
                    replacement: err.suggestions[0],
                    type: 'spelling'
                });
            }
        }
    }
    
    // Водные фразы
    if (lastAnalysisResult.water_phrases) {
        for (const wp of lastAnalysisResult.water_phrases) {
            if (wp.recommendation) {
                fixes.push({
                    position: wp.position,
                    length: wp.phrase.length,
                    original: wp.phrase,
                    replacement: wp.recommendation,
                    type: 'water'
                });
            }
        }
    }
    
    if (fixes.length === 0) {
        showNotification('Нет исправлений для применения', 'info');
        applyFixesBtn.disabled = false;  // ← разблокировать
        return;
    }
    
    // Сортируем по позиции с конца, чтобы замены не сбивали индексы
    fixes.sort((a, b) => b.position - a.position);
    
    // Применяем исправления и собираем размеченный текст
    let fixedText = text;
    const highlights = []; // для подсветки в правой панели
    
    for (const fix of fixes) {
        const before = fixedText.substring(0, fix.position);
        const after = fixedText.substring(fix.position + fix.length);
        fixedText = before + fix.replacement + after;
        
        // Сохраняем информацию для подсветки
        highlights.push({
            position: fix.position,
            length: fix.replacement.length,
            original: fix.original,
            replacement: fix.replacement
        });
    }
    
   showFixedText(fixedText, highlights);
}

function showFixedText(fixedText, highlights) {
    const modifiedColumn = document.getElementById('modifiedColumn');
    const modifiedInput = document.getElementById('modifiedInput');
    const modifiedHeader = document.querySelector('#modifiedColumn .editor-header');   
    
    // Меняем заголовок
    if (modifiedHeader) {
        modifiedHeader.innerHTML = `
            <span>Исправленный текст (${highlights.length} изменений)</span>
            <div style="display: flex; gap: 8px;">
                <button id="copyFixedTextBtn" class="copy-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Копировать
                </button>
                <button id="acceptFixesBtn" class="accept-btn">Применить изменения</button>
            </div>
        `;
    }
    
    // Создаём HTML с подсветкой исправленных слов
    let html = '';
    let lastPos = 0;
    
    // Сортируем highlights по позиции для правильного порядка
    const sortedHighlights = [...highlights].sort((a, b) => a.position - b.position);
    
    for (const h of sortedHighlights) {
        // Текст до исправления
        html += escapeHtml(fixedText.substring(lastPos, h.position));
        // Исправленное слово с подсветкой
        html += `<span class="fixed-word" title="Заменено: «${escapeHtml(h.original)}» → «${escapeHtml(h.replacement)}»">${escapeHtml(h.replacement)}</span>`;
        lastPos = h.position + h.length;
    }
    // Остаток текста
    html += escapeHtml(fixedText.substring(lastPos));
    
    modifiedInput.innerHTML = html;
    modifiedColumn.style.display = 'block';
    modifiedColumn.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Обработчик кнопки копирования
    const copyBtn = document.getElementById('copyFixedTextBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(fixedText).then(() => {
                copyBtn.classList.add('copied');
                copyBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Скопировано
                `;
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Копировать
                    `;
                }, 2000);
            }).catch(() => {
                showNotification('Не удалось скопировать текст', 'error');
            });
        });
    }
    
    // Обработчик кнопки "Применить изменения"
    const acceptBtn = document.getElementById('acceptFixesBtn');
    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            textInput.value = fixedText;
            modifiedColumn.style.display = 'none';
            modifiedInput.innerHTML = '';
            updateStatsInRealTime();
            applyFixesBtn.disabled = true;  // ← блокируем кнопку после применения
            showNotification('Исправления применены', 'success');
        });
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}