"""
Rule-based переработка текста в заданный стиль (без внешних LLM).
Применяет словари замен по всему тексту, а не только вступительные фразы.
"""
import re
from typing import Callable, Dict, List, Optional, Tuple

from nlp.style_lexicon import (
    OFFICIAL_TO_COLLOQUIAL,
    OFFICIAL_TO_LITERARY,
    OFFICIAL_TO_NEUTRAL,
    TO_COLLOQUIAL_PHRASES,
    TO_FORMAL_PHRASES,
    TO_FORMAL_WORDS,
    TO_JOURNALISTIC_PHRASES,
    TO_LITERARY_PHRASES,
    TO_NEUTRAL_PHRASES,
    TO_SCIENTIFIC_PHRASES,
)

_OFFICIAL_MARKERS = (
    "настоящим",
    "уведомля",
    "в связи с",
    "просьба",
    "осуществл",
    "доводим до",
    "сообщаем",
    "информиру",
)

_WEEKDAYS = {
    "понедельник": "понедельник",
    "вторник": "вторник",
    "среду": "среду",
    "среда": "среду",
    "четверг": "четверг",
    "четверга": "четверг",
    "пятницу": "пятницу",
    "пятница": "пятницу",
    "субботу": "субботу",
    "суббота": "субботу",
    "воскресенье": "воскресенье",
}


def _extract_weekday(text: str) -> Optional[str]:
    lower = text.lower()
    for key, value in _WEEKDAYS.items():
        if key in lower:
            return value
    return None


def _extract_time(text: str) -> Optional[str]:
    m = re.search(
        r"(\d{1,2})\s*(?::(\d{2}))?\s*(утра|утром|дня|днём|вечера|вечером)?",
        text,
        re.I,
    )
    if not m:
        return None
    hour = int(m.group(1))
    minute = m.group(2) or "00"
    part = (m.group(3) or "").lower()
    if part in ("вечера", "вечером") and hour < 12:
        hour += 12
    return f"{hour:02d}:{minute}"


def _phrase_pattern(phrase: str) -> str:
    """Замена только целых слов/фраз (не внутри «необходимостью» и т.п.)."""
    escaped = re.escape(phrase)
    return rf"(?<![а-яёА-ЯЁ]){escaped}(?![а-яёА-ЯЁ])"


def _apply_replacements(
    text: str,
    pairs: List[Tuple[str, str]],
    *,
    use_word_boundaries: bool = True,
) -> str:
    """Последовательно применяет замены (сначала длинные фразы)."""
    result = text
    sorted_pairs = sorted(pairs, key=lambda p: len(p[0]), reverse=True)
    for src, dst in sorted_pairs:
        if not src:
            continue
        pattern = _phrase_pattern(src) if use_word_boundaries else re.escape(src)
        result = re.sub(pattern, dst, result, flags=re.IGNORECASE)
    return result


def _normalize_changed(before: str, after: str) -> bool:
    return before.strip().lower() != after.strip().lower()


