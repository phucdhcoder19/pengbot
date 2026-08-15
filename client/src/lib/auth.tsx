import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as api from "./api";
import type { Tenant, User } from "./types";

interface AuthValue {
  user: User | null;
  tenant: Tenant | null;
  /** True trong lúc khôi phục phiên lúc mở trang. RequireAuth phải chờ. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (companyName: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  /** Cập nhật thông tin công ty sau khi lưu ở /settings (tên hiện trên sidebar). */
  applyTenant: (tenant: Tenant) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  // Không có token thì chẳng có gì để khôi phục — vào thẳng trạng thái chưa
  // đăng nhập, khỏi phải setState trong effect.
  const [loading, setLoading] = useState(() => api.getToken() !== null);

  // Khôi phục phiên từ token đã lưu. Trong lúc này KHÔNG được đá về /login,
  // nếu không thì mỗi lần F5 người dùng lại bị văng ra.
  useEffect(() => {
    let alive = true;
    if (!api.getToken()) return;

    api
      .getMe()
      .then((session) => {
        if (!alive) return;
        setUser(session.user);
        setTenant(session.tenant);
      })
      .catch(() => {
        if (!alive) return;
        api.clearToken();
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    api.setToken(result.accessToken);
    setUser(result.user);
    setTenant(result.tenant);
  }, []);

  const signUp = useCallback(
    async (companyName: string, email: string, password: string) => {
      const result = await api.register(companyName, email, password);
      api.setToken(result.accessToken);
      setUser(result.user);
      setTenant(result.tenant);
    },
    [],
  );

  const signOut = useCallback(() => {
    api.clearToken();
    setUser(null);
    setTenant(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, tenant, loading, signIn, signUp, signOut, applyTenant: setTenant }),
    [user, tenant, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook đi liền provider
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
