import { Falsy } from "src/packages/util/src/utility-types";
import { Desc, Params, ResponseValue } from "../types";
import { requiresFormDataBody } from "../util/util";
import { bodyToFormData, getResponseValue, mergeConfigs, setParams } from "./less-client";
import { LessQueryKey } from "./react/less-cache";
import LessFetchError from "./react/less-fetch-error";
import { QueryCache } from "@less/client/react/query-cache";

export async function lessFetch<T extends {}>(
    desc: Desc<T>,
    params: Params<T>,
    requestInit?: RequestInit
): Promise<{ response: Response; responseValue: ResponseValue<T> }> {
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
