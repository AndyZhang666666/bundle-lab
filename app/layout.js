import './globals.css';
import Nav from './nav';
import Link from 'next/link';

export const metadata = {
  title: '套餐实验室 · Bundle Lab',
  description: '从历史订单里找出真正值得做成套餐的商品组合，并把它的收益边界算清楚。',
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
          口径与默认值来源见「方法与假设」。
        </footer>
      </body>
    </html>
  );
}
