// API сервис с заглушками для дальнейшего подключения к бэкенду

const API_BASE_URL = 'http://localhost:8000/api';

// Генерация мок-данных для анализа
function generateMockAnalysis(text, selectedFunctions, rewriteStyle) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    const result = {
        id: 'analysis-' + Date.now(),
        text_id: 'text-' + Date.now(),
        analysed_at: new Date().toISOString(),
        stats: {
            characters: text.length,
            words: words.length,
            sentences: sentences.length,
            avg_word_length: words.length > 0 ? Math.round((text.length / words.length) * 10) / 10 : 0,
            avg_sentence_length: sentences.length > 0 ? Math.round((words.length / sentences.length) * 10) / 10 : 0
        },
        readability_score: 0,
        readability_level: 'Средний',
        style_label: 'neutral',
        style_confidence: 85,
        water_percentage: 0,
        water_phrases: [],
        spelling_errors: [],
        long_sentences: [],
        recommendations: [],
        modified_text: null
    };
    
    // Индекс читаемости
    const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;
    let readabilityScore = Math.max(0, Math.min(100, 100 - (avgSentenceLength - 10) * 3));
    if (readabilityScore >= 70) result.readability_level = 'Лёгкий';
    else if (readabilityScore >= 40) result.readability_level = 'Средний';
    else result.readability_level = 'Сложный';
    result.readability_score = Math.round(readabilityScore);
    
    // Орфографическая проверка
    if (selectedFunctions.spelling) {
        const commonMistakes = [
            { wrong: 'програма', correct: 'программа', desc: 'Пропущена буква "м"' },
            { wrong: 'ихний', correct: 'их', desc: 'Разговорная форма' },
            { wrong: 'ихняя', correct: 'их', desc: 'Разговорная форма' }
        ];
        commonMistakes.forEach(mistake => {
            const index = text.toLowerCase().indexOf(mistake.wrong);
            if (index !== -1) {
                result.spelling_errors.push({
                    id: 'err-' + Date.now() + '-' + index,
                    word: mistake.wrong,
                    position: index,
                    length: mistake.wrong.length,
                    suggestions: [mistake.correct],
                    description: mistake.desc,
                    type: 'spelling'
                });
                result.recommendations.push({
                    id: 'rec-spell-' + index,
                    type: 'spelling',
                    description: 'Ошибка: "' + mistake.wrong + '" → ' + mistake.correct,
                    suggested_change: mistake.correct,
                    position: index
                });
            }
        });
    }
    
    // Определение стиля текста
    if (selectedFunctions.style) {
        const formalWords = ['следует', 'необходимо', 'в соответствии', 'обеспечить'];
        const informalWords = ['короче', 'типа', 'ваще', 'прикол'];
        let formalCount = 0;
        let informalCount = 0;
        formalWords.forEach(fw => {
            if (text.toLowerCase().includes(fw)) formalCount++;
        });
        informalWords.forEach(iw => {
            if (text.toLowerCase().includes(iw)) informalCount++;
        });
        if (formalCount > informalCount) result.style_label = 'formal';
        else if (informalCount > formalCount) result.style_label = 'informal';
        else result.style_label = 'neutral';
    }
    
    // Поиск воды
    if (selectedFunctions.water) {
        const waterWords = ['является', 'представляет собой', 'в настоящее время', 'принимая во внимание', 'в целом', 'следует отметить', 'вышеупомянутый'];
        let waterCount = 0;
        waterWords.forEach(ww => {
            const index = text.toLowerCase().indexOf(ww);
            if (index !== -1) {
                waterCount++;
                result.water_phrases.push({
                    id: 'water-' + Date.now() + '-' + index,
                    phrase: ww,
                    position: index,
                    length: ww.length,
                    recommendation: 'Заменить на более простую формулировку'
                });
                result.recommendations.push({
                    id: 'rec-water-' + index,
                    type: 'style',
                    description: 'Канцеляризм: "' + ww + '"',
                    suggested_change: 'Заменить на более простую формулировку',
                    position: index
                });
            }
        });
        result.water_percentage = words.length > 0 ? Math.min(100, Math.round((waterCount / words.length) * 100)) : 0;
    }
    
    // Длинные предложения
    sentences.forEach((sentence, idx) => {
        const sentenceWords = sentence.trim().split(/\s+/).length;
        if (sentenceWords > 20) {
            const position = text.indexOf(sentence.trim());
            result.long_sentences.push({
                id: 'long-' + Date.now() + '-' + idx,
                text: sentence.trim(),
                position: position,
                word_count: sentenceWords,
                suggestion: 'Разбейте на 2-3 коротких предложения'
            });
            result.recommendations.push({
                id: 'rec-long-' + idx,
                type: 'readability',
                description: 'Слишком длинное предложение (' + sentenceWords + ' слов)',
                position: position
            });
        }
    });
    
    // Переработка текста (заглушка)
    if (selectedFunctions.rewrite) {
        const styleNames = {
            formal: 'официально-деловом',
            journalistic: 'публицистическом',
            scientific: 'научном',
            colloquial: 'разговорном',
            literary: 'художественном'
        };
        result.modified_text = '[Переработанный текст в ' + (styleNames[rewriteStyle] || 'нейтральном') + ' стиле]\n\n' + text;
    }
    
    return result;
}

