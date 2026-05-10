import language_tool_python
import textstat
import pymorphy2
import httpx
import os
import logging
from natasha import (
    Segmenter,
    MorphVocab,
    NewsEmbedding,
    NewsMorphTagger,
    Doc
)
import re
from typing import List, Dict, Any

logger = logging.getLogger("chistovik.nlp")

# Инициализация инструментов (один раз при старте приложения).
# LanguageTool может не подняться в ограниченной среде (например, без доступа для скачивания модели),
# поэтому не даем приложению падать при импорте.
tool = None
_lt_init_error: str | None = None
try:
    # Локальный режим (требует Java + скачивание LanguageTool)
    tool = language_tool_python.LanguageTool('ru-RU')
except Exception as e:
    _lt_init_error = f"{type(e).__name__}: {e}"
    tool = None
    logger.warning("LanguageTool local init failed: %s", _lt_init_error)
morph = pymorphy2.MorphAnalyzer()

# Natasha pipeline
segmenter = Segmenter()
emb = NewsEmbedding()
morph_tagger = NewsMorphTagger(emb)

# Словари канцеляризмов (можно загружать из файла)
WATER_PHRASES = [
    ("в настоящее время", "сейчас"),
    ("в настоящий момент", "сейчас"),
    ("принимать во внимание", "учитывать"),
    ("включает в себя", "содержит"),
    ("с целью", "для"),
    ("в соответствии с", "по"),
    ("в рамках", "в"),
    ("в связи с тем что", "так как"),
    ("на сегодняшний день", "сейчас"),
    ("имеет место", "есть"),
    ("осуществлять", "делать"),
    ("является", "—"),
]

COMMON_MISSPELLINGS = {
    "ихняя": "их",
    "програма": "программа",
    "очен": "очень",
    "щас": "сейчас",
    "вообщем": "в общем",
    "канечно": "конечно",
}

STYLE_LABELS_RU = {
    "formal": "Официальный",
    "neutral": "Нейтральный",
    "informal": "Разговорный",
}

# Маркеры для rule-based классификации (по вашим ПР допустимо rule-based)
FORMAL_MARKERS = [
    "следует отметить", "необходимо подчеркнуть", "важно отметить",
    "представляется важным", "обращаем внимание", "принимая во внимание",
    "в соответствии с", "на основании", "в связи с", "вследствие",
    "в порядке", "в случае", "в целях", "в рамках", "в отношении",
    "осуществить", "реализовать", "предоставить", "рассмотреть",
    "утвердить", "согласовать", "регламентировать", "взаимодействовать",
    "осуществление", "предоставление", "утверждение", "согласование",
    "деятельность", "мероприятие", "документация", "отчётность",
]

INFORMAL_MARKERS = [
    "ваще", "короче", "типа", "нафиг", "блин", "прикол", "кайф",
    "ладно", "давай", "окей", "нормально", "супер", "классно",
    "жесть", "прям", "реально",
]

def _count_markers(text_lower: str, markers: List[str]) -> int:
    count = 0
    for marker in markers:
        # Для фраз — просто поиск, для слов — границы слова
        if " " in marker:
            count += text_lower.count(marker)
        else:
            count += len(re.findall(rf"\\b{re.escape(marker)}\\b", text_lower))
    return count

def _check_with_public_languagetool(text: str) -> List[Dict[str, Any]]:
    """
    Фолбэк на публичный LanguageTool API (без Java).
    Возвращает список совпадений в унифицированном формате.
    """
    # Можно отключить через env при отсутствии интернета
    if os.getenv("LT_PUBLIC_DISABLED", "").lower() in {"1", "true", "yes"}:
        raise RuntimeError("Public LanguageTool disabled")
    url = os.getenv("LT_PUBLIC_URL", "https://api.languagetool.org/v2/check")
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(url, data={"language": "ru-RU", "text": text})
        resp.raise_for_status()
        data = resp.json()
    matches = []
    for m in data.get("matches", []):
        repl = [r.get("value") for r in (m.get("replacements") or [])][:3]
        matches.append({
            "message": m.get("message") or "",
            "offset": int(m.get("offset") or 0),
            "length": int(m.get("length") or 0),
            "replacements": repl,
        })
    return matches

