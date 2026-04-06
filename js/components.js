// Компоненты для управления интерфейсом

const Components = {
    // Обновление статистики
    updateStats(analysis) {
        const stats = analysis.stats;
        document.getElementById('charCount').textContent = stats.characters;
        document.getElementById('wordCount').textContent = stats.words;
        document.getElementById('sentenceCount').textContent = stats.sentences;
        
        document.getElementById('readabilityScore').textContent = analysis.readability_score;
        document.getElementById('readabilityFill').style.width = `${analysis.readability_score}%`;
        document.getElementById('readabilityLevel').textContent = analysis.readability_level;
        
        const styleBadge = document.getElementById('styleLabel');
        styleBadge.textContent = analysis.style_label === 'formal' ? 'Официальный' : 
                                  analysis.style_label === 'informal' ? 'Разговорный' : 'Нейтральный';
        styleBadge.className = `style-badge ${analysis.style_label}`;
        
        document.getElementById('waterPercentage').textContent = `${analysis.water_percentage}%`;
        document.getElementById('waterFill').style.width = `${analysis.water_percentage}%`;
        
        const waterWarning = document.getElementById('waterWarning');
        if (analysis.water_percentage > 30) {
            waterWarning.textContent = '⚠️ Много "воды", текст можно сделать короче';
        } else if (analysis.water_percentage > 15) {
            waterWarning.textContent = '📝 Есть небольшие избыточности';
        } else {
            waterWarning.textContent = '✅ Текст чистый, без "воды"';
        }
    },
    
    // Отображение рекомендаций
    displayRecommendations(analysis) {
        const container = document.getElementById('recommendationsList');
        const recommendations = analysis.recommendations;
        
        if (!recommendations || recommendations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" stroke-width="1.5">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    <p>Отлично! Рекомендаций нет</p>
                </div>
            `;
            return;
        }
        
        const typeLabels = {
            spelling: '🔴 Орфография',
            style: '🟡 Стилистика',
            readability: '🔵 Читаемость'
        };
        
        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item" data-position="${rec.position}">
                <div class="recommendation-type">${typeLabels[rec.type] || rec.type}</div>
                <div class="recommendation-text">${rec.description}</div>
                ${rec.suggested_change ? `<div class="recommendation-suggestion">💡 ${rec.suggested_change}</div>` : ''}
            </div>
        `).join('');
        
        // Добавляем обработчики кликов
        document.querySelectorAll('.recommendation-item').forEach(el => {
            el.addEventListener('click', () => {
                const position = parseInt(el.dataset.position);
                if (position) {
                    App.scrollToPosition(position);
                }
            });
        });
    },
    
    // Отображение сложных конструкций
    displayComplexity(analysis) {
        const container = document.getElementById('complexityList');
        const longSentences = analysis.long_sentences;
        
        if (!longSentences || longSentences.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" stroke-width="1.5">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                        <polyline points="2 17 12 22 22 17"/>
                        <polyline points="2 12 12 17 22 12"/>
                    </svg>
                    <p>Сложных конструкций не найдено</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = longSentences.map(sentence => `
            <div class="complexity-item" data-position="${sentence.position}">
                <div class="complexity-text">${sentence.text.substring(0, 150)}${sentence.text.length > 150 ? '...' : ''}</div>
                <div class="complexity-meta">📏 ${sentence.word_count} слов | 💡 ${sentence.suggestion}</div>
            </div>
        `).join('');
        
        document.querySelectorAll('.complexity-item').forEach(el => {
            el.addEventListener('click', () => {
                const position = parseInt(el.dataset.position);
                if (position) {
                    App.scrollToPosition(position);
                }
            });
        });
    },
    
    // Отображение истории
    displayHistory(history) {
        const container = document.getElementById('historyList');
        
        if (!history || history.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" stroke-width="1.5">
                        <path d="M4 4v16h16V4H4z"/>
                        <path d="M8 9h8M8 13h6M8 17h4"/>
                    </svg>
                    <p>Нет сохранённых текстов</p>
                    <p style="font-size: 12px;">Проанализируйте текст и нажмите «Сохранить»</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = history.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-title">📄 ${item.title}</div>
                <div class="history-preview">${item.content.substring(0, 100)}${item.content.length > 100 ? '...' : ''}</div>
                <div class="history-date">${new Date(item.saved_at).toLocaleString('ru-RU')}</div>
            </div>
        `).join('');
        
        document.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', async () => {
                const id = el.dataset.id;
                await App.loadSavedText(id);
            });
        });
    },
    
    // Очистка результатов
    clearResults() {
        // Сброс статистики
        document.getElementById('charCount').textContent = '0';
        document.getElementById('wordCount').textContent = '0';
        document.getElementById('sentenceCount').textContent = '0';
        document.getElementById('readabilityScore').textContent = '--';
        document.getElementById('readabilityFill').style.width = '0%';
        document.getElementById('readabilityLevel').textContent = '—';
        document.getElementById('styleLabel').textContent = '—';
        document.getElementById('waterPercentage').textContent = '0%';
        document.getElementById('waterFill').style.width = '0%';
        document.getElementById('waterWarning').textContent = '';
        
        // Очистка списков
        document.getElementById('recommendationsList').innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" stroke-width="1.5">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
                <p>Нажмите «Анализировать», чтобы получить рекомендации</p>
            </div>
        `;
        document.getElementById('complexityList').innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd0e0" stroke-width="1.5">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                    <polyline points="2 17 12 22 22 17"/>
                    <polyline points="2 12 12 17 22 12"/>
                </svg>
                <p>Запустите анализ, чтобы увидеть сложные конструкции</p>
            </div>
        `;
    }
};