// API объект
const API = {
    // Анализ текста
    // Анализ текста (реальная орфография через Speller, остальное — заглушки)
    async analyzeText(text, selectedFunctions, rewriteStyle) {
        console.log('Анализ текста:', text.substring(0, 100) + '...');
        console.log('Выбранные функции:', selectedFunctions);

        // Базовые метрики (синхронно)
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;
        let readabilityScore = Math.max(0, Math.min(100, 100 - (avgSentenceLength - 10) * 3));
        let readabilityLevel = 'Средний';
        if (readabilityScore >= 70) readabilityLevel = 'Лёгкий';
        else if (readabilityScore < 40) readabilityLevel = 'Сложный';
        readabilityScore = Math.round(readabilityScore);

        // Базовый объект результата
        const result = {
            id: 'analysis-' + Date.now(),
            text_id: 'text-' + Date.now(),
            analysed_at: new Date().toISOString(),
            stats: {
                characters: text.length,
                words: words.length,
                sentences: sentences.length,
                avg_word_length: words.length > 0 ? Math.round((text.length / words.length) * 10) / 10 : 0,
                avg_sentence_length: Math.round(avgSentenceLength * 10) / 10
            },
            readability_score: readabilityScore,
            readability_level: readabilityLevel,
            style_label: 'neutral',
            style_confidence: 85,
            water_percentage: 0,
            water_phrases: [],
            spelling_errors: [],
            long_sentences: [],
            recommendations: [],
            modified_text: null
        };

        // ========== 1. ОРФОГРАФИЧЕСКАЯ ПРОВЕРКА (реальный Speller) ==========
        // В функции analyzeText, в блоке орфографической проверки:

        if (selectedFunctions.spelling && window.YandexSpeller) {
            try {
                console.log('Запуск орфографической проверки через Яндекс...');
                const spellingErrors = await window.YandexSpeller.checkSpelling(text);
                result.spelling_errors = spellingErrors;

                spellingErrors.forEach(err => {
                    result.recommendations.push({
                        id: 'rec-spell-' + err.id,
                        type: 'spelling',
                        description: `Ошибка: "${err.originalWord}" → ${err.suggestions.join(', ')}`,
                        suggested_change: err.suggestions[0] || '',
                        position: err.position
                    });
                });
                console.log(`Найдено орфографических ошибок: ${spellingErrors.length}`);
            } catch (e) {
                console.error('Яндекс.Спеллер не сработал:', e);
            }
        }

        // ========== 2. ОСТАЛЬНЫЕ ФУНКЦИИ (пока заглушки, но асинхронно) ==========
        // Имитируем небольшую задержку для остальных проверок (чтобы не было пустоты)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Стиль текста (заглушка)
        if (selectedFunctions.style) {
            const formalWords = ['следует', 'необходимо', 'в соответствии', 'обеспечить'];
            const informalWords = ['короче', 'типа', 'ваще', 'прикол'];
            let formalCount = formalWords.filter(fw => text.toLowerCase().includes(fw)).length;
            let informalCount = informalWords.filter(iw => text.toLowerCase().includes(iw)).length;
            if (formalCount > informalCount) result.style_label = 'formal';
            else if (informalCount > formalCount) result.style_label = 'informal';
            else result.style_label = 'neutral';
        }

        // Поиск воды (заглушка)
        if (selectedFunctions.water) {
            const waterWords = ['является', 'представляет собой', 'в настоящее время', 'принимая во внимание', 'в целом', 'следует отметить'];
            let waterCount = 0;
            waterWords.forEach(ww => {
                const idx = text.toLowerCase().indexOf(ww);
                if (idx !== -1) {
                    waterCount++;
                    result.water_phrases.push({
                        id: 'water-' + Date.now() + '-' + idx,
                        phrase: ww,
                        position: idx,
                        length: ww.length,
                        recommendation: 'Заменить на более простую формулировку'
                    });
                    result.recommendations.push({
                        id: 'rec-water-' + idx,
                        type: 'style',
                        description: `Канцеляризм: "${ww}"`,
                        suggested_change: 'Заменить на более простую формулировку',
                        position: idx
                    });
                }
            });
            result.water_percentage = words.length > 0 ? Math.min(100, Math.round((waterCount / words.length) * 100)) : 0;
        }

        // Длинные предложения (всегда, не зависит от выбранных функций)
        sentences.forEach((sentence, idx) => {
            const sentenceWords = sentence.trim().split(/\s+/).length;
            if (sentenceWords > 20) {
                const pos = text.indexOf(sentence.trim());
                result.long_sentences.push({
                    id: 'long-' + Date.now() + '-' + idx,
                    text: sentence.trim(),
                    position: pos,
                    word_count: sentenceWords,
                    suggestion: 'Разбейте на 2-3 коротких предложения'
                });
                result.recommendations.push({
                    id: 'rec-long-' + idx,
                    type: 'readability',
                    description: `Слишком длинное предложение (${sentenceWords} слов)`,
                    position: pos
                });
            }
        });

        // Переработка текста (заглушка)
        if (selectedFunctions.rewrite) {
            const styleNames = {
                formal: 'официально-деловом',
                journalistic: 'публицистическом',
                scientific: 'научном',
                colloquial: 'разговорном',
                literary: 'художественном'
            };
            result.modified_text = `[Переработанный текст в ${styleNames[rewriteStyle] || 'нейтральном'} стиле]\n\n${text}`;
        }

        // Тональность (заглушка)
        if (selectedFunctions.tone) {
            result.tone = {
                label: 'нейтральная',
                confidence: 70
            };
        }

        // Синтаксис (заглушка)
        if (selectedFunctions.syntax) {
            result.syntax = {
                complex_count: 0,
                issues: []
            };
        }

        return result;
    },
    
    // Сохранение текста
    async saveText(title, content) {
        console.log('Сохранение текста:', title);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const savedTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        const newText = {
            id: Date.now().toString(),
            title: title,
            content: content,
            saved_at: new Date().toISOString()
        };
        savedTexts.unshift(newText);
        localStorage.setItem('chistovik_history', JSON.stringify(savedTexts.slice(0, 20)));
        
        return newText;
    },
    
    // Получение истории
    async getHistory() {
        await new Promise(resolve => setTimeout(resolve, 300));
        const savedTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        return savedTexts;
    },
    
    // Удаление текста
    async deleteText(id) {
        const savedTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        const updated = savedTexts.filter(t => t.id !== id);
        localStorage.setItem('chistovik_history', JSON.stringify(updated));
        return { success: true };
    },
    
    // Очистка истории
    async clearHistory() {
        localStorage.setItem('chistovik_history', '[]');
        return { success: true };
    },
    
    // Получение анализа сохранённого текста
    async getTextAnalysis(textId) {
        const savedTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        const text = savedTexts.find(t => t.id === textId);
        if (text) {
            const defaultFunctions = {
                spelling: true,
                style: true,
                water: false,
                rewrite: false,
                tone: false,
                syntax: false
            };
            return generateMockAnalysis(text.content, defaultFunctions, 'neutral');
        }
        throw new Error('Текст не найден');
    }
};

// Проверка, что API определён
if (typeof window !== 'undefined') {
    window.API = API;
    console.log('API модуль загружен');
}