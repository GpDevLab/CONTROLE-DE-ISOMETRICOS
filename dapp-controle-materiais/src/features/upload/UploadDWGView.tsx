'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchJson, apiUrl, fetchRaw, downloadFromResponse } from '@/lib/api';
import {
  UploadCloud,
  CheckCircle2,
  File as FileIcon,
  Trash2,
  Loader2,
  Download,
} from 'lucide-react';

type Cliente = { id: number; codigo: string; nome?: string };
type Area = { id: number; nome: string; rev: number };

function bytes(n: number) {
  if (Number.isNaN(n) || n == null) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(n) / Math.log(k)));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function UploadDWGView() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [areaId, setAreaId] = useState<number | ''>('');
  const [areaSelecionada, setAreaSelecionada] = useState<Area | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [arquivoGerado, setArquivoGerado] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // 🔹 Carregar clientes
  useEffect(() => {
    fetchJson<Cliente[]>('/lista-clientes')
      .then((data) => {
        if (Array.isArray(data)) {
          setClientes(data);
        } else {
          console.warn('Resposta inesperada de /lista-clientes:', data);
          setClientes([]);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar clientes:', err);
        setClientes([]);
      });
  }, []);

  // 🔹 Carregar áreas ao selecionar cliente
  useEffect(() => {
    if (!clienteId) {
      setAreas([]);
      setAreaId('');
      setAreaSelecionada(null);
      return;
    }

    fetchJson<Area[]>(`/clientes/${clienteId}/projetos`)
      .then((data) => {
        if (Array.isArray(data)) {
          setAreas(data);
        } else {
          console.warn('Resposta inesperada de /clientes/:id/projetos:', data);
          setAreas([]);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar áreas:', err);
        setAreas([]);
      });
  }, [clienteId]);

  // 🔹 Atualizar área selecionada
  useEffect(() => {
    if (areaId && areas.length > 0) {
      const area = areas.find(a => a.id === Number(areaId));
      setAreaSelecionada(area || null);
    } else {
      setAreaSelecionada(null);
    }
  }, [areaId, areas]);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) {
      alert('Nenhum arquivo válido foi selecionado ou arrastado.');
      return;
    }
    const newOnes = Array.from(list).filter((f) => /\.dwg$/i.test(f.name));
    if (newOnes.length === 0) {
      alert('Somente arquivos .dwg são aceitos.');
      return;
    }
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.name, f]));
      newOnes.forEach((f) => map.set(f.name, f)); // evita duplicados
      return Array.from(map.values());
    });
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  // 🔹 Função para baixar a planilha gerada
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDoneMsg(null);
    setArquivoGerado(null);
    
    const currentAreaId = areaId;
    const currentAreaSelecionada = areaSelecionada;
    
    if (!currentAreaId || files.length === 0 || !currentAreaSelecionada) {
      alert('Selecione um projeto e arquivos para upload.');
      return;
    }

    const url = apiUrl('/upload-dwg');
    const form = new FormData();
    form.append('area_id', String(currentAreaId));
    files.forEach((f) => form.append('arquivo', f));

    setLoading(true);
    setProgress(0);

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);

      // 🔑 fetchJson já injeta token, mas no XHR temos que setar manualmente
      const sgiToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('SGI_TOKEN='))
        ?.split('=')[1];
      if (sgiToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${sgiToken}`);
      }

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          setProgress(Math.round((evt.loaded / evt.total) * 100));
        } else {
          setProgress((p) => (p < 95 ? p + 1 : p));
        }
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          setLoading(false);
          try {
            const data = JSON.parse(xhr.responseText || '{}');
            if (xhr.status >= 200 && xhr.status < 300) {
              const mensagem = `Versão ${data.versao ?? '—'}, Rev ${data.rev ?? '—'}. Planilha: ${
                data.arquivoGerado ?? '—'
              }`;
              setDoneMsg(mensagem);
              setArquivoGerado(data.arquivoGerado);

              // 🔹 FAZ DOWNLOAD AUTOMÁTICO DA PLANILHA
              if (data.arquivoGerado) {
                setTimeout(() => {
                  onDownloadPlanilha(data.arquivoGerado);
                }, 1000);
              }

              setFiles([]);
              if (inputRef.current) inputRef.current.value = '';
              setProgress(100);
            } else {
              alert(`Erro: ${data?.erro || 'Falha no upload'}`);
            }
          } catch {
            if (xhr.status >= 200 && xhr.status < 300) {
              setDoneMsg('Upload concluído!');
              setFiles([]);
              if (inputRef.current) inputRef.current.value = '';
              setProgress(100);
            } else {
              alert('Falha no upload');
            }
          }
          resolve();
        }
      };

      xhr.send(form);
    });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Subir DWG</h2>
      <p className="text-sm text-neutral-600">
        Converta e processe arquivos .dwg (múltiplos) para um projeto.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex gap-4">
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}
            className="flex-1 rounded border px-3 py-2"
          >
            <option value="">Selecione</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} {c.nome ? `— ${c.nome}` : ''}
              </option>
            ))}
          </select>

          <select
            value={areaId}
            onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : '')}
            className="flex-1 rounded border px-3 py-2"
          >
            <option value="">Selecione</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome} (Rev {a.rev})
              </option>
            ))}
          </select>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`rounded border-2 border-dashed p-8 text-center ${
            isDragging ? 'border-blue-400 bg-blue-50' : 'border-neutral-300'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".dwg"
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
            id="dwg-input"
          />
          <label htmlFor="dwg-input" className="cursor-pointer">
            <UploadCloud className="mx-auto mb-2 h-8 w-8 text-neutral-400" />
            <span>
              Arraste seus <span className="font-medium">.dwg</span> aqui <br />
              <span className="text-sm text-neutral-500">ou clique para escolher</span>
            </span>
          </label>
        </div>

        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex items-center justify-between rounded border px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <FileIcon className="h-4 w-4 text-neutral-500" />
                  {f.name} <span className="text-neutral-400">({bytes(f.size)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(f.name)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="submit"
          disabled={loading || files.length === 0 || !areaId}
          className="rounded bg-neutral-800 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
            </span>
          ) : (
            'Enviar'
          )}
        </button>

        {loading && (
          <div className="w-full rounded bg-neutral-100">
            <div
              className="h-2 rounded bg-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {doneMsg && (
          <div className="space-y-3 rounded border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" /> 
              <span className="font-medium">Upload concluído com sucesso!</span>
            </div>
            <p className="text-sm text-green-700">{doneMsg}</p>
            
            {/* Botão para baixar novamente caso queira */}
            {arquivoGerado && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onDownloadPlanilha(arquivoGerado)}
                  className="flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Baixar Planilha Novamente
                </button>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}