/* styleAnalyzer.js - Модуль определения стиля текста */

const StyleAnalyzer = (function() {
    
    // Словари маркеров для разных стилей
    
    const formalMarkers = {
        // Вводные конструкции
        introductory: [
            'следует отметить', 'необходимо подчеркнуть', 'важно отметить', 
            'представляется важным', 'обращаем внимание', 'принимая во внимание',
            'в соответствии с', 'на основании', 'в связи с', 'вследствие',
            'в порядке', 'в случае', 'в целях', 'в рамках', 'в отношении'
        ],
        
        // Глаголы и обороты
        verbs: [
            'обеспечить', 'осуществить', 'реализовать', 'предоставить',
            'рассмотреть', 'утвердить', 'согласовать', 'регламентировать',
            'содействовать', 'взаимодействовать', 'функционировать'
        ],
        
        // Существительные
        nouns: [
            'рассмотрение', 'обеспечение', 'реализация', 'осуществление',
            'предоставление', 'утверждение', 'согласование', 'регламентация',
            'деятельность', 'мероприятие', 'документация', 'отчётность'
        ],
        
        // Прилагательные
        adjectives: [
            'вышеуказанный', 'нижеследующий', 'вышеупомянутый', 'должный',
            'необходимый', 'обязательный', 'целесообразный', 'актуальный'
        ],
        
        // Союзы и предлоги
        conjunctions: [
            'ввиду того что', 'вследствие того что', 'в связи с тем что',
            'несмотря на то что', 'в то время как', 'в соответствии с которым'
        ]
    };
    
    const informalMarkers = {
        // Разговорные слова
        colloquial: [
            'ваще', 'короче', 'типа', 'нафиг', 'блин', 'прикол', 'кайф',
            'ладно', 'давай', 'окей', 'нормально', 'супер', 'классно'
        ],
        
        // Уменьшительно-ласкательные
        diminutives: [
            'словечко', 'предложение', 'текстик', 'работка', 'статейка',
            'времечко', 'делишки', 'нормальненько', 'хорошенько'
        ],
        
        // Просторечные глаголы
        verbs: [
            'шляться', 'шастать', 'тащиться', 'обломаться', 'заколебать',
            'достать', 'впарить', 'развести', 'кинуть'
        ],
        
        // Междометия и частицы
        particles: [
            'ага', 'ну', 'вот', 'типа', 'прям', 'реально', 'жесть'
        ]
    };
    
    const neutralMarkers = {
        // Нейтральные связки (общеупотребительные)
        conjunctions: [
            'и', 'а', 'но', 'или', 'да', 'однако', 'зато', 'также',
            'потому что', 'чтобы', 'если', 'когда', 'где', 'который'
        ],
        
        // Нейтральные глаголы
        verbs: [
            'быть', 'стать', 'находиться', 'иметь', 'делать', 'говорить',
            'знать', 'думать', 'считать', 'понимать', 'видеть', 'слышать'
        ]
    };
    
    // Дополнительные метрики
    
    function calculateAverageSentenceLength(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length === 0) return 0;
        const words = text.split(/\s+/).filter(w => w.length > 0);
        return words.length / sentences.length;
    }
    
    function calculatePassiveVoiceRatio(text) {
        // Маркеры пассивного залога
        const passiveMarkers = [
            'был', 'была', 'было', 'были', 'будет', 'будут',
            'является', 'являются', 'считается', 'считаются',
            'рассматривается', 'рассматриваются', 'определяется', 'определяются'
        ];
        let passiveCount = 0;
        passiveMarkers.forEach(marker => {
            const regex = new RegExp(`\\b${marker}\\b`, 'gi');
            const matches = text.match(regex);
            if (matches) passiveCount += matches.length;
        });
        const totalWords = text.split(/\s+/).filter(w => w.length > 0).length;
        return totalWords > 0 ? (passiveCount / totalWords) * 100 : 0;
    }
    
    function calculatePersonalPronounsRatio(text) {
        // Личные местоимения (признак разговорного стиля)
        const pronouns = [
            'я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они',
            'меня', 'тебя', 'его', 'её', 'нас', 'вас', 'их',
            'мне', 'тебе', 'ему', 'ей', 'нам', 'вам', 'им'
        ];
        let pronounCount = 0;
        pronouns.forEach(pronoun => {
            const regex = new RegExp(`\\b${pronoun}\\b`, 'gi');
            const matches = text.match(regex);
            if (matches) pronounCount += matches.length;
        });
        const totalWords = text.split(/\s+/).filter(w => w.length > 0).length;
        return totalWords > 0 ? (pronounCount / totalWords) * 100 : 0;
    }
    
    function calculateComplexWordsRatio(text) {
        // Сложные слова (длиннее 8 символов)
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const longWords = words.filter(w => w.length > 8);
        return words.length > 0 ? (longWords.length / words.length) * 100 : 0;
    }
    
    // Основная функция определения стиля
    
    function analyzeStyle(text) {
        if (!text || text.trim().length === 0) {
            return {
                style: 'neutral',
                confidence: 0,
                scores: {
                    formal: 0,
                    neutral: 0,
                    informal: 0
                },
                details: {
                    formalMarkersCount: 0,
                    informalMarkersCount: 0,
                    avgSentenceLength: 0,
                    passiveVoiceRatio: 0,
                    personalPronounsRatio: 0,
                    complexWordsRatio: 0
                },
                description: 'Текст пуст. Введите текст для анализа стиля.'
            };
        }
        
        const lowerText = text.toLowerCase();
        
        // Подсчёт маркеров формального стиля
        let formalCount = 0;
        for (const category in formalMarkers) {
            formalMarkers[category].forEach(marker => {
                const regex = new RegExp(`\\b${marker}\\b`, 'gi');
                const matches = lowerText.match(regex);
                if (matches) formalCount += matches.length;
            });
        }
        
        // Подсчёт маркеров разговорного стиля
        let informalCount = 0;
        for (const category in informalMarkers) {
            informalMarkers[category].forEach(marker => {
                const regex = new RegExp(`\\b${marker}\\b`, 'gi');
                const matches = lowerText.match(regex);
                if (matches) informalCount += matches.length;
            });
        }
        
        // Дополнительные метрики
        const avgSentenceLength = calculateAverageSentenceLength(text);
        const passiveVoiceRatio = calculatePassiveVoiceRatio(text);
        const personalPronounsRatio = calculatePersonalPronounsRatio(text);
        const complexWordsRatio = calculateComplexWordsRatio(text);
        
        // Вычисление итоговых баллов (0-100 для каждого стиля)
        let formalScore = 0;
        let informalScore = 0;
        let neutralScore = 0;
        
        // Маркерные баллы (максимум 50)
        const maxMarkerScore = 50;
        const totalMarkers = formalCount + informalCount;
        if (totalMarkers > 0) {
            formalScore += (formalCount / totalMarkers) * maxMarkerScore;
            informalScore += (informalCount / totalMarkers) * maxMarkerScore;
        } else {
            neutralScore += 25;
            formalScore += 12.5;
            informalScore += 12.5;
        }
        
        // Баллы за длину предложения
        // Формальный стиль: длинные предложения (15+ слов)
        // Разговорный стиль: короткие предложения (до 10 слов)
        if (avgSentenceLength > 15) {
            formalScore += 15;
            neutralScore += 5;
        } else if (avgSentenceLength < 10) {
            informalScore += 15;
            neutralScore += 5;
        } else {
            neutralScore += 15;
            formalScore += 5;
            informalScore += 5;
        }
        
        // Баллы за пассивный залог (формальный стиль)
        if (passiveVoiceRatio > 5) {
            formalScore += 15;
        } else if (passiveVoiceRatio > 2) {
            formalScore += 8;
            neutralScore += 4;
        } else {
            informalScore += 8;
            neutralScore += 4;
        }
        
        // Баллы за личные местоимения (разговорный стиль)
        if (personalPronounsRatio > 5) {
            informalScore += 15;
        } else if (personalPronounsRatio > 2) {
            informalScore += 8;
            neutralScore += 4;
        } else {
            formalScore += 8;
            neutralScore += 4;
        }
        
        // Баллы за сложные слова (формальный стиль)
        if (complexWordsRatio > 15) {
            formalScore += 10;
        } else if (complexWordsRatio > 8) {
            formalScore += 5;
            neutralScore += 5;
        } else {
            informalScore += 5;
            neutralScore += 5;
        }
        
        // Нормализация баллов (0-100)
        const maxPossible = 105;
        formalScore = Math.min(100, Math.round((formalScore / maxPossible) * 100));
        informalScore = Math.min(100, Math.round((informalScore / maxPossible) * 100));
        neutralScore = Math.min(100, Math.round((neutralScore / maxPossible) * 100));
        
        // Определение стиля
        let style = 'neutral';
        let confidence = neutralScore;
        
        if (formalScore > informalScore && formalScore > neutralScore) {
            style = 'formal';
            confidence = formalScore;
        } else if (informalScore > formalScore && informalScore > neutralScore) {
            style = 'informal';
            confidence = informalScore;
        }
        
        // Описание стиля
        const descriptions = {
            formal: {
                title: 'Официально-деловой стиль',
                description: 'Текст написан в официально-деловом стиле. Характеризуется использованием канцеляризмов, сложных синтаксических конструкций, пассивного залога и отглагольных существительных. Обычно используется в документации, отчётах, официальных письмах и юридических текстах.',
                recommendations: [
                    'Проверьте, уместно ли использование сложных конструкций',
                    'При необходимости замените пассивный залог на активный',
                    'Упростите слишком длинные предложения для лучшего восприятия'
                ]
            },
            informal: {
                title: 'Разговорный стиль',
                description: 'Текст написан в разговорном стиле. Характеризуется использованием простых предложений, личных местоимений, разговорных слов и сокращений. Обычно используется в личной переписке, блогах, комментариях и неформальном общении.',
                recommendations: [
                    'Для официальных текстов уберите разговорные выражения',
                    'Проверьте, нет ли излишней эмоциональности',
                    'При необходимости добавьте более формальные конструкции'
                ]
            },
            neutral: {
                title: 'Нейтральный стиль',
                description: 'Текст написан в нейтральном стиле. Сбалансированное сочетание формальных и разговорных элементов. Универсальный стиль, подходящий для большинства ситуаций: статьи, новости, учебные работы, деловая переписка среднего уровня формальности.',
                recommendations: [
                    'При необходимости можно усилить формальность или добавить живости',
                    'Стиль хорошо подходит для большинства текстов',
                    'Для специальных целей можно адаптировать стиль'
                ]
            }
        };
        
        // Генерация примера исправления (для демонстрации)
        let exampleFix = null;
        if (style === 'formal' && informalCount > 0) {
            exampleFix = 'Замените разговорные выражения на более формальные аналоги. Например: "короче" → "вкратце", "типа" → "наподобие"';
        } else if (style === 'informal' && formalCount > 0) {
            exampleFix = 'Упростите сложные конструкции. Например: "в соответствии с вышеуказанным" → "как сказано выше"';
        }
        
        return {
            style: style,
            confidence: confidence,
            scores: {
                formal: formalScore,
                neutral: neutralScore,
                informal: informalScore
            },
            details: {
                formalMarkersCount: formalCount,
                informalMarkersCount: informalCount,
                avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
                passiveVoiceRatio: Math.round(passiveVoiceRatio * 10) / 10,
                personalPronounsRatio: Math.round(personalPronounsRatio * 10) / 10,
                complexWordsRatio: Math.round(complexWordsRatio * 10) / 10
            },
            description: descriptions[style].description,
            title: descriptions[style].title,
            recommendations: descriptions[style].recommendations,
            exampleFix: exampleFix
        };
    }
    
    // Функция для получения читаемого названия стиля
    function getStyleLabel(style) {
        const labels = {
            formal: 'Официальный',
            neutral: 'Нейтральный',
            informal: 'Разговорный'
        };
        return labels[style] || 'Неизвестно';
    }
    
    // Функция для получения цвета стиля (для отображения)
    function getStyleColor(style) {
        const colors = {
            formal: '#1e3c72',
            neutral: '#48bb78',
            informal: '#ecc94b'
        };
        return colors[style] || '#718096';
    }
    
    // Экспорт модуля
    return {
        analyzeStyle: analyzeStyle,
        getStyleLabel: getStyleLabel,
        getStyleColor: getStyleColor
    };
    
})();

// Подключение к глобальному объекту для использования в других файлах
if (typeof window !== 'undefined') {
    window.StyleAnalyzer = StyleAnalyzer;
}