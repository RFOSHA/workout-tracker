import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'wt-settings';

export interface AppSettings {
    timerEnabled: boolean;
    restDuration: number; // seconds
    rirEnabled: boolean;
}

const DEFAULTS: AppSettings = {
    timerEnabled: true,
    restDuration: 90,
    rirEnabled: true
};

function load(): AppSettings {
    if (!browser) return DEFAULTS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
        return DEFAULTS;
    }
}

function save(value: AppSettings) {
    if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function createSettings() {
    const { subscribe, set, update } = writable<AppSettings>(load());

    return {
        subscribe,
        set(value: AppSettings) {
            save(value);
            set(value);
        },
        update(fn: (s: AppSettings) => AppSettings) {
            update(current => {
                const next = fn(current);
                save(next);
                return next;
            });
        }
    };
}

export const settings = createSettings();
