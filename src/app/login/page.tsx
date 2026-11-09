import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ActionForm } from "../ActionForm";
import { login } from "../actions";

export default async function Login() {
  if (await getUser()) redirect("/");
  return (
    <div className="card" style={{ maxWidth: 380, margin: "48px auto" }}>
      <h1>Good morning ☀</h1>
      <ActionForm action={login}>
        <div style={{ display: "grid", gap: 10 }}>
          <input name="email" type="email" placeholder="Email" autoComplete="username" required />
          <input name="password" type="password" placeholder="Password" autoComplete="current-password" required />
          <button>Log in</button>
        </div>
      </ActionForm>
    </div>
  );
}
