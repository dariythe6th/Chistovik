// Главное приложение

const App = {
    currentAnalysis: null,
    
    init() {
        this.bindEvents();
        this.updateStatsFromText();
        
        // Добавляем слушатель изменения текста для обновления статистики в реальном времени
        document.getElementById('textInput').addEventListener('input', () => {
            this.updateStatsFromText();
        });
    },
    
    bindEvents() {
        // Анализ текста
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyze());
        
        // Сохранение текста
        document.getElementById('saveBtn').addEventListener('click', () => this.showSaveModal());
        
        // Переключение вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // Переключение между редактором и историей
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('[data-view]').dataset.view;
                this.switchView(view);
            });
        });
        
        // Очистка истории
        const clearBtn = document.getElementById('clearHistoryBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearHistory());
        }
        
        // Модальное окно
        const modal = document.getElementById('saveModal');
        document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelSaveBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('confirmSaveBtn').addEventListener('click', () => this.confirmSave());
        
        // Закрытие модального окна по клику вне его
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });
    },
    
    updateStatsFromText() {
        const text = document.getElementById('textInput').value;
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        document.getElementById('charCount').textContent = text.length;
        document.getElementById('wordCount').textContent = words.length;
        document.getElementById('sentenceCount').textContent = sentences.length;
    },
    
    async analyze() {
        const text = document.getElementById('textInput').value;
        
        if (!text.trim()) {
            alert('Введите текст для анализа');
            return;
        }
        
        const analyzeBtn = document.getElementById('analyzeBtn');
        const originalText = analyzeBtn.innerHTML;
        analyzeBtn.innerHTML = '<div class="loading">⏳ Анализируем...</div>';
        analyzeBtn.disabled = true;
        
        try {
            const result = await API.analyzeText(text);
            this.currentAnalysis = result;
            
            // Обновляем интерфейс
            Components.updateStats(result);
            Components.displayRecommendations(result);
            Components.displayComplexity(result);
            
            // Переключаемся на вкладку рекомендаций
            this.switchTab('recommendations');
            
            // Показываем уведомление
            this.showNotification('Анализ завершён!');
            
        } catch (error) {
            console.error('Ошибка анализа:', error);
            alert('Произошла ошибка при анализе текста');
        } finally {
            analyzeBtn.innerHTML = originalText;
            analyzeBtn.disabled = false;
        }
    },
    
    switchTab(tabName) {
        // Обновляем активную кнопку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Обновляем активную панель
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        
        const activePane = document.getElementById(`${tabName}Tab`);
        if (activePane) {
            activePane.classList.add('active');
        }
    },
    
    switchView(viewName) {
        const workspace = document.getElementById('workspaceView');
        const history = document.getElementById('historyView');
        
        if (viewName === 'workspace') {
            workspace.classList.add('active');
            history.classList.remove('active');
        } else if (viewName === 'history') {
            workspace.classList.remove('active');
            history.classList.add('active');
            this.loadHistory();
        }
    },
    
    async loadHistory() {
        try {
            const history = await API.getHistory();
            Components.displayHistory(history);
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
        }
    },
    
    async loadSavedText(id) {
        try {
            const history = await API.getHistory();
            const text = history.find(t => t.id === id);
            
            if (text) {
                // Переключаемся на редактор
                this.switchView('workspace');
                
                // Загружаем текст
                document.getElementById('textInput').value = text.content;
                this.updateStatsFromText();
                
                // Запускаем анализ
                await this.analyze();
                
                this.showNotification(`Загружен текст: ${text.title}`);
            }
        } catch (error) {
            console.error('Ошибка загрузки текста:', error);
        }
    },
    
    async clearHistory() {
        if (confirm('Вы уверены, что хотите очистить всю историю? Это действие нельзя отменить.')) {
            await API.clearHistory();
            await this.loadHistory();
            this.showNotification('История очищена');
        }
    },
    
    showSaveModal() {
        const text = document.getElementById('textInput').value;
        if (!text.trim()) {
            alert('Нечего сохранять. Введите текст.');
            return;
        }
        
        const modal = document.getElementById('saveModal');
        const input = document.getElementById('textTitle');
        
        // Генерируем предложение по умолчанию
        const firstLine = text.split('\n')[0].substring(0, 50);
        input.value = firstLine || 'Новый текст';
        
        modal.classList.add('active');
    },
    
    async confirmSave() {
        const title = document.getElementById('textTitle').value.trim();
        const content = document.getElementById('textInput').value;
        
        if (!title) {
            alert('Введите название текста');
            return;
        }
        
        this.closeModal();
        
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '💾 Сохранение...';
        saveBtn.disabled = true;
        
        try {
            await API.saveText(title, content);
            this.showNotification('Текст сохранён!');
            
            // Обновляем статус
            const status = document.getElementById('statusIndicator');
            status.textContent = 'Сохранено';
            status.classList.add('saved');
            setTimeout(() => {
                status.textContent = '';
                status.classList.remove('saved');
            }, 2000);
            
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            alert('Не удалось сохранить текст');
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    },
    
    closeModal() {
        document.getElementById('saveModal').classList.remove('active');
    },
    
    scrollToPosition(position) {
        const textarea = document.getElementById('textInput');
        textarea.focus();
        
        // Устанавливаем курсор на позицию ошибки
        textarea.setSelectionRange(position, position);
        
        // Прокручиваем к позиции
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
        const lines = textarea.value.substring(0, position).split('\n').length;
        const scrollPosition = (lines - 3) * lineHeight;
        
        textarea.scrollTop = Math.max(0, scrollPosition);
        
        // Визуальный эффект подсветки
        this.highlightTemporarily(position);
    },
    
    highlightTemporarily(position) {
        const textarea = document.getElementById('textInput');
        const originalColor = textarea.style.backgroundColor;
        
        textarea.style.transition = 'background-color 0.3s';
        textarea.style.backgroundColor = '#fef5e7';
        
        setTimeout(() => {
            textarea.style.backgroundColor = originalColor;
        }, 500);
    },
    
    showNotification(message) {
        // Создаём временное уведомление
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1e3c72;
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 14px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};

// Добавляем анимацию
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});