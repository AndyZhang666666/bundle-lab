import "./globals.css";
import Nav from "./nav";
import Link from "next/link";

export const metadata = {
  title: "套餐实验室 · Bundle Lab",
  description: "合成订单关联发现、两类人群收益推演与可复现实验假设。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-head">
          <div className="wrap site-head-inner">
            <Link className="brand" href="/">
              套餐实验室<span>Bundle Lab</span>
            </Link>
            <Nav />
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="wrap foot">
          数据为合成订单，仅用于演示方法。所有收益数字是参数化估算，不是预测 ——
          口径与默认值来源见「方法与假设」。{" "}
          <a href="https://andyzhang666666.github.io/#projects">返回作品集</a> ·{" "}
          <a href="https://github.com/AndyZhang666666/bundle-lab">查看源码</a>
        </footer>
      </body>
    </html>
  );
}
