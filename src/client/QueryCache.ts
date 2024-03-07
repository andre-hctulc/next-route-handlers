import hash from "stable-hash";

/*
Independent Memory Cache
*/

/**
 * Query state
 * */
export type QueryState = {
    isRevalidating: Promise<any> | null;
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
export type QueryCacheMutate = (state: QueryState) => boolean | { newData: any };
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

    /** Remnoves an entry and notifies listeners */
    delete(key: QueryCacheKey | string) {
        const k = this.serializeKey(key);
        this.#cache.delete(k);
        this.notifyListeners(k, null);
    }

    // * Mutate

    /** Updates a query state and notfies listeners */
    update(key: QueryCacheKey | string, state: QueryStateUpdate) {
        const k = this.serializeKey(key);
        /** Current Status */
        const currentState = this.#cache.get(k);
        /** New Status */
        const newState: QueryState = {
            // Default Values
            data: undefined,
            error: null,
            isRevalidating: null,
            tags: new Set<string>(),
            timestamp: undefined,
            response: null,
            // Current Status
            ...currentState,
        };

        // Set tags
        if (!state.tags) state.tags = new Set();
        state.tags?.forEach(t => newState.tags.add(t));

        // Set data
        if (state.data !== undefined) {
            newState.data = state.data;

            // update timestamp
            if (state.data === null) newState.timestamp = undefined;
            else {
                const now = new Date().getTime();
                newState.timestamp = now;
            }
        }

        // Set revalidating
        if (state.isRevalidating !== undefined) newState.isRevalidating = state.isRevalidating;

        // Error
        if (state.error !== undefined) newState.error = state.error;

        // Set state
        this.#cache.set(k, newState);
        // notify listeners
        this.notifyListeners(k, newState);
    }

    /** Mutates entries and notifies listeners */
    mutate(mutator: QueryCacheMutate) {
        for (const k of this.#cache.keys()) {
            const state = this.#cache.get(k)!;
            const mutated = mutator(state);
            if (mutated === false) continue;
            if (mutated === true) this.delete(k);
            else this.update(k, { data: mutated.newData });
        }
    }
}
