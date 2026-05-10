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
# СЛОВАРЬ ВОДНЫХ ФРАЗ И КАНЦЕЛЯРИЗМОВ
WATER_PHRASES = [
    # Временные штампы
    ("в настоящее время", "сейчас"),
    ("в настоящий момент", "сейчас"),
    ("на сегодняшний день", "сейчас"),
    ("на данный момент", "сейчас"),
    ("в текущий период", "сейчас"),
    ("в ближайшее время", "скоро"),
    ("в скором времени", "скоро"),
    ("в обозримом будущем", "позже"),
    
    # Глагольные штампы (отглагольные существительные)
    ("принимать во внимание", "учитывать"),
    ("принять во внимание", "учесть"),
    ("производить проверку", "проверять"),
    ("осуществлять контроль", "контролировать"),
    ("осуществлять", "делать"),
    ("производить", "делать"),
    ("произвести", "сделать"),
    ("оказать помощь", "помочь"),
    ("оказывать помощь", "помогать"),
    ("принять решение", "решить"),
    ("принимать решение", "решать"),
    ("провести анализ", "проанализировать"),
    ("проводить анализ", "анализировать"),
    ("дать оценку", "оценить"),
    ("давать оценку", "оценивать"),
    
    # Составные предлоги
    ("в соответствии с", "по"),
    ("в рамках", "в"),
    ("в связи с тем что", "так как"),
    ("вследствие того что", "из-за того что"),
    ("в силу того что", "потому что"),
    ("ввиду того что", "так как"),
    ("в целях", "для"),
    ("с целью", "для"),
    ("на основании", "по"),
    ("на основе", "на"),
    ("по причине", "из-за"),
    ("за счёт", "благодаря"),
    ("в области", "в"),
    ("в сфере", "в"),
    ("в части", "по"),
    ("в отношении", "о"),
    ("по вопросу", "о"),
    ("по поводу", "о"),
    ("в деле", "в"),
    ("в ходе", "при"),
    ("в процессе", "при"),
    ("по линии", "по"),
    
    # Связки-паразиты
    ("включает в себя", "содержит"),
    ("имеет место", "есть"),
    ("является", "—"),
    ("представляет собой", "—"),
    ("в том числе", "включая"),
    ("при этом", "и"),
    ("вместе с тем", "но"),
    ("в свою очередь", "также"),
    
    # Местоименные штампы
    ("данный", "этот"),
    ("вышеуказанный", "этот"),
    ("вышеупомянутый", "этот"),
    ("нижеследующий", "следующий"),
    ("таковой", "такой"),
    ("подобного рода", "такой"),
    
    # Пустые усилители
    ("абсолютно", ""),
    ("безусловно", ""),
    ("несомненно", ""),
    ("совершенно", ""),
    ("достаточно", ""),
    ("вполне", ""),
    ("довольно", ""),
    ("весьма", ""),
    ("крайне", ""),
    ("чрезвычайно", ""),
    
    # Канцелярские обороты
    ("на предмет", "для"),
    ("по факту", "фактически"),
    ("в адрес", "к"),
    ("со стороны", "от"),
    ("в лице", "—"),
    ("в целях обеспечения", "чтобы"),
    ("во исполнение", "по"),
    ("согласно", "по"),
    ("надлежащим образом", "правильно"),
    ("в установленном порядке", "как положено"),
]

