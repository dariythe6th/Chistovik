// history.js - работа с историей через API

const HistoryPage = {
    allTexts: [],
    filtered: [],

    /** data-id из DOM всегда строка; из API приходит число */
    findTextById(rawId) {
        if (rawId === undefined || rawId === null) return undefined;
        return this.allTexts.find(
            (t) => t.id === rawId || String(t.id) === String(rawId) || Number(t.id) === Number(rawId),
        );
    },
    
    async init() {
        await Auth.ensureUserLoaded();
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }
        await this.loadHistory();
        this.bindEvents();
    },
    
    async loadHistory() {
        try {
            this.allTexts = await API.getHistory(); // уже фильтрует по userId
            this.filtered = [...this.allTexts];
            this.updateStats();
            this.renderList();
        } catch(e) { console.error(e); }
    },
    
    updateStats() {
        const total = this.allTexts.length;
        document.getElementById('totalTextsCount').textContent = total;
        const weekAgo = Date.now() - 7*86400000;
        const lastWeek = this.allTexts.filter(t => new Date(t.saved_at) > weekAgo).length;
        document.getElementById('lastWeekCount').textContent = lastWeek;
        // средняя читаемость - заглушка
        document.getElementById('avgReadability').textContent = '--';
    },
    
    renderList() {
        const container = document.getElementById('historyList');
        const emptyDiv = document.getElementById('emptyHistory');
        if (this.filtered.length === 0) {
            container.style.display = 'none';
            emptyDiv.style.display = 'block';
            return;
        }
        container.style.display = 'grid';
        emptyDiv.style.display = 'none';
        
        container.innerHTML = this.filtered.map(text => `
            <div class="history-item" data-id="${text.id}">
                <div class="history-item-header">
                    <div class="history-title"> ${this.escapeHtml(text.title)}</div>
                    <div class="history-date">${this.formatDate(text.saved_at)}</div>
                </div>
                <div class="history-preview">${this.escapeHtml(text.content.substring(0, 150))}${text.content.length > 150 ? '…' : ''}</div>
                <div class="history-meta">
                    <span class="history-meta-badge"> ${text.content.length} символов</span>
                    <span class="history-meta-badge"> ${text.content.split(/\s+/).filter(w=>w).length} слов</span>
                </div>
                <div class="history-actions-buttons">
                    <button type="button" class="history-action-btn primary" data-action="open" data-id="${text.id}">Открыть в редакторе</button>
                    <button type="button" class="history-action-btn danger" data-action="delete" data-id="${text.id}">Удалить</button>
                </div>
            </div>
        `).join('');
    },
    
    async deleteText(rawId) {
        const id = Number(rawId);
        if (!Number.isFinite(id)) return;
        if (!confirm('Удалить этот текст?')) return;
        try {
            await API.deleteText(id);
            await this.loadHistory();
            this.showToast('Текст удалён');
        } catch (e) {
            console.error(e);
            this.showToast('Не удалось удалить текст');
        }
    },
    
    openInEditor(rawId) {
        const text = this.findTextById(rawId);
        if (!text) return;
        localStorage.setItem('chistovik_open_text', JSON.stringify({ content: text.content }));
        window.location.href = '../index.html';
    },
    
    formatDate(iso) {
        const date = new Date(iso);
        const now = Date.now();
        const diff = now - date;
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return `${Math.floor(diff/60000)} мин назад`;
        if (diff < 86400000) return `${Math.floor(diff/3600000)} ч назад`;
        if (diff < 604800000) return `${Math.floor(diff/86400000)} дн назад`;
        return date.toLocaleDateString('ru-RU');
    },
    
    escapeHtml(str) { return str.replace(/[&<>]/g, function(m) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]; }); },
    
    showToast(msg) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1e3c72;color:white;padding:12px 20px;border-radius:10px;z-index:1000;animation:slideIn 0.3s ease;';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity='0'; setTimeout(()=>toast.remove(),300); }, 3000);
    },
    
    bindEvents() {
        const listEl = document.getElementById('historyList');
        if (listEl && !listEl._chistDelegation) {
            listEl._chistDelegation = true;
            listEl.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-action]');
                if (btn && listEl.contains(btn)) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = btn.getAttribute('data-id');
                    if (btn.dataset.action === 'open') this.openInEditor(id);
                    if (btn.dataset.action === 'delete') void this.deleteText(id);
                    return;
                }
                const card = e.target.closest('.history-item');
                if (!card || !listEl.contains(card)) return;
                if (e.target.closest('button')) return;
                this.openInEditor(card.getAttribute('data-id'));
            });
        }

        document.getElementById('refreshHistoryBtn')?.addEventListener('click', () => this.loadHistory());
        document.getElementById('clearHistoryBtn')?.addEventListener('click', async () => {
            if (!confirm('Очистить всю историю?')) return;
            try {
                await API.clearHistory();
                await this.loadHistory();
                this.showToast('История очищена');
            } catch (e) {
                console.error(e);
                this.showToast('Не удалось очистить историю');
            }
        });
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            this.filtered = this.allTexts.filter(t => t.title.toLowerCase().includes(term) || t.content.toLowerCase().includes(term));
            this.renderList();
        });
        document.getElementById('sortSelect')?.addEventListener('change', (e) => {
            const sort = e.target.value;
            this.filtered.sort((a,b) => {
                if (sort === 'date-desc') return new Date(b.saved_at) - new Date(a.saved_at);
                if (sort === 'date-asc') return new Date(a.saved_at) - new Date(b.saved_at);
                if (sort === 'title-asc') return a.title.localeCompare(b.title);
                if (sort === 'title-desc') return b.title.localeCompare(a.title);
                return 0;
            });
            this.renderList();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => HistoryPage.init());