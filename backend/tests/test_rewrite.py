"""Проверка переработки текста во все стили."""
from nlp.rewriter import rewrite_text

MEETING_SOURCE = (
    "Привет! Нам нужно с тобой встретиться и обсудить, как мы будем делать "
    "этот новый сервис для проверки текстов. Давай соберёмся на следующей неделе, "
    "например, в среду в 11 утра. Пришли, пожалуйста, свои идеи по функциям, "
    "а я подготовлю список того, что уже сделано. Жду ответа."
)

COLLOQUIAL_REPORT = (
    "Сейчас мы делаем проект. Нужно быстро проверить текст и прислать отчёт. "
    "Спасибо за помощь!"
)

BUREAUCRATIC = (
    "В настоящее время осуществляется проверка данного документа "
    "в соответствии с установленным порядком."
)

NEWS_LINE = "Компания выпустила новую версию приложения для проверки текстов."

MEETING_RESCHEDULE = (
    "В связи с необходимостью оптимизации рабочих процессов настоящим уведомляю Вас "
    "о том, что плановое совещание переносится с 10:00 на 14:00. Приносим извинения "
    "за доставленные неудобства. Просьба скорректировать Ваши планы с учётом "
    "указанной информации."
)


def test_meeting_reschedule_colloquial():
    result = rewrite_text(MEETING_RESCHEDULE, "colloquial")
    lower = result.lower()
    assert "нужност" not in lower  # не ломаем «необходимостью»
    assert "уведомля" not in lower or "сообща" in lower
    assert "извин" in lower
    assert "поправ" in lower or "пожалуйста" in lower
    assert lower != MEETING_RESCHEDULE.lower()


def test_meeting_reschedule_literary_changes():
    result = rewrite_text(MEETING_RESCHEDULE, "literary")
    lower = result.lower()
    assert lower != MEETING_RESCHEDULE.lower()
    assert "извещ" in lower or "сход" in lower or "вест" in lower


def test_meeting_reschedule_neutral_changes():
    result = rewrite_text(MEETING_RESCHEDULE, "neutral")
    assert result.lower() != MEETING_RESCHEDULE.lower()
    assert "нужност" not in result.lower()


def test_meeting_invite_formal_style():
    result = rewrite_text(MEETING_SOURCE, "formal")
    lower = result.lower()
    assert "уважаемый коллега" in lower
    assert "следует отметить" not in lower
    assert "рабоч" in lower or "встреч" in lower
    assert "11:00" in result or "11:0" in result


def test_formal_rewrites_general_colloquial_text():
    result = rewrite_text(COLLOQUIAL_REPORT, "formal")
    assert result.lower() != COLLOQUIAL_REPORT.lower()
    lower = result.lower()
    assert "настоящее время" in lower or "необходимо" in lower
    assert "осуществ" in lower or "реализ" in lower or "направ" in lower
    assert "спасибо" not in lower or "благодар" in lower


def test_colloquial_simplifies_bureaucratic_text():
    result = rewrite_text(BUREAUCRATIC, "colloquial")
    lower = result.lower()
    assert lower != BUREAUCRATIC.lower()
    assert "сейчас" in lower or "проверя" in lower or "делается" in lower
    assert "осуществляется" not in lower


def test_scientific_changes_wording():
    src = "Я думаю, этот метод очень хорошо показывает результат проверки."
    result = rewrite_text(src, "scientific")
    lower = result.lower()
    assert lower != src.lower()
    assert "предполож" in lower or "представля" in lower or "демонстр" in lower
    assert "думаю" not in lower


def test_journalistic_no_generic_prefix_only():
    result = rewrite_text(NEWS_LINE, "journalistic")
    assert result.lower() != NEWS_LINE.lower()
    assert not result.lower().startswith("на повестке дня — " + NEWS_LINE.lower()[:10])


def test_neutral_simplifies():
    result = rewrite_text(BUREAUCRATIC, "neutral")
    assert "осуществляется" not in result.lower()
    assert result.lower() != BUREAUCRATIC.lower()


def test_literary_changes_words():
    src = "Сейчас он быстро идёт по улице. Очень красивый вечер."
    result = rewrite_text(src, "literary")
    lower = result.lower()
    assert lower != src.lower()
    assert "ныне" in lower or "стремительно" in lower or "прелестн" in lower


def test_rewrite_endpoint(client):
    r = client.post(
        "/api/rewrite",
        json={"text": MEETING_SOURCE, "style": "formal"},
    )
    assert r.status_code == 200
    assert "уважаемый коллега" in r.json()["rewritten"].lower()
