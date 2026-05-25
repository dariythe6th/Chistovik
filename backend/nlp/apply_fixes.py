"""
Применение исправлений орфографии и канцеляризмов к тексту (единая логика для API и тестов).
"""
import re
from typing import Any, Dict, List, Tuple


def _ranges_overlap(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return not (a_end <= b_start or b_end <= a_start)


def _match_case(original: str, replacement: str) -> str:
    if not original or not replacement:
        return replacement
    if original[0].isupper():
        return replacement[:1].upper() + replacement[1:]
    return replacement


def _pick_spelling_suggestion(word: str, suggestions: List[str]) -> str | None:
    if not suggestions:
        return None
    clean = [s for s in suggestions if s and s.strip()]
    if not clean:
        return None
    w_lower = word.lower()
    # Сохраняем падеж/число по окончанию (Ошыбки → Ошибки, не Ошибке)
    if len(w_lower) >= 2:
        ending = w_lower[-1]
        for s in clean:
            if s.lower().endswith(ending):
                return _match_case(word, s)
    # Близкая по длине замена
    clean.sort(key=lambda s: abs(len(s) - len(word)))
    best = clean[0]
    return _match_case(word, best)


def collect_fixes_from_analysis(analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    fixes: List[Dict[str, Any]] = []

    for err in analysis.get("spelling_errors") or []:
        pos = err.get("position")
        word = err.get("word") or ""
        if pos is None or pos < 0 or not word:
            continue
        replacement = _pick_spelling_suggestion(word, err.get("suggestions") or [])
        if not replacement:
            continue
        fixes.append({
            "position": int(pos),
            "length": len(word),
            "original": word,
            "replacement": replacement,
            "type": "spelling",
        })

    for wp in analysis.get("water_phrases") or []:
        pos = wp.get("position")
        phrase = wp.get("phrase") or ""
        repl = wp.get("recommendation")
        if pos is None or pos < 0 or not phrase:
            continue
        if repl == "—":
            continue
        fixes.append({
            "position": int(pos),
            "length": len(phrase),
            "original": phrase,
            "replacement": repl if repl is not None else "",
            "type": "water",
        })

    return fixes


def merge_and_validate_fixes(fixes: List[Dict[str, Any]], text: str) -> List[Dict[str, Any]]:
    valid = [
        f for f in fixes
        if f.get("original")
        and f.get("length", 0) > 0
        and text[f["position"] : f["position"] + f["length"]].lower() == f["original"].lower()
    ]

    valid.sort(
        key=lambda f: (
            -f["length"],
            0 if f.get("type") == "spelling" else 1,
            f["position"],
        )
    )

    accepted: List[Dict[str, Any]] = []
    for fix in valid:
        end = fix["position"] + fix["length"]
        if any(
            _ranges_overlap(fix["position"], end, a["position"], a["position"] + a["length"])
            for a in accepted
        ):
            continue
        accepted.append(fix)

    accepted.sort(key=lambda f: -f["position"])
    return accepted


def apply_fixes_to_text(text: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
    """
    Возвращает исправленный текст и список применённых замен.
    """
    fixes = collect_fixes_from_analysis(analysis)
    merged = merge_and_validate_fixes(fixes, text)

    result = text
    applied: List[Dict[str, Any]] = []

    for fix in merged:
        pos = fix["position"]
        length = fix["length"]
        fragment = result[pos : pos + length]
        if fragment.lower() != fix["original"].lower():
            continue

        replacement = fix["replacement"]
        result = result[:pos] + replacement + result[pos + length :]
        applied.append({
            "position": pos,
            "length": len(replacement),
            "original": fix["original"],
            "replacement": replacement,
            "type": fix.get("type"),
        })

    result = re.sub(r"([.!?])([А-ЯЁ])", r"\1 \2", result)
    result = re.sub(r" {2,}", " ", result).strip()

    # Позиции в applied пересчитываем по финальному тексту (после пунктуации)
    applied_final: List[Dict[str, Any]] = []
    for fix in merged:
        repl = fix["replacement"]
        if not repl:
            continue
        hint = fix["position"]
        idx = result.find(repl, max(0, hint - 3))
        if idx < 0:
            idx = result.lower().find(repl.lower())
        if idx < 0:
            continue
        applied_final.append({
            "position": idx,
            "length": len(repl),
            "original": fix["original"],
            "replacement": repl,
            "type": fix.get("type"),
        })

    return {
        "fixed_text": result,
        "applied": applied_final,
        "applied_count": len(applied_final),
        "engine": "dict-v3",
    }
