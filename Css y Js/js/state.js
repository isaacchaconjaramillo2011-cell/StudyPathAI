/**
 * state.js - Estado global de la aplicación y sistema de eventos reactivos
 */

class AppState {
    constructor() {
        this.state = {
            currentView: 'library',
            materials: [],
            routes: [],
            currentRoute: null,
            activeModule: null,
            theme: localStorage.getItem('studypath_theme') || 'light'
        };
        this.listeners = [];
    }

    get() {
        return this.state;
    }

    set(updater) {
        if (typeof updater === 'function') {
            this.state = { ...this.state, ...updater(this.state) };
        } else {
            this.state = { ...this.state, ...updater };
        }
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }
}

export const store = new AppState();