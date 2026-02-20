import { useEffect } from "react";

export interface IDebouncedEffectCallbackParams {
  cancelled: boolean;
}

/**
 * Like useEffect, but debounces the effect execution. This is useful for async
 * callbacks that are not only expensive but also may be invalidated by subsequent changes.
 *
 * The effect is delayed by `delay` ms. If dependencies change before the delay
 * elapses, the previous effect is cancelled and a new delay starts.
 *
 * The callback is provided with a object parameter that contains a `cancelled` state.
 * The callback decides what to do based on the state - normally it should avoid expensive
 * operations and state updates if `cancelled` is true.
 *
 * @param callback - Effect callback should be a memoized function. The callback
 * should always read into the parameter to get the latest value.
 * @param delay - Debounce delay in milliseconds.
 */
export const useDebouncedEffect = (
  callback: (state: IDebouncedEffectCallbackParams) => void,
  delay: number,
): void => {
  useEffect(() => {
    const state = {
      cancelled: false,
    };
    const timeoutId = setTimeout(() => callback(state), delay);

    return () => {
      state.cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [callback, delay]);
};
