export class LessError extends Error {
    readonly isLessError = true;

    constructor(
        readonly status: number,
        readonly statusText: string,
        readonly errInfo?: any
    ) {
        super(statusText || "");
    }

    static is(err: unknown, status?: number): err is LessError {
        return err instanceof LessError && (!status || err.status === status);
    }
}
