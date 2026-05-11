"""
Автоматизированные проверки REST API (уровень интеграционного тестирования).
NLP-анализ в /api/analyze подменяется фикстурой, чтобы тесты не зависели от Java/LanguageTool.
"""
from unittest.mock import patch

import pytest

MOCK_ANALYSIS = {
    "stats": {"characters": 20, "words": 3, "sentences": 1},
    "spelling_errors": [
        {"word": "ошибка", "position": 0, "suggestions": ["исправление"], "description": "тест"}
    ],
    "water_phrases": [
        {"phrase": "в настоящее время", "position": 5, "recommendation": "сейчас"}
    ],
    "long_sentences": [],
    "style": {"style": "neutral", "label": "Нейтральный"},
    "tone": {"tone": "neutral"},
    "syntax_issues": [],
    "readability_score": 42.5,
    "readability_level": "средняя",
    "recommendations": [
        {
            "type": "generic",
            "description": "Проверка",
            "suggested_change": "",
            "position": 0,
        }
    ],
}


def _register(client, email="user@test.ru", password="secretpass1", name="Тест"):
    r = client.post(
        "/api/register",
        json={"name": name, "email": email, "password": password},
    )
    return r


def _login(client, email, password):
    return client.post(
        "/api/login",
        data={"username": email, "password": password},
    )


def test_register_positive(client):
    r = _register(client)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "user@test.ru"
    assert data["role"] == "user"
    assert "id" in data


def test_register_duplicate_email(client):
    _register(client, email="dup@test.ru")
    r = _register(client, email="dup@test.ru", name="Другой")
    assert r.status_code == 400
    assert "already" in r.json()["detail"].lower() or "registered" in r.json()["detail"].lower()


def test_login_positive(client):
    _register(client, email="ok@test.ru", password="mypass99")
    r = _login(client, "ok@test.ru", "mypass99")
    assert r.status_code == 200
    assert r.json()["token_type"] == "bearer"
    assert len(r.json()["access_token"]) > 10


def test_login_wrong_password(client):
    _register(client, email="u2@test.ru", password="right")
    r = _login(client, "u2@test.ru", "wrong")
    assert r.status_code == 400


def test_me_without_token(client):
    r = client.get("/api/me")
    assert r.status_code == 401


def test_me_with_token(client):
    _register(client, email="me@test.ru", password="pw")
    token = _login(client, "me@test.ru", "pw").json()["access_token"]
    r = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "me@test.ru"


@patch("main.analyze_text", return_value=MOCK_ANALYSIS)
def test_analyze_returns_summary(_, client):
    r = client.post(
        "/api/analyze",
        json={"text": "пример текста", "functions": ["spelling", "water"]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["summary"]["spelling"]["count"] == 1
    assert body["summary"]["water"]["count"] == 1
    assert "readability_score" in body or body.get("readability_score") is not None


@patch("main.analyze_text", return_value=MOCK_ANALYSIS)
def test_save_with_analysis_and_history(_, client):
    _register(client, email="hist@test.ru", password="pw")
    token = _login(client, "hist@test.ru", "pw").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    save = client.post(
        "/api/save",
        headers=headers,
        json={
            "title": "Черновик",
            "content": "текст в настоящее время",
            "analysis": MOCK_ANALYSIS,
        },
    )
    assert save.status_code == 200
    assert save.json()["title"] == "Черновик"

    hist = client.get("/api/history", headers=headers)
    assert hist.status_code == 200
    items = hist.json()
    assert len(items) == 1
    assert items[0]["title"] == "Черновик"


@patch("main.analyze_text", return_value=MOCK_ANALYSIS)
def test_delete_history_item(_, client):
    _register(client, email="del@test.ru", password="pw")
    token = _login(client, "del@test.ru", "pw").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    sid = client.post(
        "/api/save",
        headers=headers,
        json={"title": "X", "content": "y", "analysis": None},
    ).json()["id"]

    r = client.delete(f"/api/history/{sid}", headers=headers)
    assert r.status_code == 200
    assert client.get("/api/history", headers=headers).json() == []


def test_delete_foreign_history_404(client):
    _register(client, email="a@test.ru", password="p1")
    _register(client, email="b@test.ru", password="p2")
    ta = _login(client, "a@test.ru", "p1").json()["access_token"]
    tb = _login(client, "b@test.ru", "p2").json()["access_token"]

    sid = client.post(
        "/api/save",
        headers={"Authorization": f"Bearer {ta}"},
        json={"title": "only A", "content": "c"},
    ).json()["id"]

    r = client.delete(f"/api/history/{sid}", headers={"Authorization": f"Bearer {tb}"})
    assert r.status_code == 404


def test_admin_list_users_forbidden_for_user(client):
    _register(client, email="plain@test.ru", password="pw")
    token = _login(client, "plain@test.ru", "pw").json()["access_token"]
    r = client.get(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


def test_admin_list_users_ok(client):
    token = _login(client, "admin@example.com", "admin").json()["access_token"]
    r = client.get(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    emails = {u["email"] for u in r.json()}
    assert "admin@example.com" in emails
