import type { NextApiRequest, NextApiResponse } from "next";
import type {  Session } from "next-auth";
import type { NextRequest } from "next/server";

export type LessApiHandler<T extends {}> = (req: {
    params: Params<T>;
    pathSegments: Record<string, string | string[]>;
    req: NextRequest;
}) => Response | ResponseValue<T> | Promise<Response | ResponseValue<T>>;

export type LessApiHandlerX<T extends {}> = (
    req: {
        params: Partial<Params<T>>;
        pathSegments: Record<string, string | string[]>;
        /** This is only provided, when $requireUser or $pullUser is set to true. */
        session: Session | null;
        req: NextApiRequest;
    },
    res: NextApiResponse
) => NextApiResponse | ResponseValue<T> | Promise<NextApiResponse | ResponseValue<T>> | void;


// params --

/** \<D\>esc */
export type ParamDesc<T> = { type: ParamTypeMap<T>; in: ParamIn; required?: boolean };
export type Params<D extends {}> = Omit<D, `$${string}`>;
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

export type ResponseType = "string" | "number" | "boolean" | "object" | "void" | "any" | "blob" | "stream";
export type ResponseValue<T extends {}> = T extends { $response?: any } ? T["$response"] : any;

type ResponseTypeMap<R> = R extends string
    ? "string"
    : R extends number
    ? "number"
    : R extends boolean
    ? "boolean"
    : R extends Blob | Buffer | ReadableStream
    ? "blob" | "stream"
    : R extends {} | ReadableStream
    ? "object" | "stream" | "any"
    : R extends void
    ? "void"
    : "any";

// others --

export type Desc<T extends {}> = { [K in Exclude<keyof T, `$${string}`>]: ParamDesc<T[K]> } & (T extends {
    $response: infer R;
}
    ? { $response: ResponseTypeMap<R> }
    : { $response: ResponseType }) & {
        $method: "GET" | "POST" | "DELETE" | "PUT";
        $path: string;
    };

export type ResponseBuffer = ArrayBuffer | Buffer;
export type ResponseFile = Buffer | Blob | ReadableStream;
