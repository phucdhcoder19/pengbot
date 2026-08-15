import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../lib/auth";

interface Errors {
  companyName?: string;
  email?: string;
  password?: string;
}

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): Errors {
    const next: Errors = {};
    if (!companyName.trim()) next.companyName = "Enter your company name.";
    else if (companyName.trim().length < 2) next.companyName = "Company name is too short.";

    if (!email.trim()) next.email = "Enter the email you'll sign in with.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "That doesn't look like a valid email.";

    if (!password) next.password = "Choose a password.";
    else if (password.length < 8) next.password = "Password must be at least 8 characters.";

    return next;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setFormError(null);
    setSubmitting(true);
    try {
      await signUp(companyName.trim(), email.trim(), password);
      navigate("/app", { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Account creation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Get started in 5 minutes"
      description="Create an account, upload your documents, then paste one line of script into your website. No code required."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-accent-text underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError ? <Alert>{formError}</Alert> : null}

        <Input
          label="Company name"
          autoComplete="organization"
          placeholder="ACME Inc."
          value={companyName}
          onChange={(e) => {
            setCompanyName(e.target.value);
            setErrors((s) => ({ ...s, companyName: undefined }));
          }}
          error={errors.companyName}
          hint="This name appears on the chat window your customers see."
        />

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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((s) => ({ ...s, password: undefined }));
          }}
          error={errors.password}
          hint="Minimum 8 characters."
        />

        <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