def analyze_text(text: str, functions: List[str]) -> Dict[str, Any]:
    result = {
        "stats": {
            "characters": len(text),
            "words": len(text.split()),
            "sentences": len(re.split(r'[.!?]+', text.strip())) if text else 0
        },
        "spelling_errors": [],
        "water_phrases": [],
        "long_sentences": [],
        "style": None,
        "tone": None,
        "syntax_issues": [],
        "readability_score": 0,
        "readability_level": "",
        "recommendations": []
    }

    # Орфография через LanguageTool
    if 'spelling' in functions:
        # 1) Локальный LT (если поднялся)
        matches_local = None
        if tool is not None:
            try:
                matches_local = tool.check(text)
            except Exception as e:
                logger.warning("LanguageTool local check failed: %s", f"{type(e).__name__}: {e}")
                matches_local = None

        if matches_local is not None:
            for match in matches_local:
                error_word = text[match.offset:match.offset + match.errorLength]
                repl = match.replacements[:3]
                desc = match.message
                if "аналогичной по начертанию" in desc:
                    desc = "Найдена буква из другого алфавита, похожая на русскую"
                result["spelling_errors"].append({
                    "word": error_word,
                    "position": match.offset,
                    "suggestions": repl,
                    "description": desc
                })
                result["recommendations"].append({
                    "type": "spelling",
                    "description": f"Ошибка: {desc}",
                    "suggested_change": ", ".join(repl),
                    "position": match.offset
                })
        else:
            # 2) Публичный LT API
            try:
                matches = _check_with_public_languagetool(text)
                for m in matches:
                    offset = m["offset"]
                    length = m["length"]
                    error_word = text[offset:offset + length]
                    repl = m["replacements"]
                    desc = m["message"]
                    if "аналогичной по начертанию" in desc:
                        desc = "Найдена буква из другого алфавита, похожая на русскую"
                    result["spelling_errors"].append({
                        "word": error_word,
                        "position": offset,
                        "suggestions": repl,
                        "description": desc
                    })
                    result["recommendations"].append({
                        "type": "spelling",
                        "description": f"Ошибка: {desc}",
                        "suggested_change": ", ".join(repl),
                        "position": offset
                    })
            except Exception as e:
                logger.warning("LanguageTool public check failed: %s", f"{type(e).__name__}: {e}")

    if 'spelling' in functions and len(result["spelling_errors"]) == 0:
        # Фолбэк для типичных ошибок, чтобы орфография не была полностью пустой
        # при недоступном или нестабильном внешнем движке.
        lower_text = text.lower()
        for wrong, correct in COMMON_MISSPELLINGS.items():
            for match in re.finditer(rf"\b{re.escape(wrong)}\b", lower_text):
                result["spelling_errors"].append({
                    "word": text[match.start():match.end()],
                    "position": match.start(),
                    "suggestions": [correct],
                    "description": f'Возможно, имелось в виду "{correct}"'
                })
                result["recommendations"].append({
                    "type": "spelling",
                    "description": f'Опечатка: "{wrong}"',
                    "suggested_change": correct,
                    "position": match.start()
                })

    # Канцеляризмы
    if 'water' in functions:
        lower_text = text.lower()
        for phrase, replacement in WATER_PHRASES:
            start = 0
            while True:
                pos = lower_text.find(phrase, start)
                if pos == -1:
                    break
                result["water_phrases"].append({
                    "phrase": phrase,
                    "position": pos,
                    "recommendation": replacement
                })
                result["recommendations"].append({
                    "type": "water",
                    "description": f'Канцеляризм "{phrase}"',
                    "suggested_change": f'Замените на "{replacement}"',
                    "position": pos
                })
                start = pos + 1

    # Длинные предложения
    if 'long_sentences' in functions:
        sentences = re.split(r'(?<=[.!?])\s+', text)
        offset = 0
        for sent in sentences:
            words = sent.split()
            if len(words) > 20:
                result["long_sentences"].append({
                    "sentence": sent,
                    "wordCount": len(words),
                    "position": offset
                })
                result["recommendations"].append({
                    "type": "long_sentence",
                    "description": f"Длинное предложение ({len(words)} слов)",
                    "suggested_change": "Разбейте на несколько коротких",
                    "position": offset
                })
            offset += len(sent) + 1

    # Читаемость (textstat для русского? используем упрощённую формулу Флеша)
    if 'readability' in functions or True:  # всегда считаем
        # Для русского применяем адаптацию Flesch Reading Ease:
        # score = 206.835 - 1.3*(words/sentences) - 60.1*(syllables/words)
        # Важно: здесь именно слоги, а не длина слова в символах.
        words = re.findall(r"[A-Za-zА-Яа-яЁё]+", text)
        sentences = [s for s in re.split(r"[.!?]+", text.strip()) if s.strip()]
        vowels = set("аеёиоуыэюяAEIOUYaeiouy")

        def count_syllables(word: str) -> int:
            w = word.lower()
            cnt = sum(1 for ch in w if ch in vowels)
            return cnt if cnt > 0 else 1

        if len(words) == 0 or len(sentences) == 0:
            score = 0
        else:
            total_syllables = sum(count_syllables(w) for w in words)
            avg_sentence_len = len(words) / len(sentences)
            avg_syllables_per_word = total_syllables / len(words)
            score = 206.835 - 1.3 * avg_sentence_len - 60.1 * avg_syllables_per_word
            score = max(0, min(100, score))
        result["readability_score"] = round(score, 1)
        if score >= 80:
            result["readability_level"] = "Очень лёгкий"
        elif score >= 60:
            result["readability_level"] = "Лёгкий"
        elif score >= 40:
            result["readability_level"] = "Средний"
        elif score >= 20:
            result["readability_level"] = "Сложный"
        else:
            result["readability_level"] = "Очень сложный"

    # Стиль: rule-based маркеры + fallback на Natasha (если нужно)
    if 'style' in functions:
        lower_text = text.lower()
        formal_hits = _count_markers(lower_text, FORMAL_MARKERS)
        informal_hits = _count_markers(lower_text, INFORMAL_MARKERS)

        style_label = "neutral"
        confidence = 0.55
        if formal_hits > informal_hits and formal_hits >= 2:
            style_label = "formal"
            confidence = min(0.95, 0.6 + formal_hits / 20)
        elif informal_hits > formal_hits and informal_hits >= 2:
            style_label = "informal"
            confidence = min(0.95, 0.6 + informal_hits / 20)

        result["style"] = {
            "style": style_label,
            "confidence": round(confidence, 2),
            "label": STYLE_LABELS_RU.get(style_label, style_label)
        }
        result["recommendations"].append({
            "type": "style",
            "description": f"Стиль текста: {STYLE_LABELS_RU.get(style_label, style_label)}",
            "suggested_change": "При необходимости скорректируйте стиль",
            "position": -1
        })

    # Тональность (заглушка, можно дообучить)
    if 'tone' in functions:
        tone = "нейтральная"
        if "отлично" in text.lower() or "прекрасно" in text.lower():
            tone = "позитивная"
        elif "ужасно" in text.lower() or "проблема" in text.lower():
            tone = "негативная"
        result["tone"] = {"tone": tone, "confidence": 0.6}
        result["recommendations"].append({
            "type": "tone",
            "description": f"Тональность: {tone}",
            "suggested_change": "",
            "position": -1
        })

    # Синтаксис (поиск сложных конструкций)
    if 'syntax' in functions:
        complex_markers = ['который', 'которая', 'которые', 'являющийся']
        issues = []
        for marker in complex_markers:
            if marker in text.lower():
                issues.append(f'Найдено "{marker}"')
        result["syntax_issues"] = issues
        if issues:
            result["recommendations"].append({
                "type": "syntax",
                "description": "Обнаружены сложные конструкции",
                "suggested_change": "Упростите придаточные предложения",
                "position": -1
            })

    return result