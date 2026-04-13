// api.js - Слой работы с данными (реализованы базовые анализаторы)

const API = {
    // Анализ текста
    analyzeText: async (text, selectedFunctions) => {
        // Имитация задержки сети
        await new Promise(resolve => setTimeout(resolve, 800));

        // Базовая статистика
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const characters = text.length;

        // Результаты по модулям
        let spellingErrors = [];
        let waterPhrases = [];
        let longSentences = [];
        let styleResult = null;
        let toneResult = null;
        let syntaxResult = null;
        
        // Простая имитация орфографических ошибок (встроенный список)
        if (selectedFunctions.includes('spelling')) {
            spellingErrors = simulateSpellingErrors(text);
        }
        
        // Поиск воды
        if (selectedFunctions.includes('water') && window.WaterAnalyzer) {
            waterPhrases = window.WaterAnalyzer.findWaterPhrases(text);
        }
        
        // Длинные предложения
        if (selectedFunctions.includes('long_sentences') && window.LongSentenceAnalyzer) {
            longSentences = window.LongSentenceAnalyzer.findLongSentences(text, 20);
        }
        
        // Стиль (всегда, если выбран)
        if (selectedFunctions.includes('style') && window.StyleAnalyzer) {
            styleResult = window.StyleAnalyzer.analyzeStyle(text);
        } else if (selectedFunctions.includes('style')) {
            // fallback, если модуль не загружен
            styleResult = { style: 'neutral', confidence: 50 };
        }
        
        // Тональность (заглушка)
        if (selectedFunctions.includes('tone') && window.ToneAnalyzer) {
            toneResult = window.ToneAnalyzer.analyzeTone(text);
        } else if (selectedFunctions.includes('tone')) {
            toneResult = { tone: 'нейтральная', confidence: 50 };
        }
        
        // Синтаксис (заглушка)
        if (selectedFunctions.includes('syntax') && window.SyntaxAnalyzer) {
            syntaxResult = window.SyntaxAnalyzer.analyzeSyntax(text);
        } else if (selectedFunctions.includes('syntax')) {
            syntaxResult = { issues: [], complex_count: 0 };
        }
        
        // Вычисляем читаемость (упрощённая формула Флеша для русского)
        let readabilityScore = calculateReadability(text);
        let readabilityLevel = getReadabilityLevel(readabilityScore);
        
        // Формируем список рекомендаций (каждый объект - отдельный совет)
        let recommendations = [];
        
        // Орфографические ошибки – по одной рекомендации на каждую
        for (let err of spellingErrors) {
            recommendations.push({
                type: 'spelling',
                description: `Ошибка в слове "${err.word}"`,
                suggested_change: err.suggestions.join(', ') || 'Проверьте написание',
                position: err.position
            });
        }
        
        // Водные фразы – по одной рекомендации на каждую
        for (let wp of waterPhrases) {
            recommendations.push({
                type: 'water',
                description: `Канцеляризм / "вода": "${wp.phrase}"`,
                suggested_change: `Замените на: "${wp.recommendation}"`,
                position: wp.position
            });
        }
        
        // Длинные предложения – по одной рекомендации на каждое
        for (let ls of longSentences) {
            recommendations.push({
                type: 'long_sentence',
                description: `Длинное предложение (${ls.wordCount} слов)`,
                suggested_change: 'Разбейте на 2-3 коротких предложения',
                position: ls.position
            });
        }
        
        // Стиль – одна рекомендация
        if (styleResult) {
            let styleLabel = (styleResult.style === 'formal') ? 'Официальный' : (styleResult.style === 'informal') ? 'Разговорный' : 'Нейтральный';
            recommendations.push({
                type: 'style',
                description: `Стиль текста: ${styleLabel}`,
                suggested_change: styleResult.recommendations ? styleResult.recommendations[0] : 'При необходимости скорректируйте стиль под цель текста',
                position: -1
            });
        }
        
        // Тональность – информационная рекомендация
        if (toneResult) {
            recommendations.push({
                type: 'tone',
                description: `Тональность текста: ${toneResult.tone}`,
                suggested_change: toneResult.tone === 'негативная' ? 'Попробуйте смягчить формулировки' : 'Тональность соответствует норме',
                position: -1
            });
        }
        
        // Синтаксис – информационная рекомендация
        if (syntaxResult && syntaxResult.complex_count > 0) {
            recommendations.push({
                type: 'syntax',
                description: `Обнаружено сложных синтаксических конструкций: ${syntaxResult.complex_count}`,
                suggested_change: 'Упростите придаточные предложения',
                position: -1
            });
        } else if (syntaxResult) {
            recommendations.push({
                type: 'syntax',
                description: 'Синтаксический анализ: сложных конструкций не найдено',
                suggested_change: 'Структура предложений хорошая',
                position: -1
            });
        }
        
        // Результат для вкладки "Результаты анализа" (краткая сводка)
        const summary = {
            spelling: { count: spellingErrors.length, enabled: selectedFunctions.includes('spelling') },
            water: { count: waterPhrases.length, enabled: selectedFunctions.includes('water') },
            longSentences: { count: longSentences.length, enabled: selectedFunctions.includes('long_sentences') },
            style: { label: styleResult ? (styleResult.style === 'formal' ? 'Официальный' : styleResult.style === 'informal' ? 'Разговорный' : 'Нейтральный') : null, enabled: selectedFunctions.includes('style') },
            tone: { label: toneResult ? toneResult.tone : null, enabled: selectedFunctions.includes('tone') },
            syntax: { issuesCount: syntaxResult ? syntaxResult.complex_count : 0, enabled: selectedFunctions.includes('syntax') }
        };
        
        return {
            stats: { characters, words, sentences },
            readability_score: readabilityScore,
            readability_level: readabilityLevel,
            spelling_errors: spellingErrors,
            water_phrases: waterPhrases,
            long_sentences: longSentences,
            style_label: styleResult ? styleResult.style : 'neutral',
            tone: toneResult ? toneResult.tone : null,
            syntax_issues: syntaxResult ? syntaxResult.issues : [],
            recommendations: recommendations,
            summary: summary
        };
    },
    
    // Сохранение текста (без изменений)
    saveText: async (title, content) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        const savedTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        const newText = {
            id: Date.now().toString(),
            title: title,
            content: content,
            saved_at: new Date().toISOString()
        };
        savedTexts.unshift(newText);
        localStorage.setItem('chistovik_history', JSON.stringify(savedTexts));
        return newText;
    },
    
    getHistory: async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return JSON.parse(localStorage.getItem('chistovik_history') || '[]');
    },
    
    deleteText: async (id) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        let savedTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        savedTexts = savedTexts.filter(t => t.id !== id);
        localStorage.setItem('chistovik_history', JSON.stringify(savedTexts));
        return { success: true };
    },
    
    clearHistory: async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        localStorage.removeItem('chistovik_history');
        return { success: true };
    },
    
    rewriteText: async (text, style) => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const styleMap = {
            formal: 'официально-деловом',
            journalistic: 'публицистическом',
            scientific: 'научном',
            colloquial: 'разговорном',
            literary: 'художественном'
        };
        const styleRu = styleMap[style] || 'нейтральном';
        return `[Переписано в ${styleRu} стиле]\n\n${text}\n\n---\n✨ Текст был автоматически переработан. В реальной версии будет использована нейросеть.`;
    }
};

