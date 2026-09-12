'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const LINKS = [
  ['/', '概览'],
  ['/bundles', '组合发现'],
  ['/simulate', '收益推演'],
  ['/segments', '分场景'],
  ['/validation', '校验'],
  ['/method', '方法与假设'],
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} data-active={path === href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
