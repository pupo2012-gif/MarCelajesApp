import "./globals.css";

export const metadata = {
  title: "Mar Celajes",
  description: "Pedidos",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}