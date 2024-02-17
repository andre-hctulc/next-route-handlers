import React from "react";
import { mergeConfigs } from "../client-util";
import type { LessQueryConfig } from "./useLessQuery";
import QueryCache from "../QueryCache";
import LessDev from "./LessDev";

export const defaultQueryConfig: LessQueryConfig = {
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

const LessContext = React.createContext<LessContext>({
    currentUser: null,
    userRequired: false,
    queryCache: new QueryCache(),
    queryConfig: defaultQueryConfig,
    debug: false,
});

export interface LessContext<U extends { id: string } | null = null> {
    currentUser: U | null;
    userRequired: boolean;
    queryCache: QueryCache;
    /** Merges with the parent's `LessProvider`'s query config  */
    queryConfig: LessQueryConfig;
    debug: boolean;
}

interface LessProviderProps<U extends { id: string } | null = null> {
    queryConfig?: Partial<LessQueryConfig>;
    children?: React.ReactNode;
    debug?: boolean;
    user?: U;
    userRequired?: boolean;
}

export function useLess<U extends { id: string } | null = null>(): LessContext<U> {
    const ctx = React.useContext(LessContext);
    return ctx as any;
}

export default function LessProvider<U extends { id: string }>(props: LessProviderProps<U>) {
    const ctx = useLess();
    const queryCache = React.useMemo(() => ctx?.queryCache || new QueryCache(), [ctx?.queryCache]);
    const queryConfig = React.useMemo(() => {
        return mergeConfigs(props.queryConfig || {}, ctx?.queryConfig || defaultQueryConfig);
    }, [ctx?.queryConfig, props.queryConfig]);

    if (props.userRequired && !props.user) throw new Error("User required");

    return (
        <LessContext.Provider
            value={{
                debug: !!props.debug,
                queryCache: queryCache,
                queryConfig: queryConfig,
                currentUser: (props.user as any) || null,
                userRequired: !!props.userRequired,
            }}
        >
            {props.debug !== false && <LessDev />}
            {props.children}
        </LessContext.Provider>
    );
}
