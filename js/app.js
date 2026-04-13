// app.js - Логика главной страницы (редактор, анализ, рекомендации)

const textInput = document.getElementById('textInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const saveBtn = document.getElementById('saveBtn');
const statusIndicator = document.getElementById('statusIndicator');
const rewriteBtn = document.getElementById('rewriteBtn');
const rewriteStyleSelect = document.getElementById('rewriteStyleSelect');
const modifiedColumn = document.getElementById('modifiedColumn');
const modifiedInput = document.getElementById('modifiedInput');
const acceptChangesBtn = document.getElementById('acceptChangesBtn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const saveModal = document.getElementById('saveModal');
const textTitleInput = document.getElementById('textTitle');
const confirmSaveBtn = document.getElementById('confirmSaveBtn');
const cancelSaveBtn = document.getElementById('cancelSaveBtn');
const modalCloseBtns = document.querySelectorAll('.modal-close');

let isRewriteMode = false;

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
    acceptChangesBtn.addEventListener('click', acceptChanges);

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
        
        // Обновить статистику и читаемость
        if (result.stats) {
            document.getElementById('charCount').textContent = result.stats.characters;
            document.getElementById('wordCount').textContent = result.stats.words;
            document.getElementById('sentenceCount').textContent = result.stats.sentences;
        }
        document.getElementById('readabilityScore').textContent = result.readability_score;
        document.getElementById('readabilityFill').style.width = `${result.readability_score}%`;
        document.getElementById('readabilityLevel').textContent = result.readability_level;
        
        // Рекомендации (поштучно)
        if (window.Components) {
            Components.displayRecommendations({ recommendations: result.recommendations });
            Components.displayResultsSummary(result.summary, selectedFunctions);
        } else {
            console.warn('Components не загружен');
        }
        
        showNotification('Анализ завершён', 'success');
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

function acceptChanges() {
    if (!isRewriteMode) return;
    const rewritten = modifiedInput.value;
    if (rewritten) {
        textInput.value = rewritten;
        modifiedColumn.style.display = 'none';
        modifiedInput.value = '';
        isRewriteMode = false;
        updateStatsInRealTime();
        showNotification('Текст обновлён', 'success');
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
        await API.saveText(title, content);
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