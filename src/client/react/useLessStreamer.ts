import LessFetchError from "./LessFetchError";
import React from "react";
import useLessQuery, { RefetchResult, UseFetchOptions } from "./useLessQuery";
import { useLess } from "./LessProvider";
import type { LessResponseValue, Desc, Params } from "../../types";
import QueryCache, { QueryCacheStateListener } from "../QueryCache";
import type { Falsy } from "../client-util";
import { getQueryKey, streamerTag, useMutateQuery } from "./cache";
import { randomId } from "../../system";

export type LessStreamer<D extends { $response: any[] } = any, R = LessResponseValue<D>> = {
    isError: boolean;
    error: LessFetchError | null;
    isLoading: boolean;
    /** Merged pages data */
    pages: R | undefined;
    /** Data of the current pages */
    page: R | undefined | null;
    /** Current size */
    size: number;
    /** Sets the size */
    setSize: (newSize: number) => void | Promise<LessResponseValue<D>[] | undefined>;
    /** Increases size by 1 */
    next: () => void;
    isReady: boolean;
    chunkSize: number;
    /** All pages loaded */
    isFinished: boolean;
    /** The active size of the streamer. Can differ from `size`  */
    currentSize: number;
    /** Mounted revalidate */
    revalidate: () => void;
};

export type StreamerOptions<D extends object, R = LessResponseValue<D>[]> = UseFetchOptions<D, R> & {
    chunkSize: number;
    /** @default 1 */
    defaultSize?: number;
    /** For identification during debugging */
    id?: string;
    resetSizeOnRevalidate?: boolean;
};

export default function useLessStreamer<D extends { offset?: number; limit?: number; $response: any[] }, R extends any[] = LessResponseValue<D>>(
    desc: Desc<D>,
    params: Params<D> | Falsy,
    options: StreamerOptions<D, R>
): LessStreamer<D, R> {
    const enabled = options.enabled !== false;
    const { queryCache: cache, userRequired, currentUser, queryConfig: globalConfig } = useLess<any>();
    const cognito = userRequired ? currentUser?.id || "" : undefined;
    const chunkSizeRef = React.useRef(options.chunkSize);
    const chunkSize = chunkSizeRef.current;
    const [size, setSize] = React.useState(options.defaultSize ?? 1);
    const baseKey = enabled && params && getQueryKey(desc, { ...params, offset: undefined, limit: undefined }, cognito, { streamer: true });
    /** Used as dependency in effects */
    const serBaseKey = baseKey && QueryCache.serializeKey(baseKey);
    /** options contains here the query config used in page fetches  */
    const query = useLessQuery(desc, null, options);
    const [queries, setQueries] = React.useState<RefetchResult<R>[] | undefined>(undefined);
    const [pages, page, isError, isSuccess] = React.useMemo<[R | undefined, R | undefined, boolean, boolean]>(() => {
        if (!queries) return [undefined, undefined, false, false];
        const pages: R[] = [];
        for (const query of queries) {
            if (query.isError) return [undefined, undefined, true, false];
            pages.push(query.data);
        }
        return [pages.flat(1) as R, pages[pages.length - 1] || null, false, true];
    }, [queries]);
    const isReady = isError || isSuccess;
    const isFinished = React.useMemo(() => {
        if (!queries) return false;
        return chunkSize * size !== (queries as any)?.length;
    }, [chunkSize, queries, size]);
    const currentLength = Array.isArray(queries) ? queries.length : 0;
    const errQuery = React.useMemo(() => queries?.find(q => q.error), [queries]);
    const [isLoading, setIsLoading] = React.useState(false);
    const id = React.useMemo(() => "streamer_id:" + randomId(), []);
    const reval = useMutateQuery();

    // Revalidate Effect
    React.useEffect(() => {
        if (!serBaseKey) return;

        let interrupted = false;
        const baseKey = serBaseKey;
        const _cache = cache;

        const listener: QueryCacheStateListener = () => {
            // streamer cache entry mutated/removed -> Revalidate (force=true)
            fetchPages(size, () => interrupted, true);
        };

        _cache.addListener(baseKey, listener);

        return () => {
            _cache.removeListener(baseKey, listener);
            interrupted = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serBaseKey, cache, size]);

    React.useEffect(() => {
        if (size <= 0 || !serBaseKey) {
            if (!options.keepPreviousData) setQueries(undefined);
            return;
        }

        let interrupted = false;

        // force = false
        fetchPages(size, () => interrupted);

        return () => {
            interrupted = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size, serBaseKey, size, options.keepPreviousData]);

    const next = React.useCallback(() => {
        if (!isFinished) setSize(size + 1);
    }, [isFinished, size]);

    async function fetchPage(page: number, forceRefetch?: boolean) {
        const offset = page * chunkSize;
        const refetchResult = await query.refetch({ limit: chunkSize, offset, ...(params || {}) } as any, {
            tags: [streamerTag, id, ...(options.tags || [])],
            retryOnError: false,
            forceRefetch,
        });
        return refetchResult;
    }

    async function fetchPages(size: number, isInterrupted: () => boolean, forceRefetch?: boolean) {
        setIsLoading(true);

        if (!(options.keepPreviousData ?? globalConfig.keepPreviousData)) setQueries(undefined);

        const queries: RefetchResult<R>[] = [];

        for (let i = 0; i < size; i++) {
            const page = await fetchPage(i, forceRefetch);
            if (isInterrupted()) return;
            queries.push(page);
        }
        if (!isInterrupted()) {
            setQueries(queries);
            setIsLoading(false);
        }
    }

    function revalidate() {
        if (params) reval(desc, params, { streamer: true });
    }

    function _setSize(size: number) {
        setSize(Math.max(0, size));
    }

    return {
        isError: !!errQuery,
        error: errQuery?.error || null,
        size: queries?.length || 0,
        isLoading,
        pages: pages as any,
        setSize: _setSize,
        isReady,
        chunkSize,
        page: page as any,
        isFinished,
        next,
        currentSize: currentLength,
        revalidate,
    };
}
