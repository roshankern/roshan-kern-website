import { figtree } from "../fonts";

/** Shared shell for the index and every post: the home page's black on white, in Figtree. */
export default function WritingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${figtree.className} min-h-screen bg-white text-black`}>
      <main className="flex flex-col items-center px-6 py-16 sm:py-24">
        {children}
      </main>
    </div>
  );
}
