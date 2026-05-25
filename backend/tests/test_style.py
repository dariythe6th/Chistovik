"""Проверка классификации стиля для коротких разговорных фраз."""
from nlp.analyzers import analyze_text


def test_casual_greeting_is_informal_not_scientific():
    result = analyze_text("привет как  дела", ["style"])
    assert result["style"] is not None
    assert result["style"]["style"] == "informal"
    assert result["style"]["label"] == "Разговорный"


def test_scientific_text_still_detected():
    sample = (
        "В результате анализа экспериментальных данных была выявлена "
        "статистически значимая корреляция между переменными."
    )
    result = analyze_text(sample, ["style"])
    assert result["style"]["style"] in {"scientific", "formal", "neutral"}
