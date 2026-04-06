// API сервис с заглушками для дальнейшего подключения к бэкенду

const API_BASE_URL = 'http://localhost:8000/api';

// Заглушка для демонстрации
const generateMockAnalysis = (text) => {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Простой подсчёт "воды" (канцеляризмы)
    const waterWords = ['является', 'представляет собой', 'в настоящее время', 'принимая во внимание', 'в целом', 'следует отметить', 'вышеупомянутый'];
    let waterCount = 0;
    waterWords.forEach(ww => {
        if (text.toLowerCase().includes(ww)) waterCount++;
    });
    const waterPercentage = Math.min(100, Math.round((waterCount / words.length) * 100));
    
    // Простой индекс читаемости (грубая имитация)
    const avgSentenceLength = words.length / sentences.length;
    let readabilityScore = Math.max(0, Math.min(100, 100 - (avgSentenceLength - 10) * 3));
    let readabilityLevel = '';
    if (readabilityScore >= 70) readabilityLevel = 'Лёгкий';
    else if (readabilityScore >= 40) readabilityLevel = 'Средний';
    else readabilityLevel = 'Сложный';
    
    // Определение стиля
    let style = 'neutral';
    const formalWords = ['следует', 'необходимо', 'в соответствии', 'обеспечить'];
    const informalWords = ['короче', 'типа', 'ваще', 'прикол'];
    
    let formalCount = formalWords.filter(fw => text.toLowerCase().includes(fw)).length;
    let informalCount = informalWords.filter(iw => text.toLowerCase().includes(iw)).length;
    
    if (formalCount > informalCount) style = 'formal';
    else if (informalCount > formalCount) style = 'informal';
    
    // Поиск орфографических ошибок (заглушка)
    const spellingErrors = [];
    const commonMistakes = [
        { wrong: 'програма', correct: 'программа', desc: 'Пропущена буква "м"' },
        { wrong: 'ихний', correct: 'их', desc: 'Разговорная форма' },
        { wrong: 'ихняя', correct: 'их', desc: 'Разговорная форма' }
    ];
    
    commonMistakes.forEach(mistake => {
        const index = text.toLowerCase().indexOf(mistake.wrong);
        if (index !== -1) {
            spellingErrors.push({
                id: `err-${Date.now()}-${index}`,
                word: mistake.wrong,
                position: index,
                length: mistake.wrong.length,
                suggestions: [mistake.correct],
                description: mistake.desc,
                type: 'spelling'
            });
        }
    });
    
    // Поиск "водных" фраз
    const waterPhrases = [];
    waterWords.forEach(ww => {
        const index = text.toLowerCase().indexOf(ww);
        if (index !== -1) {
            waterPhrases.push({
                id: `water-${Date.now()}-${index}`,
                phrase: ww,
                position: index,
                length: ww.length,
                recommendation: `Заменить на более простую формулировку`
            });
        }
    });
    
    // Поиск длинных предложений
    const longSentences = [];
    sentences.forEach((sentence, idx) => {
        const sentenceWords = sentence.trim().split(/\s+/).length;
        if (sentenceWords > 20) {
            longSentences.push({
                id: `long-${Date.now()}-${idx}`,
                text: sentence.trim(),
                position: text.indexOf(sentence.trim()),
                word_count: sentenceWords,
                suggestion: 'Разбейте на 2-3 коротких предложения'
            });
        }
    });
    
    return {
        id: `analysis-${Date.now()}`,
        text_id: `text-${Date.now()}`,
        analysed_at: new Date().toISOString(),
        readability_score: Math.round(readabilityScore),
        readability_level: readabilityLevel,
        style_label: style,
        water_percentage: waterPercentage,
        stats: {
            characters: text.length,
            words: words.length,
            sentences: sentences.length,
            avg_word_length: Math.round((text.length / words.length) * 10) / 10,
            avg_sentence_length: Math.round((words.length / sentences.length) * 10) / 10
        },
        spelling_errors: spellingErrors,
        water_phrases: waterPhrases,
        long_sentences: longSentences,
        recommendations: [
            ...spellingErrors.map(e => ({
                id: `rec-spell-${e.id}`,
                type: 'spelling',
                description: `Ошибка: "${e.word}" → ${e.suggestions[0]}`,
                suggested_change: e.suggestions[0],
                position: e.position
            })),
            ...waterPhrases.map(w => ({
                id: `rec-water-${w.id}`,
                type: 'style',
                description: `Канцеляризм: "${w.phrase}"`,
                suggested_change: w.recommendation,
                position: w.position
            })),
            ...longSentences.map(l => ({
                id: `rec-long-${l.id}`,
                type: 'readability',
                description: `Слишком длинное предложение (${l.word_count} слов)`,
                position: l.position
            }))
        ]
    };
};

// Основные API функции
const API = {
    // Анализ текста
    async analyzeText(text) {
        // TODO: Заменить на реальный запрос к бэкенду
        // const response = await fetch(`${API_BASE_URL}/analyze`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ text })
        // });
        // return response.json();
        
        console.log('📝 Анализ текста:', text.substring(0, 100) + '...');
        
        // Имитация задержки сети
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Генерируем мок-данные на основе реального текста
        return generateMockAnalysis(text);
    },
    
    // Сохранение текста
    async saveText(title, content) {
        // TODO: Заменить на реальный запрос
        // const response = await fetch(`${API_BASE_URL}/save`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ title, content })
        // });
        // return response.json();
        
        console.log('💾 Сохранение текста:', title);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const savedTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        const newText = {
            id: Date.now().toString(),
            title,
            content,
            saved_at: new Date().toISOString()
        };
        savedTexts.unshift(newText);
        localStorage.setItem('chistovik_history', JSON.stringify(savedTexts.slice(0, 20)));
        
        return newText;
    },
    
    // Получение истории
    async getHistory() {
        // TODO: Заменить на реальный запрос
        // const response = await fetch(`${API_BASE_URL}/history`);
        // return response.json();
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const savedTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        return savedTexts;
    },
    
    // Очистка истории
    async clearHistory() {
        localStorage.setItem('chistovik_history', '[]');
        return { success: true };
    },
    
    // Получение анализа сохранённого текста
    async getTextAnalysis(textId) {
        // TODO: Заменить на реальный запрос
        const savedTexts = JSON.parse(localStorage.getItem('chistovik_history') || '[]');
        const text = savedTexts.find(t => t.id === textId);
        if (text) {
            return generateMockAnalysis(text.content);
        }
        throw new Error('Текст не найден');
    }
};