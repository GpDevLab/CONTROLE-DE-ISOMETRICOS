import './globals.css';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SGI — Sistema de Gestão de Isométricos',
  description: 'Portal para controle dos projetos e seus isométricos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased">
        {/* HEADER estático (troque 'sticky' por 'static' se não quiser grudar no topo ao rolar) */}
        <header className="static top-0 z-50 border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
            <div className="flex items-center gap-3">
              <Image
                src="/logo-gp.png"
                alt="Logo GP"
                width={110} 
                height={40}
                priority
              />
              <div className="hidden sm:block">
                <h1 className="text-base font-semibold leading-tight">SGI</h1>
                <p className="text-xs text-neutral-500">Sistema de Gestão de Isométricos</p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </main>

        {/* RODAPÉ opcional */}
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-6 text-xs text-neutral-500">
            © {new Date().getFullYear()} GP Consultoria &amp; Engenharia — SGI
          </div>
        </footer>
      </body>
    </html>
  );
}
