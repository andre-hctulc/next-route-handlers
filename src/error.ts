const devMode = process.env.NODE_ENV === "development";

export class LessError extends Error {
    static is(err: unknown, status?: number): err is LessError {
        return err instanceof LessError && (!status || err.status === status);
    }

    readonly isLessError = true;

    /**
     * @param status `Response.status`
     * @param statusText `Response.statusText`
     * @param errInfo _Response Body_
     */
    constructor(
        readonly status: number,
        readonly statusText: string,
        readonly errInfo?: any
    ) {
        super(statusText || "");
    }

    get body() {
        if (this.errInfo) return this.errInfo;
        else if (devMode) return this.stack;
    }
}
