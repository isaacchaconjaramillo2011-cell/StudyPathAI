/**
 * app.js - Arranque principal, enrutamiento de vistas y renderizado de componentes UI
 */
import { store } from './state.js';
import { dbGetAll, dbSave, dbDelete, exportAllData, importAllData } from './storage.js';
import { extractTextFromFile } from './extract.js';
import { generateStudyRoute } from './route.js';
import { generateExamForModule, gradeExam } from './exam.js';
import { testApiConnection } from './ai.js';
import { getAdaptiveRecommendations, identifyWeakTopics } from './progress.js';

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupNavigation();
    await loadInitialData();
    renderCurrentView();
});

function initTheme() {
    const theme = localStorage.getItem('studypath_theme') || 'light';
    document.documentElement.className = theme;
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
        toggleBtn.addEventListener('click', () => {
            const current = document.documentElement.className;
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.className = next;
            localStorage.setItem('studypath_theme', next);
            toggleBtn.textContent = next === 'dark' ? '☀️' : '🌙';
        });
    }
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const view = btn.getAttribute('data-view');
            store.set({ currentView: view });
            renderCurrentView();
        });
    });
}

async function loadInitialData() {
    try {
        const materials = await dbGetAll('materials');
        const routes = await dbGetAll('routes');
        store.set({ materials, routes });
    } catch (e) {
        showToast('Error al cargar datos locales: ' + e.message, 'error');
    }
}

function renderCurrentView() {
    const container = document.getElementById('app-container');
    const { currentView } = store.get();

    document.querySelectorAll('.nav-btn').forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-view') === currentView);
    });

    container.innerHTML = '';
    switch (currentView) {
        case 'generator':
            container.innerHTML = renderGeneratorView();
            setupGeneratorEvents();
            break;
        case 'routes':
            container.innerHTML = renderRoutesView();
            setupRoutesEvents();
            break;
        case 'progress':
            container.innerHTML = renderProgressView();
            break;
        case 'settings':
            container.innerHTML = renderSettingsView();
            setupSettingsEvents();
            break;
        default:
            container.innerHTML = renderGeneratorView();
            setupGeneratorEvents();
    }
}

