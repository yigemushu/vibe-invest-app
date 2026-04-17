import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import SidebarNav from "./sidebar-nav";
import { AuthProvider } from "../lib/auth-context";

export const metadata: Metadata = {
  title: "Vibe Invest",
  description: "Rules-based investing system / 规则化投资系统",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <div className="app-shell">
            <aside className="sidebar">
              <div className="brand">
                <div className="brand-mark">VI</div>
                <div>
                  <div className="brand-title">Vibe Invest</div>
                  <div className="brand-subtitle">
                    Rules-Based System / 规则化投资系统
                  </div>
                </div>
              </div>

              <SidebarNav />

              <div className="sidebar-footer">
                <div className="sidebar-note-label">
                  System Rules / 系统规则
                </div>
                <div className="sidebar-note">
                  Blank = 0 / 空值 = 0
                  <br />
                  Min Contribution = $50 / 最低投入 = $50
                  <br />
                  Min Order = $1 / 最低下单 = $1
                  <br />
                  Remainder → B1 / 余数流向 B1
                </div>
              </div>
            </aside>

            <main className="main">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}