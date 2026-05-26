"""
Интеграционные тесты REST API (NLP в /api/analyze подменяется фикстурой).
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
    return client.post(
        "/api/register",
        json={"name": name, "email": email, "password": password},
    )


def _login(client, email, password):
    return client.post(
        "/api/login",
        data={"username": email, "password": password},
    )


def test_auth_register_login_and_profile(client):
    r = _register(client, email="flow@test.ru", password="pw12345")
    assert r.status_code == 200
    assert r.json()["email"] == "flow@test.ru"
    assert r.json()["role"] == "user"

    login = _login(client, "flow@test.ru", "pw12345")
    assert login.status_code == 200
    token = login.json()["access_token"]
    assert login.json()["token_type"] == "bearer"

    assert client.get("/api/me").status_code == 401
    me = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "flow@test.ru"

    _register(client, email="dup@test.ru")
    assert _register(client, email="dup@test.ru", name="Другой").status_code == 400
    _register(client, email="bad@test.ru", password="right")
    assert _login(client, "bad@test.ru", "wrong").status_code == 400


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
    assert body.get("readability_score") is not None


@patch("main.analyze_text", return_value=MOCK_ANALYSIS)
def test_history_save_list_delete(_, client):
    _register(client, email="hist@test.ru", password="pw")
    headers = {"Authorization": f"Bearer {_login(client, 'hist@test.ru', 'pw').json()['access_token']}"}

    save = client.post(
        "/api/save",
        headers=headers,
        json={"title": "Черновик", "content": "текст", "analysis": MOCK_ANALYSIS},
    )
    assert save.status_code == 200

    items = client.get("/api/history", headers=headers).json()
    assert len(items) == 1
    sid = items[0]["id"]

    assert client.delete(f"/api/history/{sid}", headers=headers).status_code == 200
    assert client.get("/api/history", headers=headers).json() == []


def test_history_permissions_and_admin(client):
    _register(client, email="a@test.ru", password="p1")
    _register(client, email="b@test.ru", password="p2")
    ta = _login(client, "a@test.ru", "p1").json()["access_token"]
    tb = _login(client, "b@test.ru", "p2").json()["access_token"]

    sid = client.post(
        "/api/save",
        headers={"Authorization": f"Bearer {ta}"},
        json={"title": "only A", "content": "c"},
    ).json()["id"]
    assert client.delete(f"/api/history/{sid}", headers={"Authorization": f"Bearer {tb}"}).status_code == 404

    assert client.get(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {tb}"},
    ).status_code == 403

    admin_token = _login(client, "admin@example.com", "admin").json()["access_token"]
    users = client.get(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert users.status_code == 200
    assert "admin@example.com" in {u["email"] for u in users.json()}
