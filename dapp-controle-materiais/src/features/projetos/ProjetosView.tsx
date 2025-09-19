'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiUrl, fetchJson, downloadFromResponse } from '@/lib/api';
import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  GitCompare,
  Layers3,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';

type Cliente = { id: number; codigo: string };
type Area = { id: number; nome: string; rev: number };
type Tab = 'ver' | 'criarCliente' | 'criarProjeto';

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
    </header>
  );
}

/* ---- Criar Cliente ---- */
function CriarCliente() {
  const [codigo, setCodigo] = useState('');
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim()) return alert('Informe o código do cliente.');
    try {
      const res = await fetch(apiUrl('/clientes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro || 'Falha ao criar cliente');
      alert('Cliente criado com sucesso!');
      setCodigo('');
    } catch (err: any) {
      alert(`Erro: ${err.message || 'Falha ao criar cliente'}`);
    }
  };
  return (
    <section className="rounded-2xl border bg-white p-6">
      <SectionTitle title="Criar Cliente" />
      <form onSubmit={onSubmit} className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Ex.: PETOBRAS"
        />
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
          Salvar
        </button>
      </form>
    </section>
  );
}

/* ---- Criar Projeto ---- */
function CriarProjeto() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [nome, setNome] = useState('');
  useEffect(() => {
    fetchJson<Cliente[]>(apiUrl('/lista-clientes'))
      .then(setClientes)
      .catch(() => alert('Falha ao listar clientes'));
  }, []);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !nome.trim()) return alert('Selecione o cliente e informe o projeto.');
    try {
      const res = await fetch(apiUrl('/projetos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, projeto_id: clienteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro || 'Falha ao criar projeto');
      alert('Projeto criado com sucesso!');
      setNome('');
      setClienteId('');
    } catch (err: any) {
      alert(`Erro: ${err.message || 'Falha ao criar projeto'}`);
    }
  };
  return (
    <section className="rounded-2xl border bg-white p-6">
      <SectionTitle title="Criar Projeto" />
      <form onSubmit={onSubmit} className="mt-2 grid gap-3 sm:grid-cols-3">
        <select
          className="rounded-lg border px-3 py-2"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Selecione um cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo}
            </option>
          ))}
        </select>
        <input
          className="rounded-lg border px-3 py-2 sm:col-span-2"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: PTB07"
        />
        <div className="sm:col-span-3">
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            Salvar
          </button>
        </div>
      </form>
    </section>
  );
}

