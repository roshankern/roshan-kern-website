/**
 * Shared shell for the index and every post. The backdrop is rendered by the
 * children, since each chooses its own scrim.
 */
export default function WritingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b1416]">
      <main className="relative z-10 flex flex-col items-center px-6 py-16">
        {children}
      </main>
    </div>
  );
}
