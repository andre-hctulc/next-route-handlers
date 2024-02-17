import { Desc, Params, LessResponseValue } from "../types";
import { requiresFormDataBody } from "../system";
import { bodyToFormData, getResponseValue, setParams } from "./client-util";

export default async function lessFetch<T extends object>(
    desc: Desc<T>,
    params: Params<T> | FormData,
    requestInit?: RequestInit
): Promise<{ response: Response; responseValue: LessResponseValue<T> }> {
    let inp = desc.$path;
    const method = (desc.$method || requestInit?.method || "GET").toLowerCase();
    const headers = new Headers(requestInit?.headers || {});
    const hasBody = method !== "get" && method !== "delete";
    let body: any = {};
    const searchParams = new URLSearchParams();

    if (params instanceof FormData) {
        const newParams: any = {} ;
        params.forEach((value, key) => ((newParams as Record<string, any>)[key] = value));
        params = newParams;
    }

    setParams(desc, headers, body, searchParams, params || {});

    const _search = searchParams.toString();

    inp += _search ? "?" + _search : "";

    const requiresFormData = requiresFormDataBody(desc);

    if (!requiresFormData) headers.set("Content-Type", "application/json");
    else if (hasBody) body = bodyToFormData(body, desc);

    const response = await fetch(inp, {
        ...requestInit,
        method: method,
        body: hasBody ? (requiresFormData ? body : JSON.stringify(body)) : undefined,
        headers: headers,
    });
    const responseValue = await getResponseValue(response, desc.$response || "any");

    return { response, responseValue };
}
