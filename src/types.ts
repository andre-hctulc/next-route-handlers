import type { NextApiRequest, NextApiResponse } from "next";
import type { NextRequest } from "next/server";

type LessApiHandlerResponse<T extends object> = Response | LessResponseValue<T>;

export type LessApiHandler<T extends object> = (req: {
    params: Params<T>;
    pathSegments: Record<string, string | string[]>;
    req: NextRequest;
}) => LessApiHandlerResponse<T> | Promise<LessApiHandlerResponse<T>>;

export type LessApiHandlerX<T extends object> = (
    req: {
        params: Partial<Params<T>>;
        pathSegments: Record<string, string | string[]>;
        req: NextApiRequest;
    },
    res: NextApiResponse
) => NextApiResponse | LessResponseValue<T> | Promise<NextApiResponse | LessResponseValue<T>> | void;

// params --

/** \<D\>esc */
export type ParamDesc<T> = { type: ParamTypeMap<T>; in: ParamIn; required?: boolean };
export type Params<D extends object> = Omit<D, `$${string}`>;
export type ParamType = "string" | "number" | "boolean" | "object" | "any" | "blob" | "blob-array";
export type ParamIn = "body" | "query" | "header";

type ParamTypeMap<T> = T extends string
    ? "string"
    : T extends number
    ? "number"
    : T extends boolean
    ? "boolean"
    : T extends Blob | File
    ? "blob"
    : T extends (Blob | File)[]
    ? "blob-array"
    : T extends object
    ? "object" | "any"
    : "any";

// response --

export type LessResponseType = "string" | "number" | "boolean" | "object" | "void" | "any" | "blob" | "stream";

export type LessResponseValue<T extends object> = T extends { $response?: any } ? T["$response"] : any;

type ResponseTypeMap<R> = R extends string
    ? "string"
    : R extends number
    ? "number"
    : R extends boolean
    ? "boolean"
    : R extends Blob | Buffer | ReadableStream
    ? "blob" | "stream"
    : R extends object | ReadableStream
    ? "object" | "stream" | "any"
    : R extends void
    ? "void"
    : "any";

// others --

export type Desc<T extends object> = { [K in Exclude<keyof T, `$${string}`>]: ParamDesc<T[K]> } & (T extends {
    $response: infer R;
}
    ? { $response: ResponseTypeMap<R> }
    : { $response: LessResponseType }) & {
        $method: "GET" | "POST" | "DELETE" | "PUT";
        $path: string;
    };

export type ResponseBuffer = ArrayBuffer | Buffer;
export type ResponseFile = Buffer | Blob | ReadableStream;
