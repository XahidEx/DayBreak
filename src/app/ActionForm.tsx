"use client";

import { useActionState } from "react";

/** Form wrapper that shows an error string returned from a server action. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: string | null, form: FormData) => Promise<string | null>;
  children: React.ReactNode;
  className?: string;
}) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, display: "contents" }}>{children}</fieldset>
      {error && <p className="err" role="alert">{error}</p>}
    </form>
  );
}
