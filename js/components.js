// Компоненты для управления интерфейсом

const Components = {
    // Обновление статистики
    updateStats: function(analysis) {
        const stats = analysis.stats;
        
        const charCount = document.getElementById('charCount');
        const wordCount = document.getElementById('wordCount');
        const sentenceCount = document.getElementById('sentenceCount');
        
        if (charCount) charCount.textContent = stats.characters;
        if (wordCount) wordCount.textContent = stats.words;
        if (sentenceCount) sentenceCount.textContent = stats.sentences;
        
        const readabilityScore = document.getElementById('readabilityScore');
        const readabilityFill = document.getElementById('readabilityFill');
        const readabilityLevel = document.getElementById('readabilityLevel');
        
        if (readabilityScore) readabilityScore.textContent = analysis.readability_score;
        if (readabilityFill) readabilityFill.style.width = analysis.readability_score + '%';
        if (readabilityLevel) readabilityLevel.textContent = analysis.readability_level;
        
        // Стиль (если есть элемент)
        const styleLabel = document.getElementById('styleLabel');
        if (styleLabel && analysis.style_label) {
            const styleLabels = { formal: 'Официальный', neutral: 'Нейтральный', informal: 'Разговорный' };
            styleLabel.textContent = styleLabels[analysis.style_label] || analysis.style_label;
            styleLabel.className = 'style-badge ' + analysis.style_label;
        }
        
        // Вода (если есть элементы)
        const waterPercentage = document.getElementById('waterPercentage');
        const waterFill = document.getElementById('waterFill');
        const waterWarning = document.getElementById('waterWarning');
        
        if (waterPercentage) waterPercentage.textContent = (analysis.water_percentage || 0) + '%';
        if (waterFill) waterFill.style.width = (analysis.water_percentage || 0) + '%';
        
        if (waterWarning) {
            const wp = analysis.water_percentage || 0;
            if (wp > 30) waterWarning.textContent = 'Много "воды", текст можно сделать короче';
            else if (wp > 15) waterWarning.textContent = 'Есть небольшие избыточности';
            else waterWarning.textContent = 'Текст чистый, без "воды"';
        }
    },
    
    // Отображение рекомендаций (каждая ошибка/фраза – отдельный пункт)
    displayRecommendations: function(analysis) {
        const container = document.getElementById('recommendationsList');
        if (!container) return;
        
        if (!analysis || !analysis.recommendations || analysis.recommendations.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Нет рекомендаций</p></div>';
            return;
        }
        
        let html = '';
        for (const rec of analysis.recommendations) {
            let typeLabel = '';
            switch (rec.type) {
                case 'spelling': typeLabel = 'Орфография'; break;
                case 'style': typeLabel = 'Стиль'; break;
                case 'water': typeLabel = 'Вода / канцеляризм'; break;
                case 'long_sentence': typeLabel = 'Длинное предложение'; break;
                case 'tone': typeLabel = 'Тональность'; break;
                case 'syntax': typeLabel = 'Синтаксис'; break;
                default: typeLabel = 'Рекомендация';
            }
            html += `
                <div class="recommendation-item" data-position="${rec.position || 0}">
                    <div class="recommendation-type">${this.escapeHtml(typeLabel)}</div>
                    <div class="recommendation-text">${this.escapeHtml(rec.description)}</div>
                    <div class="recommendation-suggestion">${this.escapeHtml(rec.suggested_change)}</div>
                </div>
            `;
        }
        container.innerHTML = html;
        
        // Прокрутка к месту ошибки по клику
        document.querySelectorAll('.recommendation-item').forEach(el => {
            el.addEventListener('click', () => {
                const pos = parseInt(el.dataset.position);
                if (!isNaN(pos) && pos >= 0) {
                    const textarea = document.getElementById('textInput');
                    if (textarea) {
                        textarea.focus();
                        textarea.setSelectionRange(pos, pos);
                        textarea.scrollTop = (pos / textarea.value.length) * textarea.scrollHeight;
                    }
                }
            });
        });
    },
    
    // Отображение сводки во вкладке "Результаты анализа"
    displayResultsSummary: function(summary, selectedFunctions) {
        const container = document.getElementById('resultsList');
        if (!container) return;
        
        let html = '';
        if (selectedFunctions.includes('spelling')) {
            html += `<div class="result-item"><div class="result-title">Орфография</div><div class="result-content">Найдено ошибок: ${summary.spelling?.count || 0}</div></div>`;
        }
        if (selectedFunctions.includes('water')) {
            html += `<div class="result-item"><div class="result-title">Вода и канцеляризмы</div><div class="result-content">Найдено фраз: ${summary.water?.count || 0}</div></div>`;
        }
        if (selectedFunctions.includes('long_sentences')) {
            html += `<div class="result-item"><div class="result-title">Длинные предложения</div><div class="result-content">Найдено: ${summary.longSentences?.count || 0}</div></div>`;
        }
        if (selectedFunctions.includes('style') && summary.style?.label) {
            html += `<div class="result-item"><div class="result-title">Стиль текста</div><div class="result-content">${summary.style.label}</div></div>`;
        }
        if (selectedFunctions.includes('tone') && summary.tone?.label) {
            html += `<div class="result-item"><div class="result-title">Тональность</div><div class="result-content">${summary.tone.label}</div></div>`;
        }
        if (selectedFunctions.includes('syntax')) {
            html += `<div class="result-item"><div class="result-title">Синтаксис</div><div class="result-content">Сложных конструкций: ${summary.syntax?.issuesCount || 0}</div></div>`;
        }
        
        if (html === '') {
            html = '<div class="empty-state"><p>Выберите функции и нажмите «Анализировать»</p></div>';
        }
        container.innerHTML = html;
    },
    
    // Утилиты
    escapeHtml: function(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    
    showNotification: function(message, type) {
        type = type || 'info';
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = 'toast ' + type;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

if (typeof window !== 'undefined') {
    window.Components = Components;
    window.displayRecommendations = Components.displayRecommendations.bind(Components);
    window.displayResultsSummary = Components.displayResultsSummary.bind(Components);
    window.updateStats = Components.updateStats.bind(Components);
    window.showNotification = Components.showNotification.bind(Components);
    console.log('Components модуль загружен');
}