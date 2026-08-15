import { useCallback, useEffect, useRef, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Nạp dữ liệu từ api.ts với đủ ba trạng thái: đang tải, lỗi, có dữ liệu.
 *
 * `load` phải ổn định (bọc useCallback) — nó chính là danh sách phụ thuộc.
 * `reload({ quiet: true })` dùng cho poll: làm mới ngầm, không nháy skeleton.
 */
export function useAsync<T>(load: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!options?.quiet) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await load();
        if (alive.current) setState({ data, error: null, loading: false });
        return data;
      } catch (error) {
        if (alive.current) {
          setState((s) => ({
            data: s.data,
            error: error instanceof Error ? error.message : "Something went wrong.",
            loading: false,
          }));
        }
        return null;
      }
    },
    [load],
  );

  useEffect(() => {
    void run();
  }, [run]);

  const setData = useCallback((data: T) => {
    setState((s) => ({ ...s, data }));
  }, []);

  return { ...state, reload: run, setData };
}
