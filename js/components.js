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
        
        const styleLabel = document.getElementById('styleLabel');
        if (styleLabel && analysis.style_label) {
            const styleLabels = { formal: 'Официальный', neutral: 'Нейтральный', informal: 'Разговорный' };
            styleLabel.textContent = styleLabels[analysis.style_label] || analysis.style_label;
            styleLabel.className = 'style-badge ' + analysis.style_label;
        }
        
        const waterPercentage = document.getElementById('waterPercentage');
        const waterFill = document.getElementById('waterFill');
        const waterWarning = document.getElementById('waterWarning');
        
        if (waterPercentage) waterPercentage.textContent = analysis.water_percentage + '%';
        if (waterFill) waterFill.style.width = analysis.water_percentage + '%';
        
        if (waterWarning) {
            if (analysis.water_percentage > 30) {
                waterWarning.textContent = 'Много "воды", текст можно сделать короче';
            } else if (analysis.water_percentage > 15) {
                waterWarning.textContent = 'Есть небольшие избыточности';
            } else {
                waterWarning.textContent = 'Текст чистый, без "воды"';
            }
        }
    },
    
    // Отображение рекомендаций - ИСПРАВЛЕНО: убрал function, добавил запятую
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
                case 'spelling':
                    typeLabel = 'Орфография';
                    break;
                case 'style':
                    typeLabel = 'Стиль';
                    break;
                case 'water':
                    typeLabel = 'Вода / канцеляризм';
                    break;
                case 'long_sentence':
                    typeLabel = 'Длинное предложение';
                    break;
                default:
                    typeLabel = 'Рекомендация';
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
    
    // Отображение результатов анализа
    displayResults: function(analysis, selectedFunctions) {
        const container = document.getElementById('resultsList');
        if (!container) return;
        
        const results = [];
        
        if (selectedFunctions.spelling) {
            const count = analysis.spelling_errors ? analysis.spelling_errors.length : 0;
            results.push({
                title: 'Орфографическая проверка',
                content: count > 0 ? 'Найдено ошибок: ' + count : 'Орфографических ошибок не найдено',
                details: count > 0 ? analysis.spelling_errors.map(function(e) { return e.word + ' → ' + e.suggestions.join(', '); }).join('; ') : ''
            });
        }
        
        if (selectedFunctions.style) {
            const styleLabels = { formal: 'Официальный', neutral: 'Нейтральный', informal: 'Разговорный' };
            results.push({
                title: 'Определение стиля текста',
                content: 'Стиль: ' + (styleLabels[analysis.style_label] || analysis.style_label),
                details: 'Уверенность: высокая'
            });
        }
        
        if (selectedFunctions.water) {
            results.push({
                title: 'Поиск воды и канцеляризмов',
                content: 'Вода составляет ' + analysis.water_percentage + '% текста',
                details: analysis.water_phrases && analysis.water_phrases.length > 0 ? analysis.water_phrases.map(function(w) { return '"' + w.phrase + '" → ' + w.recommendation; }).join('; ') : 'Не найдено'
            });
        }
        
        if (selectedFunctions.rewrite && analysis.modified_text) {
            results.push({
                title: 'Переработка текста',
                content: 'Текст переработан в выбранном стиле',
                details: 'Изменённый текст отображается в правой колонке. Нажмите "Применить изменения", чтобы заменить исходный текст.'
            });
        }
        
        if (selectedFunctions.tone && analysis.tone) {
            results.push({
                title: 'Тональность текста',
                content: 'Тональность: ' + (analysis.tone.label || 'нейтральная'),
                details: 'Уверенность: ' + (analysis.tone.confidence || 70) + '%'
            });
        }
        
        if (selectedFunctions.syntax && analysis.syntax) {
            results.push({
                title: 'Анализ синтаксиса',
                content: 'Сложных конструкций: ' + (analysis.syntax.complex_count || 0),
                details: (analysis.syntax.issues && analysis.syntax.issues.length > 0) ? analysis.syntax.issues.join('; ') : 'Синтаксических проблем не обнаружено'
            });
        }
        
        if (results.length === 0) {
            container.innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><p>Выберите функции и нажмите «Анализировать»</p></div>';
            return;
        }
        
        container.innerHTML = results.map(function(result) {
            return '<div class="result-item">' +
                '<div class="result-title">' + result.title + '</div>' +
                '<div class="result-content">' + result.content + '</div>' +
                (result.details ? '<div class="result-sub">' + result.details + '</div>' : '') +
                '</div>';
        }).join('');
    },
    
    // Отображение истории
    displayHistory: function(history) {
        const container = document.getElementById('historyList');
        if (!container) return;
        
        if (!history || history.length === 0) {
            container.innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" stroke-width="1.5"><path d="M4 4v16h16V4H4z"/><path d="M8 9h8M8 13h6M8 17h4"/></svg><p>Нет сохранённых текстов</p><p style="font-size: 12px;">Проанализируйте текст и нажмите «Сохранить»</p></div>';
            return;
        }
        
        container.innerHTML = history.map(function(item) {
            return '<div class="history-item" data-id="' + item.id + '">' +
                '<div class="history-title"> ' + item.title + '</div>' +
                '<div class="history-preview">' + (item.content.substring(0, 100) + (item.content.length > 100 ? '...' : '')) + '</div>' +
                '<div class="history-date">' + new Date(item.saved_at).toLocaleString('ru-RU') + '</div>' +
                '</div>';
        }).join('');
    },
    
    // Показать уведомление
    showNotification: function(message, type) {
        type = type || 'info';
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.className = 'toast ' + type;
        document.body.appendChild(notification);
        
        setTimeout(function() {
            notification.style.opacity = '0';
            setTimeout(function() { notification.remove(); }, 300);
        }, 3000);
    },
    
    // Вспомогательная функция для экранирования HTML
    escapeHtml: function(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

if (typeof window !== 'undefined') {
    window.Components = Components;
    // Для удобства выносим основные функции в глобальную область
    window.displayRecommendations = Components.displayRecommendations.bind(Components);
    window.displayResults = Components.displayResults.bind(Components);
    window.updateStats = Components.updateStats.bind(Components);
    window.showNotification = Components.showNotification.bind(Components);
    console.log('Components модуль загружен');
}