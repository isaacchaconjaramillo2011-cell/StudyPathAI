/**
 * exam.js - Generación, aplicación, corrección de exámenes y cálculo de puntajes
 */
import { callGeminiAPI } from './ai.js';
import { getExamGenerationPrompt, getEssayGradingPrompt } from './prompts.js';

export async function generateExamForModule(moduleObj, count = 5) {
    const prompt = getExamGenerationPrompt(moduleObj.title, moduleObj.summary, moduleObj.concepts, count);
    const result = await callGeminiAPI(prompt);
    if (!Array.isArray(result?.questions) || result.questions.length === 0) {
        throw new Error('La IA no devolvió preguntas válidas para este módulo. Intenta generar el examen de nuevo.');
    }
    return result.questions;
}

export async function gradeExam(questions, userAnswers) {
    let correctCount = 0;
    let totalScore = 0;
    const details = [];

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const userAns = userAnswers[q.id] || '';
        let isCorrect = false;
        let score = 0;
        let feedback = '';

        if (q.type === 'multiple_choice' || q.type === 'true_false') {
            isCorrect = userAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
            score = isCorrect ? 1.0 : 0.0;
            feedback = isCorrect ? '¡Respuesta correcta!' : `Incorrecto. La respuesta correcta era: ${q.correctAnswer}. ${q.explanation}`;
        } else if (q.type === 'short_answer') {
            // Corrección flexible local o por IA simple
            isCorrect = userAns.toLowerCase().includes(q.correctAnswer.toLowerCase()) || q.correctAnswer.toLowerCase().includes(userAns.toLowerCase());
            score = isCorrect ? 1.0 : 0.0;
            feedback = isCorrect ? 'Respuesta aceptada correctamente.' : `Respuesta incompleta. Criterio esperado: ${q.correctAnswer}.`;
        } else if (q.type === 'essay') {
            try {
                const gradingPrompt = getEssayGradingPrompt(q.statement, q.correctAnswer, userAns);
                const gradeResult = await callGeminiAPI(gradingPrompt);
                score = typeof gradeResult.score === 'number' ? gradeResult.score : 0.5;
                isCorrect = score >= 0.7;
                feedback = gradeResult.feedback || 'Evaluado por IA.';
            } catch (e) {
                score = 0.5;
                feedback = 'No se pudo evaluar automáticamente con IA: ' + e.message;
            }
        }

        if (isCorrect) correctCount++;
        totalScore += score;

        details.push({
            questionId: q.id,
            statement: q.statement,
            userAnswer: userAns,
            correctAnswer: q.correctAnswer,
            isCorrect: isCorrect,
            score: score,
            feedback: feedback,
            explanation: q.explanation
        });
    }

    const scorePercentage = questions.length === 0 ? 0 : (totalScore / questions.length) * 100;

    return {
        totalQuestions: questions.length,
        correctCount: correctCount,
        scorePercentage,
        details: details
    };
}