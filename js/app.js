// Главное приложение

const App = {
    currentAnalysis: null,
    modifiedText: null,
    isModifiedMode: false,

    init: function() {
        this.bindEvents();
        this.updateStatsFromText();
        
        // Показываем выпадающий список выбора стиля при выборе чекбокса переработки
        const rewriteCheckbox = document.getElementById('funcRewrite');
        const styleContainer = document.getElementById('rewriteStyleContainer');
        
        if (rewriteCheckbox && styleContainer) {
            rewriteCheckbox.addEventListener('change', function() {
                styleContainer.style.display = rewriteCheckbox.checked ? 'flex' : 'none';
            });
        }
        
        // Слушатель изменения текста
        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.addEventListener('input', function() {
                App.updateStatsFromText();
                if (App.isModifiedMode) {
                    App.hideModifiedColumn();
                }
            });
        }
        
        // Загрузка из localStorage
        this.loadFromStorage();
    },
    
    bindEvents: function() {
        const analyzeBtn = document.getElementById('analyzeBtn');
        const saveBtn = document.getElementById('saveBtn');
        const acceptBtn = document.getElementById('acceptChangesBtn');
        
        if (analyzeBtn) analyzeBtn.addEventListener('click', function() { App.analyze(); });
        if (saveBtn) saveBtn.addEventListener('click', function() { App.showSaveModal(); });
        if (acceptBtn) acceptBtn.addEventListener('click', function() { App.acceptChanges(); });
        
        // Переключение вкладок
        document.querySelectorAll('.results-panel .tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                const tab = e.target.dataset.tab;
                App.switchTab(tab);
            });
        });
        
        // Модальное окно
        const modal = document.getElementById('saveModal');
        const modalClose = document.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancelSaveBtn');
        const confirmBtn = document.getElementById('confirmSaveBtn');
        
        if (modalClose) modalClose.addEventListener('click', function() { App.closeModal(); });
        if (cancelBtn) cancelBtn.addEventListener('click', function() { App.closeModal(); });
        if (confirmBtn) confirmBtn.addEventListener('click', function() { App.confirmSave(); });
        
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) App.closeModal();
            });
        }
    },
    
    updateStatsFromText: function() {
        const textInput = document.getElementById('textInput');
        if (!textInput) return;
        
        const text = textInput.value;
        const words = text.split(/\s+/).filter(function(w) { return w.length > 0; });
        const sentences = text.split(/[.!?]+/).filter(function(s) { return s.trim().length > 0; });
        
        const charCount = document.getElementById('charCount');
        const wordCount = document.getElementById('wordCount');
        const sentenceCount = document.getElementById('sentenceCount');
        
        if (charCount) charCount.textContent = text.length;
        if (wordCount) wordCount.textContent = words.length;
        if (sentenceCount) sentenceCount.textContent = sentences.length;
    },
    
    analyze: async function() {
        const textInput = document.getElementById('textInput');
        const text = textInput ? textInput.value : '';
        
        if (!text.trim()) {
            alert('Введите текст для анализа');
            return;
        }
        
        // Собираем выбранные функции
        const selectedFunctions = {
            spelling: document.getElementById('funcSpelling') ? document.getElementById('funcSpelling').checked : true,
            style: document.getElementById('funcStyle') ? document.getElementById('funcStyle').checked : true,
            water: document.getElementById('funcWater') ? document.getElementById('funcWater').checked : false,
            rewrite: document.getElementById('funcRewrite') ? document.getElementById('funcRewrite').checked : false,
            tone: document.getElementById('funcTone') ? document.getElementById('funcTone').checked : false,
            syntax: document.getElementById('funcSyntax') ? document.getElementById('funcSyntax').checked : false
        };
        
        const rewriteStyleSelect = document.getElementById('rewriteStyleSelect');
        const rewriteStyle = rewriteStyleSelect ? rewriteStyleSelect.value : 'neutral';
        
        const analyzeBtn = document.getElementById('analyzeBtn');
        const originalText = analyzeBtn ? analyzeBtn.innerHTML : '';
        if (analyzeBtn) {
            analyzeBtn.innerHTML = 'Анализируем...';
            analyzeBtn.disabled = true;
        }
        
        try {
            if (!window.API) {
                throw new Error('API модуль не загружен');
            }
            
            const result = await window.API.analyzeText(text, selectedFunctions, rewriteStyle);
            this.currentAnalysis = result;
            
            // Обновляем статистику
            if (window.Components) {
                window.Components.updateStats(result);
                window.Components.displayRecommendations(result);
                window.Components.displayResults(result, selectedFunctions);
            }
            
            // Если есть переработанный текст, показываем вторую колонку
            if (result.modified_text && selectedFunctions.rewrite) {
                this.modifiedText = result.modified_text;
                this.showModifiedColumn(result.modified_text);
            }
            
            // Переключаемся на вкладку результатов
            this.switchTab('results');
            
            if (window.Components) {
                window.Components.showNotification('Анализ завершён');
            }
            
        } catch (error) {
            console.error('Ошибка анализа:', error);
            alert('Произошла ошибка при анализе текста: ' + error.message);
        } finally {
            if (analyzeBtn) {
                analyzeBtn.innerHTML = originalText;
                analyzeBtn.disabled = false;
            }
        }
    },
    
    showModifiedColumn: function(modifiedText) {
        const modifiedColumn = document.getElementById('modifiedColumn');
        const modifiedInput = document.getElementById('modifiedInput');
        
        if (modifiedColumn && modifiedInput) {
            modifiedInput.value = modifiedText;
            modifiedColumn.style.display = 'block';
            this.isModifiedMode = true;
        }
    },
    
    hideModifiedColumn: function() {
        const modifiedColumn = document.getElementById('modifiedColumn');
        if (modifiedColumn) {
            modifiedColumn.style.display = 'none';
            this.isModifiedMode = false;
            this.modifiedText = null;
        }
    },
    
    acceptChanges: function() {
        if (this.modifiedText) {
            const textInput = document.getElementById('textInput');
            if (textInput) {
                textInput.value = this.modifiedText;
                this.updateStatsFromText();
                this.hideModifiedColumn();
                if (window.Components) {
                    window.Components.showNotification('Изменения применены');
                }
                this.analyze();
            }
        }
    },
    
    switchTab: function(tabName) {
        document.querySelectorAll('.results-panel .tab-btn').forEach(function(btn) {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        document.querySelectorAll('.results-panel .tab-pane').forEach(function(pane) {
            pane.classList.remove('active');
        });
        
        const activePane = document.getElementById(tabName + 'Tab');
        if (activePane) {
            activePane.classList.add('active');
        }
    },
    
    scrollToPosition: function(position) {
        const textarea = document.getElementById('textInput');
        if (!textarea) return;
        
        textarea.focus();
        textarea.setSelectionRange(position, position);
        
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
        const lines = textarea.value.substring(0, position).split('\n').length;
        const scrollPosition = (lines - 3) * lineHeight;
        textarea.scrollTop = Math.max(0, scrollPosition);
    },
    
    showSaveModal: function() {
        const textInput = document.getElementById('textInput');
        const text = textInput ? textInput.value : '';
        
        if (!text.trim()) {
            alert('Нечего сохранять. Введите текст.');
            return;
        }
        
        const modal = document.getElementById('saveModal');
        const titleInput = document.getElementById('textTitle');
        
        if (titleInput) {
            const firstLine = text.split('\n')[0].substring(0, 50);
            titleInput.value = firstLine || 'Новый текст';
        }
        
        if (modal) modal.classList.add('active');
    },
    
    confirmSave: async function() {
        const titleInput = document.getElementById('textTitle');
        const textInput = document.getElementById('textInput');
        
        const title = titleInput ? titleInput.value.trim() : '';
        const content = textInput ? textInput.value : '';
        
        if (!title) {
            alert('Введите название текста');
            return;
        }
        
        this.closeModal();
        
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.innerHTML = 'Сохранение...';
            saveBtn.disabled = true;
        }
        
        try {
            if (window.API) {
                await window.API.saveText(title, content);
                if (window.Components) {
                    window.Components.showNotification('Текст сохранён');
                }
                
                const status = document.getElementById('statusIndicator');
                if (status) {
                    status.textContent = 'Сохранено';
                    status.classList.add('saved');
                    setTimeout(function() {
                        status.textContent = '';
                        status.classList.remove('saved');
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            alert('Не удалось сохранить текст');
        } finally {
            if (saveBtn) {
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            }
        }
    },
    
    closeModal: function() {
        const modal = document.getElementById('saveModal');
        if (modal) modal.classList.remove('active');
    },
    
    loadFromStorage: async function() {
        const savedText = localStorage.getItem('chistovik_open_text');
        if (savedText) {
            const text = JSON.parse(savedText);
            const textInput = document.getElementById('textInput');
            if (textInput) {
                textInput.value = text.content;
                this.updateStatsFromText();
            }
            localStorage.removeItem('chistovik_open_text');
            await this.analyze();
            if (window.Components) {
                window.Components.showNotification('Загружен текст: ' + text.title);
            }
        }
    }
};

// Запуск приложения
if (typeof window !== 'undefined') {
    window.App = App;
    document.addEventListener('DOMContentLoaded', function() {
        App.init();
    });
    console.log('App модуль загружен');
}