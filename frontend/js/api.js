// api.js - слой взаимодействия с backend API
const API = {
    baseURL: '/api',

    async _fetch(url, options = {}) {
        const token = localStorage.getItem('access_token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };
        const response = await fetch(this.baseURL + url, { ...options, headers });
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Требуется вход в аккаунт');
            }
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || 'Ошибка сервера');
        }
        return response.json();
    },

    analyzeText: (text, selectedFunctions) =>
        API._fetch('/analyze', {
            method: 'POST',
            body: JSON.stringify({ text, functions: selectedFunctions })
        }),

    saveText: (title, content, analysis = null) =>
        API._fetch('/save', {
            method: 'POST',
            body: JSON.stringify({ title, content, analysis })
        }),

    getHistory: () => API._fetch('/history'),

    deleteText: (id) =>
        API._fetch(`/history/${id}`, { method: 'DELETE' }),

    clearHistory: () => Promise.resolve({ success: true }), // заглушка

    rewriteText: async (text, style) => {
        // заглушка – использует клиентский RewriteAnalyzer (если есть)
        if (window.RewriteAnalyzer) {
            return window.RewriteAnalyzer.rewriteText(text, style);
        }
        return `[Переписано в стиле ${style}]\n\n${text}`;
    }
};

if (typeof window !== 'undefined') {
    window.API = API;
}