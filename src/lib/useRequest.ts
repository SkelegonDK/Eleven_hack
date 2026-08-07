/**
 * One request's lifecycle, held as one state machine instead of three
 * `useState` calls that have to be kept in agreement by hand.
 *
 * Four components each grew their own `{ loading, error, data }` triple, and
 * each got a detail wrong — most often leaving `loading` true after a failure,
 * or flipping it false before the state that depends on it settled. `run()`
 * owns the whole transition: it sets `loading` first, then writes exactly one
 * terminal state from the `ApiResult` it receives. There is no path that
 * forgets to clear it.
 *
 * Deliberately dumb: no caching, no deduplication, no Suspense, no retry, no
 * abort. It does not fetch anything either — `run()` takes a thunk (in
 * practice a `poduApi` function), so this hook never knows a URL. That keeps
 * it testable, dependency-free, and honest about being a state holder.
 *
 * `data` survives a subsequent `run()`: a refresh keeps rendering the last
 * known-good value rather than blanking the UI, and a failed refresh leaves
 * the stale value visible alongside `error` for the caller to weigh.
 *
 * Not race-safe by design: concurrent `run()` calls on one hook resolve in
 * whatever order the network returns. Callers here issue one at a time.
 */

import { useCallback, useState } from "react";
import type { ApiError, ApiResult } from "./poduApi";

export type RequestStatus = "idle" | "loading" | "success" | "error";

interface RequestState<T> {
  status: RequestStatus;
  data: T | null;
  error: ApiError | null;
}

export interface UseRequest<T> extends RequestState<T> {
  /**
   * Run `fn`, mirroring its result into state. Also returns the result, so a
   * caller that needs to branch immediately (rather than on the next render)
   * can do so without reading back through state it hasn't received yet.
   */
  run: (fn: () => Promise<ApiResult<T>>) => Promise<ApiResult<T>>;
}

export function useRequest<T>(): UseRequest<T> {
  const [state, setState] = useState<RequestState<T>>({
    status: "idle",
    data: null,
    error: null,
  });

  const run = useCallback(async (fn: () => Promise<ApiResult<T>>) => {
    setState((prev) => ({ status: "loading", data: prev.data, error: null }));

    const result = await fn();

    setState((prev) =>
      result.ok
        ? { status: "success", data: result.data, error: null }
        : { status: "error", data: prev.data, error: result.error },
    );

    return result;
  }, []);

  return { ...state, run };
}
