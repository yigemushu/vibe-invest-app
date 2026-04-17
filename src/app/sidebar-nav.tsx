"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard / 总览", href: "/" },
  { label: "Portfolio / 持仓", href: "/portfolio" },
  { label: "Contribute / 投入", href: "/contribute" },
  { label: "Strategy / 策略", href: "/strategy" },
  { label: "Rebalance / 再平衡", href: "/rebalance" },
  { label: "Auth / 登录", href: "/auth" },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {navItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link${isActive ? " active" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}