import type { Desc, LessApiHandler } from "./types";
import { DynamicRequest, parseParams } from "./system";
import type { NextRequest } from "next/server";
import LessResponse from "./LessResponse";
import { LessError } from "./error";

/**
 * Do this only in dev mode!!
 *
 * `Error.message` -> valid `Response.statusText`.
 *
 * The status may not contain certain cahracters and my have a maximum length.
 * This function sanitizes the error message.
 *
 * @param errorMessage `Error.message`
 * @returns Validen `Response.statusText`
 *  */
function errorMessageToDevStatusText(errorMessage: string) {
    errorMessage = "[dev_mode '(500) - Internal Server Error'] " + errorMessage;
    // Max length depends on browser. 300 should be safe
    const truncatedErrorMessage = errorMessage.length > 300 ? errorMessage.substring(0, 300) + "..." : errorMessage;
    // Remove unallowed characters
    const sanitizedErrorMessage = truncatedErrorMessage.replace(/[\r\n]+/g, " ");
    return sanitizedErrorMessage;
}

const devMode = process.env.NODE_ENV === "development";

export default async function withLess<T extends object = object>(
    args: [NextRequest, Record<string, string> | null | undefined] | [NextRequest, Record<string, string> | null | undefined, DynamicRequest], // [NextRequest, pathSegements, STaticRequest]
    desc: Desc<T> | null,
    handler: LessApiHandler<T>
): Promise<Response> {
    const req = args[0];
    const pathSegments = args[1] || {};
    const staticRequest = args[2];

    try {
        const parsedParams = await parseParams<T>(req, desc || ({ $response: "any" } as Desc<T>), staticRequest);
        const result = await handler({ params: parsedParams, pathSegments, req: req });

        // response
        if (result instanceof Response) return result;
        // response value
        else return LessResponse.send(result);
    } catch (err) {
        console.error(`\n${desc?.$method.toUpperCase()} - ${desc?.$path}\n`, err);

        if (err instanceof LessError) {
            // valid Error.message as statusMessage expected expected
            return LessResponse.sendStatus(err.status, err.statusText, { body: JSON.stringify(err.body || "") });
        } else {
            // Error.message -> Response.statusText
            return LessResponse.sendStatus(500, devMode ? errorMessageToDevStatusText((err as Error).message) : "Internal Server Error", {
                body: devMode ? (err as Error).stack : undefined,
            });
        }
    }
}
