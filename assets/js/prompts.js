/**
 * prompts.js - Plantillas de prompts estructurados para la IA de Gemini
 */

export function getRouteGenerationPrompt(materialsSummary, objective, level, language, hoursPerWeek) {
    return `
Actúa como un profesor experto y diseñador instruccional. Genera una ruta de estudio personalizada basada estrictamente en los siguientes materiales de origen proporcionados por el usuario.

OBJETIVO DEL ESTUDIO: "${objective}"
NIVEL ACTUAL: "${level}"
IDIOMA DE SALIDA: "${language}"
DISPONIBILIDAD HORARIA: "${hoursPerWeek}" horas semanales.

MATERIALES DE ORIGEN:
${materialsSummary}

REGLAS ESTRICTAS:
1. Básate EXCLUSIVAMENTE en el contenido de los materiales provistos. No inventes datos externos ni supongas hechos que no aparezcan en el texto. Si la información es insuficiente, indícalo claramente en los resúmenes.
2. Devuelve la respuesta ÚNICAMENTE en formato JSON válido que cumpla estrictamente con el esquema requerido, sin texto adicional ni bloques markdown fuera del JSON si es posible.

ESQUEMA JSON ESPERADO:
{
  "title": "Título claro de la ruta",
  "description": "Breve descripción general",
  "estimatedWeeks": 2,
  "modules": [
    {
      "id": "mod_1",
      "title": "Título del Módulo 1",
      "objectives": ["Objetivo 1", "Objetivo 2"],
      "summary": "Resumen completo y detallado basado en los fragmentos...",
      "concepts": [
        {
          "term": "Concepto Clave",
          "definition": "Definición exacta extraída del material"
        }
      ],
      "examples": ["Ejemplo práctico 1"],
      "commonErrors": ["Error común o concepto confuso 1"],
      "estimatedHours": 4,
      "sourceReference": "Archivo / Fragmento de origen"
    }
  ],
  "flashcards": [
    {
      "id": "fc_1",
      "question": "¿Pregunta clave?",
      "answer": "Respuesta precisa"
    }
  ]
}
`;
}

export function getExamGenerationPrompt(moduleTitle, moduleSummary, conceptsJson, count = 5) {
    return `
Genera un examen de evaluación para el siguiente módulo de estudio.
MÓDULO: "${moduleTitle}"
RESUMEN: "${moduleSummary}"
CONCEPTOS CLAVE: ${JSON.stringify(conceptsJson)}

Genera ${count} preguntas variadas (opción múltiple, verdadero/falso, respuesta corta y desarrollo).
Devuelve la respuesta ÚNICAMENTE en formato JSON válido con esta estructura:
{
  "questions": [
    {
      "id": "q_1",
      "type": "multiple_choice", // "multiple_choice", "true_false", "short_answer", "essay"
      "statement": "Enunciado claro de la pregunta",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"], // Solo para multiple_choice, de lo contrario array vacío
      "correctAnswer": "Opción A", // Respuesta exacta o criterio de corrección
      "explanation": "Explicación detallada de por qué esta es la respuesta correcta basada en el módulo."
    }
  ]
}
`;
}

export function getEssayGradingPrompt(questionStatement, correctAnswer, userAnswer) {
    return `
Evalúa la respuesta abierta del estudiante en comparación con la respuesta esperada o rúbrica.
PREGUNTA: "${questionStatement}"
RESPUESTA ESPERADA / CRITERIO: "${correctAnswer}"
RESPUESTA DEL ESTUDIANTE: "${userAnswer}"

Devuelve la respuesta ÚNICAMENTE en JSON válido:
{
  "score": 0.85, // Número entre 0.0 y 1.0 indicando acierto
  "feedback": "Retroalimentación constructiva y detallada explicando aciertos y áreas de mejora."
}
`;
}

export function getChatContextPrompt(moduleContext, chatHistory, userQuestion) {
    return `
Eres un tutor virtual experto y amigable. Responde a la pregunta del estudiante basándote ÚNICAMENTE en el siguiente contexto de su material de estudio. Si la respuesta no se encuentra en el material, indícalo cortésmente y no inventes información.

CONTEXTO DEL MÓDULO:
${moduleContext}

HISTORIAL RECIENTE:
${chatHistory}

PREGUNTA DEL ESTUDIANTE:
${userQuestion}
`;
}