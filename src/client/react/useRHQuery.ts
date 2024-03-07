import React from "react";
import rhFetch from "../rhFetch";
import { useRHContext } from "./RHProvider";
import useRHCache, { CacheDataMutation, LessQueryKey, getQueryKey } from "./useRHCache";
import { RHDesc, Params, ResponseValue } from "../../types";
import { Falsy, mergeConfigs } from "../client-util";
import QueryCache, { QueryCacheStateListener, QueryState } from "../QueryCache";
import RHFetchError from "./RHFetchError";

// * Config

export interface RHQueryConfig {
    /**
     * Data will be kept while revalidating and if data is present
     * @default true
     * */
    keepPreviousData: boolean;
    /** @default 5000 */
    freshTime: number;
    /** @default 3 */
    maxErrRetries: number;
    /** @default 2000 */
    errRetryTimeout: number;
    /** @default undefined */
    onError: ((err: RHFetchError) => void) | undefined;
    /** @default true */
    retryOnError: ((err: RHFetchError) => boolean) | boolean;
    /** @default [] */
    tags: (string | Falsy)[];
    /** @default {} */
    requestInit: RequestInit;
    /** @default false */
    forceRefetch: boolean;
    /**
     * Detatches this query from the cache. Only mounted refetches (`LessQueryResult.refetch`) or key changes from this query will trigger refetches.
     * @default false
     * */
    detatch: boolean;
}

export type RefetchResult<R> =
    | {
          isError: false;
          error: null;
          isSuccess: true;
          data: R;
          response: Response | null;
      }
    | {
          isError: true;
          error: RHFetchError;
          isSuccess: false;
          data: undefined;
          response: Response | null;
      };

// * Hook

export type Query<D extends object, R> = {
    /** Mounted refetch */
    refetch: (params: Params<D>, queryConfig?: Partial<RHQueryConfig>) => Promise<RefetchResult<R>>;
    /** Revalidating? (Revalidating **and** _keepPreviousData=false_) */
    isLoading: boolean;
    isReady: boolean;
    enabled: boolean;
    /** Mounted mutate */
    mutate: (newData?: CacheDataMutation<R>) => Promise<{ error: Error | null; newData: undefined | R }>;
} & RefetchResult<R>;

export type QueryOptions<D extends object, R = ResponseValue<D>> = {
    enabled?: boolean;
    /** Debugging */
    id?: string;
    /**
     * Delay applied to the initial fetch. This delay is __only__ applied the initial fetch
     * Milliseconds
     * @default 0
     * */
    delay?: number;
    /** This fetcher is also used in error retries. To prevent retries on certain errors use the  */
    fetcher?: (params: Params<D>) => R | Promise<R>;
    parser?: (data: ResponseValue<D>) => R | Promise<R>;
} & Partial<RHQueryConfig>;

/**
 * Type params:
 *
 * _\<D\>esc_ - Description
 *
 * _\<R\>esponse Value_ - Defaults to `ResponseValue<D>`. If `options.paser` returns another type, this can overwrite the default response type.
 *
 * @param desc Description
 * @param params Paramaters
 * @param options Fetch options
 */
