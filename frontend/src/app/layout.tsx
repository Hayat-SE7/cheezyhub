import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CheezyHub',
  description: 'Fresh. Fast. Cheezylicious.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}