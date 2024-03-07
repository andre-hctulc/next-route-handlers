import React from "react";
import { mergeConfigs } from "../client-util";
import type { RHQueryConfig } from "./useRHQuery";
import QueryCache from "../QueryCache";
import RHDev from "./RHDev";

// default config

export const defaultQueryConfig: RHQueryConfig = {
    freshTime: 5000,
    keepPreviousData: true,
    maxErrRetries: 3,
    onError: undefined,
    errRetryTimeout: 2000,
    retryOnError: true,
    tags: [],
    requestInit: {},
    forceRefetch: false,
    detatch: false,
};

// Context

const RHContext = React.createContext<RHContext>({
    queryCache: new QueryCache(),
    queryConfig: defaultQueryConfig,
    debug: false,
});

export interface RHContext {
    queryCache: QueryCache;
    /** Merges with the parent's `LessProvider`'s query config  */
    queryConfig: RHQueryConfig;
    debug: boolean;
}

export function useRHContext(): RHContext {
    const ctx = React.useContext(RHContext);
    return ctx as any;
}

// Provider

interface RHProviderProps<U extends { id: string } | null = null> {
    queryConfig?: Partial<RHQueryConfig>;
    children?: React.ReactNode;
    debug?: boolean;
    user?: U;
    userRequired?: boolean;
}

export default function RHProvider<U extends { id: string }>(props: RHProviderProps<U>) {
    const ctx = useRHContext();
    const queryCache = React.useMemo(() => ctx?.queryCache || new QueryCache(), [ctx?.queryCache]);
    const queryConfig = React.useMemo(() => {
        return mergeConfigs(props.queryConfig || {}, ctx?.queryConfig || defaultQueryConfig);
    }, [ctx?.queryConfig, props.queryConfig]);

    return (
        <RHContext.Provider
            value={{
                debug: !!props.debug,
                queryCache: queryCache,
                queryConfig: queryConfig,
            }}
        >
            {props.debug !== false && <RHDev />}
            {props.children}
        </RHContext.Provider>
    );
}