/* ---- Ver Projetos ---- */
function VerProjetos() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [areaId, setAreaId] = useState<number | ''>('');
  const [rev1, setRev1] = useState<number | ''>('');
  const [rev2, setRev2] = useState<number | ''>('');
  const [revSelecionada, setRevSelecionada] = useState<number | null>(null);
  const [maiorVersaoAtual, setMaiorVersaoAtual] = useState<number | null>(null);
  const [revisoesComVersoes, setRevisoesComVersoes] = useState<{ rev: number; versoes: number[] }[]>([]);
  const areaSelecionada = useMemo(() => areas.find((a) => a.id === areaId), [areas, areaId]);

  useEffect(() => {
    fetchJson<Cliente[]>(apiUrl('/lista-clientes'))
      .then(setClientes)
      .catch(() => alert('Falha ao listar clientes'));
  }, []);
  useEffect(() => {
    if (!clienteId) {
      setAreas([]);
      setAreaId('');
      return;
    }
    fetchJson<Area[]>(apiUrl(`/clientes/${clienteId}/projetos`))
      .then(setAreas)
      .catch(() => alert('Falha ao listar projetos do cliente'));
  }, [clienteId]);
  useEffect(() => {
    setRev1('');
    setRev2('');
    setRevisoesComVersoes([]);
    setMaiorVersaoAtual(null);
    if (!areaSelecionada) return;
    (async () => {
      try {
        const rev = areaSelecionada.rev;
        const res1 = await fetchJson<{ ultima: number }>(apiUrl(`/areas/${areaSelecionada.id}/rev/${rev}/ultima-versao`));
        setMaiorVersaoAtual(res1.ultima ?? null);
        const res2 = await fetchJson<{ rev: number; versoes: number[] }[]>(apiUrl(`/areas/${areaSelecionada.id}/revisoes`));
        setRevisoesComVersoes(res2);
      } catch {
        alert('Falha ao carregar informações do projeto');
      }
    })();
  }, [areaSelecionada?.id]);

  const allRevs = useMemo(
    () => (!areaSelecionada ? [] : Array.from({ length: (Number(areaSelecionada.rev) || 0) + 1 }, (_, i) => i)),
    [areaSelecionada?.rev]
  );

  async function onGerarMapaTotal() {
    if (!areaId) return;
    try {
      const res = await fetch(apiUrl(`/mapa-total/${areaId}`), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await downloadFromResponse(res, `mapa_total_area_${areaId}.xlsx`);
      alert('Mapa total gerado!');
    } catch {
      alert('Falha ao gerar mapa total.');
    }
  }
  async function onSubirRevisao() {
    if (!areaId) return;
    try {
      const res = await fetch(apiUrl('/subir-rev'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_id: areaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro || 'Falha no subir rev');
      alert(`Sucesso! Nova revisão: ${data.nova_rev}`);
    } catch (err: any) {
      alert(`Erro: ${err.message || 'Falha no subir rev'}`);
    }
  }
  async function onCompararRevisoes() {
    if (!areaId) return alert('Selecione um projeto.');
    if (rev1 === '' || rev2 === '') return alert('Selecione as duas revisões.');
    if (rev1 === rev2) return alert('As revisões devem ser diferentes.');
    try {
      const res = await fetch(apiUrl(`/comparar-revisoes/${areaId}/${rev1}/${rev2}`), { method: 'POST' });
      if (!res.ok) {
        let msg = 'Falha ao comparar revisões.';
        try {
          const j = await res.json();
          msg = j?.erro || msg;
        } catch {}
        throw new Error(msg);
      }
      await downloadFromResponse(res, `rev_${rev1}_vs_${rev2}.xlsx`);
      alert('Planilha de comparação gerada!');
    } catch (err: any) {
      alert(`Erro: ${err.message || 'Falha ao comparar revisões'}`);
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Projetos</h1>
        <p className="text-sm text-neutral-500">Filtre por cliente, selecione o projeto e gerencie revisões/versões.</p>
      </header>

      <section className="rounded-2xl border bg-white p-6">
        <SectionTitle title="Filtros" subtitle="Selecione o cliente e o projeto" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={areaId}
            onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : '')}
            disabled={!clienteId}
          >
            <option value="">Projetos</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
      </section>

      {areaSelecionada && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border bg-white p-6">
              <SectionTitle title="Projeto Selecionado" />
              <p className="text-sm text-neutral-600">
                <span className="text-neutral-500">Projeto:</span> <span className="font-medium">{areaSelecionada.nome}</span>
              </p>
              <p className="text-sm text-neutral-600">
                <span className="text-neutral-500">Revisão atual:</span> <span className="font-medium">{areaSelecionada.rev}</span>
              </p>
              <p className="text-sm text-neutral-600">
                <span className="text-neutral-500">Maior versão na revisão atual:</span>{' '}
                <span className="font-medium">{maiorVersaoAtual ?? '—'}</span>
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-6">
              <SectionTitle title="Revisões & Versões" />
              {revisoesComVersoes.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhuma revisão encontrada</p>
              ) : (
                <ul className="space-y-2">
                  {revisoesComVersoes.map((rev) => {
                    const open = revSelecionada === rev.rev;
                    return (
                      <li key={rev.rev} className="rounded-lg border">
                        <button
                          className="flex w-full items-center justify-between px-3 py-2 text-left"
                          onClick={() => setRevSelecionada(open ? null : rev.rev)}
                        >
                          <span className="text-sm font-medium">Revisão {rev.rev}</span>
                          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {open && (
                          <div className="border-t px-3 py-2">
                            {rev.versoes.length === 0 ? (
                              <p className="text-sm text-neutral-500">Sem versões</p>
                            ) : (
                              <ul className="list-inside space-y-1 text-sm">
                                {rev.versoes.map((v) => (
                                  <li key={v} className="flex items-center justify-between">
                                    <span>Versão {v}</span>
                                    <a
                                      href={apiUrl(
                                        `/download-planilha?path=${encodeURIComponent(
                                          `${areaSelecionada.nome}_upload_v${v}_rev${rev.rev}.xlsx`
                                        )}`
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="pressable inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                                    >
                                      <FileSpreadsheet className="h-3.5 w-3.5" /> Baixar planilha
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-6">
              <SectionTitle title="Ações" />
              <div className="grid gap-2">
                <button
                  onClick={onGerarMapaTotal}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  <Layers3 className="h-4 w-4" />
                  Gerar mapa total
                </button>
                <button
                  onClick={onSubirRevisao}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Subir revisão
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-6">
            <SectionTitle title="Comparar revisões" subtitle="Selecione duas revisões do mesmo projeto para gerar a planilha de comparação." />
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Revisão 1</label>
                <select
                  className="w-full rounded-lg border px-3 py-2"
                  value={rev1}
                  onChange={(e) => setRev1(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">Selecione</option>
                  {allRevs.map((r) => (
                    <option key={`r1-${r}`} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Revisão 2</label>
                <select
                  className="w-full rounded-lg border px-3 py-2"
                  value={rev2}
                  onChange={(e) => setRev2(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={rev1 === ''}
                >
                  <option value="">Selecione</option>
                  {allRevs
                    .filter((r) => (rev1 === '' ? true : r > (rev1 as number)))
                    .map((r) => (
                      <option key={`r2-${r}`} value={r}>
                        {r}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={onCompararRevisoes}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                  disabled={rev1 === '' || rev2 === ''}
                >
                  <GitCompare className="h-4 w-4" />
                  Comparar
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

/* ---- Componente público ---- */
export default function ProjetosView() {
  const [tab, setTab] = useState<Tab>('ver');
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {(['ver', 'criarCliente', 'criarProjeto'] as Tab[]).map((t) => {
          const label = t === 'ver' ? 'Projetos' : t === 'criarCliente' ? 'Criar Cliente' : 'Criar Projeto';
          const Icon = t === 'ver' ? Layers3 : t === 'criarCliente' ? PlusCircle : FileSpreadsheet;
          const active = t === tab;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                active ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white hover:bg-neutral-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>
      {tab === 'ver' && <VerProjetos />}
      {tab === 'criarCliente' && <CriarCliente />}
      {tab === 'criarProjeto' && <CriarProjeto />}
    </div>
  );
}
