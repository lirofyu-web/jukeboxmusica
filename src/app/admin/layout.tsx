'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@/firebase/provider";
import { LogOut, ChevronRight, LayoutDashboard, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LoginView } from '@/components/jukebox/login-view';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!auth) return;
    return auth.onAuthStateChanged((user: any) => {
      setUserEmail(user?.email || null);
      setAuthLoading(false);
    });
  }, [auth]);

  // Restore body scrolling overridden by the kiosk globals.css
  useEffect(() => {
    const props: [string, string][] = [
      ['overflow', 'auto'],
      ['height', 'auto'],
      ['position', 'static'],
      ['touch-action', 'auto'],
      ['cursor', 'auto'],
      ['overscroll-behavior', 'auto'],
    ];
    props.forEach(([prop, val]) => {
      document.documentElement.style.setProperty(prop, val, 'important');
      document.body.style.setProperty(prop, val, 'important');
    });

    return () => {
      // Cleanup: restore kiosk defaults when leaving admin
      props.forEach(([prop]) => {
        document.documentElement.style.removeProperty(prop);
        document.body.style.removeProperty(prop);
      });
    };
  }, []);

  const isOnMachinePage = pathname?.includes('/admin/machine');

  const handleLogout = () => {
    if (auth && confirm("Deseja sair do painel?")) {
      auth.signOut();
    }
  };

  const cssOverrides = `
    html, body {
      overflow: auto !important;
      height: auto !important;
      min-height: 100vh !important;
      position: static !important;
      touch-action: auto !important;
      overscroll-behavior: auto !important;
      cursor: auto !important;
      -webkit-overflow-scrolling: touch !important;
    }
    #admin-layout-root,
    #admin-layout-root * {
      cursor: auto !important;
    }
  `;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <style dangerouslySetInnerHTML={{ __html: cssOverrides }} />
        <p className="text-zinc-500 font-black uppercase tracking-[0.3em] animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: cssOverrides }} />
        <LoginView />
      </>
    );
  }

  return (
    <>
      {/*
        This <style> tag is rendered AFTER globals.css in the document,
        so it wins the CSS cascade for equal-specificity !important rules.
        This is the ONLY reliable way to override the kiosk scroll-lock
        without touching globals.css (which would break the main jukebox view).
      */}
      <style dangerouslySetInnerHTML={{ __html: cssOverrides }} />

      <div
        id="admin-layout-root"
        className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col relative overflow-x-hidden selection:bg-primary/30"
      >
        {/* Background Ambient Glows */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]" />
        </div>

        {/* Sticky Header */}
        <header className="border-b border-white/5 bg-zinc-900/40 backdrop-blur-xl p-4 md:p-6 sticky top-0 z-[100]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

            {/* Logo + Breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-sm flex items-center justify-center shrink-0">
                <span className="text-primary font-black text-xl italic leading-none">J</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-black uppercase tracking-tighter text-white leading-none">
                  Jukebox <span className="text-primary">Admin</span>
                </h1>
                {/* Dynamic Breadcrumb */}
                <div className="flex items-center gap-1 mt-1">
                  <Link
                    href="/admin"
                    className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <LayoutDashboard className="w-2.5 h-2.5" />
                    Dashboard
                  </Link>
                  {isOnMachinePage && (
                    <>
                      <ChevronRight className="w-2.5 h-2.5 text-zinc-700" />
                      <span className="text-[9px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                        <Music className="w-2.5 h-2.5" />
                        Gerenciar Músicas
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* User Info + Logout */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              {userEmail && (
                <div className="hidden sm:block text-right">
                  <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Logado como</p>
                  <p
                    className="text-[10px] font-mono text-zinc-400 truncate max-w-[160px]"
                    title={userEmail}
                  >
                    {userEmail}
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                onClick={handleLogout}
                className="bg-transparent border-white/5 hover:bg-white/5 hover:border-red-500/20 hover:text-red-400 text-[10px] font-black uppercase tracking-widest h-10 px-4 md:px-6 gap-2 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 relative z-10 w-full">
          <div className="max-w-7xl mx-auto p-4 md:p-10">
            {children}
          </div>
        </main>

        <footer className="p-10 border-t border-white/5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">
            © 2026 Jukebox Musica • Secure Kiosk Technology
          </p>
        </footer>
      </div>
    </>
  );
}
