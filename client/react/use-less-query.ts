import type { Desc, Params, ResponseValue } from "src/packages/less";
import { mergeConfigs } from "src/packages/less/client/less-client";
import React from "react";
import LessFetchError from "./less-fetch-error";
import { Falsy } from "src/packages/util/src/utility-types";
import { useLessCognitoContext } from "./less-cognito-context";
import { lessFetch } from "../less-fetch";
import { LessQueryKey, useLessCache } from "./less-cache";
import { QueryCache, QueryCacheStateListener, QueryState } from "@less/client/react/query-cache";
import { useMutateQuery } from "./revalidate";

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
          error: LessFetchError;
          isSuccess: false;
          data: undefined;
          response: Response | null;
      };

export type UseLessQueryResult<D extends {}, R> = {
    /** Die Status Variablen dieses hooks werden von dem Ergebnis oder Zustand dieses refetches nicht beeinflusst! */
    refetch: (params: Params<D>, refetchOptions?: RefetchOptions) => Promise<RefetchResult<R>>;
    /** Daten werden geladen (Revalideren + keepPreviousData=false oder Initialer fetch) */
    isLoading: boolean;
    isReady: boolean;
    enabled: boolean;
    /** Mounted Mutation */
    mutate: (data?: R) => Promise<{ error: Error | null; newData: undefined | R }>;
} & RefetchResult<R>;

export type UseFetchOptions<D extends {}, R = ResponseValue<D>> = {
    enabled?: boolean;
    /** Debugging */
    id?: string;
    /**
     * Millisekunden
     * @default 0
     * */
    delay?: number;
} & FetchOptions<D, R>;

export interface RefetchOptions {
    requestInit?: RequestInit;
    forceRefetch?: boolean;
    /**
     * Falls _true_, wird nach `LessQueryConfig.maxErrRetries` Errors ein refetch versucht. Ansonsten wird nur 1 Versuch durchgeführt.
     * @default false
     *  */
    retryOnError?: boolean;
    tags?: (string | Falsy)[];
}

export interface LessQueryConfig {
    /**
     * Daten werden beibehalten, wenn revalidiert wird und Daten vorhanden sind.
     * Im Unterschied zu _swr_ bezieht sich diese Option auf das Revalidieren, statt auf das Ändern des Keys
     * @default true
     * */
    keepPreviousData: boolean;
    /** @default 5000 */
    freshTime: number;
    /** @default 3 */
    maxErrRetries: number;
    /** @default 2000 */
    errRetryTimeout: number;
    onError: ((err: LessFetchError) => void) | undefined;
}

/** Siehe `LessQueryConfig` für Default Values */
export const defaultQueryConfig: LessQueryConfig = {
    freshTime: 5000,
    keepPreviousData: true,
    maxErrRetries: 3,
    onError: undefined,
    errRetryTimeout: 2000,
};

export interface FetchOptions<D extends {}, R> extends Partial<LessQueryConfig> {
    requestInit?: RequestInit;
    forceRefetch?: boolean;
    /**
     * Falls _true_, wird nach `LessQueryConfig.maxErrRetries` Errors ein refetch versucht. Ansonsten wird nur 1 Versuch durchgeführt.
     * @default false
     *  */
    retryOnError?: boolean;
    tags?: (string | Falsy)[];
    cognito?: string;
    fetcher?: (params: Params<D>) => R | Promise<R>;
    parser?: (data: ResponseValue<D>) => R | Promise<R>;
}

export function getQueryKey(
    desc: Desc<any>,
    params: object,
    cognitoContext: string | undefined,
    options?: { streamer?: { page: number; chunkSize: number } }
): LessQueryKey {
    return {
        desc: `${desc.$method}:${desc.$path}`,
        params: params,
        streamer: options?.streamer ? true : undefined,
        streamer_page: options?.streamer ? options.streamer.page : undefined,
        cognito: cognitoContext,
        streamer_chunkSize: options?.streamer?.chunkSize,
    };
}

/**
 * Type params:
 *
 * _\<D\>esc_ - Beschreibung des Endpunktes
 *
 * _\<R\>esponse Value_ - Standard ist `ResponseValue<D>`. Sollte `options.paser` jedoch einen anderen Wert zurückgeben kann man den Standardtyp hier übeschreiben.
 *
 * @param desc Beschreibung des Endpunktes
 * @param params Paramater
 * @param options SWR/Fetch Optionen
 */
