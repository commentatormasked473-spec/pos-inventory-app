import "./globals.css";

export const metadata = {
  title: "POS Inventory App",
  description: "Point of Sale and Inventory Management",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#1a73e8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}