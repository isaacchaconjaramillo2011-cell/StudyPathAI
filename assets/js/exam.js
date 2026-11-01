/**
 * exam.js - Generación, aplicación, corrección de exámenes y cálculo de puntajes
 */
import { callGeminiAPI } from './ai.js';
import { getExamGenerationPrompt, getEssayGradingPrompt } from './prompts.js';

function validateExamQuestions(result) {
    if (!Array.isArray(result?.questions) || result.questions.length === 0) {
        throw new Error('La IA no devolvió preguntas válidas para este módulo.');
    }

    const supportedTypes = new Set(['multiple_choice', 'true_false']);
    const usedQuestionIds = new Set();
    return result.questions.map((question, index) => {
        if (!question || !supportedTypes.has(question.type) || !question.statement || !question.correctAnswer) {
            throw new Error(`La pregunta ${index + 1} del examen está incompleta.`);
        }

        let options = Array.isArray(question.options)
            ? [...new Set(question.options.filter(option => typeof option === 'string' && option.trim()))]
            : [];
        if (question.type === 'true_false' && options.length === 0) {
            options = ['Verdadero', 'Falso'];
        }
        if (question.type === 'multiple_choice' && options.length < 2) {
            throw new Error(`La pregunta ${index + 1} no incluye opciones suficientes.`);
        }

        const correctAnswer = String(question.correctAnswer);
        const normalizedOptions = options.map(option => option.trim().toLowerCase());
        if ((question.type === 'multiple_choice' || question.type === 'true_false') &&
            !normalizedOptions.includes(correctAnswer.trim().toLowerCase())) {
            throw new Error(`La respuesta correcta de la pregunta ${index + 1} no coincide con sus opciones.`);
        }

        const baseId = String(question.id || `q_${index + 1}`);
        let id = baseId;
        let suffix = index + 1;
        while (usedQuestionIds.has(id)) id = `${baseId}_${suffix++}`;
        usedQuestionIds.add(id);
        return {
            ...question,
            id,
            statement: String(question.statement),
            correctAnswer: (question.type === 'multiple_choice' || question.type === 'true_false')
                ? options.find(option => option.trim().toLowerCase() === correctAnswer.trim().toLowerCase())
                : correctAnswer,
            options,
            explanation: String(question.explanation || '')
        };
    });
}

function shuffleOptions(options, correctAnswer, questionIndex) {
    const incorrectOptions = [...new Set(options)].filter(option => option !== correctAnswer);
    const insertionIndex = questionIndex % (Math.min(incorrectOptions.length, 3) + 1);
    const choices = incorrectOptions.slice(0, 3);
    choices.splice(insertionIndex, 0, correctAnswer);
    return choices;
}

function createMaterialBasedExam(moduleObj, count) {
    const facts = [];
    const addFact = (question, answer) => {
        if (typeof question !== 'string' || typeof answer !== 'string' || !question.trim() || !answer.trim()) return;
        if (facts.some(fact => fact.question.toLowerCase() === question.trim().toLowerCase())) return;
        facts.push({ question: question.trim(), answer: answer.trim() });
    };

    for (const card of moduleObj.flashcards || []) {
        addFact(card.question, card.answer);
    }
    for (const concept of moduleObj.concepts || []) {
        if (concept?.term && concept?.definition) {
            addFact(`¿Qué significa ${concept.term}?`, concept.definition);
        }
    }
    for (const objective of moduleObj.objectives || []) {
        addFact(`¿Qué debes poder hacer al terminar “${moduleObj.title}”?`, objective);
    }
    for (const slide of moduleObj.lessonSlides || []) {
        for (const point of slide.keyPoints || []) {
            addFact(`Menciona una idea clave de “${slide.title}”.`, point);
        }
    }
    if (facts.length === 0 && moduleObj.summary) {
        addFact(`¿Cuál es la idea central de “${moduleObj.title}”?`, moduleObj.summary);
    }

    return facts.slice(0, count).map((fact, index) => {
        const options = shuffleOptions(
            facts.filter((_, factIndex) => factIndex !== index).map(otherFact => otherFact.answer),
            fact.answer,
            index
        );
        return {
            id: `material_q_${index + 1}`,
            type: options.length > 1 ? 'multiple_choice' : 'short_answer',
            statement: fact.question,
            options: options.length > 1 ? options : [],
            correctAnswer: fact.answer,
            explanation: 'Respuesta basada en el material de estudio de este módulo.'
        };
    });
}

