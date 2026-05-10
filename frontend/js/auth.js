const Auth = (function() {
    const TOKEN_KEY = 'access_token';
    let currentUser = null;
    let userLoadPromise = null;

    async function register(name, email, password) {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Ошибка регистрации');
        }
        const user = await res.json();
        return { success: true, user };
    }

    async function login(email, password) {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        const res = await fetch('/api/login', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Ошибка входа');
        }
        const data = await res.json();
        localStorage.setItem(TOKEN_KEY, data.access_token);
        const user = await loadUser();
        return { success: true, user };
    }

    async function loadUser() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;
        try {
            const res = await fetch('/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                throw new Error('Не удалось получить профиль');
            }
            currentUser = await res.json();
            return currentUser;
        } catch (e) {
            localStorage.removeItem(TOKEN_KEY);
            currentUser = null;
            return null;
        }
    }

    function ensureUserLoaded() {
        if (userLoadPromise) return userLoadPromise;
        userLoadPromise = Promise.resolve().then(loadUser).finally(() => {
            userLoadPromise = null;
        });
        return userLoadPromise;
    }

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        currentUser = null;
    }

    function getCurrentUser() {
        return currentUser;
    }

    function isAuthenticated() {
        return !!localStorage.getItem(TOKEN_KEY);
    }

    ensureUserLoaded();

    function isAdmin() {
        return !!currentUser && currentUser.role === 'admin';
    }

    async function getAllUsers() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) throw new Error('Требуется вход в аккаунт');
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Ошибка загрузки пользователей');
        }
        return res.json();
    }

    async function getAllTexts() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) throw new Error('Требуется вход в аккаунт');
        const res = await fetch('/api/admin/texts', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Ошибка загрузки текстов');
        }
        return res.json();
    }

    return {
        register,
        login,
        logout,
        getCurrentUser,
        isAuthenticated,
        ensureUserLoaded,
        isAdmin,
        getAllUsers,
        getAllTexts
    };
})();

if (typeof window !== 'undefined') {
    window.Auth = Auth;
}