"""Проверка орфографии и канцеляризмов без пересекающихся замен."""
from nlp.analyzers import _find_water_phrases, analyze_text

SPELLING_SAMPLE = (
    "Севодня мы рассматрваем вопрос о разработке нового сервиса для проверки текстов. "
    "Данный сервис будет полезен для журналистов, маркетологов и всех кто много пишит. "
    "Ошыбки в тексте могуть снижать доверие к автору, поэтомы важно их оперативно "
    "находить и исправлять."
)

WATER_SAMPLE = (
    "В настоящее время хотелось бы отметить тот факт, что на сегодняшний день "
    "существует целый ряд причин, по которым процесс написания текстов является "
    "довольно сложным делом."
)


def _ranges_overlap(a_start, a_end, b_start, b_end):
    return not (a_end <= b_start or b_end <= a_start)


def test_water_phrases_do_not_overlap():
    phrases = _find_water_phrases(WATER_SAMPLE)
    for i, a in enumerate(phrases):
        for b in phrases[i + 1:]:
            a_end = a["position"] + len(a["phrase"])
            b_end = b["position"] + len(b["phrase"])
            assert not _ranges_overlap(a["position"], a_end, b["position"], b_end)


def test_common_misspellings_detected():
    result = analyze_text(SPELLING_SAMPLE, ["spelling"])
    words = {e["word"].lower() for e in result["spelling_errors"]}
    assert "севодня" in words or any("сегодн" in (e["suggestions"][0] or "").lower() for e in result["spelling_errors"])
    assert "рассматрваем" in words or "ошыбки" in words


def test_water_positions_match_text():
    result = analyze_text(WATER_SAMPLE, ["water"])
    for wp in result["water_phrases"]:
        fragment = WATER_SAMPLE[wp["position"]: wp["position"] + len(wp["phrase"])]
        assert fragment.lower() == wp["phrase"].lower()
