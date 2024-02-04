import { Desc, Params, LessResponseValue } from "../types";
import { requiresFormDataBody } from "../util/util";
import { bodyToFormData, getResponseValue, setParams } from "./client-util";

export async function lessFetch<T extends {}>(
    desc: Desc<T>,
    params: Params<T>,
    requestInit?: RequestInit
): Promise<{ response: Response; responseValue: LessResponseValue<T> }> {
    let inp = desc.$path;
    const method = (desc.$method || requestInit?.method || "GET").toLowerCase();
    const headers = new Headers(requestInit?.headers || {});
    const hasBody = method !== "get" && method !== "delete";
    let body: any = {};
    const searchParams = new URLSearchParams();

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
