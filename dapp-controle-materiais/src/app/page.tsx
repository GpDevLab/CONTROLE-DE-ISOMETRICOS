'use client';

import { useEffect, useState } from 'react';
import { FolderGit2, UploadCloud } from 'lucide-react';
import ProjetosView from '@/features/projetos/ProjetosView';
import UploadDWGView from '@/features/upload/UploadDWGView';

type View = 'menu' | 'projetos' | 'upload';

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

export default function Home() {
  const [view, setView] = useState<View>('menu');
  const [sgiTokenReady, setSgiTokenReady] = useState(false);

  // Troca o token do portal pelo do SGI
  useEffect(() => {
    const portalToken = getCookie('token'); 
    if (portalToken) {
      fetch('http://10.71.0.195:5000/api/auth/exchange-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${portalToken}`,
          'Content-Type': 'application/json'
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.SGI_TOKEN) {
            document.cookie = `SGI_TOKEN=${data.SGI_TOKEN}; path=/;`;
            setSgiTokenReady(true); 
          }
        });
    }
  }, []);
    
  useEffect(() => {
  const sgiToken = getCookie('SGI_TOKEN');
  if (sgiToken) {
    fetch('http://localhost:5000/lista-clientes', {
      headers: {
        'Authorization': `Bearer ${sgiToken}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
        console.log("Clientes:", data);
      });
  }
}, [sgiTokenReady]);

  useEffect(() => {
    const v = location.hash.replace('#', '');
    if (v === 'projetos' || v === 'upload') setView(v as View);
  }, []);
  useEffect(() => {
    if (view === 'menu') history.replaceState(null, '', location.pathname);
    else location.hash = view;
  }, [view]);

  if (view !== 'menu') {
    return (
      <div className="space-y-6">
        <div>
          <button
            onClick={() => setView('menu')}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            ← Voltar ao menu
          </button>
        </div>
        {view === 'projetos' ? <ProjetosView /> : <UploadDWGView />}
      </div>
    );
  }

  // MENU INICIAL 
  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Portal para controle dos projetos e seus isométricos
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Gerencie clientes, áreas, revisões, versões e planilhas.
        </p>
      </section>

      <section className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
        <MenuCard
          title="Projetos"
          desc="Filtrar por cliente, gerenciar revisões e versões de projetos, gerar mapa total e comparações."
          icon={<FolderGit2 className="h-7 w-7" />}
          cta="Abrir Projetos"
          onClick={() => setView('projetos')}
        />
        <MenuCard
          title="Subir DWG"
          desc="Envie múltiplos arquivos .dwg para um projeto, gerando novas versões e planilhas."
          icon={<UploadCloud className="h-7 w-7" />}
          cta="Abrir Upload"
          onClick={() => setView('upload')}
        />
      </section>
    </div>
  );
}

function MenuCard({
  title, desc, icon, cta, onClick,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="group text-left">
      <div className="rounded-2xl border bg-white p-7 transition hover:shadow-sm hover:border-neutral-300">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-neutral-100 p-3 text-neutral-600">{icon}</div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-neutral-600">{desc}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-neutral-900">
              {cta} <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}