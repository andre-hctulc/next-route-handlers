export default class RHFetchError extends Error {
    constructor(readonly reason: Error, readonly response: Response | null) {
        super(`LessFetchError${response ? ` (${response.status}) "${response.statusText}"` : ` - Reason: ${reason.message}`}`);
    }

    get status() {
        return this.response?.status || 0;
    }

    get statusText() {
        return this.response?.statusText || 0;
    }

    async getInfo(): Promise<object | string> {
        try {
            return await this.response?.json();
        } catch (err) {
            return "";
        }
    }

    static is(err: unknown, status?: number): err is RHFetchError {
        return err instanceof RHFetchError && (!status || status === err.response?.status);
    }
}
