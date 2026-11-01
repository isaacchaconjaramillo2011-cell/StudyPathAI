/**
 * ai.js - Cliente de Gemini, reintentos con espera exponencial, validación JSON y manejo de errores HTTP
 */

export async function callGeminiAPI(promptText, images = []) {
    const apiKey = localStorage.getItem('studypath_api_key');
    const model = localStorage.getItem('studypath_model') || 'gemini-flash-latest';

    if (!apiKey) {
        throw new Error('API Key de Gemini no configurada. Por favor, ingrésala en la sección de Ajustes.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts = [{ text: promptText }];
    for (const image of images) {
        if (image.base64 && image.mimeType) {
            parts.push({
                inlineData: {
                    mimeType: image.mimeType,
                    data: image.base64
                }
            });
        }
    }

    const payload = {
        contents: [{ parts }],
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    let retries = 3;
    let delay = 1000;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const status = response.status;
                
                if (status === 400) throw new Error('Solicitud inválida (400): Verifique los parámetros o la API key.');
                if (status === 401 || status === 403) throw new Error('Error de autenticación (401/403): API Key inválida o sin permisos.');
                if (status === 429) throw new Error('Cuota excedida (429): Límite de solicitudes alcanzado. Reintentando...');
                if (status >= 500) throw new Error(`Error del servidor de Google (${status}). Reintentando...`);
                
                throw new Error(`Error HTTP ${status}: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];
            if (!candidate || !candidate.content?.parts?.[0]?.text) {
                throw new Error('La respuesta de la IA está vacía o malformada.');
            }

            const rawText = candidate.content.parts[0].text;
            return parseAndValidateJSON(rawText);

        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            // Si es error 429 o 5xx, aplicamos espera exponencial
            if (error.message.includes('429') || error.message.includes('500') || error.message.includes('Reintentando')) {
                await new Promise(res => setTimeout(res, delay));
                delay *= 2;
                continue;
            }
            throw error;
        }
    }
}

function parseAndValidateJSON(rawText) {
    let cleanText = rawText.trim();
    // Remover bloques markdown si los tuviera
    if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    try {
        return JSON.parse(cleanText);
    } catch (e) {
        throw new Error('La IA devolvió un JSON inválido que no pudo parsearse: ' + e.message);
    }
}

export async function testApiConnection(apiKey, model = 'gemini-flash-latest') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: 'Responde estrictamente con un JSON válido que contenga la propiedad "status": "ok".' }] }],
        generationConfig: { responseMimeType: "application/json" }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Conexión fallida (HTTP ${response.status})`);
    }
    return true;
}