# КАТЕГОРИИ ВОДЫ ДЛЯ СТАТИСТИКИ
WATER_CATEGORIES = {
    "временные штампы": ["в настоящее время", "в настоящий момент", "на сегодняшний день", 
                        "на данный момент", "в текущий период", "в ближайшее время", 
                        "в скором времени", "в обозримом будущем"],
    "глагольные штампы": ["принимать во внимание", "принять во внимание", 
                         "производить проверку", "осуществлять контроль", "осуществлять", 
                         "производить", "произвести", "оказать помощь", "оказывать помощь",
                         "принять решение", "принимать решение", "провести анализ", 
                         "проводить анализ", "дать оценку", "давать оценку"],
    "составные предлоги": ["в соответствии с", "в рамках", "в связи с тем что", 
                          "вследствие того что", "в силу того что", "ввиду того что", 
                          "в целях", "с целью", "на основании", "на основе", 
                          "по причине", "за счёт", "в области", "в сфере", 
                          "в части", "в отношении", "по вопросу", "по поводу", 
                          "в деле", "в ходе", "в процессе", "по линии"],
    "связки-паразиты": ["включает в себя", "имеет место", "является", 
                       "представляет собой", "в том числе", "при этом", 
                       "вместе с тем", "в свою очередь"],
    "местоименные штампы": ["данный", "вышеуказанный", "вышеупомянутый", 
                           "нижеследующий", "таковой", "подобного рода"],
    "пустые усилители": ["абсолютно", "безусловно", "несомненно", "совершенно", 
                        "достаточно", "вполне", "довольно", "весьма", 
                        "крайне", "чрезвычайно"],
    "канцелярские обороты": ["на предмет", "по факту", "в адрес", "со стороны", 
                            "в лице", "в целях обеспечения", "во исполнение", 
                            "согласно", "надлежащим образом", "в установленном порядке"],
}

# ПОРОГИ ДЛЯ ОЦЕНКИ ВОДЫ
WATER_THRESHOLDS = {
    "clean": 10,       # < 10% — чистый текст
    "mild": 25,        # 10-25% — лёгкая избыточность
    "heavy": 40,       # 25-40% — много воды
    # > 40% — текст нужно серьёзно перерабатывать
}

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

# Маркеры для rule-based классификации
# ФОРМАЛЬНЫЙ СТИЛЬ (ОФИЦИАЛЬНО-ДЕЛОВОЙ)
FORMAL_MARKERS = [
    # Вводные конструкции
    "следует отметить", "необходимо подчеркнуть", "важно отметить",
    "представляется важным", "обращаем внимание", "принимая во внимание",
    "в соответствии с", "на основании", "в связи с", "вследствие",
    "в порядке", "в случае", "в целях", "в рамках", "в отношении",
    "в данном случае", "ввиду вышеизложенного", "надлежащим образом",
    "в установленном порядке", "на основании вышеизложенного",
    "в сложившейся ситуации", "в части касающейся", "в установленные сроки",
    "в целях обеспечения", "во исполнение", "впредь до",
    # Канцелярские глаголы
    "осуществить", "реализовать", "предоставить", "рассмотреть",
    "утвердить", "согласовать", "регламентировать", "взаимодействовать",
    "содействовать", "функционировать", "уполномочить", "делегировать",
    "проконтролировать", "задействовать", "проинформировать",
    "запросить", "ходатайствовать", "предписать",
    # Существительные
    "рассмотрение", "обеспечение", "реализация", "осуществление",
    "предоставление", "утверждение", "согласование", "регламентация",
    "деятельность", "мероприятие", "документация", "отчётность",
    "исполнение", "содействие", "урегулирование", "разъяснение",
    # Прилагательные и причастия
    "вышеуказанный", "нижеследующий", "вышеупомянутый", "должный",
    "необходимый", "обязательный", "целесообразный", "актуальный",
    "надлежащий", "соответствующий", "уполномоченный",
    "регламентирующий", "предусмотренный", "установленный",
]

# ПУБЛИЦИСТИЧЕСКИЙ СТИЛЬ
JOURNALISTIC_MARKERS = [
    # Характерные обороты
    "по данным", "как сообщается", "по мнению экспертов",
    "стоит отметить", "нельзя не заметить", "как показывает практика",
    "в центре внимания", "остаётся открытым вопрос",
    "вызывает обеспокоенность", "привлекает внимание",
    "источник сообщает", "по имеющейся информации",
    # Глаголы и выражения
    "подчёркивается", "отмечается", "сообщается",
    "комментируется", "заявляется", "акцентируется",
    "прозвучало", "прозвучала", "заявил", "заявила",
    "прокомментировал", "подчеркнул", "отметил",
    # Тематические слова
    "тенденция", "ситуация", "проблема", "вопрос",
    "факт", "событие", "происшествие", "инцидент",
    "общественность", "граждане", "население",
    "статистика", "исследование", "опрос", "данные",
    # Эмоционально окрашенные (умеренно)
    "значимый", "существенный", "заметный", "очевидный",
    "нашумевший", "резонансный", "беспрецедентный",
]

