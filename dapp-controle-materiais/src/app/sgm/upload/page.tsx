'use client';

import { useEffect, useState } from 'react';

const API = 'http://localhost:5000';

type Cliente = { id: number; codigo: string };
type Area = { id: number; nome: string; rev: number };

export default function UploadDWGPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [areaId, setAreaId] = useState<number | ''>('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/lista-clientes`).then(r=>r.json()).then(setClientes).catch(console.error);
  }, []);

  useEffect(() => {
    if (!clienteId) {
      setAreas([]); setAreaId(''); return;
    }
    fetch(`${API}/clientes/${clienteId}/projetos`).then(r=>r.json()).then(setAreas).catch(console.error);
  }, [clienteId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaId || !files?.length) return;

    const form = new FormData();
    form.append('area_id', String(areaId));
    Array.from(files).forEach(f => form.append('arquivo', f));

    setLoading(true);
    try {
      const res = await fetch(`${API}/upload-dwg`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        alert(`Erro: ${data?.erro || 'Falha no upload'}`);
      } else {
        alert(`Sucesso! Versão ${data.versao}, Rev ${data.rev}. Planilha: ${data.arquivoGerado}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="px-6 pb-12">
      <h1 className="text-2xl font-semibold mb-6">Subir DWG</h1>
      <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-6 space-y-4 max-w-2xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Cliente</label>
            <select className="w-full rounded-lg border px-3 py-2" value={clienteId}
                    onChange={e=>setClienteId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Selecione</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.codigo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Projeto (Área)</label>
            <select className="w-full rounded-lg border px-3 py-2" value={areaId}
                    disabled={!clienteId}
                    onChange={e=>setAreaId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Selecione</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Arquivos DWG</label>
          <input type="file" multiple accept=".dwg" onChange={e=>setFiles(e.target.files)} />
          <p className="text-xs text-gray-500 mt-1">Você pode selecionar vários arquivos.</p>
        </div>

        <button
          disabled={loading}
          className="rounded-lg border bg-gray-900 text-white px-3 py-2 hover:bg-gray-800 disabled:opacity-60"
        >
          {loading ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </main>
  );
}