"""
Тесты NLP: орфография, «вода», стиль, применение исправлений.
"""
from nlp.analyzers import _find_water_phrases, analyze_text
from nlp.apply_fixes import apply_fixes_to_text

SPELLING_SAMPLE = (
    "Севодня мы рассматрваем вопрос о разработке нового сервиса для проверки текстов. "
    "Ошыбки в тексте могуть снижать доверие, поэтомы важно их исправлять."
)

SPORT_SAMPLE = (
    "Каждый день я занимаюсь спортом, потомму что это полезна для здоровья. "
    "Утром я бегаю, а вечером хожу в тренажорный зал. "
    "Если вы тоже хатите быть здоровыми, начинайте прямо севодня!"
)

WATER_SAMPLE = (
    "В настоящее время хотелось бы отметить тот факт, что на сегодняшний день "
    "существует целый ряд причин, по которым процесс написания текстов является "
    "довольно сложным делом."
)

APPLY_SOURCE = (
    "Севодня мы рассматрваем вопрос о разработке нового сервиса для проверки текстов. "
    "Данный сервис будет полезен для журналистов и всех кто много пишит. "
    "Ошыбки в тексте могуть снижать доверие к автору, поэтомы важно их исправлять."
)


def _ranges_overlap(a_start, a_end, b_start, b_end):
    return not (a_end <= b_start or b_end <= a_start)


def test_spelling_detection_and_apply():
    result = analyze_text(SPELLING_SAMPLE, ["spelling"])
    words = {e["word"].lower() for e in result["spelling_errors"]}
    assert "севодня" in words or any("сегодн" in (e["suggestions"][0] or "").lower() for e in result["spelling_errors"])

    sport = analyze_text(SPORT_SAMPLE, ["spelling"])
    sport_words = {e["word"].lower() for e in sport["spelling_errors"]}
    assert "потомму" in sport_words
    assert "хатите" in sport_words
    assert len(sport["recommendations"]) >= 4

    fixed = apply_fixes_to_text(SPORT_SAMPLE, sport)["fixed_text"].lower()
    assert "потомму" not in fixed
    assert "севодня" not in fixed
    assert "тренажор" not in fixed


def test_apply_fixes_endpoint_no_corruption(client):
    r = client.post(
        "/api/apply-fixes",
        json={"text": APPLY_SOURCE, "functions": ["spelling"]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("engine") == "dict-v3"
    fixed = body["fixed_text"]
    for broken in ("этотт", "ппишет", "ООшибк", "ммогут", "попоэтому"):
        assert broken not in fixed
    assert "Сегодня" in fixed
    assert "рассматриваем" in fixed


def test_water_phrases_analysis():
    phrases = _find_water_phrases(WATER_SAMPLE)
    for i, a in enumerate(phrases):
        for b in phrases[i + 1:]:
            a_end = a["position"] + len(a["phrase"])
            b_end = b["position"] + len(b["phrase"])
            assert not _ranges_overlap(a["position"], a_end, b["position"], b_end)

    result = analyze_text(WATER_SAMPLE, ["water"])
    for wp in result["water_phrases"]:
        fragment = WATER_SAMPLE[wp["position"] : wp["position"] + len(wp["phrase"])]
        assert fragment.lower() == wp["phrase"].lower()
    assert len(result["water_phrases"]) >= 1


def test_style_classification():
    casual = analyze_text("привет как  дела", ["style"])
    assert casual["style"]["style"] == "informal"
    assert casual["style"]["label"] == "Разговорный"

    scientific = analyze_text(
        "В результате анализа экспериментальных данных была выявлена "
        "статистически значимая корреляция между переменными.",
        ["style"],
    )
    assert scientific["style"]["style"] in {"scientific", "formal", "neutral"}
