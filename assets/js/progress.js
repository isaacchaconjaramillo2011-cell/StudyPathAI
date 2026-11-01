/**
 * progress.js - Métricas, repetición espaciada y cálculo de temas débiles
 */

export const MODULE_PASSING_SCORE = 70;

function resultMatchesModule(result, module) {
    if (result.moduleId && module.id) return result.moduleId === module.id;
    return result.moduleTitle === module.title;
}

export function isModuleUnlocked(modules, examResults, moduleIndex) {
    if (moduleIndex <= 0) return true;
    if (moduleIndex >= modules.length) return false;

    return modules.slice(0, moduleIndex).every(module =>
        (examResults || []).some(result =>
            resultMatchesModule(result, module) &&
            typeof result.scorePercentage === 'number' &&
            result.scorePercentage >= MODULE_PASSING_SCORE
        )
    );
}

// Algoritmo Leitner simple para flashcards
export function calculateNextReview(cardId, currentBox = 1, isCorrect = true) {
    let nextBox = currentBox;
    let intervalDays = 1;

    if (isCorrect) {
        nextBox = Math.min(5, currentBox + 1);
    } else {
        nextBox = 1;
    }

    switch (nextBox) {
        case 1: intervalDays = 1; break;
        case 2: intervalDays = 3; break;
        case 3: intervalDays = 7; break;
        case 4: intervalDays = 14; break;
        case 5: intervalDays = 30; break;
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

    return {
        cardId,
        box: nextBox,
        nextReview: nextReviewDate.toISOString()
    };
}

export function identifyWeakTopics(examResultsHistory) {
    const weakMap = {};
    
    for (const res of examResultsHistory) {
        for (const detail of res.details || []) {
            if (!detail.isCorrect) {
                const statement = String(detail.statement || 'Tema sin título');
                const topic = statement.length > 30 ? `${statement.slice(0, 30)}...` : statement;
                weakMap[topic] = (weakMap[topic] || 0) + 1;
            }
        }
    }

    return Object.entries(weakMap)
        .sort((a, b) => b[1] - a[1])
        .map(([topic, count]) => ({ topic, failCount: count }));
}

export function getAdaptiveRecommendations(modules, examResultsHistory, threshold = 85) {
    const resultsByModule = new Map();

    for (const result of examResultsHistory) {
        const key = result.moduleId || result.moduleTitle;
        if (!key || typeof result.scorePercentage !== 'number') continue;

        const current = resultsByModule.get(key) || { totalScore: 0, examCount: 0, results: [] };
        current.totalScore += result.scorePercentage;
        current.examCount++;
        current.results.push(result);
        resultsByModule.set(key, current);
    }

    return modules
        .map(module => {
            const stats = resultsByModule.get(module.id) || resultsByModule.get(module.title);
            if (!stats) return null;

            const averageScore = stats.totalScore / stats.examCount;
            if (averageScore >= threshold) return null;

            const weakTopics = identifyWeakTopics(stats.results).slice(0, 3);
            return {
                moduleId: module.id,
                moduleTitle: module.title,
                averageScore,
                examCount: stats.examCount,
                weakTopics
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.averageScore - b.averageScore);
}