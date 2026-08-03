export const metadata = {
  title: 'YakYak — Language, out loud.',
  description: 'A warm, AI-adaptive language learning companion, built around the CEFR framework.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