// === Вспомогательные функции ===

function simulateSpellingErrors(text) {
    const errors = [];
    // Словарь "ошибок" (слово -> правильный вариант)
    const errorMap = {
        'ихняя': ['их'],
        'програма': ['программа'],
        'кампьютер': ['компьютер'],
        'резюме': ['резюме'], // нет ошибки, но для примера
        'алиса': ['Алиса'],
        'нету': ['нет'],
        'ложить': ['класть'],
        'зделать': ['сделать']
    };
    const lowerText = text.toLowerCase();
    for (let wrong in errorMap) {
        let index = lowerText.indexOf(wrong);
        while (index !== -1) {
            // Проверяем, что это целое слово (границы)
            const before = text[index - 1] || '';
            const after = text[index + wrong.length] || '';
            if (!/[а-яё]/i.test(before) && !/[а-яё]/i.test(after)) {
                errors.push({
                    word: text.substr(index, wrong.length),
                    position: index,
                    suggestions: errorMap[wrong],
                    description: `Орфографическая ошибка: возможно, вы имели в виду "${errorMap[wrong][0]}"`
                });
            }
            index = lowerText.indexOf(wrong, index + 1);
        }
    }
    return errors;
}

function calculateReadability(text) {
    // Упрощённая формула: 100 - (средняя длина предложения * 1.5) - (средняя длина слова * 0.8)
    // Ограничиваем от 0 до 100
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (words.length === 0 || sentences.length === 0) return 50;
    const avgSentenceLen = words.length / sentences.length;
    const avgWordLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    let score = 100 - (avgSentenceLen * 1.2) - (avgWordLen * 0.6);
    score = Math.min(100, Math.max(0, Math.round(score)));
    return score;
}

function getReadabilityLevel(score) {
    if (score >= 80) return 'Очень лёгкий';
    if (score >= 60) return 'Лёгкий';
    if (score >= 40) return 'Средний';
    if (score >= 20) return 'Сложный';
    return 'Очень сложный';
}

if (typeof window !== 'undefined') {
    window.API = API;
    console.log('API модуль загружен (с улучшенной логикой)');
}