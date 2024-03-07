import type { Params, RHDesc, ResponseValue } from "./types";
import { parseParams } from "./system";
import type { NextRequest } from "next/server";
import RHResponse from "./RHResponse";
import RHError from "./RHError";
import { headers } from "next/headers";

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

type LessApiHandlerResponse<T extends object> = Response | ResponseValue<T>;

export type LessApiHandler<T extends object> = (req: {
    params: Params<T>;
    pathSegments: Record<string, string | string[]>;
    req: NextRequest;
}) => LessApiHandlerResponse<T> | Promise<LessApiHandlerResponse<T>>;

export default async function rh<T extends object = object>(
    args: [NextRequest, Record<string, string> | null | undefined],
    desc: RHDesc<T> | null,
    handler: LessApiHandler<T>
): Promise<Response> {
    const req = args[0];
    const pathSegments = args[1] || {};
    const headersList = headers();

    try {
        const parsedParams = await parseParams<T>(req, desc || ({ $response: "any" } as RHDesc<T>), headersList);
        const result = await handler({ params: parsedParams, pathSegments, req: req });

        // response
        if (result instanceof Response) return result;
        // response value
        else return RHResponse.send(result);
    } catch (err) {
        console.error(`\n${desc?.$method.toUpperCase()} - ${desc?.$path}\n`, err);

        if (err instanceof RHError) {
            // valid Error.message as statusMessage expected expected
            return RHResponse.sendStatus(err.status, err.statusText, { body: JSON.stringify(err.body || "") });
        } else {
            // Error.message -> Response.statusText
            return RHResponse.sendStatus(500, devMode ? errorMessageToDevStatusText((err as Error).message) : "Internal Server Error", {
                body: devMode ? (err as Error).stack : undefined,
            });
        }
    }
}
