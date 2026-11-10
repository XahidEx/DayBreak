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
        <div className="login__badge">
          <Sun />
        </div>
        <h1>DayBreak</h1>
        <p className="login__sub">Your calm morning note on the US stock market.</p>
        <div className="login__pills">
          <span>Morning brief</span>
          <span>Why it moved</span>
          <span>Signal &amp; backtest</span>
        </div>
        <ActionForm action={login} className="login__form">
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" name="email" type="email" placeholder="you@example.com" autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" name="password" type="password" placeholder="••••••••••••" autoComplete="current-password" required />
          </div>
          <button className="login__btn">Sign in to DayBreak →</button>
        </ActionForm>
      </div>
    </div>
  );
}
