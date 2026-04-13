// app.js - Логика главной страницы (редактор, анализ, рекомендации)

// Элементы DOM
const textInput = document.getElementById('textInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const saveBtn = document.getElementById('saveBtn');
const statusIndicator = document.getElementById('statusIndicator');

// Элементы для переработки текста
const rewriteBtn = document.getElementById('rewriteBtn');
const rewriteStyleSelect = document.getElementById('rewriteStyleSelect');
const modifiedColumn = document.getElementById('modifiedColumn');
const modifiedInput = document.getElementById('modifiedInput');
const acceptChangesBtn = document.getElementById('acceptChangesBtn');

// Вкладки
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

// Модальное окно сохранения
const saveModal = document.getElementById('saveModal');
const textTitleInput = document.getElementById('textTitle');
const confirmSaveBtn = document.getElementById('confirmSaveBtn');
const cancelSaveBtn = document.getElementById('cancelSaveBtn');
const modalCloseBtns = document.querySelectorAll('.modal-close');

// Текущий текст перед переработкой
let currentOriginalText = '';
let isRewriteMode = false;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Загружаем текст из localStorage (если перешли из истории)
    const savedTextFromHistory = localStorage.getItem('resumeText');
    if (savedTextFromHistory) {
        textInput.value = savedTextFromHistory;
        localStorage.removeItem('resumeText');
        updateStatsInRealTime();
    }

    // Обновление статистики при вводе текста
    textInput.addEventListener('input', updateStatsInRealTime);
    updateStatsInRealTime();

    // Обработчики кнопок
    analyzeBtn.addEventListener('click', analyzeText);
    saveBtn.addEventListener('click', openSaveModal);
    rewriteBtn.addEventListener('click', handleRewrite);
    acceptChangesBtn.addEventListener('click', acceptChanges);

    // Вкладки
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Модальное окно
    confirmSaveBtn.addEventListener('click', saveCurrentText);
    cancelSaveBtn.addEventListener('click', closeSaveModal);
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', closeSaveModal);
    });
    window.addEventListener('click', (e) => {
        if (e.target === saveModal) closeSaveModal();
    });
});

// === Вспомогательные функции ===

// Обновление статистики в реальном времени (символы, слова, предложения)
function updateStatsInRealTime() {
    const text = textInput.value;
    const charCount = text.length;
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

    const charCountEl = document.getElementById('charCount');
    const wordCountEl = document.getElementById('wordCount');
    const sentenceCountEl = document.getElementById('sentenceCount');

    if (charCountEl) charCountEl.textContent = charCount;
    if (wordCountEl) wordCountEl.textContent = wordCount;
    if (sentenceCountEl) sentenceCountEl.textContent = sentenceCount;
}

