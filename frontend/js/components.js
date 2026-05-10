// components.js – Компоненты интерфейса

const Components = {
    // Ссылка на активный tooltip
    activeTooltip: null,

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
    
    // Отображение рекомендаций с новым обработчиком
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
                <div class="recommendation-item" data-position="${rec.position || 0}" data-type="${rec.type}" data-description="${this.escapeHtml(rec.description)}" data-suggestion="${this.escapeHtml(rec.suggested_change)}">
                    <div class="recommendation-type">${this.escapeHtml(typeLabel)}</div>
                    <div class="recommendation-text">${this.escapeHtml(rec.description)}</div>
                    <div class="recommendation-suggestion">${this.escapeHtml(rec.suggested_change)}</div>
                </div>
            `;
        }
        container.innerHTML = html;
        
        // Обработчики клика для выделения и подсказки
        const self = this;
        document.querySelectorAll('.recommendation-item').forEach(el => {
            el.addEventListener('click', function(e) {
                const pos = parseInt(this.dataset.position);
                const desc = this.dataset.description;
                const suggest = this.dataset.suggestion;
                if (isNaN(pos)) return;
                
                const textarea = document.getElementById('textInput');
                if (!textarea) return;
                
                // 1. Выделяем слово (простая эвристика: от позиции до ближайшего пробела или конца)
                const text = textarea.value;
                let end = pos;
                while (end < text.length && text[end] !== ' ' && text[end] !== '\n') end++;
                let start = pos;
                while (start > 0 && text[start-1] !== ' ' && text[start-1] !== '\n') start--;
                
                textarea.focus();
                textarea.setSelectionRange(start, end);
                
                // 2. Показываем tooltip
                const word = text.substring(start, end);
                const tooltipText = `${desc}${suggest ? ' → ' + suggest : ''}`;
                self.showWordTooltip(textarea, start, end, word, tooltipText);
            });
        });
    },
    
    // Вычисляет координаты слова в textarea (зеркальный метод)
    getWordCoordinates: function(textarea, start, end) {
        // Создаём скрытый div, копирующий стили textarea
        const mirror = document.createElement('div');
        const style = window.getComputedStyle(textarea);
        mirror.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            font-family: ${style.fontFamily};
            font-size: ${style.fontSize};
            font-weight: ${style.fontWeight};
            line-height: ${style.lineHeight};
            letter-spacing: ${style.letterSpacing};
            padding: ${style.padding};
            border: ${style.border};
            width: ${textarea.clientWidth}px;
            box-sizing: ${style.boxSizing};
        `;
        
        // Вставляем текст до начала слова с подсветкой начала
        const text = textarea.value;
        const before = text.substring(0, start);
        const word = text.substring(start, end);
        
        // Для точного позиционирования используем span
        mirror.innerHTML = this.escapeHtml(before) +
            '<span style="background-color: transparent; border: 1px solid transparent;">' +
            this.escapeHtml(word) + '</span>';
        
        document.body.appendChild(mirror);
        
        const span = mirror.querySelector('span');
        const rect = span.getBoundingClientRect();
        const textareaRect = textarea.getBoundingClientRect();
        
        document.body.removeChild(mirror);
        
        // Координаты относительно viewport
        return {
            left: textareaRect.left + rect.left - mirror.getBoundingClientRect().left,
            top: textareaRect.top + rect.top - mirror.getBoundingClientRect().top,
            width: rect.width,
            height: rect.height
        };
    },
    
    // Показывает tooltip возле слова
    showWordTooltip: function(textarea, start, end, word, message) {
        // Удаляем старый tooltip, если есть
        if (this.activeTooltip) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
        }
        
        const coords = this.getWordCoordinates(textarea, start, end);
        
        // Создаём новый tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'word-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-word">${this.escapeHtml(word)}</div>
            <div class="tooltip-message">${this.escapeHtml(message)}</div>
        `;
        
        // Стили tooltip (жёлтый фон)
        tooltip.style.cssText = `
            position: fixed;
            left: ${coords.left}px;
            top: ${coords.top + coords.height + 6}px;
            background: #fff9db;
            border: 1px solid #f0e68c;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 13px;
            color: #5c5100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 280px;
            pointer-events: none;
        `;
        
        document.body.appendChild(tooltip);
        this.activeTooltip = tooltip;
        
        // Удаляем tooltip через несколько секунд или при клике в другом месте
        const removeTooltip = () => {
            tooltip.remove();
            this.activeTooltip = null;
            document.removeEventListener('click', removeTooltip);
        };
        setTimeout(() => {
            document.addEventListener('click', removeTooltip, { once: true });
        }, 10);
        // Также удалим через 5 секунд автоматически
        setTimeout(() => {
            if (this.activeTooltip === tooltip) removeTooltip();
        }, 5000);
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
}