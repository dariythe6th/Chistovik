// profile.js - реальные данные пользователя и выход

document.addEventListener('DOMContentLoaded', () => {
    // Проверка авторизации уже выполнена в HTML (редирект на login.html)
    const user = Auth.getCurrentUser();
    if (!user) return;

    // Заполняем данные профиля
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userRegDate').textContent = new Date(user.registered_at).toLocaleDateString('ru-RU');
    
    // Аватар (первые буквы имени)
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.querySelector('.avatar-initials').textContent = initials;
    
    // Загружаем статистику (сохранённые тексты пользователя)
    const allTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
    const myTexts = allTexts.filter(t => t.userId === user.id);
    const savedCount = myTexts.length;
    const totalChars = myTexts.reduce((sum, t) => sum + (t.content?.length || 0), 0);
    const totalAnalyses = myTexts.length; // можно считать каждый сохранённый текст как один анализ (или сделать отдельный счётчик)
    
    document.getElementById('savedCount').textContent = savedCount;
    document.getElementById('totalChars').textContent = totalChars.toLocaleString();
    document.getElementById('totalAnalyses').textContent = totalAnalyses;
    
    // --- Кнопка выхода (рабочая) ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            Auth.logout();
            window.location.href = '../index.html';
        });
    }
    
    // --- Кнопка смены пароля (заглушка) ---
    const changePwdBtn = document.getElementById('changePasswordBtn');
    if (changePwdBtn) {
        changePwdBtn.addEventListener('click', () => {
            alert('Демо-режим: смена пароля не реализована.');
        });
    }
    
    // --- Кнопка удаления аккаунта (заглушка) ---
    const deleteBtn = document.getElementById('deleteAccountBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (confirm('Удалить аккаунт? Все ваши тексты будут потеряны.')) {
                // В демо просто очищаем сессию и перенаправляем
                localStorage.removeItem('chistovik_current_user');
                // (опционально: удалить все тексты пользователя)
                const all = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
                const remaining = all.filter(t => t.userId !== user.id);
                localStorage.setItem('chistovik_history', JSON.stringify(remaining));
                // Удалить самого пользователя из списка
                const users = JSON.parse(localStorage.getItem('chistovik_users') || '[]');
                const newUsers = users.filter(u => u.id !== user.id);
                localStorage.setItem('chistovik_users', JSON.stringify(newUsers));
                window.location.href = '../index.html';
            }
        });
    }
    
    // Редактирование имени (заглушка)
    const editNameBtn = document.getElementById('editNameBtn');
    if (editNameBtn) {
        editNameBtn.addEventListener('click', () => {
            alert('Демо-режим: редактирование имени временно недоступно.');
        });
    }
});