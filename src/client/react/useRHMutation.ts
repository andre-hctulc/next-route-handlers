import React from "react";
import RHFetchError from "./RHFetchError";
import rhFetch from "../rhFetch";
import { ResponseValue, Params, RHDesc } from "../../types";

type MutationResult<R> =
    | { data: undefined; isSuccess: false; isError: true; error: RHFetchError }
    | { data: R; isSuccess: true; isError: false; error: null };

export type Mutation<D extends object, R = ResponseValue<D>> = {
    isLoading: boolean;
    isReady: boolean;
    mutate: (params: Params<D> | FormData, requestInit?: RequestInit) => Promise<MutationResult<R>>;
    /** Resets the current status */
    reset: () => void;
} & MutationResult<R>;

export type MutationOptions<D extends object, R = ResponseValue<D>> = {
    requestInit?: RequestInit;
    onError?: (error: RHFetchError) => void;
    onSuccess?: (data: R) => void;
    parser?: (data: ResponseValue<D>) => R | Promise<R>;
    fetcher?: (params: Params<D>) => Promise<R> | R;
};

export default function useRHMutation<D extends object, R = ResponseValue<D>>(desc: RHDesc<D>, options?: MutationOptions<D, R>): Mutation<D, R> {
    const [isSuccess, setIsSuccess] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<RHFetchError | null>(null);
    const [data, setData] = React.useState<ResponseValue<D>>();

    async function mutate(params: Params<D> | FormData, requestInit?: RequestInit): Promise<MutationResult<ResponseValue<D>>> {
        const resolve = (error: RHFetchError | null, data: ResponseValue<D> | undefined) => {
            setIsLoading(false);
            setIsSuccess(!error);
            setError(error);
            setData(data);

            if (error) options?.onError?.(error);
            else options?.onSuccess?.(data as ResponseValue<D>);

            return { isSuccess: !error as any, isError: !!error as any, error: error as any, data: data as any };
        };

        let response: Response | null = null;

        setIsSuccess(false);
        setError(null);
        setIsLoading(true);

        try {
            let responseValue: any;

            if (options?.fetcher) responseValue = await options.fetcher(params as Params<D>);
            else {
                const { response: res, responseValue: value } = await rhFetch(desc, params, requestInit || options?.requestInit);
                if (!res.ok) throw new Error("Response not ok");
                response = res;
                responseValue = value;
            }

            let data: any = responseValue;

            try {
                if (options?.parser) data = await options.parser(data);
            } catch (err) {
                throw new Error("Failed to parse data");
            }

            return resolve(null, data);
        } catch (err) {
            const lessError = new RHFetchError(err as Error, response);
            return resolve(lessError, undefined);
        }
    }

    function reset() {
        setIsSuccess(false);
        setIsLoading(false);
        setData(undefined);
        setError(null);
    }

    return {
        isSuccess: isSuccess as any,
        isError: !!error as any,
        isLoading,
        error: error as any,
        isReady: isSuccess || !!error,
        mutate,
        data: data,
        reset,
    };
}
