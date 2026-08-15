import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Spinner } from "./ui/Spinner";

/** Màn hình chờ lúc khôi phục phiên — im lặng, không nháy. */
function SessionLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-faint">
      <Spinner size={20} label="Restoring your session" />
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Đang khôi phục phiên thì CHỜ, tuyệt đối không đá về /login —
  // nếu không, mỗi lần tải lại trang người dùng đều bị văng ra.
  if (loading) return <SessionLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <>{children}</>;
}

/** Ngược lại: đã đăng nhập rồi thì không xem /login, /register nữa. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <SessionLoading />;
  if (user) return <Navigate to="/app" replace />;

  return <>{children}</>;
}