# НАУЧНЫЙ СТИЛЬ
SCIENTIFIC_MARKERS = [
    # Вводные и связующие конструкции
    "таким образом", "следовательно", "в данном исследовании",
    "в результате анализа", "как показали исследования",
    "на основании полученных данных", "в ходе эксперимента",
    "в частности", "в том числе", "в отличие от",
    "по сравнению с", "при условии", "в зависимости от",
    # Глаголы научной речи
    "проанализировать", "выявить", "определить", "установить",
    "подтвердить", "опровергнуть", "предположить",
    "классифицировать", "систематизировать", "обобщить",
    "экспериментировать", "наблюдать", "измерять",
    "вычислить", "смоделировать", "спрогнозировать",
    # Существительные
    "гипотеза", "теория", "концепция", "методология",
    "эксперимент", "исследование", "анализ", "синтез",
    "выборка", "корреляция", "погрешность", "переменная",
    "закономерность", "тенденция", "фактор", "критерий",
    # Прилагательные
    "эмпирический", "теоретический", "статистический",
    "количественный", "качественный", "существенный",
    "достоверный", "значимый", "репрезентативный",
    "экспериментальный", "лабораторный", "полевой",
]

# НЕЙТРАЛЬНЫЙ СТИЛЬ
NEUTRAL_MARKERS = [
    # Стандартные связки
    "можно сказать", "с другой стороны", "например",
    "в целом", "как правило", "в большинстве случаев",
    "стоит заметить", "вместе с тем", "в свою очередь",
    "по сути", "в принципе", "в общем",
    # Нейтральные глаголы
    "является", "находится", "существует", "имеется",
    "представляет собой", "относится к", "включает",
    "состоит из", "характеризуется", "отличается",
    # Нейтральные существительные
    "объект", "предмет", "явление", "процесс",
    "свойство", "характеристика", "особенность",
    "структура", "элемент", "компонент", "часть",
    # Оценочная лексика (слабая)
    "хороший", "плохой", "важный", "нужный",
    "интересный", "простой", "сложный", "понятный",
]

# РАЗГОВОРНЫЙ СТИЛЬ
INFORMAL_MARKERS = [
    # Разговорные слова и выражения
    "ваще", "короче", "типа", "нафиг", "блин", "прикол", "кайф",
    "ладно", "давай", "окей", "нормально", "супер", "классно",
    "жесть", "прям", "реально", "вообще-то", "по ходу",
    "типа того", "как бы", "прикинь", "в натуре",
    "конкретно", "по-любому", "чё", "щас", "такой",
    # Сленг и просторечия
    "круто", "отстой", "фигня", "ерунда", "чума",
    "улёт", "зашибись", "капец", "мрак", "дичь",
    "зашло", "не зашло", "тащить", "топчик",
    "хайп", "краш", "кринж", "рофл", "вайб",
    # Уменьшительно-ласкательные
    "словечко", "текстик", "работка", "статейка",
    "времечко", "делишки", "нормальненько", "хорошенько",
    "чуть-чуть", "капельку", "немножко", "быстренько",
    # Частицы и междометия
    "ага", "ну", "вот", "ох", "эх", "ой", "ух ты",
    "ничего себе", "вот это да", "да ну", "ну-ка",
]

