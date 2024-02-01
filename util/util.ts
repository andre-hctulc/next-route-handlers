import type { NextRequest } from "next/server";
import type { ParamIn, ParamType, Desc, ParamDesc } from "../types";
import { dateReviver } from "src/packages/util/src/strings";
import { ParamTypeError } from "./errors";

export type DynamicRequest = { headers?: Headers };

function parseParam(paramName: string, value: any, { type, required }: ParamDesc<any>) {
    if (value === undefined) {
        if (required) throw new ParamTypeError(paramName, true);
        return value;
    }

    switch (type) {
        case "boolean":
            if (typeof value === "boolean") return value;
            if (value === "false") return false;
            else if (value === "true") return true;
            return Boolean(value);
        case "number":
            const num = +value;
            if (isNaN(num)) throw new ParamTypeError(paramName);
            return num;
        case "object":
        case "any":
            // TODO dateRevivder entfernen?
            return typeof value === "string" ? JSON.parse(value, dateReviver) : value;
        case "blob":
            if (!(value instanceof Blob)) throw new ParamTypeError(paramName);
            else return value;
        case "string":
            if (typeof value !== "string") throw new ParamTypeError(paramName);
            return value;
        case "blob-array":
            if (value instanceof Blob) value = [value];
            if (!Array.isArray(value) || value.some(item => !(item instanceof Blob))) throw new ParamTypeError(paramName);
            return value;
        default:
            throw new Error("Invalid parameter type");
    }
}

function getParam(paramName: string, reqBody: any, url: URL, paramDef: { type: ParamType; in: ParamIn }, dynamicRequest?: DynamicRequest) {
    let rawValue: any;

    switch (paramDef.in) {
        case "body":
            rawValue = reqBody?.[paramName];
            break;
        case "query":
            rawValue = url.searchParams.get(paramName) || undefined;
            break;
        case "header":
            if (!dynamicRequest?.headers) throw new Error("Dynamic request incomplete or missing - `headers` required");
            rawValue = dynamicRequest.headers.get(paramName) || undefined;
            break;
        default:
            rawValue = undefined;
            break;
    }

    return parseParam(paramName, rawValue, paramDef);
}

export function setHeader(headers: HeadersInit, headerName: string, value: string) {
    if (Array.isArray(headers)) return headers.push([headerName, value]);
    else if (headers instanceof Headers) headers.set(headerName, value);
    else headers[headerName] = value;
}

export function formDataToObject(formData: FormData, desc: Desc<any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const paramName in desc) {
        if (paramName.startsWith("$")) continue;
        const param = desc[paramName];
        if (formData.has(paramName))
            result[paramName] = parseParam(paramName, param.type === "blob-array" ? formData.getAll(paramName) : formData.get(paramName), desc[paramName]);
    }
    return result;
}

export function requiresFormDataBody(desc: Desc<any>): boolean {
    return Object.values(desc).some(v => ((v as any)?.type === "blob" || (v as any)?.type === "blob-array") && (v as any)?.in === "body");
}

export async function parseParams<T extends {}>(req: NextRequest, desc: Desc<T>, dynamicRequest?: DynamicRequest): Promise<T> {
    const result: Partial<T> = {};
    const url = new URL(req.url);
    const canHaveBody = desc.$method !== "GET" && desc.$method !== "DELETE";
    let body: any = {};

    if (canHaveBody) {
        if (Object.values(desc).some(v => (v as any)?.in === "body")) {
            if (requiresFormDataBody(desc)) body = formDataToObject(await req.formData(), desc);
            else {
                try {
                    // Kein Extra parsing, wie date reviver etc., aus performance Gründen
                    body = await req.json();
                } catch (err) {
                    body = {};
                }
            }
        }
    }

    for (const paramName in desc) {
        if (paramName.startsWith("$")) continue;
        result[paramName as keyof T] = getParam(paramName, body, url, desc[paramName as keyof T], dynamicRequest);
    }

    return result as T;
}

/**
 * Diese function wandelt eine `Error.message` in einen validen `Response.statusText` um.
 * @param errorMessage `Error.message`
 * @returns Validen `Response.statusText`
 *  */
export function errorMessageToStatusText(errorMessage: string) {
    errorMessage = "[dev-error '(500) - Internal Server Error'] " + errorMessage;
    // Maximallänge hngt von browser ab. 300 sollten immer kurz genug sein.
    const truncatedErrorMessage = errorMessage.length > 300 ? errorMessage.substring(0, 300) + "..." : errorMessage;
    // Unerlaubte Zeichen entfernen
    const sanitizedErrorMessage = truncatedErrorMessage.replace(/[\r\n]+/g, " ");
    return sanitizedErrorMessage;
}
