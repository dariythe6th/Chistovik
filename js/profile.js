// profile.js - логика страницы профиля (заглушки)

document.addEventListener('DOMContentLoaded', () => {
    // Модальные окна
    const passwordModal = document.getElementById('passwordModal');
    const logoutModal = document.getElementById('logoutModal');
    const deleteModal = document.getElementById('deleteModal');
    
    // Кнопки
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    
    // Функция открытия модального окна
    function openModal(modal) {
        if (modal) modal.classList.add('active');
    }
    
    // Функция закрытия модального окна
    function closeModal(modal) {
        if (modal) modal.classList.remove('active');
    }
    
    // Закрытие всех модальных окон по крестику или кнопке "Закрыть"
    const closeButtons = document.querySelectorAll('.modal-close, .modal-close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            closeModal(modal);
        });
    });
    
    // Закрытие по клику вне модального окна
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });
    
    // Обработчики кнопок (заглушки)
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => openModal(passwordModal));
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => openModal(logoutModal));
    }
    
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', () => openModal(deleteModal));
    }
    
    // Кнопка редактирования имени (заглушка)
    const editNameBtn = document.getElementById('editNameBtn');
    if (editNameBtn) {
        editNameBtn.addEventListener('click', () => {
            alert('Демо-режим: изменение имени временно недоступно.');
        });
    }
});