export default function useLessQuery<D extends {}, R = ResponseValue<D>>(
    desc: Desc<D>,
    params: Params<D> | Falsy,
    options?: UseFetchOptions<D, R>
): UseLessQueryResult<D, R> {
    const lessContext = useLessCognitoContext();
    const { cache, config: globalConfig } = useLessCache();
    const config = React.useMemo(() => {
        return mergeConfigs(options || {}, globalConfig);
    }, [globalConfig, options]);
    const [delayed, setDelayed] = React.useState(!!options?.delay);
    const cognito = lessContext.cognitoMode ? lessContext.currentUser?.id || "" : undefined;
    const key = params && options?.enabled !== false ? getQueryKey(desc, params, cognito) : false;
    const serializedKey = key && QueryCache.serializeKey(key);
    const enabled = options?.enabled !== false && !!params;
    const [state, setState] = React.useState<QueryState | null>(serializedKey ? cache.get(serializedKey) || null : null);
    const [isLoading, data, hasData] = React.useMemo<[boolean, any, boolean]>(() => {
        if (state?.data) {
            if (state.isRevalidating && !config.keepPreviousData) return [true, undefined, false];
            else return [false, state.data.d, true];
        } else return [(!state && !!serializedKey) || !!state?.isRevalidating, undefined, false];
    }, [state, config.keepPreviousData, serializedKey]);
    const error = state?.error;
    const isSuccess = !!state?.data && !error;
    const mut = useMutateQuery();

    // Delay Effect
    React.useEffect(() => {
        let interrupted = false;

        if (options?.delay) {
            // TODO mit ref machen, damit der delay direkt vermerkt ist
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

    // Params Change Effekt (`serializedKey`)
    React.useEffect(() => {
        if (!serializedKey || delayed) return setState(null);

        const listener: QueryCacheStateListener = (state, index) => {
            setState(state);
            // Revalidieren (state=null bedeutet, dass diese Query aus dem cache entfernt wurde)
            // Nur die erste mounted query (index === 0) fetcht wirklich neu
            if (state === null && index === 0 && params) {
                refetch(params, { retryOnError: true, tags: options?.tags });
            }
        };

        const newState = cache.get(serializedKey);
        cache.addListener(serializedKey, listener);
        // Initial Fetch
        refetch(params as any, { retryOnError: true, tags: options?.tags });
        setState(newState || null);

        return () => {
            cache.removeListener(serializedKey, listener);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serializedKey, delayed]);

    async function refetch(params: Params<D>, refetchOptions?: RefetchOptions, errRetryCount = 0): Promise<RefetchResult<R>> {
        try {
            const { data, response } = await mountedLessFetch(desc, params, cache, { ...options, ...refetchOptions, cognito }, errRetryCount);
            return { data, isSuccess: true, isError: false, response, error: null };
        } catch (err) {
            return { isError: true, isSuccess: false, data: undefined, response: null, error: err as LessFetchError };
        }
    }

    async function _refetch(params: Params<D>, refetchOptions?: RefetchOptions) {
        return await refetch(params, refetchOptions);
    }

    async function mutate(newData?: R | ((previousData: R | undefined) => Promise<R>)): Promise<{ error: Error | null; newData: undefined | R }> {
        if (!params) return { error: new Error("Query disabled"), newData: undefined };
        return mut(desc, params, newData);
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

/**
 * Berücksichtigt den Cache, falls angegeben
 */
async function mountedLessFetch<D extends {}, R = ResponseValue<D>>(
    desc: Desc<D>,
    params: Params<D>,
    cache: QueryCache,
    fetchOptions?: FetchOptions<D, R>,
    errRetryCount = 0
): Promise<{ data: R; response: Response | null }> {
    const config = mergeConfigs(fetchOptions || {}, defaultQueryConfig);
    let key: LessQueryKey | undefined;
    let response: Response | null = null;

    try {
        if (!params) throw new Error("No params received");

        key = getQueryKey(desc, params, fetchOptions?.cognito);
        if (!key) throw new Error("No query key received");

        let data: any;
        const state = cache?.get(key as any);

        // tags setzen

        const t = fetchOptions?.tags?.filter(t => !!t) as string[] | undefined;
        cache?.update(key, { tags: t });

        if (state?.isRevalidating) {
            // Daten am laden
            data = await state.isRevalidating;
        } else {
            const now = new Date().getTime();
            const freshTime = config.freshTime;

            // Falls keine freshen Daten oder `RefetchOptions.forceRefetch=true` refetchen
            if (fetchOptions?.forceRefetch || !state?.data || freshTime === 0 || !state.timestamp || now - state.timestamp > freshTime) {
                const dataPromise = new Promise(async (resolve, reject) => {
                    try {
                        let data: any;

                        if (fetchOptions?.fetcher) {
                            data = await fetchOptions.fetcher(params);
                        } else {
                            const { response: res, responseValue } = await lessFetch(desc, params, fetchOptions?.requestInit);
                            response = res;
                            if (!response?.ok) return reject(new Error("Response not ok"));
                            data = responseValue;
                        }

                        // TODO Momentan werden geparste Daten gecacht
                        // Der gesamte cache müsste dannn verschlüsselt gespeichert werden, wenn man einen persisten Cache haben will
                        try {
                            if (fetchOptions?.parser) data = await fetchOptions.parser(data);
                        } catch (err) {
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
        const fetchErr = new LessFetchError(err as Error, response);

        if (key) {
            // Error-Retries
            if (fetchOptions?.retryOnError && errRetryCount < config.maxErrRetries) {
                // `isRevalidating=null` setzen, sonst wird bei Err retries auf promise gewartet, der bereits rejected wurde.
                cache?.update(key, { isRevalidating: null });

                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        mountedLessFetch(desc, params, cache, fetchOptions, errRetryCount + 1)
                            .then(result => resolve(result))
                            .catch(err => reject(err));
                    }, config.errRetryTimeout);
                });
            }

            cache?.update(key, { data: null, error: fetchErr, response, isRevalidating: null });
        }

        config.onError?.(fetchErr);

        throw fetchErr;
    }
}
