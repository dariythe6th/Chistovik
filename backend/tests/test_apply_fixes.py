"""Проверка применения исправлений на типичном тексте с опечатками."""
from nlp.analyzers import analyze_text
from nlp.apply_fixes import apply_fixes_to_text

SOURCE = (
    "Севодня мы рассматрваем вопрос о разработке нового сервиса для проверки текстов. "
    "Данный сервис будет полезен для журналистов, маркетологов и всех кто много пишит. "
    "Ошыбки в тексте могуть снижать доверие к автору, поэтомы важно их оперативно "
    "находить и исправлять. В будущем мы планируем добавить поддержку английского языка."
)


def test_user_sample_spelling_only_no_corruption():
    analysis = analyze_text(SOURCE, ["spelling"])
    out = apply_fixes_to_text(SOURCE, analysis)
    fixed = out["fixed_text"]

    assert "этотт" not in fixed
    assert "ппишет" not in fixed
    assert "ООшибк" not in fixed
    assert "ммогут" not in fixed
    assert "попоэтому" not in fixed
    assert "нужност" not in fixed
    assert "Сегодня" in fixed
    assert "рассматриваем" in fixed
    assert "Ошибки" in fixed or "ошибки" in fixed.lower()
    assert "могут" in fixed
    assert "поэтому" in fixed
    assert "текстов." in fixed or "текстов. " in fixed


def test_user_sample_spelling_and_water():
    analysis = analyze_text(SOURCE, ["spelling", "water"])
    out = apply_fixes_to_text(SOURCE, analysis)
    fixed = out["fixed_text"]
    assert "этотт" not in fixed
    assert "Сегодня" in fixed


def test_apply_fixes_endpoint_reanalyzes(client):
    r = client.post(
        "/api/apply-fixes",
        json={"text": SOURCE, "functions": ["spelling"]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("engine") == "dict-v3"
    fixed = body["fixed_text"]
    assert "этотт" not in fixed
    assert "ппишет" not in fixed
    assert "Сегодня" in fixed
    assert "рассматриваем" in fixed