export async function generateExamForModule(moduleObj, count = 10) {
    let aiError = null;
    if (localStorage.getItem('studypath_api_key')) {
        try {
            const prompt = getExamGenerationPrompt(moduleObj.title, moduleObj.summary, moduleObj.concepts, count);
            const result = await callGeminiAPI(prompt);
            return {
                questions: validateExamQuestions(result),
                source: 'ai'
            };
        } catch (error) {
            aiError = error;
        }
    }

    const questions = createMaterialBasedExam(moduleObj, count);
    if (questions.length === 0) {
        throw new Error(aiError
            ? `No se pudo generar el examen con IA (${aiError.message}) y este módulo no contiene material suficiente para crear uno localmente.`
            : 'No se pudo generar el examen: configura Gemini o agrega contenido de estudio al módulo.');
    }
    return {
        questions,
        source: 'module'
    };
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
            isCorrect = Boolean(userAns.trim()) && userAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
            score = isCorrect ? 1.0 : 0.0;
            feedback = isCorrect ? '¡Respuesta correcta!' : `Incorrecto. La respuesta correcta era: ${q.correctAnswer}. ${q.explanation}`;
        } else if (q.type === 'short_answer') {
            const normalizeAnswer = value => value.trim().toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\p{L}\p{N}]+/gu, ' ')
                .trim();
            const normalizedAnswer = normalizeAnswer(userAns);
            const expectedAnswer = normalizeAnswer(q.correctAnswer);
            const answerTokens = new Set(normalizedAnswer.split(/\s+/).filter(token => token.length > 2));
            const expectedTokens = expectedAnswer.split(/\s+/).filter(token => token.length > 2);
            const matchingTokens = expectedTokens.filter(token => answerTokens.has(token)).length;
            isCorrect = Boolean(normalizedAnswer) && Boolean(expectedAnswer) &&
                (normalizedAnswer === expectedAnswer ||
                    (expectedTokens.length > 0 && matchingTokens / expectedTokens.length >= 0.6));
            score = isCorrect ? 1.0 : 0.0;
            feedback = isCorrect ? 'Respuesta aceptada correctamente.' : `Respuesta incompleta. Criterio esperado: ${q.correctAnswer}.`;
        } else if (q.type === 'essay') {
            if (!userAns.trim()) {
                feedback = 'Escribe una respuesta para que pueda evaluarse.';
                details.push({
                    questionId: q.id,
                    statement: q.statement,
                    userAnswer: userAns,
                    correctAnswer: q.correctAnswer,
                    isCorrect: false,
                    score: 0,
                    feedback,
                    explanation: q.explanation
                });
                continue;
            }
            try {
                const gradingPrompt = getEssayGradingPrompt(q.statement, q.correctAnswer, userAns);
                const gradeResult = await callGeminiAPI(gradingPrompt);
                score = typeof gradeResult?.score === 'number' && Number.isFinite(gradeResult.score)
                    ? Math.max(0, Math.min(1, gradeResult.score))
                    : 0;
                isCorrect = score >= 0.7;
                feedback = gradeResult?.feedback || (score === 0
                    ? 'La respuesta no recibió puntaje automático válido.'
                    : 'Evaluado por IA.');
            } catch (e) {
                score = 0;
                feedback = 'No se pudo evaluar automáticamente con IA; no se otorgaron puntos: ' + e.message;
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