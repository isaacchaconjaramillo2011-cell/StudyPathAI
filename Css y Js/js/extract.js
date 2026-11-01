/**
 * extract.js - Extracción de texto por tipo de archivo (PDF, DOCX, TXT, MD, Imágenes)
 */

export async function extractTextFromFile(file) {
    if (!file) {
        throw new Error('No se seleccionó ningún archivo.');
    }

    if (file.size === 0) {
        throw new Error(`El archivo "${file.name}" está vacío.`);
    }

    const extension = file.name.split('.').pop().toLowerCase();

    // Límite de 25MB por archivo
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        throw new Error(`El archivo "${file.name}" excede el límite máximo de 25MB.`);
    }

    switch (extension) {
        case 'txt':
        case 'md':
            return await extractTextFromPlainText(file);
        case 'pdf':
            return await extractTextFromPDF(file);
        case 'docx':
            return await extractTextFromDOCX(file);
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'webp':
            return await extractTextFromImage(file);
        default:
            throw new Error(`Formato de archivo no soportado: .${extension}. Use PDF, DOCX, TXT, MD o imágenes.`);
    }
}

async function extractTextFromPlainText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ text: e.target.result, pagesOrWords: countWords(e.target.result) + ' palabras', isScannedPdf: false });
        reader.onerror = () => reject(new Error('Error al leer archivo de texto plano.'));
        reader.readAsText(file);
    });
}

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    try {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        let fullText = '';
        const numPages = pdfDoc.numPages;

        for (let i = 1; i <= numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const tokenizedText = await page.getTextContent();
            const pageText = tokenizedText.items.map(item => item.str).join(' ');
            fullText += `\n--- Página ${i} ---\n` + pageText;
        }

        const trimmed = fullText.trim();
        if (!trimmed && numPages > 0) {
            return {
                text: '',
                pagesOrWords: `${numPages} páginas (Escaneado)`,
                isScannedPdf: true
            };
        }

        return {
            text: trimmed,
            pagesOrWords: `${numPages} páginas`,
            isScannedPdf: false
        };
    } catch (error) {
        throw new Error('Error al procesar el documento PDF: ' + error.message);
    }
}

async function extractTextFromDOCX(file) {
    const arrayBuffer = await file.arrayBuffer();
    try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value.trim();
        if (!text) {
            throw new Error('El documento DOCX no contiene texto extraíble.');
        }
        return {
            text: text,
            pagesOrWords: countWords(text) + ' palabras',
            isScannedPdf: false
        };
    } catch (error) {
        throw new Error('Error al procesar el archivo DOCX: ' + error.message);
    }
}

async function extractTextFromImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            resolve({
                text: `[Imagen adjunta para análisis multimodal: ${file.name}]`,
                pagesOrWords: '1 imagen',
                isScannedPdf: false,
                imageBase64: e.target.result.split(',')[1],
                mimeType: file.type
            });
        };
        reader.onerror = () => reject(new Error('Error al leer la imagen.'));
        reader.readAsDataURL(file);
    });
}

function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
}