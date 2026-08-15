import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("chi.nguyen@acme.vn");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const next: typeof errors = {};
    if (!email.trim()) next.email = "Enter your registered email.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "That doesn't look like a valid email.";
    if (!password) next.password = "Enter your password.";

    setErrors(next);
    if (Object.keys(next).length) return;

    setFormError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate("/app", { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Welcome back"
      description="See how your chatbot has been answering customers lately."
      footer={
        <>
          No account yet?{" "}
          <Link
            to="/register"
            className="font-medium text-accent-text underline-offset-4 hover:underline"
          >
            Create a free account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError ? <Alert>{formError}</Alert> : null}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="ban@congty.vn"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((s) => ({ ...s, email: undefined }));
          }}
          error={errors.email}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="At least 8 characters"
          hint="Demo build, no server yet — enter any password of 8+ characters."
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((s) => ({ ...s, password: undefined }));
          }}
          error={errors.password}
        />

        <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
