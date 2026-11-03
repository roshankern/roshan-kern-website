import { ClosingCanvas, ClosingFrame } from "./components/closing/ClosingScene";
import { Hero } from "./components/Hero";
import { MarginField } from "./components/MarginField";
import { Sections } from "./components/Sections";
import { figtree } from "./fonts";

export default function Home() {
  return (
    // `isolate` keeps the dot canvas (fixed, -z-10) above the white ground but behind every section.
    <main className={`${figtree.className} relative isolate bg-white text-black`}>
      <MarginField />
      {/* the closing scene's dots: fixed like the field's, and after it, so they draw on top as they arrive */}
      <ClosingCanvas />
      <Hero />
      <Sections />
      <section className="px-6 pb-24">
        <ClosingFrame />
      </section>
    </main>
  );
}
