"""Тесты переработки текста по стилям."""
import pytest

from nlp.rewriter import rewrite_text

MEETING_SOURCE = (
    "Привет! Нам нужно с тобой встретиться и обсудить, как мы будем делать "
    "этот новый сервис для проверки текстов. Давай соберёмся на следующей неделе, "
    "например, в среду в 11 утра. Пришли, пожалуйста, свои идеи по функциям, "
    "а я подготовлю список того, что уже сделано. Жду ответа."
)

MEETING_RESCHEDULE = (
    "В связи с необходимостью оптимизации рабочих процессов настоящим уведомляю Вас "
    "о том, что плановое совещание переносится с 10:00 на 14:00. Приносим извинения "
    "за доставленные неудобства. Просьба скорректировать Ваши планы с учётом "
    "указанной информации."
)

TECH_STACK = (
    "FastAPI использует асинхронные эндпоинты. Библиотека LanguageTool проверяет "
    "орфографию и грамматику. pymorphy2 приводит слова к нормальной форме. textstat "
    "вычисляет индекс читаемости. Пользователь вставляет текст. Система возвращает "
    "подсветку ошибок и рекомендации."
)


def test_rewrite_formal_meeting_invite(client):
    result = rewrite_text(MEETING_SOURCE, "formal")
    lower = result.lower()
    assert "уважаемый коллега" in lower
    assert "рабоч" in lower or "встреч" in lower
    assert "11:00" in result or "11:0" in result

    r = client.post(
        "/api/rewrite",
        json={"text": MEETING_SOURCE, "style": "formal"},
    )
    assert r.status_code == 200
    assert "уважаемый коллега" in r.json()["rewritten"].lower()


def test_rewrite_official_reschedule_colloquial():
    result = rewrite_text(MEETING_RESCHEDULE, "colloquial")
    lower = result.lower()
    assert lower != MEETING_RESCHEDULE.lower()
    assert "нужност" not in lower
    assert "извин" in lower or "сообща" in lower


@pytest.mark.parametrize(
    "style,needles",
    [
        ("journalistic", ("основе", "отвечает", "нормализует", "сервис", "автор")),
        ("literary", ("укрощ", "вкладывает", "будто", "отдаёт", "пульсирует")),
        ("neutral", ("асинхронно", "удобочитаем", "подсказ", "начальной")),
        ("colloquial", ("ловит", "вставляешь", "подсвеч", "асинхронно")),
        ("scientific", ("верификац", "нормализац", "метрик", "архитектур")),
    ],
)
def test_rewrite_tech_stack_by_style(style, needles):
    result = rewrite_text(TECH_STACK, style)
    assert result != TECH_STACK
    lower = result.lower()
    assert any(n in lower for n in needles)
    assert "по коррекции по коррекции" not in lower
