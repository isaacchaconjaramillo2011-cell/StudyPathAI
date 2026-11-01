/**
 * storage.js - Manejo de IndexedDB y localStorage para persistencia robusta
 */

const DB_NAME = 'StudyPathAI_DB';
const DB_VERSION = 1;
const STORE_MATERIALS = 'materials';
const STORE_ROUTES = 'routes';
const STORE_PROGRESS = 'progress';

export function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_MATERIALS)) {
                db.createObjectStore(STORE_MATERIALS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_ROUTES)) {
                db.createObjectStore(STORE_ROUTES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
                db.createObjectStore(STORE_PROGRESS, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(new Error('Error al abrir IndexedDB: ' + event.target.error));
    });
}

export async function dbSave(storeName, item) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);
        
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject(new Error('Error al guardar en ' + storeName + ': ' + event.target.error));
    });
}

export async function dbGet(storeName, id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        
        request.onsuccess = (event) => resolve(event.target.result || null);
        request.onerror = (event) => reject(new Error('Error al leer de ' + storeName + ': ' + event.target.error));
    });
}

export async function dbGetAll(storeName) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = (event) => resolve(event.target.result || []);
        request.onerror = (event) => reject(new Error('Error al listar ' + storeName + ': ' + event.target.error));
    });
}

export async function dbDelete(storeName, id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject(new Error('Error al eliminar de ' + storeName + ': ' + event.target.error));
    });
}

export async function exportAllData() {
    const materials = await dbGetAll(STORE_MATERIALS);
    const routes = await dbGetAll(STORE_ROUTES);
    const progress = await dbGetAll(STORE_PROGRESS);
    const settings = {
        apiKey: localStorage.getItem('studypath_api_key') || '',
        model: localStorage.getItem('studypath_model') || 'gemini-flash-latest',
        theme: localStorage.getItem('studypath_theme') || 'light'
    };

    return JSON.stringify({ materials, routes, progress, settings, version: 1, exportedAt: new Date().toISOString() }, null, 2);
}

export async function importAllData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (!data || !Array.isArray(data.materials) || !Array.isArray(data.routes)) {
            throw new Error('Formato de archivo de respaldo inválido o corrupto.');
        }

        const db = await openDatabase();
        
        // Importar materiales
        for (const mat of data.materials) {
            await dbSave(STORE_MATERIALS, mat);
        }
        // Importar rutas
        for (const route of data.routes) {
            await dbSave(STORE_ROUTES, route);
        }
        // Importar progreso
        if (Array.isArray(data.progress)) {
            for (const prog of data.progress) {
                await dbSave(STORE_PROGRESS, prog);
            }
        }
        // Importar ajustes
        if (data.settings) {
            if (data.settings.apiKey) localStorage.setItem('studypath_api_key', data.settings.apiKey);
            if (data.settings.model) localStorage.setItem('studypath_model', data.settings.model);
            if (data.settings.theme) localStorage.setItem('studypath_theme', data.settings.theme);
        }

        return true;
    } catch (error) {
        throw new Error('Fallo al importar datos: ' + error.message);
    }
}