export default function useRHQuery<D extends object, R = ResponseValue<D>>(
    desc: RHDesc<D>,
    params: Params<D> | Falsy,
    options?: QueryOptions<D, R>
): Query<D, R> {
    const { queryCache: cache, queryConfig: globalConfig } = useRHContext();
    const [delayed, setDelayed] = React.useState(!!options?.delay);
    const key = params && options?.enabled !== false ? getQueryKey(desc, params) : false;
    const serializedKey = key && QueryCache.serializeKey(key);
    const enabled = options?.enabled !== false && !!params;
    const [state, setState] = React.useState<QueryState | null>(serializedKey ? cache.get(serializedKey) || null : null);
    const keepPreviousData = options?.keepPreviousData ?? globalConfig.keepPreviousData;
    const [isLoading, data, hasData] = React.useMemo<[boolean, any, boolean]>(() => {
        if (state?.data) {
            if (state.isRevalidating && keepPreviousData) return [true, undefined, false];
            else return [false, state.data.d, true];
        } else return [(!state && !!serializedKey) || !!state?.isRevalidating, undefined, false];
    }, [state, keepPreviousData, serializedKey]);
    const error = state?.error;
    const isSuccess = !!state?.data && !error;
    const { mutateQuery } = useRHCache();

    // Delay Effect
    React.useEffect(() => {
        let interrupted = false;

        if (options?.delay) {
            // BUG if the key changes the delay is not notices directly since it is set in this effect
            // the query would fetch without a delay then
            setDelayed(true);

            setTimeout(() => {
                if (!interrupted) setDelayed(false);
            }, options.delay);
        }

        return () => {
            interrupted = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serializedKey]);

    // Params Change Effect (`serializedKey`)
    React.useEffect(() => {
        if (!serializedKey || delayed) return setState(null);

        const _cache = cache;
        const key = serializedKey;

        const listener: QueryCacheStateListener = (state, index) => {
            setState(state);
            // Revalidate (state=null means the state has been removed from the cache)
            // Only leading queries (index === 0) really refetch
            if (state === null && index === 0 && params) {
                if (!(options?.detatch ?? globalConfig.detatch)) refetch(params, { retryOnError: true, tags: options?.tags });
            }
        };

        const newState = cache.get(key);
        _cache.addListener(key, listener);
        // Initial Fetch
        refetch(params as any, { retryOnError: true, tags: options?.tags });
        setState(newState || null);

        return () => {
            _cache.removeListener(key, listener);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serializedKey, delayed, cache]);

    async function refetch(params: Params<D>, refetchOptions?: Partial<RHQueryConfig>, errRetryCount = 0): Promise<RefetchResult<R>> {
        const conf = mergeConfigs(refetchOptions || {}, mergeConfigs(options || {}, globalConfig));

        try {
            const { data, response } = await mountedLessFetch(
                desc,
                params,
                { config: conf, cache, fetcher: options?.fetcher, parser: options?.parser },
                errRetryCount
            );
            return { data, isSuccess: true, isError: false, response, error: null };
        } catch (err) {
            return { isError: true, isSuccess: false, data: undefined, response: null, error: err as RHFetchError };
        }
    }

    async function _refetch(params: Params<D>, refetchOptions?: Partial<RHQueryConfig>) {
        return await refetch(params, refetchOptions);
    }

    async function mutate(newData?: CacheDataMutation<R>): Promise<{ error: Error | null; newData: undefined | R }> {
        if (!params) return { error: new Error("Query disabled"), newData: undefined };
        return mutateQuery(desc, params, { newData });
    }

    return {
        isLoading,
        error: error as any,
        isError: !!error as any,
        data,
        refetch: _refetch,
        isSuccess,
        isReady: (isSuccess && hasData) || !!error,
        response: state?.response || null,
        enabled,
        mutate,
    };
}

// * Mounted Fetch

interface MountedFetchOptions<D extends object, R> {
    cognito?: string;
    /** This fetcher is also used in error retries. To prevent retries on certain errors use `LessQueryConfig.retryOnError`  */
    fetcher?: QueryOptions<D, R>["fetcher"];
    parser?: QueryOptions<D, R>["parser"];
    cache: QueryCache;
    config: RHQueryConfig;
}

/**
 * Respects cache, if given
 */
async function mountedLessFetch<D extends object, R = ResponseValue<D>>(
    desc: RHDesc<D>,
    params: Params<D>,
    fetchOptions: MountedFetchOptions<D, R>,
    errRetryCount = 0
): Promise<{ data: R; response: Response | null }> {
    const cache = fetchOptions.cache;
    const config = fetchOptions.config;
    let key: LessQueryKey | undefined;
    let response: Response | null = null;
    let isParseError = false;

    try {
        if (!params) throw new Error("No params received");

        key = getQueryKey(desc, params);
        if (!key) throw new Error("No query key received");

        let data: any;
        const state = cache?.get(key as any);

        // tags setzen

        const t = config.tags?.filter(t => !!t) as string[] | undefined;
        cache?.update(key, { tags: t });

        if (state?.isRevalidating) {
            // Daten am laden
            data = await state.isRevalidating;
        } else {
            const now = new Date().getTime();
            const freshTime = config.freshTime;

            // Falls keine freshen Daten oder `RefetchOptions.forceRefetch=true` refetchen
            if (config.forceRefetch || !state?.data || freshTime === 0 || !state.timestamp || now - state.timestamp > freshTime) {
                // ! Catch all errors and reject
                // eslint-disable-next-line no-async-promise-executor
                const dataPromise = new Promise(async (resolve, reject) => {
                    try {
                        let data: any;

                        if (fetchOptions?.fetcher) {
                            data = await fetchOptions.fetcher(params);
                        } else {
                            const { response: res, responseValue } = await rhFetch(desc, params, config.requestInit);
                            response = res;
                            if (!response?.ok) return reject(new Error("Response not ok"));
                            data = responseValue;
                        }

                        // TODO Momentan werden geparste Daten gecacht
                        // Der gesamte cache müsste dannn verschlüsselt gespeichert werden, wenn man einen persisten Cache haben will
                        try {
                            if (fetchOptions?.parser) data = await fetchOptions.parser(data);
                        } catch (err) {
                            isParseError = true;
                            throw new Error("Failed to parse data: " + (err as Error).message);
                        }

                        resolve(data);
                    } catch (err) {
                        reject(err);
                    }
                });

                // Daten unverändert lassen
                cache?.update(key as any, { isRevalidating: dataPromise, error: null });
                data = await dataPromise;
                // Daten hier erst setzen!
                cache?.update(key as any, { data: { d: data }, isRevalidating: null, error: null, response });
            } else {
                // Gecachte Data
                data = state.data?.d;
            }
        }

        return { data, response };
    } catch (err) {
        const fetchErr = new RHFetchError(err as Error, response);

        if (key) {
            /** Retry prevented by options? */
            const retryPrevented =
                isParseError || config.retryOnError === false || (config.retryOnError !== true && config.retryOnError?.(fetchErr) === false);

            if (!retryPrevented && errRetryCount < config.maxErrRetries) {
                // set `isRevalidating=null`
                cache?.update(key, { isRevalidating: null });

                const retryResult = await new Promise<any>(resolve => {
                    setTimeout(async () => {
                        try {
                            const r = await mountedLessFetch(desc, params, fetchOptions, errRetryCount + 1);
                            resolve(r);
                        } catch (err) {
                            resolve({ err: err || new Error("Error retry failed") });
                        }
                    }, config.errRetryTimeout);
                });

                if (retryResult.err) {
                    // If not last retry the throw error herre to prevent cache update
                    if (errRetryCount !== config.maxErrRetries - 1) throw retryResult.err;
                } else return retryResult;
            }

            cache?.update(key, { data: null, error: fetchErr, response, isRevalidating: null });
        }

        config.onError?.(fetchErr);

        throw fetchErr;
    }
}
