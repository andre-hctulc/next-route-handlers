import React from "react";
import LessFetchError from "./LessFetchError";
import { lessFetch } from "../lessFetch";
import { LessResponseValue, Params, Desc } from "../../types";

export type UseLessMutationData<R> =
    | { data: undefined; isSuccess: false; isError: true; error: LessFetchError }
    | { data: R; isSuccess: true; isError: false; error: null };

export type UseLessMutationResult<D extends {}, R = LessResponseValue<D>> = {
    isLoading: boolean;
    isReady: boolean;
    mutate: (params: Params<D> | FormData, requestInit?: RequestInit) => Promise<UseLessMutationData<R>>;
    /** Resets the current status */
    reset: () => void;
} & UseLessMutationData<R>;

export type UseLessMutationOptions<D extends {}, R = LessResponseValue<D>> = {
    requestInit?: RequestInit;
    onError?: (error: LessFetchError) => void;
    onSuccess?: (data: R) => void;
    parser?: (data: LessResponseValue<D>) => R | Promise<R>;
};

export default function useLessMutation<D extends {}, R = LessResponseValue<D>>(desc: Desc<D>, options?: UseLessMutationOptions<D, R>): UseLessMutationResult<D, R> {
    const [isSuccess, setIsSuccess] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<LessFetchError | null>(null);
    const [data, setData] = React.useState<LessResponseValue<D>>();

    async function mutate(params: Params<D> | FormData, requestInit?: RequestInit): Promise<UseLessMutationData<LessResponseValue<D>>> {
        const resolve = (error: LessFetchError | null, data: LessResponseValue<D> | undefined) => {
            setIsLoading(false);
            setIsSuccess(!error);
            setError(error);
            setData(data);

            if (error) options?.onError?.(error);
            else options?.onSuccess?.(data as any);

            return { isSuccess: !error as any, isError: !!error as any, error: error as any, data: data as any };
        };

        let response: Response | null = null;

        setIsSuccess(false);
        setError(null);
        setIsLoading(true);

        try {
            const { response: res, responseValue } = await lessFetch(desc, params, requestInit || options?.requestInit);

            response = res;
            if (!response.ok) throw new Error("Response not ok");

            let data: any = responseValue;

            try {
                if (options?.parser) data = await options.parser(data);
            } catch (err) {
                throw new Error("Failed to parse data");
            }

            return resolve(null, data);
        } catch (err) {
            const lessError = new LessFetchError(err as Error, response);
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
