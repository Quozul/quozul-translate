import type { Metadata, Viewport } from "next";
import { Translator } from "@/components/translator";

export const metadata: Metadata = {
  title: "Translate",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function Home() {
  return <Translator />;
}
