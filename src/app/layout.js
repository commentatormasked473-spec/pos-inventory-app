import "./globals.css";

export const metadata = {
  title: "SCO Tech POS - Point of Sale & Inventory Management for Kenyan Businesses",
  description: "SCO Tech POS helps Kenyan small businesses manage sales, inventory, staff, and customer credit — all in one simple app. Get started today.",
  manifest: "/manifest.json",
  keywords: "POS system Kenya, inventory management, point of sale, small business software, shop management app",
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