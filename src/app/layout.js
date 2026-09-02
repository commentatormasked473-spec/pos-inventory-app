import "./globals.css";

export const metadata = {
  title: "POS Inventory App",
  description: "Point of Sale and Inventory Management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}