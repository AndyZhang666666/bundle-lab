"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const LINKS = [
  ["/", "订单画像"],
  ["/bundles", "组合发现"],
  ["/simulate", "收益推演"],
  ["/playbook", "建议输出"],
  ["/validation", "校验"],
  ["/method", "方法与假设"],
];

export default function Nav() {
  const path = usePathname().replace(/\/+$/, "") || "/";
  return (
    <nav className="nav">
      {LINKS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          data-active={path === href}
          aria-current={path === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