// Получение выбранных функций анализа
function getSelectedFunctions() {
    const checkboxes = document.querySelectorAll('.functions-grid input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Переключение вкладок
function switchTab(tabId) {
    // Обновляем кнопки
    tabBtns.forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    // Обновляем панели
    tabPanes.forEach(pane => {
        if (pane.id === `${tabId}Tab`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });
}

// === Основной анализ текста ===
async function analyzeText() {
    const text = textInput.value.trim();
    if (!text) {
        showNotification('Введите текст для анализа', 'warning');
        return;
    }

    const selectedFunctions = getSelectedFunctions();
    if (selectedFunctions.length === 0) {
        showNotification('Выберите хотя бы одну функцию анализа', 'warning');
        return;
    }

    // Показать загрузку
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="loading-spinner">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2v4M12 22v-4M4 12H2M22 12h-2M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83M16.24 7.76l2.83-2.83M4.93 19.07l2.83-2.83"/>
        </svg>
        Анализируем...
    `;

    try {
        // Вызов API (заглушка из api.js, позже заменится на реальный запрос)
        const result = await API.analyzeText(text, selectedFunctions);

        // Обновляем статистику (на случай, если API вернул свои данные)
        if (result.stats) {
            document.getElementById('charCount').textContent = result.stats.characters || text.length;
            document.getElementById('wordCount').textContent = result.stats.words || text.trim().split(/\s+/).length;
            document.getElementById('sentenceCount').textContent = result.stats.sentences || text.split(/[.!?]+/).filter(s => s.trim()).length;
        } else {
            updateStatsInRealTime();
        }

        // Обновляем читаемость
        if (result.readability_score !== undefined) {
            const readabilityScore = document.getElementById('readabilityScore');
            const readabilityFill = document.getElementById('readabilityFill');
            const readabilityLevel = document.getElementById('readabilityLevel');
            if (readabilityScore) readabilityScore.textContent = result.readability_score;
            if (readabilityFill) readabilityFill.style.width = `${Math.min(100, result.readability_score)}%`;
            if (readabilityLevel) readabilityLevel.textContent = result.readability_level || '—';
        }

        // Отображаем рекомендации
        if (result.recommendations) {
            displayRecommendations({ recommendations: result.recommendations });
        } else {
            // Формируем рекомендации из других полей, если API не отдал отдельно
            const recommendations = buildRecommendationsFromResult(result, selectedFunctions);
            displayRecommendations({ recommendations });
        }

        // Отображаем дополнительные результаты (для вкладки "Результаты анализа")
        displayAnalysisResults(result, selectedFunctions);

        // Если есть орфографические ошибки, можно подсветить (пока заглушка)
        if (result.spelling_errors && window.highlightErrors) {
            window.highlightErrors(text, result.spelling_errors);
        }

        showNotification('Анализ завершён', 'success');
    } catch (error) {
        console.error('Analysis error:', error);
        showNotification('Ошибка при анализе текста', 'error');
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
            </svg>
            Анализировать
        `;
    }
}

// Сборка рекомендаций, если API не вернул готовый массив
function buildRecommendationsFromResult(result, selectedFunctions) {
    const recs = [];

    if (selectedFunctions.includes('spelling') && result.spelling_errors?.length) {
        recs.push({
            type: 'spelling',
            description: `Найдено орфографических ошибок: ${result.spelling_errors.length}`,
            suggested_change: 'Проверьте выделенные слова и выберите исправление'
        });
    }
    if (selectedFunctions.includes('water') && result.water_phrases?.length) {
        recs.push({
            type: 'water',
            description: `Обнаружено ${result.water_phrases.length} канцеляризмов / "водных" фраз`,
            suggested_change: 'Замените их на более простые формулировки'
        });
    }
    if (selectedFunctions.includes('long_sentences') && result.long_sentences?.length) {
        recs.push({
            type: 'long_sentence',
            description: `Найдено длинных предложений: ${result.long_sentences.length}`,
            suggested_change: 'Разбейте длинные предложения на несколько коротких'
        });
    }
    if (selectedFunctions.includes('style') && result.style_label) {
        recs.push({
            type: 'style',
            description: `Стиль текста: ${result.style_label}`,
            suggested_change: result.style_recommendation || '—'
        });
    }
    return recs;
}

// Отображение детальных результатов во вкладке "Результаты анализа"
function displayAnalysisResults(result, selectedFunctions) {
    const container = document.getElementById('resultsList');
    if (!container) return;

    let html = '';
    if (selectedFunctions.includes('style') && result.style_label) {
        html += `<div class="result-item">
            <div class="result-title">Стиль текста</div>
            <div class="result-content">${result.style_label}</div>
        </div>`;
    }
    if (selectedFunctions.includes('tone') && result.tone) {
        html += `<div class="result-item">
            <div class="result-title">Тональность</div>
            <div class="result-content">${result.tone}</div>
        </div>`;
    }
    if (selectedFunctions.includes('syntax') && result.syntax_issues) {
        html += `<div class="result-item">
            <div class="result-title">Синтаксический анализ</div>
            <div class="result-content">${result.syntax_issues}</div>
        </div>`;
    }
    if (selectedFunctions.includes('water') && result.water_percentage !== undefined) {
        html += `<div class="result-item">
            <div class="result-title">Зашумленность текста</div>
            <div class="result-content">Вода и канцеляризмы: ${result.water_percentage}%</div>
        </div>`;
    }
    if (selectedFunctions.includes('long_sentences') && result.long_sentences?.length) {
        html += `<div class="result-item">
            <div class="result-title">Длинные предложения (более 25 слов)</div>
            <div class="result-content">${result.long_sentences.map(s => `• ${s.text.substring(0, 100)}... (${s.wordCount} слов)`).join('<br>')}</div>
        </div>`;
    }

    if (html === '') {
        html = '<div class="empty-state"><p>Нет дополнительных результатов</p></div>';
    }
    container.innerHTML = html;
}

// === Переработка текста ===
async function handleRewrite() {
    const text = textInput.value.trim();
    if (!text) {
        showNotification('Введите текст для переработки', 'warning');
        return;
    }

    const selectedStyle = rewriteStyleSelect.value;
    const styleName = rewriteStyleSelect.options[rewriteStyleSelect.selectedIndex]?.text || selectedStyle;

    rewriteBtn.disabled = true;
    rewriteBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="loading-spinner">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2v4M12 22v-4M4 12H2M22 12h-2M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83M16.24 7.76l2.83-2.83M4.93 19.07l2.83-2.83"/>
        </svg>
        Обработка...
    `;

    try {
        const rewrittenText = await API.rewriteText(text, selectedStyle);
        modifiedColumn.style.display = 'block';
        modifiedInput.value = rewrittenText;
        currentOriginalText = text;
        isRewriteMode = true;
        modifiedColumn.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showNotification(`Текст переписан в стиле «${styleName}»`, 'success');
    } catch (error) {
        console.error('Rewrite error:', error);
        showNotification('Ошибка при переработке текста', 'error');
    } finally {
        rewriteBtn.disabled = false;
        rewriteBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>
            </svg>
            Переписать текст
        `;
    }
}

// Принять изменения (заменить оригинальный текст переписанным)
function acceptChanges() {
    if (!isRewriteMode) return;
    const rewrittenText = modifiedInput.value;
    if (rewrittenText) {
        textInput.value = rewrittenText;
        modifiedColumn.style.display = 'none';
        modifiedInput.value = '';
        isRewriteMode = false;
        updateStatsInRealTime();
        showNotification('Текст успешно обновлён', 'success');
        // Можно автоматически переанализировать текст
        // analyzeText();
    }
}

// === Сохранение текста ===
function openSaveModal() {
    const text = textInput.value.trim();
    if (!text) {
        showNotification('Нечего сохранять: текст пуст', 'warning');
        return;
    }
    textTitleInput.value = '';
    saveModal.classList.add('active');
}

function closeSaveModal() {
    saveModal.classList.remove('active');
}

async function saveCurrentText() {
    const title = textTitleInput.value.trim();
    if (!title) {
        showNotification('Введите название текста', 'warning');
        return;
    }
    const content = textInput.value.trim();

    statusIndicator.textContent = 'Сохранение...';
    statusIndicator.classList.add('saving');

    try {
        await API.saveText(title, content);
        showNotification('Текст сохранён', 'success');
        closeSaveModal();
    } catch (error) {
        console.error('Save error:', error);
        showNotification('Ошибка при сохранении', 'error');
    } finally {
        statusIndicator.textContent = '';
        statusIndicator.classList.remove('saving');
    }
}

// === Утилиты ===
// Используем showNotification из Components (глобальный), без рекурсии
function showNotification(message, type) {
    // Проверяем, есть ли глобальная функция (из components.js)
    if (typeof window.showNotification === 'function' && window.showNotification !== showNotification) {
        window.showNotification(message, type);
        return;
    }
    // Fallback на случай, если components.js не загружен
    const toast = document.createElement('div');
    toast.className = `toast ${type || 'info'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


// Отображение сводки результатов анализа во вкладке "Результаты анализа"
function displayAnalysisResults(result, selectedFunctions) {
    const container = document.getElementById('resultsList');
    if (!container) return;
    
    const summary = result.summary || {};
    let html = '';
    
    if (summary.spelling && summary.spelling.enabled) {
        html += `<div class="result-item">
            <div class="result-title">Орфографическая проверка</div>
            <div class="result-content">Найдено ошибок: ${summary.spelling.count}</div>
        </div>`;
    }
    if (summary.water && summary.water.enabled) {
        html += `<div class="result-item">
            <div class="result-title">Поиск воды и канцеляризмов</div>
            <div class="result-content">Найдено фраз: ${summary.water.count}</div>
        </div>`;
    }
    if (summary.longSentences && summary.longSentences.enabled) {
        html += `<div class="result-item">
            <div class="result-title">Длинные предложения</div>
            <div class="result-content">Найдено: ${summary.longSentences.count}</div>
        </div>`;
    }
    if (summary.style && summary.style.enabled && summary.style.label) {
        html += `<div class="result-item">
            <div class="result-title">Стиль текста</div>
            <div class="result-content">${summary.style.label}</div>
        </div>`;
    }
    if (summary.tone && summary.tone.enabled && summary.tone.label) {
        html += `<div class="result-item">
            <div class="result-title">Тональность</div>
            <div class="result-content">${summary.tone.label}</div>
        </div>`;
    }
    if (summary.syntax && summary.syntax.enabled) {
        html += `<div class="result-item">
            <div class="result-title">Синтаксический анализ</div>
            <div class="result-content">Сложных конструкций: ${summary.syntax.issuesCount}</div>
        </div>`;
    }
    
    if (html === '') {
        html = '<div class="empty-state"><p>Выберите функции и нажмите «Анализировать»</p></div>';
    }
    container.innerHTML = html;
}