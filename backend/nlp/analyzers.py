import httpx
import os
import logging
import re
from typing import List, Dict, Any, Tuple

logger = logging.getLogger("chistovik.nlp")

_LIGHT_MODE = os.getenv("CHISTOVIK_LIGHT_NLP", "").lower() in {"1", "true", "yes"}
tool = None
_lt_init_error: str | None = None
morph = None
segmenter = None
morph_tagger = None

if not _LIGHT_MODE:
    try:
        import language_tool_python
        import pymorphy2
        from natasha import Segmenter, NewsEmbedding, NewsMorphTagger, Doc

        try:
            tool = language_tool_python.LanguageTool("ru-RU")
        except Exception as e:
            _lt_init_error = f"{type(e).__name__}: {e}"
            tool = None
            logger.warning("LanguageTool local init failed: %s", _lt_init_error)

        morph = pymorphy2.MorphAnalyzer()
        segmenter = Segmenter()
        emb = NewsEmbedding()
        morph_tagger = NewsMorphTagger(emb)
    except Exception as e:
        _LIGHT_MODE = True
        logger.warning("NLP heavy deps unavailable, using light mode: %s", e)
else:
    logger.info("CHISTOVIK_LIGHT_NLP enabled — rule-based analysis only")

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
    "севодня": "сегодня",
    "рассматрваем": "рассматриваем",
    "рассматрвает": "рассматривает",
    "ошыбки": "ошибки",
    "ошыбка": "ошибка",
    "могуть": "могут",
    "поэтомы": "поэтому",
    "пишит": "пишет",
    "потомму": "потому",
    "потомо": "потом",
    "хатите": "хотите",
    "хочите": "хотите",
    "тренажорный": "тренажёрный",
    "тренажорная": "тренажёрная",
    "тренажорное": "тренажёрное",
    "тренажорные": "тренажёрные",
    "тренажорном": "тренажёрном",
    "тренажорного": "тренажёрного",
    "здраствуйте": "здравствуйте",
    "здраствуй": "здравствуй",
    "пожалуста": "пожалуйста",
    "пожалуйсто": "пожалуйста",
    "вообщемто": "в общем-то",
    "когданибуть": "когда-нибудь",
    "какнибуть": "как-нибудь",
    "что-бы": "чтобы",
    "чтоби": "чтобы",
    "в течении": "в течение",
    "впринципе": "в принципе",
    "вобщем": "в общем",
    "зделать": "сделать",
}

# Контекстные ошибки (фраза целиком)
SPELLING_PHRASE_PATTERNS = [
    (
        r"(?<![а-яё])это\s+полезна(?![а-яё])",
        "это полезно",
        'После «это» нужен средний род: «полезно»',
    ),
    (
        r"(?<![а-яё])это\s+полезен(?![а-яё])",
        "это полезно",
        'После «это» нужен средний род: «полезно»',
    ),
    (
        r"(?<![а-яё])это\s+полезны(?![а-яё])",
        "это полезно",
        'После «это» нужен средний род: «полезно»',
    ),
]