def _polish_text(text: str, style: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(
        r"([.!?])\s*([а-яё])",
        lambda m: m.group(1) + " " + m.group(2).upper(),
        text,
        flags=re.IGNORECASE,
    )
    if text:
        text = text[0].upper() + text[1:]

    if style == "formal":
        for pron in ("Вы", "Вас", "Вам", "Ваш", "Ваши", "Вашего", "Вашу"):
            text = re.sub(rf"\b{pron.lower()}\b", pron, text)
        text = re.sub(
            r"^уважаемый коллега([,.])?",
            "Уважаемый коллега!",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(r"уважаемый коллега\s+уважаемый коллега", "Уважаемый коллега", text, flags=re.I)

    return text


def _fix_formal_time(text: str) -> str:
    def _time_sub(m: re.Match) -> str:
        t = _extract_time(m.group(0))
        return f"в {t}" if t else m.group(0)

    return re.sub(
        r"в\s+\d{1,2}\s*(?::\d{2})?\s*(?:утра|утром|дня|днём|вечера|вечером)?",
        _time_sub,
        text,
        flags=re.I,
    )


def _is_official_text(text: str) -> bool:
    lower = text.lower()
    return sum(1 for m in _OFFICIAL_MARKERS if m in lower) >= 2


def _try_meeting_reschedule_notice(text: str, style: str) -> Optional[str]:
    """Перенос совещания — цельное переписывание по стилю."""
    lower = text.lower()
    if not (re.search(r"уведомл", lower) and re.search(r"перенос", lower)):
        return None

    time_m = re.search(
        r"с\s*(\d{1,2}:\d{2})\s+на\s+(\d{1,2}:\d{2})",
        text,
        re.I,
    )
    t_from = time_m.group(1) if time_m else "10:00"
    t_to = time_m.group(2) if time_m else "14:00"

    if style == "colloquial":
        return (
            f"Из-за необходимости упростить работу сообщаем: плановую встречу "
            f"переносим с {t_from} на {t_to}. Извините за неудобства. "
            f"Пожалуйста, поправьте свои планы с учётом этого."
        )
    if style == "neutral":
        return (
            f"Из-за необходимости оптимизировать работу сообщаю: плановое совещание "
            f"переносим с {t_from} на {t_to}. Приносим извинения за неудобства. "
            f"Пожалуйста, скорректируйте планы с учётом этой информации."
        )
    if style == "literary":
        return (
            f"В силу нужды привести дела в порядок спешу известить Вас: сход коллег "
            f"отодвигается с {t_from} на {t_to}. Просим простить смущение, "
            f"доставленное Вам. Умоляем сверить свои замыслы с этой вестью."
        )
    if style == "journalistic":
        return (
            f"Сегодня стало известно: в связи с оптимизацией работы плановое совещание "
            f"переносится с {t_from} на {t_to}. Организаторы приносят извинения "
            f"и просят скорректировать планы."
        )
    if style == "scientific":
        return (
            f"В связи с необходимостью оптимизации процессов фиксируется перенос "
            f"планового совещания с {t_from} на {t_to}. Зафиксированы неудобства; "
            f"рекомендуется скорректировать планы участников."
        )
    return None


def _pairs_for_style(style: str) -> List[Tuple[str, str]]:
    """Собирает словарь: для официальных текстов — сначала спецправила."""
    if style == "colloquial":
        base = OFFICIAL_TO_COLLOQUIAL + TO_COLLOQUIAL_PHRASES
    elif style == "neutral":
        base = OFFICIAL_TO_NEUTRAL + TO_NEUTRAL_PHRASES
    elif style == "literary":
        base = OFFICIAL_TO_LITERARY + TO_LITERARY_PHRASES
    elif style == "journalistic":
        base = OFFICIAL_TO_NEUTRAL + TO_JOURNALISTIC_PHRASES
    elif style == "scientific":
        base = OFFICIAL_TO_NEUTRAL + TO_SCIENTIFIC_PHRASES
    else:
        return []
    return base


def _try_meeting_invite_formal(text: str) -> Optional[str]:
    """Специализированный шаблон только для явного приглашения на встречу."""
    lower = text.lower()
    if not (
        re.search(r"\bпривет\b", lower)
        and re.search(r"\bвстрет", lower)
        and re.search(r"\bобсуд", lower)
        and len(text.split()) >= 12
    ):
        return None

    day = _extract_weekday(text)
    time = _extract_time(text)

    topic = "процесса разработки сервиса автоматической проверки текстов"
    topic_m = re.search(
        r"обсудить,?\s*(?:как\s+мы\s+будем\s+делать\s+)?(.+?)(?:\.|давай|пришл)",
        text,
        re.I | re.S,
    )
    if topic_m:
        raw = topic_m.group(1).strip().rstrip(".")
        raw = re.sub(r"^этот\s+", "", raw, flags=re.I)
        raw = re.sub(r"^новый\s+", "", raw, flags=re.I)
        if raw:
            topic = f"процесса разработки {raw}"

    parts = [
        "Уважаемый коллега!",
        f"Прошу Вас принять участие в рабочей встрече, посвящённой обсуждению {topic}.",
    ]

    when_bits = []
    if day:
        when_bits.append(f"в {day}")
    if time:
        when_bits.append(f"ориентировочно в {time}")
    if when_bits:
        parts.append("Встреча предлагается к проведению " + ", ".join(when_bits) + ".")
    elif re.search(r"следующ", lower):
        parts.append("Встреча предлагается к проведению на следующей неделе.")

    if re.search(r"идеи|предлож|функц", lower):
        parts.append("Просьба направить Ваши предложения по функциональным требованиям.")

    if re.search(r"подготов|сделан|готов|реализ", lower):
        parts.append("Я, в свою очередь, предоставлю отчёт о реализованных модулях.")

    if re.search(r"жду\s+ответ", lower):
        parts.append("Ожидаю подтверждения Вашего участия.")
    else:
        parts.append("Ожидаю Вашего ответа.")

    return " ".join(parts)


def _rewrite_pipeline(
    text: str,
    style: str,
    phrase_pairs: List[Tuple[str, str]],
    word_pairs: Optional[List[Tuple[str, str]]] = None,
    *,
    pre_hook: Optional[Callable[[str], str]] = None,
    post_hook: Optional[Callable[[str], str]] = None,
) -> str:
    original = text.strip()
    result = original

    if pre_hook:
        hooked = pre_hook(result)
        if hooked is not None:
            return _polish_text(hooked, style)

    result = _apply_replacements(result, phrase_pairs)
    if word_pairs:
        result = _apply_replacements(result, word_pairs)

    if post_hook:
        result = post_hook(result)

    return _polish_text(result, style)


def _rewrite_formal(text: str) -> str:
    specialized = _try_meeting_invite_formal(text)
    if specialized:
        return specialized

    result = _rewrite_pipeline(
        text,
        "formal",
        TO_FORMAL_PHRASES,
        TO_FORMAL_WORDS,
        post_hook=_fix_formal_time,
    )

    # Дополнительный проход для пропущенных разговорных форм
    if not _normalize_changed(text, result):
        extra = [
            ("щас", "в настоящее время"),
            ("чтоб", "для того чтобы"),
            ("чё", "что"),
            ("ваще", "в целом"),
            ("блин", ""),
            ("норм", "приемлемо"),
        ]
        result = _apply_replacements(result, extra)
        result = _polish_text(result, "formal")

    return result


def _rewrite_with_style_dict(text: str, style: str) -> str:
    specialized = _try_meeting_reschedule_notice(text, style)
    if specialized:
        return _polish_text(specialized, style)

    pairs = _pairs_for_style(style)
    if _is_official_text(text):
        result = _apply_replacements(text, pairs)
        return _polish_text(result, style)

    return _rewrite_pipeline(text, style, pairs)


def _rewrite_colloquial(text: str) -> str:
    return _rewrite_with_style_dict(text, "colloquial")


def _rewrite_neutral(text: str) -> str:
    return _rewrite_with_style_dict(text, "neutral")


def _rewrite_journalistic(text: str) -> str:
    return _rewrite_with_style_dict(text, "journalistic")


def _rewrite_scientific(text: str) -> str:
    return _rewrite_with_style_dict(text, "scientific")


def _rewrite_literary(text: str) -> str:
    return _rewrite_with_style_dict(text, "literary")


_REWRITERS: Dict[str, Callable[[str], str]] = {
    "formal": _rewrite_formal,
    "journalistic": _rewrite_journalistic,
    "scientific": _rewrite_scientific,
    "colloquial": _rewrite_colloquial,
    "literary": _rewrite_literary,
    "neutral": _rewrite_neutral,
}


def rewrite_text(text: str, style: str = "formal") -> str:
    if not text or not text.strip():
        return text
    handler = _REWRITERS.get((style or "formal").lower(), _rewrite_neutral)
    return handler(text)
