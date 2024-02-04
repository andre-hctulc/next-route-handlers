import type { Desc, LessApiHandler } from "./types";
import { DynamicRequest, errorMessageToStatusText, parseParams } from "./util/util";
import type { NextRequest } from "next/server";
import { LessResponse } from "./util/response";

// TODO session hier als arg mitgeben, da nur dort verfügbar getServerSession(authOptions) LessProvider.Options.validateSession...

const devMode = process.env.NODE_ENV === "development";

export class LessError extends Error {
    readonly isLessError = true;

    /**
     * @param status Wird als `Response` Status verwendet
     * @param statusTextWird als `Response` Status text verwendet
     * @param errInfo Wird als `Response` Body verwendet
     */
    constructor(
        readonly status: number,
        readonly statusText: string,
        readonly errInfo?: string | object
    ) {
        super(statusText || "");
    }

    get body() {
        if (this.errInfo) return this.errInfo;
        else if (devMode) return this.stack;
    }
}

export default async function withLess<T extends {} = {}>(
    args: [NextRequest, Record<string, string> | null | undefined] | [NextRequest, Record<string, string> | null | undefined, DynamicRequest], // [NextRequest, pathSegements, STaticRequest]
    desc: Desc<T> | null,
    handler: LessApiHandler<T>
): Promise<Response> {
    const req = args[0];
    const pathSegments = args[1] || {};
    const staticRequest = args[2];

    // LATER (NextJS 13 Fehler -> manuell) if ((desc?.$requireUser || desc?.$pullUser) && _provider.authOptions) token = await getToken({ req });

    const parsedParams = await parseParams<T>(req as any, desc || ({ $response: "any" } as any), staticRequest);

    // LATER (NextJS 13 Fehler -> manuell) if (!token && desc?.$requireUser) return new NextResponse(undefined, { statusText: "Unauthorized", status: 401 });

    try {
        const result = await handler({ params: parsedParams, pathSegments, req: req });

        // response
        if (result instanceof Response) return result;
        // response value
        else return LessResponse.send(result);
    } catch (err) {
        console.error(`\n${desc?.$method.toUpperCase()} - ${desc?.$path}\n`, err);

        if (err instanceof LessError) {
            // Error.message valider Response.statusText vorrausgesetzt
            return LessResponse.sendStatus(err.status, err.statusText, { body: JSON.stringify(err.body || "") });
        } else {
            // Error.message nach Response.statusText umwandeln
            return LessResponse.sendStatus(500, devMode ? errorMessageToStatusText((err as Error).message) : "Internal Server Error", {
                body: devMode ? (err as Error).stack : undefined,
            });
        }
    }
}