def _ranges_overlap(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return not (a_end <= b_start or b_end <= a_start)


def _match_case_fragment(original: str, replacement: str) -> str:
    """Сохраняет регистр первой буквы фрагмента."""
    if not original or not replacement:
        return replacement
    if original[0].isupper():
        return replacement[:1].upper() + replacement[1:]
    return replacement


def _pick_spelling_suggestions(word: str, raw: List[str]) -> List[str]:
    """Упорядочивает подсказки: предпочтение той же форме (Ошыбки → Ошибки)."""
    clean = [s for s in raw if s and str(s).strip()]
    if not clean:
        return []
    w_lower = word.lower()
    if len(w_lower) >= 2:
        end = w_lower[-1]
        same_ending = [s for s in clean if str(s).lower().endswith(end)]
        if same_ending:
            rest = [s for s in clean if s not in same_ending]
            return same_ending + rest
    return clean


def _append_spelling_error(
    result: Dict[str, Any],
    *,
    word: str,
    position: int,
    suggestions: List[str],
    description: str,
    occupied: List[Tuple[int, int]],
    source_text: str = "",
) -> bool:
    """Добавляет ошибку, если диапазон не пересекается с уже найденными."""
    if source_text and position >= 0:
        fragment = source_text[position:position + len(word)]
        if fragment.lower() != word.lower():
            return False
    end = position + len(word)
    if any(_ranges_overlap(position, end, s, e) for s, e in occupied):
        return False
    ordered = _pick_spelling_suggestions(word, suggestions)
    if not ordered:
        return False
    occupied.append((position, end))
    result["spelling_errors"].append({
        "word": word,
        "position": position,
        "suggestions": ordered,
        "description": description,
    })
    result["recommendations"].append({
        "type": "spelling",
        "description": description,
        "suggested_change": ", ".join(ordered),
        "position": position,
    })
    return True


def _find_water_phrases(text: str) -> List[Dict[str, Any]]:
    """Ищет канцеляризмы без пересекающихся вхождений (сначала длинные фразы)."""
    lower_text = text.lower()
    found: List[Dict[str, Any]] = []
    occupied: List[Tuple[int, int]] = []

    for phrase, replacement in sorted(WATER_PHRASES, key=lambda p: len(p[0]), reverse=True):
        start = 0
        while True:
            pos = lower_text.find(phrase, start)
            if pos == -1:
                break

            before_ok = pos == 0 or lower_text[pos - 1] in " \n\t,.;:!?—()\"'«»"
            after_pos = pos + len(phrase)
            after_ok = after_pos >= len(lower_text) or lower_text[after_pos] in " \n\t,.;:!?—()\"'«»"

            if before_ok and after_ok:
                end = after_pos
                if not any(_ranges_overlap(pos, end, s, e) for s, e in occupied):
                    category = "прочее"
                    for cat, phrases in WATER_CATEGORIES.items():
                        if phrase in phrases:
                            category = cat
                            break
                    found.append({
                        "phrase": text[pos:after_pos],
                        "position": pos,
                        "recommendation": replacement,
                        "category": category,
                    })
                    occupied.append((pos, end))
            start = pos + len(phrase)

    found.sort(key=lambda x: x["position"])
    return found

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
            count += len(re.findall(rf"\b{re.escape(marker)}\b", text_lower))
    return count


# Бытовые короткие реплики (не научный/официальный стиль)
_CASUAL_PHRASE_PATTERNS = [
    r"\bпривет\b",
    r"\bприветик\b",
    r"\bздаров",
    r"\bздравствуй",
    r"\bкак\s+дела\b",
    r"\bчё\s+как\b",
    r"\bчо\s+как\b",
    r"\bкак\s+ты\b",
    r"\bкак\s+сам\b",
    r"\bчто\s+делаешь\b",
    r"\bкак\s+жизнь\b",
    r"\bхай\b",
    r"\bйо\b",
    r"\bнорм\b",
    r"\bокей\b",
    r"\bспасибо\b",
    r"\bпока\b",
]


def _is_casual_short_text(lower_text: str, total_words: int) -> bool:
    """Короткие разговорные сообщения без признаков деловой/научной речи."""
    if total_words > 12:
        return False
    if any(re.search(p, lower_text) for p in _CASUAL_PHRASE_PATTERNS):
        return True
    # Несколько коротких слов без канцеляризмов — обычно разговорная речь
    if total_words <= 6 and not _count_markers(lower_text, FORMAL_MARKERS + SCIENTIFIC_MARKERS):
        avg_len = sum(len(w) for w in lower_text.split()) / max(1, total_words)
        if avg_len <= 6:
            return True
    return False


STYLE_LABELS_RU = {
    "formal": "Официальный",
    "journalistic": "Публицистический",
    "scientific": "Научный",
    "neutral": "Нейтральный",
    "informal": "Разговорный",
    "literary": "Художественный",
}


def _classify_style(
    text: str,
    *,
    use_morph: bool,
    segmenter_ref,
    morph_tagger_ref,
) -> Dict[str, Any]:
    lower_text = text.lower()
    words = text.split()
    total_words = len(words)

    if _is_casual_short_text(lower_text, total_words):
        return {
            "style": "informal",
            "confidence": 0.85,
            "label": STYLE_LABELS_RU["informal"],
            "scores": {"informal": 10.0},
        }

    formal_hits = _count_markers(lower_text, FORMAL_MARKERS)
    journalistic_hits = _count_markers(lower_text, JOURNALISTIC_MARKERS)
    scientific_hits = _count_markers(lower_text, SCIENTIFIC_MARKERS)
    neutral_hits = _count_markers(lower_text, NEUTRAL_MARKERS)
    informal_hits = _count_markers(lower_text, INFORMAL_MARKERS)
    literary_hits = _count_markers(lower_text, LITERARY_MARKERS)

    passive_count = sum(
        1 for m in PASSIVE_MARKERS if re.search(rf"\b{re.escape(m)}\b", lower_text)
    )
    passive_ratio = passive_count / max(1, total_words)

    pronoun_count = sum(
        1 for m in PERSONAL_PRONOUNS if re.search(rf"\b{re.escape(m)}\b", lower_text)
    )
    pronoun_ratio = pronoun_count / max(1, total_words)

    avg_word_len = sum(len(w) for w in words) / max(1, total_words)

    verb_ratio = noun_ratio = adj_ratio = verbality = 0.0
    morph_ok = use_morph and total_words >= 10 and segmenter_ref is not None and morph_tagger_ref is not None

    if morph_ok:
        from natasha import Doc

        doc = Doc(text)
        doc.segment(segmenter_ref)
        doc.tag_morph(morph_tagger_ref)

        verb_count = noun_count = adj_count = adv_count = 0
        for token in doc.tokens:
            pos = token.pos
            if pos == "VERB":
                verb_count += 1
            elif pos == "NOUN":
                noun_count += 1
            elif pos == "ADJ":
                adj_count += 1
            elif pos == "ADV":
                adv_count += 1

        total_tagged = verb_count + noun_count + adj_count + adv_count
        if total_tagged > 0:
            verb_ratio = verb_count / total_tagged
            noun_ratio = noun_count / total_tagged
            adj_ratio = adj_count / total_tagged
            verbality = verb_ratio / max(0.01, noun_ratio)

    # Морфологические бонусы только для достаточно длинных текстов
    morph_weight = 1.0 if total_words >= 10 else 0.0

    scores = {
        "formal": formal_hits * 2.0 + passive_ratio * 30 * morph_weight - verbality * 5 * morph_weight,
        "journalistic": journalistic_hits * 1.8 + adj_ratio * 10 * morph_weight,
        "scientific": scientific_hits * 2.0 + (avg_word_len > 7) * 10 + noun_ratio * 15 * morph_weight
        - verbality * 5 * morph_weight,
        "neutral": neutral_hits * 1.5 + (2 if total_words >= 10 else 0.5),
        "informal": informal_hits * 1.8 + pronoun_ratio * 25 + verbality * 8 * morph_weight
        - noun_ratio * 5 * morph_weight,
        "literary": literary_hits * 2.0 + adj_ratio * 12 * morph_weight,
    }

    style_label = max(scores, key=scores.get)
    max_score = scores[style_label]

    if max_score < 3:
        style_label = "neutral"
        max_score = 3

    confidence = min(0.95, 0.5 + max_score / 40)

    return {
        "style": style_label,
        "confidence": round(confidence, 2),
        "label": STYLE_LABELS_RU.get(style_label, style_label),
        "scores": {k: round(v, 1) for k, v in scores.items()},
    }

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

    # Орфография: по умолчанию только словарь (в Docker LT давал ложные пересечения)
    dictionary_only = os.getenv("CHISTOVIK_SPELLING_DICTIONARY_ONLY", "1").lower() in {"1", "true", "yes"}
    use_lt = (
        not dictionary_only
        and os.getenv("ENABLE_LANGUAGETOOL", "").lower() in {"1", "true", "yes"}
    )

    if 'spelling' in functions:
        spelling_occupied: List[Tuple[int, int]] = []

        lower_text = text.lower()
        for wrong, correct in sorted(COMMON_MISSPELLINGS.items(), key=lambda p: -len(p[0])):
            for match in re.finditer(rf"(?<![а-яё]){re.escape(wrong)}(?![а-яё])", lower_text):
                orig = text[match.start():match.end()]
                fixed = _match_case_fragment(orig, correct)
                _append_spelling_error(
                    result,
                    word=orig,
                    position=match.start(),
                    suggestions=[fixed],
                    description=f'Возможно, имелось в виду «{fixed}»',
                    occupied=spelling_occupied,
                    source_text=text,
                )

        for pattern, replacement, description in SPELLING_PHRASE_PATTERNS:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                orig = text[match.start():match.end()]
                fixed = _match_case_fragment(orig, replacement)
                _append_spelling_error(
                    result,
                    word=orig,
                    position=match.start(),
                    suggestions=[fixed],
                    description=description,
                    occupied=spelling_occupied,
                    source_text=text,
                )

        if use_lt and tool is not None:
            try:
                for match in tool.check(text):
                    error_word = text[match.offset:match.offset + match.errorLength]
                    if error_word.lower() != text[match.offset:match.offset + match.errorLength].lower():
                        continue
                    repl = match.replacements[:3]
                    if not repl:
                        continue
                    desc = match.message
                    if "аналогичной по начертанию" in desc:
                        desc = "Найдена буква из другого алфавита, похожая на русскую"
                    _append_spelling_error(
                        result,
                        word=error_word,
                        position=match.offset,
                        suggestions=repl,
                        description=f"Ошибка: {desc}",
                        occupied=spelling_occupied,
                        source_text=text,
                    )
            except Exception as e:
                logger.warning("LanguageTool local check failed: %s", f"{type(e).__name__}: {e}")

        if use_lt:
            try:
                for m in _check_with_public_languagetool(text):
                    offset = m["offset"]
                    length = m["length"]
                    error_word = text[offset:offset + length]
                    if not error_word:
                        continue
                    repl = m["replacements"]
                    if not repl:
                        continue
                    desc = m["message"]
                    if "аналогичной по начертанию" in desc:
                        desc = "Найдена буква из другого алфавита, похожая на русскую"
                    _append_spelling_error(
                        result,
                        word=error_word,
                        position=offset,
                        suggestions=repl,
                        description=f"Ошибка: {desc}",
                        occupied=spelling_occupied,
                        source_text=text,
                    )
            except Exception as e:
                logger.warning("LanguageTool public check failed: %s", f"{type(e).__name__}: {e}")

    # Канцеляризмы и вода
    if 'water' in functions:
        total_words = len(text.split())
        found_phrases = _find_water_phrases(text)
        result["water_phrases"] = found_phrases

        for wp in found_phrases:
            repl = wp["recommendation"]
            result["recommendations"].append({
                "type": "water",
                "description": f'Канцеляризм "{wp["phrase"]}"',
                "suggested_change": f'Замените на "{repl}"' if repl else "Удалите без потери смысла",
                "position": wp["position"],
            })
        
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
        style_info = _classify_style(
            text,
            use_morph=not _LIGHT_MODE,
            segmenter_ref=segmenter,
            morph_tagger_ref=morph_tagger,
        )
        result["style"] = style_info
        result["recommendations"].append({
            "type": "style",
            "description": f"Стиль текста: {style_info['label']}",
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