import { LessQueryKey, useLessCache } from "./LessCacheProvider";
import { useLessCognitoContext } from "./LessCognitoProvider";
import { Desc, Params, LessResponseValue } from "../../types";
import { getQueryKey } from "./useLessQuery";
import QueryCache, { QueryCacheMutate, QueryCacheKey, QueryState, QueryCacheTagsFilter } from "./QueryCache";

export type QueryKeyFilter = string[] | ((key: any) => boolean);
/** _und((oder)[])_ */
export type QueryTagFilter = (string | string[])[];

export function useMutateQuery() {
    const { cache } = useLessCache();
    const lessContext = useLessCognitoContext();

    async function mutate<D extends object, R = LessResponseValue<D>>(
        desc: Desc<D>,
        params: Params<D>,
        newData?: R | ((previousData: R | undefined) => Promise<R>)
    ): Promise<{ error: Error | null; newData: undefined | R }> {
        const key = getQueryKey(desc, params, lessContext.cognitoMode ? lessContext.currentUser?.id || "" : undefined);
        const state = cache.get(key);

        if (newData === undefined) {
            cache.delete(key);
            return { newData: undefined, error: null };
        }

        try {
            const newD = typeof newData === "function" ? await (newData as (previousData: R | undefined) => Promise<R> | R)(state?.data?.d) : newData;
            // TODO race conditions mit mounted queries fetch, da hier nicht geprüft wird, ob QueryState.isRevalidating gerade true ist
            cache.update(key as any, { data: { d: newD }, isRevalidating: null, error: null });
            return { newData: newD, error: null };
        } catch (err) {
            return { error: err as Error, newData: undefined };
        }
    }

    return mutate;
}

export function useMutateQueries() {
    const { cache } = useLessCache();

    function mutateQueriesCache(mutator: Extract<QueryCacheMutate, Function>) {
        cache.mutate(mutator);
    }

    return mutateQueriesCache;
}

// * Tags

/** `QueryTagFilter`-Logik: _und((oder)[])_ */
export function useMutateTags() {
    const { cache } = useLessCache();

    /** `QueryTagFilter`-Logik: _und((oder)[])_ */
    function revalidateTags(tagsFilter: QueryTagFilter, data?: (key: QueryCacheKey, state: QueryState) => void) {
        if (data === undefined) cache.remove((key, state) => QueryCache.stateIncludesTags(state, tagsFilter));
        else
            cache.mutate((key, state) => {
                if (QueryCache.stateIncludesTags(state, tagsFilter)) return data(key, state);
                else return undefined;
            });
    }

    return revalidateTags;
}

// * Streamer

/**
 *
 * @returns Hierfür muss der key
 */
export function useRevalidateStreamer() {
    const { cache } = useLessCache();

    /**
     * Revalidiert alle Streamer mit dieser `desc` und dem gegebenen `QueryTagFilter`.
     * Momentan **müssen** Streamer also mit Tags revalidiert werden! Es werden nur Streamer revalidiert.
     * */
    function revalidateStreamer<D extends object>(desc: Desc<D>, tags: QueryCacheTagsFilter) {
        const descTag = `${desc.$method}:${desc.$path}`;

        cache.mutate((key, state) => {
            // desc und params vergleichen (ohne limit und offset)
            return (key as LessQueryKey).streamer && descTag === (key as LessQueryKey).desc && QueryCache.stateIncludesTags(state, tags);
        });
    }

    return revalidateStreamer;
}
