import { useRHContext } from "./RHProvider";
import type { RHDesc, Params, ResponseValue } from "../../types";
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
            (!tagsFilter.andOr || stateIncludesTagsAndOr(state, tagsFilter.andOr)) &&
            (!tagsFilter.not || !tagsFilter.not.some(excludeTag => state.tags.has(excludeTag)))
        );
    }
}

//* Query Key

/** Key type */
export type LessQueryKey = {
    desc: string;
    params: object;
    streamer: boolean | undefined;
};

export type QueryKeyFilter = string[] | ((key: any) => boolean);
export type CacheDataMutation<T> = T | ((previousData: T | undefined) => Promise<T> | T) | Promise<T>;

export function getQueryKey(desc: RHDesc<any>, params: object, unique?: { streamer?: boolean }): LessQueryKey {
    return {
        desc: `${desc.$method}:${desc.$path}`,
        params: params,
        // Streamer
        streamer: unique?.streamer || undefined,
    };
}

// * Mutate Hooks

/*
## QueryCache
Listeners can listen to entry changes/deletions of a key.
A deletion with a key that has no entry still triggers listeners.
Mutations (type `QueryCacheMutate`) can only delete cache entries that exist!
## Streamer
Streamers do only have cache entries of their mounted fetches.
The streamer itself gets revalidated by listening to the (streamer) key delete in the cache, which gets triggerd 
although the streamer key has no entry.
*/

export interface Cache {
    mutateQuery: <D extends object, R = ResponseValue<D>>(
        desc: RHDesc<D>,
        params: Params<D>,
        options?: { newData?: CacheDataMutation<R> }
    ) => Promise<{ error: Error | null; newData: undefined | R }>;
    revalidateStreamer: <D extends object>(desc: RHDesc<D>, params: Params<D>) => void;
    revalidateTags: (tagsFilter: QueryTagFilter) => void;
    mutateQueries: (mutator: Extract<QueryCacheMutate, (...args: any) => any>) => void;
}

// This hook is also used in mounted mutations in useRHQuery and useRHStreamer
/** Mutates a query or revalidates a streamer */
export default function useRHCache(): Cache {
    const { queryCache: cache } = useRHContext();

    async function mutateQuery<D extends object, R = ResponseValue<D>>(
        desc: RHDesc<D>,
        params: Params<D>,
        options?: { newData?: CacheDataMutation<R> }
    ): Promise<{ error: Error | null; newData: undefined | R }> {
        const newData = options?.newData;

        const p = { ...params, offset: undefined, limit: undefined };
        const key = getQueryKey(desc, p);
        const state = cache.get(key);

        if (newData === undefined) {
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

    async function revalidateStreamer<D extends object>(desc: RHDesc<D>, params: Params<D>): Promise<void> {
        const p = { ...params, offset: undefined, limit: undefined };
        const key = getQueryKey(desc, p, { streamer: true });
        cache.delete(key);
    }

    function mutateQueries(mutator: Extract<QueryCacheMutate, (...args: any) => any>) {
        cache.mutate(mutator);
    }

    function revalidateTags(tagsFilter: QueryTagFilter) {
        cache.remove(state => stateIncludesTags(state, tagsFilter));
    }

    return { mutateQuery, revalidateStreamer, revalidateTags, mutateQueries };
}
