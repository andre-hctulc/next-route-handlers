import { dateReviver } from "../sys/util";
import { Desc, ParamIn, ParamType, LessResponseType } from "../types";
import { LessQueryConfig } from "./react/useLessQuery";

export function requiresFormDataBody(desc: Desc<any>): boolean {
    return Object.values(desc).some(v => typeof v === "object" && ((v as any)?.type === "blob" || (v as any)?.type === "blob-array") && (v as any)?.in === "body");
}

function setBodyProp(paramName: string, body: any, value: any) {
    if (value === undefined) return;
    else body[paramName] = value;
}

function setHeadersOrQueryParams(paramName: string, headersOrSearchParams: Headers | URLSearchParams, value: any, type: ParamType) {
    if (value == null) return;

    switch (type) {
        case "boolean":
            headersOrSearchParams.set(paramName, value + "");
            break;
        case "number":
            headersOrSearchParams.set(paramName, value + "");
            break;
        case "object":
        case "any":
            headersOrSearchParams.set(paramName, JSON.stringify(value));
            break;
        case "blob-array":
        case "blob":
            throw new Error("Cannot put blob in header");
        case "string":
            headersOrSearchParams.set(paramName, value);
            break;
    }
}

export function setParams(desc: Desc<any>, headers: Headers, body: any, query: URLSearchParams, values: any) {
    for (const paramName in desc) {
        if (paramName.startsWith("$")) continue;

        const paramDef = desc[paramName];

        switch (paramDef.in) {
            case "body":
                setBodyProp(paramName, body, values[paramName]);
                break;
            case "header":
                setHeadersOrQueryParams(paramName, headers, values[paramName], paramDef.type);
                break;
            case "query":
                setHeadersOrQueryParams(paramName, query, values[paramName], paramDef.type);
                break;
        }
    }
}

/** @param value Cannot be null or undefined */
function paramToFormDataValue(value: any, paramDef: { type: ParamType; in: ParamIn }): string | Blob | Blob[] {
    if (value == null) throw new Error("Received null or undefined for form data property");

    switch (paramDef.type) {
        case "boolean":
        case "number":
        case "string":
            return value + "";
        case "blob-array":
            (value as (Blob | ArrayBuffer)[]).map(item => (item instanceof ArrayBuffer || item instanceof Uint8Array ? new Blob([item]) : item));
        case "blob":
            return value instanceof ArrayBuffer || value instanceof Uint8Array ? new Blob([value]) : value;
        case "object":
        case "any":
            return JSON.stringify(value);
        default:
            throw new Error("Unknown param type");
    }
}

export function bodyToFormData(body: {}, desc: Desc<any>) {
    const formData = new FormData();

    for (const propName in body) {
        const value: any = body[propName as keyof typeof body];

        if (value != undefined) {
            const formValue = paramToFormDataValue(value, desc[propName as keyof typeof desc]);

            if (desc[propName].type === "blob-array") {
                if (!Array.isArray(formValue)) throw new TypeError("Expected type `Array` for blob arrays");
                /** Die Reihenfolge sollte beibehalten werden für den server. // ! Ein vorheriger kommentar hat anderes behauptet */
                formValue.forEach(blob => formData.append(propName, blob));
            } else {
                if (Array.isArray(formValue)) throw new TypeError("Received `Array` for non blob array");
                formData.set(propName, formValue);
            }
        }
    }

    return formData;
}

export async function getResponseValue(res: Response, type: LessResponseType) {
    if (!res.ok) return undefined;

    switch (type) {
        case "any":
        case "boolean":
        case "number":
        case "string":
            try {
                const contentType = res.headers.get("content-type");
                const text = await res.text();
                // startsWith statt ===, da header auch 'application/json ...' sein kann‚
                return contentType?.startsWith("application/json") ? (text ? JSON.parse(text, dateReviver) : undefined) : text;
            } catch (err) {
                return undefined;
            }
        case "blob":
            try {
                const blob = await res.blob();
                // FIXME statt  blob länge, content type überprüfen (Momentan kann man keine headers in route handler senden)
                // Sendet der server undefined, ist blob ein `Blob` mit `Blob.size` 0
                if (!blob.size) return undefined;
                return blob;
            } catch (err) {
                return undefined;
            }
        case "object":
            try {
                const text = await res.text();
                const obj = text ? JSON.parse(text, dateReviver) : undefined;
                return obj;
            } catch (err) {
                return undefined;
            }

        case "stream":
            return res.body;
        case "void":
        default:
            return undefined;
    }
}

// Util

export function toBlob<R extends boolean = false>(
    data: ArrayBuffer | Uint8Array | undefined | null | Blob | string,
    required?: R
): R extends true ? Blob : Blob | undefined {
    if (data instanceof Blob) return data;
    if (typeof data === "string") return new Blob([data], { type: "text/plain" });
    if (required && !data) throw new Error("Blob data required");
    if (!data) return undefined as any;
    return new Blob([data], { type: "application/octet-stream" });
}

export function toBlobArray<R extends boolean = false>(
    data: (ArrayBuffer | Uint8Array | Blob | string)[] | undefined | null,
    required?: R
): R extends true ? Blob[] : Blob[] | undefined {
    if (required && !data) throw new Error("Blob data required");
    if (!data) return undefined as any;
    return data.map(b => toBlob(b, true));
}

/**
 * `config1` überschreibt `config2`
 * @param config1
 * @param config2
 * @returns
 */
export function mergeConfigs(config1: Partial<LessQueryConfig>, config2: LessQueryConfig) {
    /** Enthält alle props (Standardmäßig mit default values) */
    const newConfig = { ...config2 };

    // `newConfig` enthält ALLE möglichen Optionen, dewegen darüber iterieren, um nur erlaubte Props zu setzen
    for (const mem in newConfig) {
        const prop: keyof LessQueryConfig = mem as any;
        if (config1[prop] !== undefined) (newConfig as any)[prop] = config1[prop];
    }

    return newConfig;
}

export type Falsy = null | undefined | false | 0 | "";
