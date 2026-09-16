import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "打印机租赁运营平台",
  description: "打印机租赁业务运营后台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
