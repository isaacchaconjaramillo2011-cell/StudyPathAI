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
2. Organiza el contenido como una ruta progresiva de 3 a 6 módulos, desde fundamentos hasta aplicación, sin repetir temas. Cada módulo debe poder estudiarse por separado y tener objetivos, resumen, conceptos clave y evaluación.
3. Cada módulo debe incluir de 3 a 6 diapositivas breves y didácticas. Cada diapositiva necesita título, explicación basada en el material y de 2 a 4 puntos clave.
4. Cada módulo debe incluir de 3 a 8 tarjetas de estudio. Las preguntas y respuestas deben cubrir definiciones, relaciones y elementos que el estudiante debe recordar; usa los conceptos del material.
5. Si el material no alcanza para cubrir un punto, dilo explícitamente en vez de rellenar con información inventada.
6. Devuelve ÚNICAMENTE JSON válido, sin comentarios, texto adicional ni bloques Markdown.

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
      "sourceReference": "Archivo / Fragmento de origen",
      "lessonSlides": [
        {
          "title": "Fundamento del tema",
          "content": "Explicación basada en el material",
          "keyPoints": ["Idea clave 1", "Idea clave 2"]
        },
        {
          "title": "Conceptos y relaciones",
          "content": "Desarrollo de conceptos relacionados del material",
          "keyPoints": ["Relación clave 1", "Relación clave 2"]
        },
        {
          "title": "Aplicación y repaso",
          "content": "Aplicación o ejemplo extraído del material",
          "keyPoints": ["Aplicación clave 1", "Conclusión clave 2"]
        }
      ],
      "flashcards": [
        {
          "id": "fc_1",
          "question": "¿Qué significa el concepto clave?",
          "answer": "Definición precisa basada en el material"
        },
        {
          "id": "fc_2",
          "question": "¿Cómo se relacionan los conceptos principales?",
          "answer": "Relación explicada en el material"
        },
        {
          "id": "fc_3",
          "question": "¿Qué elemento debes recordar para aplicar el tema?",
          "answer": "Elemento esencial basado en el material"
        }
      ]
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

Genera exactamente ${count} preguntas de evaluación, únicamente de opción múltiple o verdadero/falso. No generes respuesta corta ni desarrollo: todas las preguntas deben poder corregirse localmente sin otra llamada a la IA.
En verdadero/falso, usa las opciones "Verdadero" y "Falso". Para opción múltiple incluye entre dos y cuatro opciones distintas y una respuesta correcta que coincida exactamente con una de ellas. Evita preguntas ambiguas, usa preguntas y respuestas breves, y basa cada respuesta en el material del módulo.
Devuelve únicamente JSON válido, sin comentarios ni texto adicional:
{
  "questions": [
    {
      "id": "q_1",
      "type": "multiple_choice",
      "statement": "Enunciado claro de la pregunta",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctAnswer": "Opción A",
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
  "score": 0.85,
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