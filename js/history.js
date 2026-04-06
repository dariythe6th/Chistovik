// Логика для страницы истории

const HistoryPage = {
    allTexts: [],
    filteredTexts: [],
    
    init() {
        this.bindEvents();
        this.loadHistory();
        
        // Устанавливаем активную страницу в шапке
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.getAttribute('href') === 'history.html') {
                btn.classList.add('active');
            }
        });
    },
    
    bindEvents() {
        document.getElementById('refreshHistoryBtn')?.addEventListener('click', () => this.loadHistory());
        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => this.clearAllHistory());
        document.getElementById('searchInput')?.addEventListener('input', (e) => this.filterHistory(e.target.value));
        document.getElementById('sortSelect')?.addEventListener('change', (e) => this.sortHistory(e.target.value));
        
        // Модальное окно
        const modal = document.getElementById('textDetailsModal');
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });
    },
    
    async loadHistory() {
        try {
            this.allTexts = await API.getHistory();
            this.filteredTexts = [...this.allTexts];
            this.updateStats();
            this.renderList();
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            this.showError('Не удалось загрузить историю');
        }
    },
    
    updateStats() {
        const total = this.allTexts.length;
        document.getElementById('totalTextsCount').textContent = total;
        
        // Подсчёт за последнюю неделю
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const lastWeekCount = this.allTexts.filter(t => new Date(t.saved_at) > oneWeekAgo).length;
        document.getElementById('lastWeekCount').textContent = lastWeekCount;
        
        // Средняя читаемость (заглушка, т.к. в сохранённых нет этого поля)
        // В реальности нужно было бы хранить результат анализа вместе с текстом
        document.getElementById('avgReadability').textContent = '--';
    },
    
    filterHistory(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredTexts = [...this.allTexts];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredTexts = this.allTexts.filter(text => 
                text.title.toLowerCase().includes(term) || 
                text.content.toLowerCase().includes(term)
            );
        }
        this.sortHistory(document.getElementById('sortSelect').value);
    },
    
    sortHistory(sortType) {
        switch(sortType) {
            case 'date-desc':
                this.filteredTexts.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));
                break;
            case 'date-asc':
                this.filteredTexts.sort((a, b) => new Date(a.saved_at) - new Date(b.saved_at));
                break;
            case 'title-asc':
                this.filteredTexts.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title-desc':
                this.filteredTexts.sort((a, b) => b.title.localeCompare(a.title));
                break;
        }
        this.renderList();
    },
    
    renderList() {
        const container = document.getElementById('historyList');
        const emptyState = document.getElementById('emptyHistory');
        
        if (this.filteredTexts.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        container.style.display = 'grid';
        emptyState.style.display = 'none';
        
        container.innerHTML = this.filteredTexts.map(text => `
            <div class="history-item" data-id="${text.id}">
                <div class="history-item-header">
                    <div class="history-title">
                        <span>📄</span>
                        ${this.escapeHtml(text.title)}
                    </div>
                    <div class="history-date">${this.formatDate(text.saved_at)}</div>
                </div>
                <div class="history-preview">
                    ${this.escapeHtml(text.content.substring(0, 150))}${text.content.length > 150 ? '...' : ''}
                </div>
                <div class="history-meta">
                    <span class="history-meta-badge">📏 ${text.content.length} символов</span>
                    <span class="history-meta-badge">📝 ${text.content.split(/\s+/).filter(w => w.length > 0).length} слов</span>
                </div>
                <div class="history-actions-buttons">
                    <button class="history-action-btn primary" data-action="open" data-id="${text.id}">
                        📖 Открыть
                    </button>
                    <button class="history-action-btn" data-action="details" data-id="${text.id}">
                        🔍 Подробнее
                    </button>
                    <button class="history-action-btn danger" data-action="delete" data-id="${text.id}">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
        `).join('');
        
        // Добавляем обработчики для кнопок
        document.querySelectorAll('[data-action="open"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.openInEditor(id);
            });
        });
        
        document.querySelectorAll('[data-action="details"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.showDetails(id);
            });
        });
        
        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.deleteText(id);
            });
        });
        
        // Клик по карточке тоже открывает
        document.querySelectorAll('.history-item').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('[data-action]')) {
                    const id = card.dataset.id;
                    this.openInEditor(id);
                }
            });
        });
    },
    
    async openInEditor(id) {
        const text = this.allTexts.find(t => t.id === id);
        if (text) {
            // Сохраняем в localStorage для передачи на главную страницу
            localStorage.setItem('chistovik_open_text', JSON.stringify(text));
            window.location.href = 'index.html';
        }
    },
    
    async showDetails(id) {
        const text = this.allTexts.find(t => t.id === id);
        if (text) {
            document.getElementById('detailsTitle').textContent = text.title;
            document.getElementById('detailsDate').textContent = this.formatDate(text.saved_at);
            document.getElementById('detailsStats').textContent = `${text.content.length} символов, ${text.content.split(/\s+/).filter(w => w.length > 0).length} слов`;
            document.getElementById('detailsContent').textContent = text.content;
            
            const modal = document.getElementById('textDetailsModal');
            modal.classList.add('active');
            
            // Обработчики для модального окна
            document.getElementById('openInEditorBtn').onclick = () => {
                this.closeModal();
                this.openInEditor(id);
            };
            document.getElementById('deleteTextBtn').onclick = () => {
                this.closeModal();
                this.deleteText(id);
            };
        }
    },
    
    async deleteText(id) {
        if (confirm('Вы уверены, что хотите удалить этот текст?')) {
            // Удаляем из локального хранилища
            const updatedTexts = this.allTexts.filter(t => t.id !== id);
            localStorage.setItem('chistovik_history', JSON.stringify(updatedTexts));
            
            // Обновляем состояние
            this.allTexts = updatedTexts;
            this.filteredTexts = [...this.allTexts];
            this.updateStats();
            this.renderList();
            
            this.showToast('Текст удалён');
        }
    },
    
    async clearAllHistory() {
        if (confirm('Вы уверены, что хотите удалить ВСЮ историю? Это действие нельзя отменить.')) {
            await API.clearHistory();
            this.allTexts = [];
            this.filteredTexts = [];
            this.updateStats();
            this.renderList();
            this.showToast('История очищена');
        }
    },
    
    closeModal() {
        document.getElementById('textDetailsModal').classList.remove('active');
    },
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин назад`;
        if (diffHours < 24) return `${diffHours} ч назад`;
        if (diffDays < 7) return `${diffDays} дн назад`;
        
        return date.toLocaleDateString('ru-RU');
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
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
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    showError(message) {
        alert(message);
    }
};

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    HistoryPage.init();
});