// --- VISTA PRINCIPAL INTUITIVA (CREAR RUTA Y ARCHIVOS) ---
function renderGeneratorView() {
    const { materials } = store.get();
    const readyMaterials = materials.filter(m => m.status === 'ready');

    return `
        <div class="view-section">
            <div class="view-header" style="text-align: center; margin-bottom: 1.5rem;">
                <h2>StudyPath AI</h2>
                <p class="text-muted">Sube tus materiales de estudio y genera tu ruta de aprendizaje en un solo clic.</p>
            </div>

            <div class="card" style="max-width: 750px; margin: 0 auto;">
                <!-- Zona de carga intuitiva -->
                <div class="dropzone" id="generator-dropzone">
                    <p style="font-size: 1.1rem; font-weight: 600;">📁 Arrastra tus archivos aquí o haz clic para seleccionarlos</p>
                    <p class="text-sm text-muted" style="margin-top: 0.5rem;">Soporta PDF, DOCX, TXT, Markdown e Imágenes</p>
                    <input type="file" id="generator-file-input" multiple accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" class="hidden">
                </div>

                <!-- Lista de archivos subidos -->
                <div id="generator-file-list" style="margin: 1.5rem 0;">
                    ${materials.length === 0 ? '<p class="text-muted text-center" style="font-style: italic;">Aún no has subido ningún material.</p>' : 
                      materials.map(m => `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-color); padding: 10px 14px; border-radius: var(--radius); margin-bottom: 0.5rem; border: 1px solid var(--border-color);">
                            <span style="font-size: 0.9rem; font-weight: 500;">📄 ${escapeHtml(m.name)} <span class="text-muted">(${escapeHtml(m.pagesOrWords)})</span></span>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span class="status-badge status-${m.status}">${m.status === 'ready' ? 'Listo' : m.status}</span>
                                <button class="btn btn-secondary btn-sm delete-material" data-id="${m.id}" style="padding: 2px 8px; font-size: 0.8rem;">✕</button>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Formulario dinámico que aparece solo si hay archivos listos -->
                <form id="route-generator-form" style="margin-top: 1.5rem; display: ${readyMaterials.length > 0 ? 'block' : 'none'};">
                    <div class="form-group">
                        <label>¿Qué objetivo de estudio quieres lograr?</label>
                        <input type="text" id="route-objective" placeholder="Ej: Aprobar el examen de física, dominar JavaScript..." required style="width: 100%;">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group">
                            <label>Nivel:</label>
                            <select id="route-level" style="width: 100%;">
                                <option value="principiante">Principiante</option>
                                <option value="intermedio" selected>Intermedio</option>
                                <option value="avanzado">Avanzado</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Horas semanales:</label>
                            <input type="number" id="route-hours" value="5" min="1" max="40" style="width: 100%;">
                        </div>
                    </div>

                    <!-- Botón intuitivo principal -->
                    <button type="submit" id="start-path-btn" class="btn" style="width: 100%; margin-top: 1.5rem; padding: 0.875rem; font-size: 1.1rem; font-weight: bold; text-align: center;">
                        🚀 Empezar ruta de estudio
                    </button>
                </form>
            </div>
        </div>
    `;
}

function setupGeneratorEvents() {
    const dropzone = document.getElementById('generator-dropzone');
    const fileInput = document.getElementById('generator-file-input');
    const form = document.getElementById('route-generator-form');

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files) {
                await handleFilesUpload(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener('change', async (e) => {
            if (e.target.files) {
                await handleFilesUpload(e.target.files);
            }
            fileInput.value = '';
        });
    }

    document.querySelectorAll('.delete-material').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            await dbDelete('materials', id);
            const materials = await dbGetAll('materials');
            store.set({ materials });
            renderCurrentView();
            showToast('Material eliminado.', 'success');
        });
    });

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { materials } = store.get();
        const readyMaterials = materials.filter(m => m.status === 'ready');

        if (readyMaterials.length === 0) {
            showToast('Sube al menos un material válido.', 'warning');
            return;
        }

        const objective = document.getElementById('route-objective').value;
        const level = document.getElementById('route-level').value;
        const hoursPerWeek = parseInt(document.getElementById('route-hours').value) || 5;

        const startBtn = document.getElementById('start-path-btn');
        startBtn.textContent = '⏳ Creando tu ruta inteligente...';
        startBtn.disabled = true;

        showToast('Generando ruta de estudio con Gemini... Por favor espera.', 'success', 6000);

        try {
            const newRoute = await generateStudyRoute(readyMaterials, { objective, level, hoursPerWeek, language: 'Español' });
            const routes = await dbGetAll('routes');
            store.set({ routes, currentRoute: newRoute, currentView: 'routes' });
            renderCurrentView();
            showToast('¡Ruta de estudio generada con éxito!', 'success');
        } catch (error) {
            startBtn.textContent = '🚀 Empezar ruta de estudio';
            startBtn.disabled = false;
            showToast('Error al generar la ruta: ' + error.message, 'error', 8000);
        }
    });
}

async function handleFilesUpload(fileList) {
    for (const file of fileList) {
        const materialId = 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
        const newMaterial = {
            id: materialId,
            name: file.name,
            size: file.size,
            status: 'processing',
            pagesOrWords: 'Procesando...',
            text: '',
            isScannedPdf: false
        };

        const currentMaterials = store.get().materials;
        store.set({ materials: [newMaterial, ...currentMaterials] });
        renderCurrentView();

        try {
            const extracted = await extractTextFromFile(file);
            newMaterial.text = extracted.text;
            newMaterial.pagesOrWords = extracted.pagesOrWords;
            newMaterial.isScannedPdf = extracted.isScannedPdf;
            if (extracted.imageBase64) {
                newMaterial.imageBase64 = extracted.imageBase64;
                newMaterial.mimeType = extracted.mimeType;
            }
            if (newMaterial.isScannedPdf) {
                newMaterial.status = 'error';
                newMaterial.pagesOrWords = `${extracted.pagesOrWords}: sin texto extraíble.`;
                showToast(`El PDF "${file.name}" parece escaneado.`, 'warning', 6000);
            } else {
                newMaterial.status = 'ready';
            }
        } catch (error) {
            newMaterial.status = 'error';
            newMaterial.pagesOrWords = error.message;
            showToast(`Error en "${file.name}": ${error.message}`, 'error', 6000);
        }

        await dbSave('materials', newMaterial);
        store.set({ materials: await dbGetAll('materials') });
        renderCurrentView();
    }
}

// --- VISTA 2: MIS RUTAS ---
function renderRoutesView() {
    const { routes, currentRoute } = store.get();

    if (!currentRoute && routes.length > 0) {
        store.set({ currentRoute: routes[0] });
    }

    const active = store.get().currentRoute;
    const adaptiveRecommendations = active
        ? getAdaptiveRecommendations(active.modules, active.progress?.examResults || [])
        : [];

    return `
        <div class="view-section">
            <div class="view-header">
                <h2>Mis Rutas de Estudio</h2>
                <select id="route-selector" class="form-group" style="margin-bottom:0; padding: 0.5rem;">
                    ${routes.length === 0 ? '<option>No hay rutas creadas</option>' :
                      routes.map(r => `<option value="${r.id}" ${active?.id === r.id ? 'selected' : ''}>${escapeHtml(r.title)}</option>`).join('')}
                </select>
            </div>
            ${!active ? '<div class="card"><p class="text-muted">No tienes ninguna ruta seleccionada o creada. Ve a "Crear Ruta".</p></div>' : `
                <div class="card">
                    <h3>${escapeHtml(active.title)}</h3>
                    <p class="text-muted" style="margin-top: 0.5rem;">${escapeHtml(active.description)}</p>
                    <hr style="margin: 1rem 0; border:0; border-top: 1px solid var(--border-color);">
                    ${active.progress?.examResults?.length ? `
                        <div class="card" style="border-left: 4px solid var(--warning-color); margin: 1rem 0;">
                            <h4>Ruta adaptada según tus resultados</h4>
                            ${adaptiveRecommendations.length ? `
                                <p class="text-muted" style="margin-top: 0.5rem;">Prioriza estos módulos en tu próximo repaso:</p>
                                <ul style="margin: 0.5rem 0 0 1.25rem;">
                                    ${adaptiveRecommendations.map(item => `
                                        <li>
                                            <strong>${escapeHtml(item.moduleTitle)}</strong> — promedio ${item.averageScore.toFixed(1)}%.
                                            ${item.weakTopics.length
                                                ? ` Refuerza: ${item.weakTopics.map(topic => escapeHtml(topic.topic)).join(', ')}.`
                                                : ''}
                                        </li>
                                    `).join('')}
                                </ul>
                            ` : '<p class="text-muted" style="margin-top: 0.5rem;">Buen dominio de los módulos evaluados.</p>'}
                        </div>
                    ` : ''}
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        ${active.modules.map((mod, index) => `
                            <div class="card" style="border-left: 4px solid var(--primary-color);">
                                <h4>Módulo ${index + 1}: ${escapeHtml(mod.title)}</h4>
                                <p class="text-sm text-muted" style="margin-top: 0.25rem;">Estimado: ${mod.estimatedHours} horas</p>
                                <p style="margin-top: 0.5rem;">${escapeHtml(mod.summary)}</p>
                                <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                                    <button class="btn btn-secondary start-exam-btn" data-mod-index="${index}">Realizar Examen del Módulo</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `}
        </div>
    `;
}

