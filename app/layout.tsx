import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SUGOI — Zero-Trust Enterprise IT Triage Agent",
  description: "AI-powered, privacy-first Enterprise IT Helpdesk with RAG-based resolution, PII redaction, confidence scoring, and agentic workflows. Built for NASSCOM Hackathon 2026.",
  keywords: ["AI helpdesk", "ticket routing", "RAG", "PII redaction", "enterprise knowledge assistant", "agentic AI", "ONNX", "Council"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{ background: 'var(--bg-primary)', color: 'var(--charcoal)', fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
