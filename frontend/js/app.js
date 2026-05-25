// app.js - Логика главной страницы (редактор, анализ, рекомендации)

const textInput = document.getElementById('textInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const saveBtn = document.getElementById('saveBtn');
const statusIndicator = document.getElementById('statusIndicator');
const rewriteBtn = document.getElementById('rewriteBtn');
const rewriteStyleSelect = document.getElementById('rewriteStyleSelect');
const modifiedColumn = document.getElementById('modifiedColumn');
const modifiedInput = document.getElementById('modifiedInput');
const applyFixesBtn = document.getElementById('applyFixesBtn');
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
        setModifiedPlainText(rewritten, `Переработанный текст (${styleName})`);
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

if (applyFixesBtn) {
    applyFixesBtn.addEventListener('click', applyFixes);
}

function collectFixesFromAnalysis(analysis) {
    const fixes = [];

    if (analysis.spelling_errors) {
        for (const err of analysis.spelling_errors) {
            const suggestion = err.suggestions && err.suggestions[0];
            if (!suggestion || err.position == null || err.position < 0) continue;
            fixes.push({
                position: err.position,
                length: err.word.length,
                original: err.word,
                replacement: suggestion,
                type: 'spelling',
            });
        }
    }

    if (analysis.water_phrases) {
        for (const wp of analysis.water_phrases) {
            if (wp.recommendation == null || wp.position == null || wp.position < 0) continue;
            if (wp.recommendation === '—') continue;
            fixes.push({
                position: wp.position,
                length: wp.phrase.length,
                original: wp.phrase,
                replacement: wp.recommendation,
                type: 'water',
            });
        }
    }

    return fixes;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return !(aEnd <= bStart || bEnd <= aStart);
}

function mergeAndValidateFixes(fixes, text) {
    const valid = fixes.filter((fix) => {
        if (!fix.original || fix.length <= 0) return false;
        const slice = text.substring(fix.position, fix.position + fix.length);
        return slice.toLowerCase() === fix.original.toLowerCase();
    });

    valid.sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        if (a.type !== b.type) return a.type === 'spelling' ? -1 : 1;
        return a.position - b.position;
    });

    const accepted = [];
    for (const fix of valid) {
        const end = fix.position + fix.length;
        const overlaps = accepted.some((a) =>
            rangesOverlap(fix.position, end, a.position, a.position + a.length)
        );
        if (!overlaps) accepted.push(fix);
    }

    accepted.sort((a, b) => b.position - a.position);
    return accepted;
}

function applyFixesToText(text, fixes) {
    const merged = mergeAndValidateFixes(fixes, text);
    let result = text;
    const highlights = [];

    for (const fix of merged) {
        const actual = result.substring(fix.position, fix.position + fix.length);
        if (actual.toLowerCase() !== fix.original.toLowerCase()) continue;

        const before = result.substring(0, fix.position);
        const after = result.substring(fix.position + fix.length);
        result = before + fix.replacement + after;

        highlights.push({
            position: fix.position,
            length: fix.replacement.length,
            original: fix.original,
            replacement: fix.replacement,
        });
    }

    result = result
        .replace(/([.!?])([А-ЯЁA-Z])/g, '$1 $2')
        .replace(/ {2,}/g, ' ')
        .trim();

    highlights.sort((a, b) => a.position - b.position);
    return { fixedText: result, highlights, appliedCount: highlights.length };
}

async function applyFixes() {
    if (!lastAnalysisResult) {
        showNotification('Сначала выполните анализ текста', 'warning');
        return;
    }

    applyFixesBtn.disabled = true;
    const text = textInput.value;

    try {
        const data = await API.applyFixes(text, getSelectedFunctions());
        if (!data.applied_count) {
            showNotification('Нет исправлений для применения', 'info');
            applyFixesBtn.disabled = false;
            return;
        }
        if (data.engine && data.engine !== 'dict-v3') {
            console.warn('Старая версия движка исправлений:', data.engine);
        }
        const broken = /этотт|ппишет|ООшибк|ммогут|попоэтому/i;
        if (broken.test(data.fixed_text)) {
            showNotification(
                'Сервер вернул некорректный текст. Пересоберите Docker: docker-compose up --build',
                'error',
            );
            applyFixesBtn.disabled = false;
            return;
        }
        const highlights = (data.applied || []).map((a) => ({
            position: a.position,
            length: a.length,
            original: a.original,
            replacement: a.replacement,
        }));
        showFixedText(data.fixed_text, highlights);
    } catch (err) {
        console.error(err);
        showNotification(err.message || 'Ошибка при применении исправлений', 'error');
        applyFixesBtn.disabled = false;
    }
}

function normalizeHighlights(fixedText, highlights) {
    const valid = (highlights || [])
        .filter((h) => h.position >= 0 && h.length > 0 && h.replacement != null)
        .filter((h) => {
            const frag = fixedText.substring(h.position, h.position + h.length);
            return frag === h.replacement;
        })
        .sort((a, b) => a.position - b.position);

    const merged = [];
    let cursor = 0;
    for (const h of valid) {
        if (h.position < cursor) continue;
        merged.push(h);
        cursor = h.position + h.length;
    }
    return merged;
}

function showFixedText(fixedText, highlights) {
    const modifiedColumn = document.getElementById('modifiedColumn');
    const modifiedInput = document.getElementById('modifiedInput');
    const modifiedHeader = document.querySelector('#modifiedColumn .editor-header');
    const safeHighlights = normalizeHighlights(fixedText, highlights);

    // Меняем заголовок
    if (modifiedHeader) {
        modifiedHeader.innerHTML = `
            <span>Исправленный текст (${safeHighlights.length} изменений)</span>
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
    
    if (safeHighlights.length === 0) {
        modifiedInput.textContent = fixedText;
    } else {
        let html = '';
        let lastPos = 0;
        for (const h of safeHighlights) {
            html += escapeHtml(fixedText.substring(lastPos, h.position));
            html += `<span class="fixed-word" title="Заменено: «${escapeHtml(h.original)}» → «${escapeHtml(h.replacement)}»">${escapeHtml(h.replacement)}</span>`;
            lastPos = h.position + h.length;
        }
        html += escapeHtml(fixedText.substring(lastPos));
        modifiedInput.innerHTML = html;
    }
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

function setModifiedPlainText(text, headerLabel) {
    const modifiedHeader = document.querySelector('#modifiedColumn .editor-header');
    if (modifiedHeader) {
        modifiedHeader.innerHTML = `
            <span>${escapeHtml(headerLabel || 'Изменённый текст')}</span>
            <div style="display: flex; gap: 8px;">
                <button type="button" id="copyFixedTextBtn" class="copy-btn">Копировать</button>
                <button type="button" id="acceptRewriteBtn" class="accept-btn">Заменить исходный текст</button>
            </div>
        `;
    }
    modifiedInput.textContent = text;
    bindModifiedPanelActions(text);
}

function bindModifiedPanelActions(plainText) {
    const copyBtn = document.getElementById('copyFixedTextBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(plainText).then(() => {
                showNotification('Текст скопирован', 'success');
            }).catch(() => showNotification('Не удалось скопировать текст', 'error'));
        });
    }
    const acceptRewriteBtn = document.getElementById('acceptRewriteBtn');
    if (acceptRewriteBtn) {
        acceptRewriteBtn.addEventListener('click', () => {
            textInput.value = plainText;
            modifiedColumn.style.display = 'none';
            modifiedInput.textContent = '';
            isRewriteMode = false;
            updateStatsInRealTime();
            showNotification('Исходный текст обновлён', 'success');
        });
    }
}