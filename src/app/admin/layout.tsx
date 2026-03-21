export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/50 p-4">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Jukebox Admin Panel
        </h1>
      </header>
      <style dangerouslySetInnerHTML={{ __html: `body { cursor: auto !important; }` }} />
      <main className="flex-1 p-6 z-10 relative">
        {children}
      </main>
    </div>
  );
}
