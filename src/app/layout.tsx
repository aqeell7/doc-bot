import type { ReactNode } from "react";
export const metadata = { title: "Nimbus Doc Bot" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f7f9" }}>
        {children}
      </body>
    </html>
  );
} 