# ХУДОЖЕСТВЕННЫЙ СТИЛЬ
LITERARY_MARKERS = [
    # Метафоры и образные выражения
    "душа поёт", "сердце замирает", "мысль летит",
    "время течёт", "ветер шепчет", "звезды мерцают",
    "солнце встаёт", "туман стелется", "дождь барабанит",
    # Эпитеты
    "несказанный", "неописуемый", "дивный", "чудный",
    "пленительный", "чарующий", "ослепительный",
    "таинственный", "загадочный", "неведомый",
    "безмятежный", "трепетный", "томный",
    # Архаизмы и книжная лексика
    "очи", "уста", "ланиты", "десница", "чело",
    "сударь", "сударыня", "ведать", "молвить",
    "ныне", "отныне", "впредь", "доселе",
    "ибо", "поелику", "дабы", "токмо",
    # Художественные обороты
    "взор", "грёзы", "мечты", "воспоминания",
    "размышления", "созерцание", "томление",
    "благоухание", "сияние", "мерцание",
    "как будто", "словно", "точно", "подобно",
]

# ПРИЗНАКИ ДЛЯ ДОПОЛНИТЕЛЬНОГО АНАЛИЗА
PASSIVE_MARKERS = [
    "был", "была", "было", "были", "будет", "будут",
    "является", "являются", "считается", "считаются",
    "рассматривается", "рассматриваются", "определяется",
    "определяются", "называется", "называются",
]