function setupRoutesEvents() {
    const selector = document.getElementById('route-selector');
    if (selector) {
        selector.addEventListener('change', (e) => {
            const routeId = e.target.value;
            const found = store.get().routes.find(r => r.id === routeId);
            if (found) {
                store.set({ currentRoute: found });
                renderCurrentView();
            }
        });
    }

    document.querySelectorAll('.start-exam-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const modIndex = parseInt(e.target.getAttribute('data-mod-index'));
            const activeRoute = store.get().currentRoute;
            const mod = activeRoute.modules[modIndex];

            showToast('Generando examen interactivo con IA...', 'success', 4000);
            try {
                const questions = await generateExamForModule(mod);
                openExamModal(mod, questions);
            } catch (err) {
                showToast('Error al generar examen: ' + err.message, 'error');
            }
        });
    });
}

function openExamModal(mod, questions) {
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');
    
    let userAnswers = {};

    modal.innerHTML = `
        <div class="modal-content">
            <h3>Examen: ${escapeHtml(mod.title)}</h3>
            <form id="exam-form" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1.5rem;">
                ${questions.map((q, idx) => `
                    <div class="form-group">
                        <label style="font-weight: 600;">${idx + 1}. ${escapeHtml(q.statement)}</label>
                        ${q.type === 'multiple_choice' ? q.options.map(opt => `
                            <label style="font-weight: normal; display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                                <input type="radio" name="q_${q.id}" value="${escapeHtml(opt)}" required> ${escapeHtml(opt)}
                            </label>
                        `).join('') : `
                            <textarea name="q_${q.id}" rows="3" placeholder="Escribe tu respuesta aquí..." required style="margin-top: 0.5rem;"></textarea>
                        `}
                    </div>
                `).join('')}
                <div style="display: flex; justify-content: flex-end; gap: 1rem;">
                    <button type="button" class="btn btn-secondary" id="close-modal-btn">Cancelar</button>
                    <button type="submit" class="btn">Enviar Examen</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    document.getElementById('exam-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        for (const [key, val] of formData.entries()) {
            const qId = key.replace('q_', '');
            userAnswers[qId] = val;
        }

        showToast('Corrigiendo examen...', 'success');
        try {
            const result = await gradeExam(questions, userAnswers);
            const activeRoute = store.get().currentRoute;
            const updatedRoute = {
                ...activeRoute,
                progress: {
                    ...activeRoute.progress,
                    examResults: [
                        ...(activeRoute.progress?.examResults || []),
                        {
                            completedAt: new Date().toISOString(),
                            moduleId: mod.id,
                            moduleTitle: mod.title,
                            ...result
                        }
                    ]
                }
            };
            await dbSave('routes', updatedRoute);
            const routes = await dbGetAll('routes');
            store.set({ routes, currentRoute: updatedRoute });
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>Resultados del Examen</h3>
                    <p style="font-size: 1.25rem; font-weight: bold; margin: 1rem 0;">Puntaje obtenido: ${result.scorePercentage.toFixed(1)}% (${result.correctCount}/${result.totalQuestions} correctas)</p>
                    <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 50vh; overflow-y: auto;">
                        ${result.details.map((d, i) => `
                            <div class="card" style="border-left: 4px solid ${d.isCorrect ? 'var(--success-color)' : 'var(--danger-color)'};">
                                <p style="font-weight: 600;">${i + 1}. ${escapeHtml(d.statement)}</p>
                                <p class="text-sm" style="margin-top: 0.25rem;">Tu respuesta: ${escapeHtml(d.userAnswer)}</p>
                                <p class="text-sm text-muted" style="margin-top: 0.25rem;">${escapeHtml(d.feedback)}</p>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 1.5rem; text-align: right;">
                        <button type="button" class="btn" id="finish-exam-modal">Cerrar</button>
                    </div>
                </div>
            `;
            document.getElementById('finish-exam-modal').addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        } catch (err) {
            showToast('Error al calificar: ' + err.message, 'error');
        }
    });
}

// --- VISTA 3: PROGRESO ---
function renderProgressView() {
    const routes = store.get().routes;
    const examResults = routes.flatMap(route =>
        (route.progress?.examResults || []).map(result => ({
            ...result,
            routeTitle: route.title
        }))
    );
    const averageScore = examResults.length
        ? examResults.reduce((total, result) => total + result.scorePercentage, 0) / examResults.length
        : 0;
    const weakTopics = identifyWeakTopics(examResults).slice(0, 5);

    return `
        <div class="view-section">
            <div class="view-header">
                <h2>Progreso y Métricas de Estudio</h2>
            </div>
            <div class="card">
                <p class="text-muted">Resumen de tus exámenes realizados y temas a reforzar.</p>
                <div style="margin-top: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div class="card" style="text-align: center;">
                        <h3>${examResults.length}</h3>
                        <p class="text-sm text-muted">Exámenes realizados</p>
                    </div>
                    <div class="card" style="text-align: center;">
                        <h3>${averageScore.toFixed(1)}%</h3>
                        <p class="text-sm text-muted">Puntaje promedio</p>
                    </div>
                    <div class="card" style="text-align: center;">
                        <h3>${routes.length}</h3>
                        <p class="text-sm text-muted">Rutas creadas</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- VISTA 4: AJUSTES ---
function renderSettingsView() {
    const apiKey = localStorage.getItem('studypath_api_key') || '';
    const model = localStorage.getItem('studypath_model') || 'gemini-flash-latest';

    return `
        <div class="view-section">
            <div class="view-header">
                <h2>Ajustes y Configuración</h2>
            </div>
            <div class="card">
                <form id="settings-form">
                    <div class="form-group">
                        <label>Google Gemini API Key:</label>
                        <input type="password" id="settings-api-key" value="${escapeHtml(apiKey)}" placeholder="Pega tu API Key de Gemini aquí" required>
                    </div>
                    <div class="form-group">
                        <label>Modelo de Gemini:</label>
                        <input type="text" id="settings-model" value="${escapeHtml(model)}" required>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem; flex-wrap: wrap;">
                        <button type="submit" class="btn">Guardar Ajustes</button>
                        <button type="button" id="test-connection-btn" class="btn btn-secondary">Probar Conexión</button>
                        <button type="button" id="export-backup-btn" class="btn btn-secondary">Exportar Datos</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function setupSettingsEvents() {
    const form = document.getElementById('settings-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const apiKey = document.getElementById('settings-api-key').value.trim();
        const model = document.getElementById('settings-model').value.trim();

        localStorage.setItem('studypath_api_key', apiKey);
        localStorage.setItem('studypath_model', model);
        showToast('Ajustes guardados correctamente.', 'success');
    });

    document.getElementById('test-connection-btn').addEventListener('click', async () => {
        const apiKey = document.getElementById('settings-api-key').value.trim();
        const model = document.getElementById('settings-model').value.trim();
        if (!apiKey) {
            showToast('Ingresa una API Key para probar.', 'warning');
            return;
        }

        showToast('Probando conexión con Gemini...', 'success');
        try {
            await testApiConnection(apiKey, model);
            showToast('¡Conexión exitosa con Gemini!', 'success');
        } catch (err) {
            showToast('Fallo de conexión: ' + err.message, 'error');
        }
    });

    document.getElementById('export-backup-btn').addEventListener('click', async () => {
        try {
            const jsonStr = await exportAllData();
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `studypath_backup_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Copia exportada con éxito.', 'success');
        } catch (err) {
            showToast('Error al exportar: ' + err.message, 'error');
        }
    });
}

// Utilidades UI
function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}