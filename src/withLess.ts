import type { Desc, LessApiHandler } from "./types";
import { DynamicRequest, errorMessageToDevStatusText, parseParams } from "./sys/util";
import type { NextRequest } from "next/server";
import LessResponse from "./LessResponse";
import { LessError } from "./error";

const devMode = process.env.NODE_ENV === "development";

export default async function withLess<T extends {} = {}>(
    args: [NextRequest, Record<string, string> | null | undefined] | [NextRequest, Record<string, string> | null | undefined, DynamicRequest], // [NextRequest, pathSegements, STaticRequest]
    desc: Desc<T> | null,
    handler: LessApiHandler<T>
): Promise<Response> {
    const req = args[0];
    const pathSegments = args[1] || {};
    const staticRequest = args[2];

    try {
        const parsedParams = await parseParams<T>(req as any, desc || ({ $response: "any" } as any), staticRequest);
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
            return LessResponse.sendStatus(500, devMode ? errorMessageToDevStatusText((err as Error).message) : "Internal Server Error", {
                body: devMode ? (err as Error).stack : undefined,
            });
        }
    }
}
