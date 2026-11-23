import './globals.css';

export const metadata = {
  title: 'Roblox Classic Clothing Editor',
  description: 'Draw classic Roblox shirts and pants on the real 585x559 template.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d0f12',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
