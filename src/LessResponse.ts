import { NextResponse } from "next/server";
import { setHeader } from "./system";

/** Extends the NextResponse with some helper functions. (NextJS >= 13) */
export default class LessResponse extends NextResponse {
    /**
     * Sends an empty response with the given status and status message.
     * @param status
     * @param statusText Status message. **Darf nicht alle chars enthalten** ('\n' ist bspw. verboten).
     * @param init `ResponseInit`
     * */
    static sendStatus(status: number, statusText: string, init?: ResponseInit & { body?: string }) {
        return new LessResponse(init?.body, {
            status: status,
            statusText: statusText,
            ...init,
        });
    }

    /**
     * Sends _any_ value.
     * @param value
     * @param init `ResponseInit`
     * */
    static send(value: any, init?: ResponseInit) {
        if (value === null || value === undefined) return new Response(undefined, { status: 200, ...init });
        else if (value instanceof ReadableStream) return LessResponse.stream(value, init);
        else if (Buffer.isBuffer(value)) return LessResponse.blob(value, init);
        else return LessResponse.json(value, { status: 200, ...init });
    }

    /**
     * Sends a _Blob_.
     * @param value `Buffer`
     * @param init `ResponseInit`
     * */
    static blob(value: Buffer, init?: ResponseInit) {
        const headers = init?.headers || new Headers();
        setHeader(headers, "content-type", "application/octet-stream");
        return new Response(value, { status: 200, ...init });
    }

    /**
     * Sends a _Stream_.
     * @param value `ReadableStream`
     * @param init `ResponseInit`
     * */
    static stream(value: ReadableStream, init?: ResponseInit) {
        return new Response(value, { status: 200, ...init });
    }
}
