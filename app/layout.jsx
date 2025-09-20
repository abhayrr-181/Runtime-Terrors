import "./globals.css";

export const metadata = {
  title: "Secure FinBot HF — LLaMA-2 + Phishing Detector",
  description: "LLM-powered finance Q&A (LLaMA-2) + phishing URL checker"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
