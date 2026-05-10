const RewriteAnalyzer = (function () {
    const replacements = {
        formal: [
            ["короче", "вкратце"],
            ["типа", "например"],
            ["щас", "сейчас"],
            ["чтоб", "чтобы"],
            ["вообще", "в целом"]
        ],
        journalistic: [
            ["в настоящее время", "сегодня"],
            ["осуществлять", "проводить"],
            ["является", "остается"],
            ["необходимо", "важно"],
            ["данный", "этот"]
        ],
        scientific: [
            ["я думаю", "можно предположить"],
            ["мне кажется", "представляется"],
            ["очень", "значительно"],
            ["просто", "относительно"],
            ["показывает", "демонстрирует"]
        ],
        colloquial: [
            ["вследствие", "из-за"],
            ["осуществлять", "делать"],
            ["представляется", "кажется"],
            ["необходимо", "нужно"],
            ["следует", "надо"]
        ],
        literary: [
            ["сейчас", "ныне"],
            ["очень", "необычайно"],
            ["быстро", "стремительно"],
            ["важно", "существенно"],
            ["проблема", "затруднение"]
        ]
    };

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function rewriteText(text, style) {
        if (!text || !text.trim()) return text;
        let rewritten = text;
        const styleReplacements = replacements[style] || [];

        styleReplacements.forEach(([from, value]) => {
            rewritten = rewritten.replace(new RegExp(escapeRegExp(from), "gi"), value);
        });

        if (rewritten === text) {
            // Гарантируем видимое изменение даже если точечных замен не было.
            if (style === "formal") {
                rewritten = `Следует отметить, что ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
            } else if (style === "scientific") {
                rewritten = `Проведенный анализ показывает, что ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
            } else if (style === "journalistic") {
                rewritten = `Сегодня особенно важно подчеркнуть: ${text}`;
            } else if (style === "colloquial") {
                rewritten = `Если проще, то ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
            } else if (style === "literary") {
                rewritten = `Как будто между строк звучит мысль: ${text}`;
            }
        }

        return rewritten;
    }

    return { rewriteText };
})();

if (typeof window !== "undefined") {
    window.RewriteAnalyzer = RewriteAnalyzer;
}
