import { useLess } from "./LessProvider";
import type { Desc, Params, LessResponseValue } from "../../types";
import type { QueryCacheMutate, QueryState } from "../QueryCache";

// * Tags

/** Tag that is applied to all streamers */
export const streamerTag = "__less_streamer";

/** Logic: **and**[...(**or**[..._tags_] | _tag_)] */
export type QueryTagFilter = (string | string[])[] | { andOr?: (string | string[])[]; not?: string[] };

function stateIncludesTagsAndOr(state: QueryState, tagsFilter: Extract<QueryTagFilter, any[]>) {
    const tags = state.tags;
    if (!tags?.size) return false;
    return tagsFilter.every(tagOrTagArr => {
        if (typeof tagOrTagArr === "string") return tags.has(tagOrTagArr);
        else return tagOrTagArr.some(tag => tags.has(tag));
    });
}

function stateIncludesTags(state: QueryState, tagsFilter: QueryTagFilter) {
    if (Array.isArray(tagsFilter)) return stateIncludesTagsAndOr(state, tagsFilter);
    else {
        if (!tagsFilter.andOr && !tagsFilter.not) return false;
        return (
            (!tagsFilter.andOr || stateIncludesTagsAndOr(state, tagsFilter.andOr)) && (!tagsFilter.not || !tagsFilter.not.some(excludeTag => state.tags.has(excludeTag)))
        );
    }
}

//* Query Key

/** Key type */
export type LessQueryKey = {
    desc: string;
    params: object;
    streamer: boolean | undefined;
    cognito: string | undefined;
};

export type QueryKeyFilter = string[] | ((key: any) => boolean);
export type DataMutation<T> = T | ((previousData: T | undefined) => Promise<T> | T) | Promise<T>;

export function getQueryKey(desc: Desc<any>, params: object, cognitoNamespace: string | undefined, unique?: { streamer?: boolean }): LessQueryKey {
    return {
        desc: `${desc.$method}:${desc.$path}`,
        params: params,
        cognito: cognitoNamespace || undefined,
        // Streamer
        streamer: unique?.streamer || undefined,
    };
}

// * Mutate Hooks

/** Mutates a query or revalidates a streamer */
export function useMutateQuery() {
    const { queryCache: cache, userRequired, currentUser } = useLess<any>();

    async function mutate<D extends object, R = LessResponseValue<D>>(
        desc: Desc<D>,
        params: Params<D>,
        options?: { streamer?: boolean; newData?: DataMutation<R> }
    ): Promise<{ error: Error | null; newData: undefined | R }> {
        const newData = options?.newData;
        const isStreamer = !!options?.streamer;

        const p = isStreamer ? { ...params, offset: undefined, limit: undefined } : params;
        const key = getQueryKey(desc, p, userRequired ? currentUser?.id || "" : undefined, { streamer: isStreamer });
        const state = cache.get(key);

        if (isStreamer || newData === undefined) {
            cache.delete(key);
            return { newData: undefined, error: null };
        }

        try {
            const newD =
                newData instanceof Promise
                    ? await newData
                    : typeof newData === "function"
                    ? await (newData as (previousData: R | undefined) => Promise<R> | R)(state?.data?.d)
                    : newData;
            // TODO race conditions mit mounted queries fetch, da hier nicht geprüft wird, ob QueryState.isRevalidating gerade true ist
            cache.update(key as any, { data: { d: newD }, isRevalidating: null, error: null });
            return { newData: newD, error: null };
        } catch (err) {
            return { error: err as Error, newData: undefined };
        }
    }

    return mutate;
}

/** Mutates/revalidates multiple queries or streamers */
export function useMutateQueries() {
    const { queryCache: cache } = useLess();

    function mutateQueriesCache(mutator: Extract<QueryCacheMutate, (...args: any) => void>) {
        cache.mutate(mutator);
    }

    return mutateQueriesCache;
}

/** Revalidates queries and streamers by tags */
export function useMutateTags() {
    const { queryCache: cache } = useLess();

    function revalidateTags(tagsFilter: QueryTagFilter) {
        cache.remove(state => stateIncludesTags(state, tagsFilter));
    }

    return revalidateTags;
}
