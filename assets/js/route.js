/**
 * route.js - Generación, gestión y adaptación de rutas de estudio
 */
import { callGeminiAPI } from './ai.js';
import { getRouteGenerationPrompt } from './prompts.js';
import { dbSave, dbGet } from './storage.js';
import { chunkText } from './chunk.js';

function stringList(value) {
    return Array.isArray(value)
        ? value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
        : [];
}

function createFallbackSlides(module) {
    const concepts = module.concepts
        .map(concept => `${concept.term}: ${concept.definition}`)
        .filter(Boolean);
    const objectives = module.objectives;
    const examples = module.examples;
    const commonErrors = module.commonErrors;

    return [
        {
            title: 'Panorama del módulo',
            content: module.summary,
            keyPoints: objectives.length ? objectives.slice(0, 4) : [module.summary]
        },
        {
            title: 'Conceptos esenciales',
            content: concepts.length ? concepts.join('\n\n') : module.summary,
            keyPoints: concepts.length ? concepts.slice(0, 4) : [module.summary]
        },
        {
            title: 'Aplicación y repaso',
            content: [...examples, ...commonErrors].join('\n\n') || module.summary,
            keyPoints: [...examples, ...commonErrors].slice(0, 4).length
                ? [...examples, ...commonErrors].slice(0, 4)
                : objectives.slice(0, 4).length ? objectives.slice(0, 4) : [module.summary]
        }
    ];
}

function createFallbackFlashcards(module, moduleIndex) {
    const conceptCards = module.concepts.map(concept => ({
        question: `¿Qué significa ${concept.term}?`,
        answer: concept.definition
    }));
    const pointCards = [...module.objectives, ...module.examples]
        .map((point, index) => ({
            question: `¿Qué debes recordar sobre ${module.title} (${index + 1})?`,
            answer: point
        }));
    const summarySentences = module.summary.split(/(?<=[.!?])\s+/).filter(Boolean);
    const summaryCards = summarySentences.map((sentence, index) => ({
        question: `¿Cuál es una idea clave de ${module.title} (${index + 1})?`,
        answer: sentence
    }));
    const cards = [...conceptCards, ...pointCards, ...summaryCards].slice(0, 8);
    const recapQuestions = [
        `¿Cuál es la idea central de ${module.title}?`,
        `¿Qué explicación debes recordar sobre ${module.title}?`,
        `¿Cómo resumirías lo más importante de ${module.title}?`
    ];
    while (cards.length < 3) {
        cards.push({
            question: recapQuestions[cards.length],
            answer: module.summary
        });
    }

    return cards.map((card, index) => ({
        id: `fc_${moduleIndex + 1}_${index + 1}`,
        moduleId: module.id,
        question: card.question,
        answer: card.answer
    }));
}

