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
    : T extends Blob
    ? "blob"
    : T extends Blob[]
    ? "blob-array"
    : T extends object
    ? "object" | "any"
    : "any";

// response --

export type ResponseType = "string" | "number" | "boolean" | "object" | "void" | "any" | "blob" | "stream";
export type ResponseValue<T extends object> = T extends { $response?: any } ? T["$response"] : any;

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

export type RHDesc<T extends object> = { [K in Exclude<keyof T, `$${string}`>]: ParamDesc<T[K]> } & (T extends {
    $response: infer R;
}
    ? { $response: ResponseTypeMap<R> }
    : { $response: ResponseType }) & {
        $method: "GET" | "POST" | "DELETE" | "PUT";
        $path: string;
    };