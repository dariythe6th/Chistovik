// longSentenceAnalyzer.js - Поиск длинных предложений

const LongSentenceAnalyzer = (function() {
    // Порог длины предложения в словах
    const DEFAULT_MAX_WORDS = 20;

    function findLongSentences(text, maxWords = DEFAULT_MAX_WORDS) {
        if (!text) return [];
        // Разбиваем на предложения по .!? и …
        const sentences = text.split(/(?<=[.!?…])\s+/);
        const results = [];
        let globalPos = 0;

        for (let sent of sentences) {
            const trimmed = sent.trim();
            if (trimmed.length === 0) continue;
            const words = trimmed.split(/\s+/).filter(w => w.length > 0);
            const wordCount = words.length;
            if (wordCount > maxWords) {
                // Находим позицию начала предложения в исходном тексте
                let startPos = text.indexOf(trimmed, globalPos);
                if (startPos === -1) {
                    // fallback: поиск по первому слову
                    const firstWord = words[0];
                    startPos = text.indexOf(firstWord, globalPos);
                }
                results.push({
                    text: trimmed.substring(0, 150), // обрезаем для краткости
                    wordCount: wordCount,
                    position: startPos >= 0 ? startPos : 0
                });
            }
            // Сдвигаем глобальную позицию (приблизительно)
            globalPos = text.indexOf(trimmed, globalPos) + trimmed.length;
        }
        return results;
    }

    return { findLongSentences };
})();

if (typeof window !== 'undefined') {
    window.LongSentenceAnalyzer = LongSentenceAnalyzer;
}