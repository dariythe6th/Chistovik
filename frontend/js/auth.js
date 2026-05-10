// auth.js - Модуль аутентификации и работы с пользователями (имитация БД в localStorage)

const Auth = (function() {
    const STORAGE_KEY = 'chistovik_users';
    const SESSION_KEY = 'chistovik_current_user';

    // Инициализация: если нет пользователей, создать админа по умолчанию
    function init() {
        let users = getUsers();
        if (users.length === 0) {
            // Создаём администратора по умолчанию
            const defaultAdmin = {
                id: Date.now().toString(),
                name: 'Администратор',
                email: 'admin@example.com',
                password: hashPassword('admin'),
                role: 'admin',
                registered_at: new Date().toISOString()
            };
            users.push(defaultAdmin);
            saveUsers(users);
            console.log('Создан администратор по умолчанию: admin@example.com / admin');
        }
    }

    function getUsers() {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }

    function saveUsers(users) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    }

    // Простейшее хэширование (не для продакшена, только для демо)
    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return hash.toString();
    }

    function register(name, email, password) {
        const users = getUsers();
        // Проверка на существующего пользователя
        if (users.find(u => u.email === email)) {
            return { success: false, error: 'Пользователь с таким email уже существует' };
        }
        const newUser = {
            id: Date.now().toString(),
            name: name,
            email: email,
            password: hashPassword(password),
            role: 'user',
            registered_at: new Date().toISOString()
        };
        users.push(newUser);
        saveUsers(users);
        return { success: true, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } };
    }

    function login(email, password) {
        const users = getUsers();
        const hashed = hashPassword(password);
        const user = users.find(u => u.email === email && u.password === hashed);
        if (!user) {
            return { success: false, error: 'Неверный email или пароль' };
        }
        // Сохраняем сессию
        const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            registered_at: user.registered_at
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
        return { success: true, user: sessionUser };
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
    }

    function getCurrentUser() {
        const data = localStorage.getItem(SESSION_KEY);
        return data ? JSON.parse(data) : null;
    }

    function isAuthenticated() {
        return getCurrentUser() !== null;
    }

    function isAdmin() {
        const user = getCurrentUser();
        return user && user.role === 'admin';
    }

    // Получить всех пользователей (только для админа)
    function getAllUsers() {
        const users = getUsers();
        // Возвращаем без паролей
        return users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            registered_at: u.registered_at
        }));
    }

    // Получить все тексты всех пользователей (для админа)
    function getAllTexts() {
        const allTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        // В текущей реализации тексты не привязаны к пользователю, поэтому добавим поле user_id позже
        // Для простоты будем считать, что все тексты принадлежат текущему пользователю.
        // В админке покажем общее количество текстов.
        return allTexts;
    }

    // Привязка текста к пользователю (для будущего)
    function saveTextForUser(userId, title, content) {
        // Сейчас сохраняем как обычно, но в записи добавим userId
        const savedTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        const newText = {
            id: Date.now().toString(),
            userId: userId,
            title: title,
            content: content,
            saved_at: new Date().toISOString()
        };
        savedTexts.unshift(newText);
        localStorage.setItem('chistovik_history', JSON.stringify(savedTexts));
        return newText;
    }

    function getUserTexts(userId) {
        const allTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        return allTexts.filter(t => t.userId === userId);
    }

    // Инициализация при загрузке
    init();

    return {
        register,
        login,
        logout,
        getCurrentUser,
        isAuthenticated,
        isAdmin,
        getAllUsers,
        getAllTexts,
        saveTextForUser,
        getUserTexts
    };
})();

if (typeof window !== 'undefined') {
    window.Auth = Auth;
}