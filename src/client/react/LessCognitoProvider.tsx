"use client";

import { useSession } from "next-auth/react";
import React from "react";
import LessDev from "./LessDev";

export const LessCognitoContext = React.createContext<LessCognitoContext>({ currentUser: null, cognitoMode: false });

export interface LessCognitoContext {
    currentUser: { id: string } | null;
    cognitoMode: boolean;
}

interface LessCognitoProviderProps {
    children?: React.ReactNode;
    cognitoMode: boolean;
    required: boolean;
    debug?: boolean;
}

export function useLessCognitoContext() {
    const lessContext = React.useContext(LessCognitoContext);
    return lessContext;
}

export default function LessCognitoProvider(props: LessCognitoProviderProps) {
    const session = useSession({ required: !!props.required });
    const currentUser = session.data?.user;

    if (session.status === "loading" || (props.required && !currentUser)) return null;

    return (
        <LessCognitoContext.Provider
            value={{
                currentUser: session.data?.user as any,
                cognitoMode: props.cognitoMode,
            }}
        >
            {props.debug !== false && <LessDev />}
            {props.children}
        </LessCognitoContext.Provider>
    );
}
