/**
 * route.js - Generación, gestión y adaptación de rutas de estudio
 */
import { callGeminiAPI } from './ai.js';
import { getRouteGenerationPrompt } from './prompts.js';
import { dbSave, dbGet } from './storage.js';
import { chunkText } from './chunk.js';

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
    if (!routeData || !Array.isArray(routeData.modules) || routeData.modules.length === 0) {
        throw new Error('La IA no devolvió módulos de estudio válidos. Intenta generar la ruta de nuevo.');
    }

    const newRoute = {
        id: 'route_' + Date.now(),
        createdAt: new Date().toISOString(),
        options: options,
        title: routeData.title || 'Ruta de Estudio Personalizada',
        description: routeData.description || '',
        estimatedWeeks: routeData.estimatedWeeks || 2,
        modules: routeData.modules || [],
        flashcards: routeData.flashcards || [],
        progress: {
            completedModules: [],
            examScores: {},
            weakTopics: []
        }
    };

    await dbSave('routes', newRoute);
    return newRoute;
}