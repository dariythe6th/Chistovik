// profile.js — объединённая версия (API + localStorage fallback, модальные окна)

function wireModals(scope = document) {
    scope.querySelectorAll('.modal').forEach((modal) => {
        const close = () => modal.classList.remove('active');
        modal.querySelectorAll('.modal-close, .modal-close-btn').forEach((btn) => {
            btn.addEventListener('click', close);
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    wireModals();

    // Дожидаемся загрузки данных пользователя
    await Auth.ensureUserLoaded();
    if (!Auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    let user = Auth.getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const apiAvailable = (typeof API !== 'undefined');

    // Рендер данных пользователя в шапке профиля
    function renderUser(u) {
        document.getElementById('userName').textContent = u.name;
        document.getElementById('userEmail').textContent = u.email;
        document.getElementById('userRegDate').textContent = new Date(
            u.registered_at,
        ).toLocaleDateString('ru-RU');
        const initials = u.name
            .trim()
            .split(/\s+/)
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        const avatar = document.querySelector('.avatar-initials');
        if (avatar) avatar.textContent = initials || '?';
    }

    renderUser(user);

    // --- Загрузка статистики (API → localStorage fallback) ---
    async function loadStats() {
        if (apiAvailable) {
            try {
                const texts = await API.getHistory();
                const savedCount = texts.length;
                const totalChars = texts.reduce((sum, t) => sum + (t.content?.length || 0), 0);
                return { savedCount, totalChars, totalAnalyses: savedCount };
            } catch (e) {
                console.error('Ошибка загрузки истории через API, пробуем localStorage:', e);
                if (window.Components) {
                    Components.showNotification(
                        'Не удалось загрузить историю с сервера, используются локальные данные.',
                        'warning'
                    );
                }
            }
        }
        // localStorage fallback (логика партнёра)
        const allTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        const myTexts = allTexts.filter(t => t.userId === user.id);
        const savedCount = myTexts.length;
        const totalChars = myTexts.reduce((sum, t) => sum + (t.content?.length || 0), 0);
        return { savedCount, totalChars, totalAnalyses: savedCount };
    }

    const stats = await loadStats();
    if (stats) {
        document.getElementById('savedCount').textContent = stats.savedCount;
        document.getElementById('totalChars').textContent = stats.totalChars.toLocaleString('ru-RU');
        document.getElementById('totalAnalyses').textContent = stats.totalAnalyses;
    } else {
        document.getElementById('savedCount').textContent = '—';
        document.getElementById('totalChars').textContent = '—';
        document.getElementById('totalAnalyses').textContent = '—';
    }

    // --- Выход через модальное окно ---
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        document.getElementById('logoutModal')?.classList.add('active');
    });

    document.getElementById('confirmLogoutBtn')?.addEventListener('click', () => {
        document.getElementById('logoutModal')?.classList.remove('active');
        Auth.logout();
        window.location.href = '../index.html';
    });

    // --- Смена пароля (открытие модалки) ---
    document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
        document.getElementById('passwordModal')?.classList.add('active');
    });
    // Здесь позже можно добавить обработчик подтверждения смены пароля

    // --- Удаление аккаунта (модалка + API/localStorage) ---
    document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
        document.getElementById('deleteModal')?.classList.add('active');
    });

    document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
        document.getElementById('deleteModal')?.classList.remove('active');
        if (apiAvailable) {
            try {
                await API.deleteAccount();
            } catch (e) {
                alert(e.message || 'Ошибка удаления аккаунта');
                return;
            }
        } else {
            // Локальное удаление данных (из версии партнёра)
            const all = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
            const remaining = all.filter(t => t.userId !== user.id);
            localStorage.setItem('chistovik_history', JSON.stringify(remaining));

            const users = JSON.parse(localStorage.getItem('chistovik_users') || '[]');
            const newUsers = users.filter(u => u.id !== user.id);
            localStorage.setItem('chistovik_users', JSON.stringify(newUsers));
        }
        Auth.logout();
        window.location.href = '../index.html';
    });

    // --- Редактирование имени (через API/prompt) ---
    document.getElementById('editNameBtn')?.addEventListener('click', async () => {
        if (!apiAvailable) {
            alert('Демо-режим: редактирование имени временно недоступно.');
            return;
        }
        const next = prompt('Новое имя', user.name);
        if (next === null || !next.trim()) return;
        try {
            await API.updateProfile(next.trim());
            await Auth.refreshUser();
            user = Auth.getCurrentUser();
            renderUser(user);
            if (window.Components) {
                Components.showNotification('Имя обновлено', 'success');
            }
        } catch (err) {
            alert(err.message || 'Не удалось обновить имя');
        }
    });
});