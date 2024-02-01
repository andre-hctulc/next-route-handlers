"use client";

import React from "react";
import { useLessCognitoContext } from "./less-cognito-context";
import { useLessCache } from "./less-cache";
import { QueryState } from "@less/client/react/query-cache";

export default function LessDev() {
    const ctx = useLessCognitoContext();
    const { cache } = useLessCache();
    const [open, setOpen] = React.useState(false);
    const cacheEntries = React.useMemo<{ key: string; state: QueryState }[]>(() => {
        return Array.from(cache.keys()).map(key => ({ key: key, state: cache.get(key) as any }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cache, open]);

    return (
        <div
            style={{
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                position: "fixed",
                padding: 5,
                top: 20,
                right: 20,
                maxWidth: 550,
                background: "white",
                border: "2px solid black",
            }}
        >
            <button onClick={() => setOpen(!open)} style={{ border: "2px solid blue", alignSelf: "flex-end", width: 30, height: 30 }}>
                {open ? "-" : "+"}
            </button>
            <div style={{ display: open ? "flex" : "none", maxHeight: 500, overflowY: "auto" }} className="flex flex-col space-y-2 min-w-0">
                {cacheEntries.map(entry => (
                    <div className="flex flex-col border-2 rounded max-w-full p-0.5" style={{ borderColor: "green" }} key={entry.key}>
                        <h5 style={{ fontWeight: 500 }} className="break-words overflow-hidden whitespace-normal max-w-full">
                            {entry.key}
                        </h5>
                        <div className="flex flex-row space-x-1 my-2">
                            <strong style={{ color: "magenta" }}>isLoading:</strong>
                            <span>{entry.state.isRevalidating + ""}</span>
                            <strong style={{ color: "red" }}>Error:</strong>
                            <span>{entry.state.error instanceof Error ? entry.state.error.message?.substring(20) : ""}</span>
                        </div>
                        <p style={{ maxHeight: 150, overflowY: "auto", marginTop: 5 }}>{JSON.stringify(entry.state.data)}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
