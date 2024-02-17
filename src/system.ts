import type { NextRequest } from "next/server";
import type { ParamIn, ParamType, Desc, ParamDesc } from "./types";

/* 
This module is used client and server side!
*/

export function randomId(length = 12) {
    return [...Array(length)].map(() => (~~(Math.random() * 36)).toString(36)).join("");
}

export class ParamTypeError extends TypeError {
    constructor(paramName: string, required?: boolean) {
        super(`Invalid type received. At parameter '${paramName}'${required ? ". Required parameter missing" : ""}`);
    }
}

export function dateReviver(key: string, value: any) {
    if (typeof value === "string" && /^\d{4}-[01]\d-[0-3]\dT[012]\d(?::[0-6]\d){2}\.\d{3}Z$/.test(value)) {
        const date = new Date(value);
        // If the date is valid then go ahead and return the date object.
        if (+date === +date) return date;
    }
    // If a date was not returned, return the value that was passed in.
    return value;
}

export type DynamicRequest = { headers?: Headers };

function parseParam(paramName: string, value: any, { type, required }: ParamDesc<any>) {
    if (value === undefined) {
        if (required) throw new ParamTypeError(paramName, true);
        return value;
    }

    let num: number;

    switch (type) {
        case "boolean":
            if (typeof value === "boolean") return value;
            if (value === "false") return false;
            else if (value === "true") return true;
            return Boolean(value);
        case "number":
            num = +value;
            if (isNaN(num)) throw new ParamTypeError(paramName);
            return num;
        case "object":
        case "any":
            // TODO remove dateRevivder?
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

export async function parseParams<T extends object>(req: NextRequest, desc: Desc<T>, dynamicRequest?: DynamicRequest): Promise<T> {
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
