import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/context";
import Navbar from "@/components/common/Navbar";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Drive - Cloud Storage",
  description: "Modern minimalist cloud storage solution",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
