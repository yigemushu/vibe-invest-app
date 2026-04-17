"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(`Sign up failed / 注册失败：${error.message}`);
      setLoading(false);
      return;
    }

    setMessage(
      "Sign up success. Check your email if confirmation is enabled. / 注册成功，如果开启了邮箱验证，请检查邮箱。"
    );
    setLoading(false);
  }

  async function handleSignIn() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(`Sign in failed / 登录失败：${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("Sign in success / 登录成功");
    setLoading(false);
  }

  async function handleSignOut() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Sign out failed / 退出失败：${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("Signed out / 已退出登录");
    setLoading(false);
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Auth / 登录注册</h1>
          <p className="page-subtitle">
            Sign up and sign in with Supabase / 使用 Supabase 注册与登录
          </p>
        </div>
      </header>

      <section className="panel" style={{ maxWidth: 620 }}>
        <div className="panel-header">
          <h2>Account / 账户</h2>
        </div>

        <div className="panel-body">
          <div className="field-group">
            <label className="field-label">Email / 邮箱</label>
            <input
              className="field-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>

          <div className="field-group">
            <label className="field-label">Password / 密码</label>
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
            />
          </div>

          <div
            className="action-row"
            style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
          >
            <button className="primary-btn" onClick={handleSignUp} disabled={loading}>
              {loading ? "Processing... / 处理中..." : "Sign Up / 注册"}
            </button>

            <button className="primary-btn" onClick={handleSignIn} disabled={loading}>
              {loading ? "Processing... / 处理中..." : "Sign In / 登录"}
            </button>

            <button className="primary-btn" onClick={handleSignOut} disabled={loading}>
              {loading ? "Processing... / 处理中..." : "Sign Out / 退出"}
            </button>
          </div>

          {message && (
            <div className="success-box" style={{ marginTop: 16 }}>
              {message}
            </div>
          )}
        </div>
      </section>
    </>
  );
}