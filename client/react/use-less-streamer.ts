import type { Desc, Params, ResponseValue } from "src/packages/less";
import LessFetchError from "./less-fetch-error";
import React from "react";
import useLessQuery, { RefetchResult, UseFetchOptions, getQueryKey } from "./use-less-query";
import { Falsy } from "src/packages/util/src/utility-types";
import { useLessCognitoContext } from "./less-cognito-context";
import { useLessCache } from "./less-cache";
import { QueryCache, QueryCacheStateListener } from "@less/client/react/query-cache";

export type LessStreamer<D extends { $response: any[] } = any, R = ResponseValue<D>> = {
    isError: boolean;
    error: LessFetchError | null;
    isLoading: boolean;
    /** Alle Daten */
    pages: R | undefined;
    /** Daten der aktuellsten (letzten) Seite */
    page: R | undefined | null;
    size: number;
    /** Setzt die größe des Steramers (Wie viel chunks geladen werden) */
    setSize: (newSize: number) => void | Promise<ResponseValue<D>[] | undefined>;
    /** Erhöt die Größe um 1 */
    next: () => void;
    isReady: boolean;
    chunkSize: number;
    /** Alle Daten wurden geladen */
    isFinished: boolean;
    /** Anzahl der  */
    currentLength: number;
};

export type StreamerOptions<D extends {}, R = ResponseValue<D>[]> = UseFetchOptions<D, R> & {
    chunkSize: number;
    /** @default 1 */
    defaultSize?: number;
    /** Für die Identifizierung beim Debuggen */
    id?: string;
};

export default function useLessStreamer<D extends { offset?: number; limit?: number; $response: any[] }, R extends any[] = ResponseValue<D>>(
    desc: Desc<D>,
    params: Params<D> | Falsy,
    options: StreamerOptions<D, R>
): LessStreamer<D, R> {
    const enabled = options.enabled !== false;
    const lessContext = useLessCognitoContext();
    const cognito = lessContext.cognitoMode ? lessContext.currentUser?.id || "" : undefined;
    const { cache } = useLessCache();
    const chunkSizeRef = React.useRef(options.chunkSize);
    const chunkSize = chunkSizeRef.current;
    const [size, setSize] = React.useState(options.defaultSize || 1);
    const limit = React.useMemo(() => size * chunkSize, [size, chunkSize]);
    const currentBaseKey = enabled && params && getQueryKey(desc, params, cognito);
    const preKey = React.useRef<any>();
    const currentSerializedBaseKey = currentBaseKey && QueryCache.serializeKey(currentBaseKey);
    const currentKey = enabled && params && getQueryKey(desc, { limit: size * chunkSize, offset: limit - chunkSize, ...params }, cognito);
    const currentSerializedKey = currentKey && QueryCache.serializeKey(currentKey);
    const query = useLessQuery(desc, null, options);
    const [queries, setQueries] = React.useState<RefetchResult<R>[] | undefined>(undefined);
    const [pages, page, isError, isSuccess] = React.useMemo<[R | undefined, R | undefined, boolean, boolean]>(() => {
        if (!queries) return [undefined, undefined, false, false];
        const pages: any[] = [];
        for (const query of queries) {
            if (query.isError) return [undefined, undefined, true, false];
            pages.push(...query.data);
        }
        return [pages as R, pages.length ? pages[pages.length - 1] || null : undefined, false, true];
    }, [queries]);
    const isReady = isError || isSuccess;
    const isFinished = React.useMemo(() => {
        if (!queries) return false;
        return chunkSize * size !== (queries as any)?.length;
    }, [chunkSize, queries, size]);
    const currentLength = Array.isArray(queries) ? queries.length : 0;

    React.useEffect(() => {
        let x = preKey;
        preKey.current = currentSerializedKey;

        if (!currentSerializedKey) return;

        let interrupted = false;

        const listener: QueryCacheStateListener = state => {
            // Alle pages
            if (state === null) {
                revalidate(() => interrupted);
            }
        };

        cache.addListener(currentSerializedKey, listener);

        return () => {
            cache.removeListener(currentSerializedKey, listener);
            interrupted = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSerializedKey]);

    React.useEffect(() => {
        if (size <= 0 || !currentSerializedBaseKey) {
            if (!options.keepPreviousData) setQueries(undefined);
            return;
        }

        let interrupted = false;

        revalidate(() => interrupted);

        return () => {
            interrupted = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size, currentSerializedBaseKey]);

    async function fetchPage(page: number) {
        const limit = page * chunkSize;
        const refetchResult = await query.refetch({ limit, offset: limit - chunkSize, ...params } as any, { tags: options.tags, retryOnError: true });
        return refetchResult;
    }

    async function revalidate(isInterrupted: () => boolean) {
        const queries: RefetchResult<R>[] = [];
        for (let i = 1; i <= size; i++) {
            const page = await fetchPage(i);
            if (isInterrupted()) return;
            queries.push(page);
        }
        if (!isInterrupted()) setQueries(queries);
    }

    function next() {
        if (!isFinished) setSize(size + 1);
    }

    return {
        isError: !!query.error,
        error: query.error,
        size: queries?.length || 0,
        isLoading: query.isLoading,
        pages: pages as any,
        setSize,
        isReady,
        chunkSize,
        page: page as any,
        isFinished,
        next,
        currentLength,
    };
}
