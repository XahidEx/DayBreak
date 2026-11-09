import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ActionForm } from "../ActionForm";
import { Sun } from "../Sun";
import { login } from "../actions";

export default async function Login() {
  if (await getUser()) redirect("/");
  return (
    <div className="login-wrap">
      <div className="card login">
        <Sun />
        <h1>DayBreak</h1>
        <p className="mute" style={{ marginBottom: 20 }}>Your calm morning note on the market.</p>
        <ActionForm action={login}>
          <div>
            <input name="email" type="email" placeholder="Email" autoComplete="username" required />
            <input name="password" type="password" placeholder="Password" autoComplete="current-password" required />
            <button>Log in</button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