export function normalizeStudyRoute(routeData, options = routeData?.options || {}, existingRoute = null) {
    if (!routeData || !Array.isArray(routeData.modules) || routeData.modules.length === 0) {
        throw new Error('La IA no devolvió módulos de estudio válidos. Intenta generar la ruta de nuevo.');
    }

    const legacyCards = Array.isArray(routeData.flashcards) ? routeData.flashcards : [];
    const usedModuleIds = new Set();
    const modules = routeData.modules.map((sourceModule, index) => {
        if (!sourceModule || typeof sourceModule !== 'object') {
            throw new Error(`El módulo ${index + 1} de la ruta no tiene un formato válido.`);
        }
        const title = typeof sourceModule.title === 'string' ? sourceModule.title.trim() : '';
        const summary = typeof sourceModule.summary === 'string' ? sourceModule.summary.trim() : '';
        if (!title || !summary) {
            throw new Error(`El módulo ${index + 1} no incluye título y resumen. Intenta generar la ruta de nuevo.`);
        }

        const concepts = Array.isArray(sourceModule.concepts)
            ? sourceModule.concepts
                .filter(concept => concept && typeof concept.term === 'string' && typeof concept.definition === 'string')
                .map(concept => ({ term: concept.term.trim(), definition: concept.definition.trim() }))
                .filter(concept => concept.term && concept.definition)
            : [];
        let id = String(sourceModule.id || `mod_${index + 1}`);
        while (usedModuleIds.has(id)) id = `${id}_${index + 1}`;
        usedModuleIds.add(id);
        const module = {
            ...sourceModule,
            id,
            title,
            summary,
            objectives: stringList(sourceModule.objectives),
            concepts,
            examples: stringList(sourceModule.examples),
            commonErrors: stringList(sourceModule.commonErrors)
        };

        const slides = Array.isArray(sourceModule.lessonSlides)
            ? sourceModule.lessonSlides
                .filter(slide => slide && typeof slide.title === 'string' && typeof slide.content === 'string')
                .map(slide => ({
                    title: slide.title.trim(),
                    content: slide.content.trim(),
                    keyPoints: stringList(slide.keyPoints).length
                        ? stringList(slide.keyPoints)
                        : module.objectives.length
                            ? module.objectives.slice(0, 4)
                            : concepts.length
                                ? concepts.slice(0, 4).map(concept => `${concept.term}: ${concept.definition}`)
                                : [slide.content.trim()]
                }))
                .filter(slide => slide.title && slide.content)
            : [];
        module.lessonSlides = slides.length >= 3 ? slides : createFallbackSlides(module);

        const moduleCards = Array.isArray(sourceModule.flashcards) ? sourceModule.flashcards : [];
        const matchingLegacyCards = legacyCards.filter(card =>
            card && (card.moduleId === module.id || card.moduleIndex === index ||
                (!card.moduleId && card.moduleIndex === undefined && index === 0))
        );
        const cards = (moduleCards.length ? moduleCards : matchingLegacyCards)
            .filter(card => card && typeof card.question === 'string' && typeof card.answer === 'string')
            .map((card, cardIndex) => ({
                id: String(card.id || `fc_${index + 1}_${cardIndex + 1}`),
                moduleId: module.id,
                question: card.question.trim(),
                answer: card.answer.trim()
            }))
            .filter(card => card.question && card.answer);
        const fallbackCards = cards.length >= 3 ? [] : createFallbackFlashcards(module, index);
        module.flashcards = [...cards, ...fallbackCards]
            .filter((card, cardIndex, allCards) =>
                allCards.findIndex(candidate => candidate.question.toLowerCase() === card.question.toLowerCase()) === cardIndex
            )
            .slice(0, 8);
        module.estimatedHours = Number.isFinite(Number(sourceModule.estimatedHours))
            ? Math.max(1, Number(sourceModule.estimatedHours))
            : 2;
        module.sourceReference = String(sourceModule.sourceReference || '');
        return module;
    });

    return {
        id: existingRoute?.id || 'route_' + Date.now(),
        createdAt: existingRoute?.createdAt || new Date().toISOString(),
        options: existingRoute?.options || options,
        title: typeof routeData.title === 'string' && routeData.title.trim()
            ? routeData.title.trim()
            : 'Ruta de Estudio Personalizada',
        description: typeof routeData.description === 'string' ? routeData.description.trim() : '',
        estimatedWeeks: Number.isFinite(Number(routeData.estimatedWeeks))
            ? Math.max(1, Number(routeData.estimatedWeeks))
            : 2,
        modules,
        flashcards: modules.flatMap(module => module.flashcards),
        progress: {
            ...existingRoute?.progress,
            completedModules: existingRoute?.progress?.completedModules || [],
            examScores: existingRoute?.progress?.examScores || {},
            weakTopics: existingRoute?.progress?.weakTopics || [],
            examResults: existingRoute?.progress?.examResults || []
        }
    };
}

export async function generateStudyRoute(materials, options) {
    let combinedText = '';
    const images = [];

    for (const mat of materials) {
        if (mat.imageBase64 && mat.mimeType) {
            images.push({ base64: mat.imageBase64, mimeType: mat.mimeType });
        }
        combinedText += `\n\n=== DOCUMENTO: ${mat.name} ===\n${mat.text}`;
    }

    // Trocear si es muy largo (Map-Reduce simplificado o resumen de fragmentos)
    const chunks = chunkText(combinedText, 15000, 500);
    let summaryForAI = combinedText;
    if (chunks.length > 1) {
        summaryForAI = chunks.map(c => c.text).join('\n\n');
    }

    const prompt = getRouteGenerationPrompt(
        summaryForAI,
        options.objective,
        options.level,
        options.language,
        options.hoursPerWeek
    );

    const routeData = await callGeminiAPI(prompt, images);
    if (routeData?.modules?.length < 2) {
        throw new Error('La ruta necesita al menos dos módulos para organizar el avance y los exámenes. Intenta generarla de nuevo.');
    }
    const newRoute = normalizeStudyRoute(routeData, options);

    await dbSave('routes', newRoute);
    return newRoute;
}