PERSONAL_PRONOUNS = [
    "я", "ты", "он", "она", "оно", "мы", "вы", "они",
    "меня", "тебя", "его", "её", "нас", "вас", "их",
    "мне", "тебе", "ему", "ей", "нам", "вам", "им",
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

        # Канцеляризмы и вода
    if 'water' in functions:
        lower_text = text.lower()
        total_words = len(text.split())
        found_phrases = []
        
        for phrase, replacement in WATER_PHRASES:
            start = 0
            while True:
                pos = lower_text.find(phrase, start)
                if pos == -1:
                    break
                
                # Проверяем границы слова: до и после фразы должны быть разделители
                before_ok = (pos == 0 or 
                           lower_text[pos-1] in ' \n\t,.;:!?—()"\'«»')
                after_ok = (pos + len(phrase) >= len(lower_text) or 
                          lower_text[pos + len(phrase)] in ' \n\t,.;:!?—()"\'«»')
                
                if before_ok and after_ok:
                    # Определяем категорию фразы
                    category = "прочее"
                    for cat, phrases in WATER_CATEGORIES.items():
                        if phrase in phrases:
                            category = cat
                            break
                    
                    found_phrases.append({
                        "phrase": phrase,
                        "position": pos,
                        "recommendation": replacement,
                        "category": category
                    })
                    
                    result["recommendations"].append({
                        "type": "water",
                        "description": f'Канцеляризм "{phrase}"',
                        "suggested_change": f'Замените на "{replacement}"' if replacement else "Удалите без потери смысла",
                        "position": pos
                    })
                
                start = pos + 1
        
        # Сортируем по позиции в тексте
        found_phrases.sort(key=lambda x: x["position"])
        result["water_phrases"] = found_phrases
        
        # Процент воды
        water_word_count = sum(len(p["phrase"].split()) for p in found_phrases)
        water_percentage = round(water_word_count / max(1, total_words) * 100, 1)
        
        # Определяем уровень засорённости
        if water_percentage < WATER_THRESHOLDS["clean"]:
            water_level = "clean"
            water_description = "Текст чистый, без лишней воды"
        elif water_percentage < WATER_THRESHOLDS["mild"]:
            water_level = "mild"
            water_description = "Есть небольшая избыточность"
        elif water_percentage < WATER_THRESHOLDS["heavy"]:
            water_level = "heavy"
            water_description = "Много канцеляризмов, текст нужно облегчить"
        else:
            water_level = "critical"
            water_description = "Текст перегружен канцеляризмами, требуется серьёзная переработка"
        
        result["water_stats"] = {
            "total_phrases": len(found_phrases),
            "percentage": water_percentage,
            "level": water_level,
            "description": water_description,
            "by_category": {}
        }
        
        # Считаем по категориям
        for p in found_phrases:
            cat = p["category"]
            result["water_stats"]["by_category"][cat] = result["water_stats"]["by_category"].get(cat, 0) + 1

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

    # Стиль: расширенный rule-based анализ
    if 'style' in functions:
        lower_text = text.lower()
        
        # Подсчёт маркеров для всех шести стилей
        formal_hits = sum(1 for m in FORMAL_MARKERS if m in lower_text)
        journalistic_hits = sum(1 for m in JOURNALISTIC_MARKERS if m in lower_text)
        scientific_hits = sum(1 for m in SCIENTIFIC_MARKERS if m in lower_text)
        neutral_hits = sum(1 for m in NEUTRAL_MARKERS if m in lower_text)
        informal_hits = sum(1 for m in INFORMAL_MARKERS if m in lower_text)
        literary_hits = sum(1 for m in LITERARY_MARKERS if m in lower_text)
        
        # Дополнительные метрики
        words = text.split()
        total_words = len(words)
        
        # Пассивный залог
        passive_count = sum(1 for m in PASSIVE_MARKERS 
                          if re.search(rf'\b{re.escape(m)}\b', lower_text))
        passive_ratio = passive_count / max(1, total_words)
        
        # Личные местоимения
        pronoun_count = sum(1 for m in PERSONAL_PRONOUNS 
                          if re.search(rf'\b{re.escape(m)}\b', lower_text))
        pronoun_ratio = pronoun_count / max(1, total_words)
        
        # Средняя длина слова
        avg_word_len = sum(len(w) for w in words) / max(1, total_words)
        
        # Natasha: соотношение частей речи
        doc = Doc(text)
        doc.segment(segmenter)
        doc.tag_morph(morph_tagger)
        
        verb_count = 0
        noun_count = 0
        adj_count = 0
        adv_count = 0
        
        for token in doc.tokens:
            pos = token.pos
            if pos == 'VERB':
                verb_count += 1
            elif pos == 'NOUN':
                noun_count += 1
            elif pos == 'ADJ':
                adj_count += 1
            elif pos == 'ADV':
                adv_count += 1
        
        total_tagged = verb_count + noun_count + adj_count + adv_count
        verb_ratio = verb_count / max(1, total_tagged) if total_tagged > 0 else 0
        noun_ratio = noun_count / max(1, total_tagged) if total_tagged > 0 else 0
        adj_ratio = adj_count / max(1, total_tagged) if total_tagged > 0 else 0
        
        # Коэффициент глагольности (чем выше — тем разговорнее)
        verbality = verb_ratio / max(0.01, noun_ratio)
        
        # Подсчёт весов с учётом всех метрик
        scores = {
            "formal": formal_hits * 2.0 + passive_ratio * 30 - verbality * 5,
            "journalistic": journalistic_hits * 1.8 + adj_ratio * 10,
            "scientific": scientific_hits * 2.0 + (avg_word_len > 7) * 10 
                         + noun_ratio * 15 - verbality * 5,
            "neutral": neutral_hits * 1.5 + 2,
            "informal": informal_hits * 1.8 + pronoun_ratio * 25 
                       + verbality * 8 - noun_ratio * 5,
            "literary": literary_hits * 2.0 + adj_ratio * 12,
        }
        
        # Определяем стиль с максимальным весом
        style_label = max(scores, key=scores.get)
        max_score = scores[style_label]
        
        # Если все счета низкие — нейтральный
        if max_score < 5:
            style_label = "neutral"
            max_score = 5
        
        # Уверенность
        confidence = min(0.95, 0.5 + max_score / 40)
        
        # Читаемые названия
        STYLE_LABELS_RU = {
            "formal": "Официальный",
            "journalistic": "Публицистический",
            "scientific": "Научный",
            "neutral": "Нейтральный",
            "informal": "Разговорный",
            "literary": "Художественный",
        }
        
        result["style"] = {
            "style": style_label,
            "confidence": round(confidence, 2),
            "label": STYLE_LABELS_RU.get(style_label, style_label),
            "scores": {k: round(v, 1) for k, v in scores.items()}
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