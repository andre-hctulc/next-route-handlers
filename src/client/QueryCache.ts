import hash from "stable-hash";

/*
Independent from less types/api
*/

/**
 * Query state
 * */
export type QueryState = {
    isRevalidating: Promise<any> | null;
    /**
     * Daten in ein Objekt setzen, um _undefined_ als Wert identifizieren zu können
     * Sollten erst nach dem Laden von Daten aktualisert werden. Nicht schon während des Ladens, um `keepPreviousValue` zu realisieren!
     * */
    data: { d: any } | null | undefined;
    error: Error | null;
    /** Zeitstempel des Zeitpunktes, in dem `data` das letzte mal im Status gesetzt wurden */
    timestamp: number | undefined;
    tags: Set<string>;
    response: Response | null;
};

export type QueryCacheKey = object | string;
export type QueryCacheStateListener = (state: QueryState | null, queueIndex: number) => void;

/**
 * If **not** _undefined_ is returned, the return value is used as the new data
 * */
export type QueryCacheMutate = ((state: QueryState) => any) | { key: QueryCacheKey; data: any };
export type QueryCacheDelete = (state: QueryState) => boolean | QueryCacheKey;
type QueryStateUpdate = Partial<Omit<QueryState, "timestamp" | "key" | "tags" | "data">> & {
    tags?: string[] | undefined | Set<string>;
    data?: { d: any } | null;
};

/**
 * Memory-Cache for async/simultanious requests to data sources (e.g. `fetch`).
 */
export default class QueryCache {
    #cache: Map<string, QueryState> = new Map();
    #listeners: Map<string, Set<QueryCacheStateListener>> = new Map();

    // * Key

    static serializeKey(key: any | string) {
        try {
            return hash(key);
        } catch (err) {
            throw new Error("Invalid cache key");
        }
    }

    serializeKey(key: QueryCacheKey | string) {
        if (typeof key === "string") return key;
        return QueryCache.serializeKey(key);
    }

    // * Listeners

    addListener(key: QueryCacheKey | string, listener: QueryCacheStateListener) {
        const k = this.serializeKey(key);
        if (this.#listeners.has(k)) this.#listeners.get(k)!.add(listener);
        else this.#listeners.set(k, new Set([listener]));
    }

    removeListener(key: QueryCacheKey | string, listener: QueryCacheStateListener) {
        const k = this.serializeKey(key);
        this.#listeners.get(k)?.delete(listener);
    }

    private notifyListeners(key: string, state: QueryState | null) {
        const listeners = this.#listeners.get(key);
        if (!listeners?.size) return;
        let i = 0;
        listeners.forEach(l => l(state, i++));
    }

    // * Map

    keys() {
        return this.#cache.keys();
    }

    get(key: QueryCacheKey | string) {
        const k = this.serializeKey(key);
        return this.#cache.get(k);
    }

    has(key: QueryCacheKey) {
        const k = this.serializeKey(key);
        return this.#cache.has(k);
    }

    /** Entfernt einen Eintrag aus dem Cache und benachrichtigt Listeners */
    delete(key: QueryCacheKey | string) {
        const k = this.serializeKey(key);
        this.#cache.delete(k);
        this.notifyListeners(k, null);
    }

    // * Mutate

    /** Aktualisiert den Status einer Query benachrichtigt Listeners */
    update(key: QueryCacheKey | string, state: QueryStateUpdate) {
        const k = this.serializeKey(key);
        /** Aktueller Status */
        const currentState = this.#cache.get(k);
        /** Neuer Status */
        const newState: QueryState = {
            // Default Values
            data: undefined,
            error: null,
            isRevalidating: null,
            tags: new Set<string>(),
            timestamp: undefined,
            response: null,
            // Aktueller Status (falls vorhanden)
            ...currentState,
        };

        // * Tags
        // TODO Hier sind evtl noch tags von ounmounted queries enthalten!
        state.tags?.forEach(t => newState.tags.add(t));

        // * Daten setzen (Wenn nicht undefined)

        if (state.data !== undefined) {
            newState.data = state.data;

            // Timestamp aktualisieren
            if (state.data === null) newState.timestamp = undefined;
            else {
                const now = new Date().getTime();
                newState.timestamp = now;
            }
        }

        // * isRevalidating
        if (state.isRevalidating !== undefined) newState.isRevalidating = state.isRevalidating;

        // * Error
        if (state.error !== undefined) newState.error = state.error;

        // * In Cache setzen + Listener benachrichtigen
        this.#cache.set(k, newState);
        this.notifyListeners(k, newState);
    }

    /** Ändert Einträge aus dem Cache und benachrichtigt Listeners */
    mutate(mutator: QueryCacheMutate) {
        if (typeof mutator === "function") {
            for (const k of this.#cache.keys()) {
                const state = this.#cache.get(k)!;
                const newData = mutator(state);
                if (newData !== undefined) this.update(k, { data: newData });
            }
        } else {
            this.update(mutator.key, { data: mutator.data });
        }
    }

    /** Entfernt Einträge aus dem Cache und benachrichtigt Listeners */
    remove(del: QueryCacheDelete) {
        if (typeof del === "function") {
            // Keys vorher bestimmen, da in dem Loop Einträge entfernt werden
            const keys = Array.from(this.#cache.keys());
            // const tags = Array.from(this.#cache.values()).map(state => Array.from(state.tags));

            for (const k of keys) {
                const state = this.#cache.get(k)!;
                const reval = del(state);
                if (reval) this.delete(k);
            }
        } else this.delete(del);
    }
}
