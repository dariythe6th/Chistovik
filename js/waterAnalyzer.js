// waterAnalyzer.js - Поиск "воды" и канцеляризмов

const WaterAnalyzer = (function() {
    // Список фраз-канцеляризмов и "воды"
    const waterPhrases = [
        { phrase: 'в настоящее время', replacement: 'сейчас' },
        { phrase: 'в настоящий момент', replacement: 'сейчас' },
        { phrase: 'принимать во внимание', replacement: 'учитывать' },
        { phrase: 'включает в себя', replacement: 'содержит' },
        { phrase: 'с целью', replacement: 'для' },
        { phrase: 'в соответствии с', replacement: 'по' },
        { phrase: 'в рамках', replacement: 'в' },
        { phrase: 'в связи с тем что', replacement: 'так как' },
        { phrase: 'вследствие того что', replacement: 'из-за того что' },
        { phrase: 'на сегодняшний день', replacement: 'сейчас' },
        { phrase: 'имеет место', replacement: 'есть' },
        { phrase: 'осуществлять', replacement: 'делать' },
        { phrase: 'производить', replacement: 'делать' },
        { phrase: 'является', replacement: '—' } // можно заменять на тире или убирать
    ];

    function findWaterPhrases(text) {
        if (!text) return [];
        const lowerText = text.toLowerCase();
        const results = [];

        for (let item of waterPhrases) {
            const phrase = item.phrase;
            const replacement = item.replacement;
            let index = lowerText.indexOf(phrase);
            while (index !== -1) {
                results.push({
                    phrase: phrase,
                    position: index,
                    recommendation: replacement
                });
                index = lowerText.indexOf(phrase, index + 1);
            }
        }
        // Удаляем дубликаты по позиции (если одна фраза найдена несколько раз – оставляем)
        const unique = [];
        const positions = new Set();
        for (let res of results) {
            if (!positions.has(res.position)) {
                positions.add(res.position);
                unique.push(res);
            }
        }
        return unique;
    }

    return { findWaterPhrases };
})();

if (typeof window !== 'undefined') {
    window.WaterAnalyzer = WaterAnalyzer;
}