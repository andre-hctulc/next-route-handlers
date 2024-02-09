import React from "react";
import { mergeConfigs } from "../client-util";
import { LessQueryConfig, defaultQueryConfig } from "./useLessQuery";
import QueryCache from "./QueryCache";

/** Typ der Keys, die für den Cache (`MemoryCache`) verwendet wird */
export type LessQueryKey = {
    desc: string;
    params: object;
    streamer: true | undefined;
    streamer_page: number | undefined;
    streamer_chunkSize: number | undefined;
    cognito: string | undefined;
};

// * Context

const LessCacheContext = React.createContext<LessCacheContext | null>(null);

export interface LessCacheContext {
    /** Falls es einen übergeordneten `LessContext` gibt, wird dessen `queryCache` hier verwendet  */
    cache: QueryCache;
    config: LessQueryConfig;
}

interface LessCacheContextProviderProps {
    config?: LessQueryConfig;
    children?: React.ReactNode;
}

export function useLessCache<O extends boolean = false>(optional?: O): O extends true ? LessCacheContext | undefined : LessCacheContext {
    const cache = React.useContext(LessCacheContext);
    if (!cache && !optional) throw new Error("`LessCacheProvider` required");
    return cache as any;
}

export default function LessCacheProvider(props: LessCacheContextProviderProps) {
    const ctx = useLessCache(true);
    const queryCache = React.useMemo(() => ctx?.cache || new QueryCache(), [ctx?.cache]);
    const queryConfig = React.useMemo(() => {
        return mergeConfigs(props.config || {}, ctx?.config || defaultQueryConfig);
    }, [ctx?.config, props.config]);
    return (
        <LessCacheContext.Provider
            value={{
                cache: queryCache,
                config: queryConfig,
            }}
        >
            {props.children}
        </LessCacheContext.Provider>
    );
}
