"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  PickupApiError,
  toPickupError,
  type PickupSnapshot,
} from "@/api/pickups";

type State = {
  data: PickupSnapshot | null;
  error: PickupApiError | null;
  checking: boolean;
  backgroundChecking: boolean;
};

function shouldPoll(data: PickupSnapshot) {
  return (
    data.parcel.status === "pending" &&
    data.receipt === null &&
    (
      data.verification === null ||
      data.verification.status === "awaiting_confirmation"
    )
  );
}

export function useLivePickup(
  load: (signal: AbortSignal) => Promise<PickupSnapshot>,
) {
  const [state, setState] = useState<State>({
    data: null,
    error: null,
    checking: true,
    backgroundChecking: false,
  });

  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const stop = useCallback(() => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    stop();
    pausedRef.current = true;

    if (mountedRef.current) {
      // 明碼、成功結果與舊狀態一起清除。
      setState({
        data: null,
        error: null,
        checking: false,
        backgroundChecking: false,
      });
    }
  }, [stop]);

  const pause = useCallback(() => {
    stop();
    pausedRef.current = true;

    if (mountedRef.current) {
      setState((previous) => ({
        ...previous,
        checking: true,
        backgroundChecking: false,
      }));
    }
  }, [stop]);

  const refresh = useCallback(
    async function read(
      manual = true,
    ): Promise<PickupSnapshot> {
      if (
        !mountedRef.current ||
        document.hidden ||
        (!manual && pausedRef.current)
      ) {
        throw new PickupApiError(
          0,
          "READ_CANCELLED",
          "查詢已暫停。",
        );
      }

      stop();
      if (manual) pausedRef.current = false;

      const generation = generationRef.current;
      const controller = new AbortController();
      controllerRef.current = controller;

      setState((previous) => ({
        ...previous,
        error: null,
        checking: true,
        // 背景輪詢可保留上次顯示；checking 仍鎖住簽收等操作。
        backgroundChecking: !manual && previous.data !== null,
      }));

      try {
        const data = await load(controller.signal);

        if (
          !mountedRef.current ||
          generation !== generationRef.current
        ) {
          throw new PickupApiError(
            0,
            "STALE_READ",
            "查詢結果已失效。",
          );
        }

        setState({
          data,
          error: null,
          checking: false,
          backgroundChecking: false,
        });

        if (shouldPoll(data)) {
          timerRef.current = window.setTimeout(() => {
            void read(false).catch(() => {
              // 錯誤已寫入 state，不自動重送寫入操作。
            });
          }, 3000);
        }

        return data;
      } catch (cause) {
        const error = toPickupError(cause);

        if (
          mountedRef.current &&
          generation === generationRef.current
        ) {
          // 查詢失敗立即隱藏舊資料，避免顯示過期的成功或取件碼。
          setState({
            data: null,
            error,
            checking: false,
            backgroundChecking: false,
          });
        }

        throw error;
      }
    },
    [load, stop],
  );

  useEffect(() => {
    let current = true;
    mountedRef.current = true;
    pausedRef.current = false;

    void Promise.resolve().then(() => {
      if (current && !document.hidden) {
        void refresh().catch(() => {});
      }
    });

    function focus() {
      if (!document.hidden) {
        void refresh(false).catch(() => {});
      }
    }

    function visibility() {
      if (document.hidden) {
        clear();
      } else {
        void refresh().catch(() => {});
      }
    }

    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);

    return () => {
      current = false;
      mountedRef.current = false;
      stop();

      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refresh, clear, stop]);

  return {
    ...state,
    refresh,
    pause,
    clear,
  };
}
