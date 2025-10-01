'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchJson, fetchRaw, downloadFromResponse } from '@/lib/api';
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
      await fetchJson('/clientes', {
        method: 'POST',
        body: JSON.stringify({ codigo }),
      });
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
          placeholder="Ex.: PETROBRAS"
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
    fetchJson<Cliente[]>('/lista-clientes')
      .then(setClientes)
      .catch(() => alert('Falha ao listar clientes'));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !nome.trim()) return alert('Selecione o cliente e informe o projeto.');
    try {
      await fetchJson('/projetos', {
        method: 'POST',
        body: JSON.stringify({ nome, projeto_id: clienteId }),
      });
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
  const allRevs = useMemo(
    () => (!areaSelecionada ? [] : Array.from({ length: (Number(areaSelecionada.rev) || 0) + 1 }, (_, i) => i)),
    [areaSelecionada?.rev]
  );

  // 🔹 Listar clientes
  useEffect(() => {
    fetchJson<Cliente[]>('/lista-clientes')
      .then(setClientes)
      .catch(() => alert('Falha ao listar clientes'));
  }, []);

  // 🔹 Listar projetos ao selecionar cliente
  useEffect(() => {
    if (!clienteId) {
      setAreas([]);
      setAreaId('');
      return;
    }
    fetchJson<Area[]>(`/clientes/${clienteId}/projetos`)
      .then(setAreas)
      .catch(() => alert('Falha ao listar projetos do cliente'));
  }, [clienteId]);

  // 🔹 Carregar revisões ao selecionar projeto
  useEffect(() => {
    setRev1('');
    setRev2('');
    setRevisoesComVersoes([]);
    setMaiorVersaoAtual(null);
    if (!areaSelecionada) return;

    (async () => {
      try {
        const res1 = await fetchJson<{ ultima: number }>(`/areas/${areaSelecionada.id}/rev/${areaSelecionada.rev}/ultima-versao`);
        setMaiorVersaoAtual(res1.ultima ?? null);

        const res2 = await fetchJson<{ rev: number; versoes: number[] }[]>(`/areas/${areaSelecionada.id}/revisoes`);
        setRevisoesComVersoes(res2);
      } catch {
        alert('Falha ao carregar informações do projeto');
      }
    })();
  }, [areaSelecionada?.id]);

  // 🔹 Função para baixar planilha individual
  async function onDownloadPlanilha(nomeArquivo: string) {
    try {
      const res = await fetchRaw(`/download-planilha?path=${encodeURIComponent(nomeArquivo)}`, {
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await downloadFromResponse(res, nomeArquivo);
    } catch (err: any) {
      alert(`Erro ao baixar planilha: ${err.message || 'Arquivo não encontrado'}`);
    }
  }

  // 🔹 Gerar mapa total
  async function onGerarMapaTotal() {
    if (!areaId) return;
    try {
      const res = await fetchRaw(`/mapa-total/${areaId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await downloadFromResponse(res, `mapa_total_area_${areaId}.xlsx`);
      alert('Mapa total gerado!');
    } catch {
      alert('Falha ao gerar mapa total.');
    }
  }

  // 🔹 Subir revisão
  // 🔹 Subir revisão
async function onSubirRevisao() {
  if (!areaId || !areaSelecionada) return;
  try {
    const res = await fetchRaw(('/subir-rev'), {
      method: 'POST',
      body: JSON.stringify({ area_id: areaId }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Obtém a nova revisão do header (se disponível)
    const novaRev = res.headers.get('X-Nova-Rev');
    
    // Nome do arquivo no padrão: area_rev_X (onde X é a revisão ANTIGA)
    const revAntiga = novaRev ? parseInt(novaRev) - 1 : areaSelecionada.rev;
    const filename = `${areaSelecionada.nome}_rev_${revAntiga}.xlsx`;
    
    await downloadFromResponse(res, filename);

    // Atualiza a interface
    alert('Revisão enviada e planilha gerada!');
    
    // Recarrega os dados para mostrar a nova revisão
    const resAreas = await fetchJson<Area[]>(`/clientes/${clienteId}/projetos`);
    setAreas(resAreas);
    
    // Atualiza a área selecionada
    const areaAtualizada = resAreas.find(a => a.id === areaId);
    if (areaAtualizada) {
      // Força o recarregamento das revisões
      const resRevisoes = await fetchJson<{ rev: number; versoes: number[] }[]>(`/areas/${areaId}/revisoes`);
      setRevisoesComVersoes(resRevisoes);
    }
    
  } catch (err: any) {
    alert(`Erro: ${err.message || 'Falha ao subir revisão'}`);
  }
}

  // 🔹 Comparar revisões
  async function onCompararRevisoes() {
    if (!areaId) return alert('Selecione um projeto.');
    if (rev1 === '' || rev2 === '') return alert('Selecione as duas revisões.');
    if (rev1 === rev2) return alert('As revisões devem ser diferentes.');

    try {
      const res = await fetchRaw((`/comparar-revisoes/${areaId}/${rev1}/${rev2}`), {
        method: 'POST',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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

      {/* Filtros */}
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
          {/* Projeto Selecionado + Ações */}
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
                <span className="text-neutral-500">Maior versão na revisão atual:</span> <span className="font-medium">{maiorVersaoAtual ?? '—'}</span>
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
                                    <button
                                      onClick={() => onDownloadPlanilha(`${areaSelecionada.nome}_upload_v${v}_rev${rev.rev}.xlsx`)}
                                      className="pressable inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                                    >
                                      <FileSpreadsheet className="h-3.5 w-3.5" /> Baixar planilha
                                    </button>
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
                  <Layers3 className="h-4 w-4" /> Gerar mapa total
                </button>
                <button
                  onClick={onSubirRevisao}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  <RefreshCw className="h-4 w-4" /> Subir revisão
                </button>
              </div>
            </div>
          </section>

          {/* Comparar revisões */}
          <section className="rounded-2xl border bg-white p-6">
            <SectionTitle title="Comparar revisões" subtitle="Selecione duas revisões para gerar a planilha de comparação." />
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
                  {allRevs.filter((r) => (rev1 === '' ? true : r > (rev1 as number))).map((r) => (
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
                  disabled={rev1 === ''  || rev2 === ''}
                >
                  <GitCompare className="h-4 w-4" /> Gerar planilha
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

/* ---- Componente principal ---- */
export default function ProjetosView() {
  const [tab, setTab] = useState<Tab>('ver');
  return (
    <div className="space-y-6">
      <nav className="flex gap-4">
        <button onClick={() => setTab('ver')} className={`rounded-lg px-4 py-2 ${tab === 'ver' ? 'bg-neutral-900 text-white' : 'border'}`}>Ver Projetos</button>
        <button onClick={() => setTab('criarCliente')} className={`rounded-lg px-4 py-2 ${tab === 'criarCliente' ? 'bg-neutral-900 text-white' : 'border'}`}>Criar Cliente</button>
        <button onClick={() => setTab('criarProjeto')} className={`rounded-lg px-4 py-2 ${tab === 'criarProjeto' ? 'bg-neutral-900 text-white' : 'border'}`}>Criar Projeto</button>
      </nav>
      {tab === 'ver' && <VerProjetos />}
      {tab === 'criarCliente' && <CriarCliente />}
      {tab === 'criarProjeto' && <CriarProjeto />}
    </div>
  );
}