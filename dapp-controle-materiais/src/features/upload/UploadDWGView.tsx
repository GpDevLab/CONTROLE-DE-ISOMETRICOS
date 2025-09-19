'use client';

import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api';
import {
  UploadCloud,
  CheckCircle2,
  File as FileIcon,
  Trash2,
  Loader2,
} from 'lucide-react';

type Cliente = { id: number; codigo: string };
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

  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch(apiUrl('/lista-clientes'))
      .then((r) => r.json())
      .then(setClientes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!clienteId) {
      setAreas([]);
      setAreaId('');
      return;
    }
    fetch(apiUrl(`/clientes/${clienteId}/projetos`))
      .then((r) => r.json())
      .then(setAreas)
      .catch(() => {});
  }, [clienteId]);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDoneMsg(null);
    if (!areaId || files.length === 0) return;

    const url = apiUrl('/upload-dwg');
    const form = new FormData();
    form.append('area_id', String(areaId));
    files.forEach((f) => form.append('arquivo', f));

    setLoading(true);
    setProgress(0);

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);

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
              setDoneMsg(
                `Versão ${data.versao ?? '—'}, Rev ${data.rev ?? '—'}. Planilha: ${
                  data.arquivoGerado ?? '—'
                }`
              );
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
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Subir DWG</h1>
        <p className="text-sm text-neutral-500">
          Converta e processe arquivos .dwg (múltiplos) para um projeto.
        </p>
      </header>

      <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-6">
        {/* Filtros */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Cliente</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={clienteId}
              onChange={(e) =>
                setClienteId(e.target.value ? Number(e.target.value) : '')
              }
            >
              <option value="">Selecione</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Projeto</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={areaId}
              disabled={!clienteId}
              onChange={(e) =>
                setAreaId(e.target.value ? Number(e.target.value) : '')
              }
            >
              <option value="">Selecione</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input escondido */}
       <input
        type="file"
        accept=".dwg"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
        />

        {/* Área de drop/click */}
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              addFiles(e.dataTransfer.files);
            } else {
              alert('O item arrastado não é um arquivo válido.');
            }
          }}
          className={`mt-4 flex flex-col items-center justify-center cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            isDragging ? 'border-neutral-800 bg-neutral-50' : 'border-neutral-300'
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud className="mx-auto h-8 w-8 text-neutral-600" />
          <p className="mt-2 text-sm text-neutral-700">
            Arraste seus <strong>.dwg</strong> aqui
          </p>
          <p className="text-xs text-neutral-500">ou clique para escolher</p>

          {files.length > 0 && (
            <p className="mt-3 text-xs text-neutral-500">
              {files.length} arquivo(s) •{' '}
              {bytes(files.reduce((a, f) => a + f.size, 0))}
            </p>
          )}
        </div>

        {/* Lista de arquivos */}
        {files.length > 0 && (
          <ul className="mt-4 divide-y rounded-lg border">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileIcon className="h-4 w-4 text-neutral-500" />
                  <span className="truncate text-sm">{f.name}</span>
                  <span className="shrink-0 text-xs text-neutral-500">
                    • {bytes(f.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(f.name)}
                  className="pressable rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        
        {/* Progresso */}
        {loading && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando…
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-2 rounded-full bg-neutral-900 transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-neutral-500">
              {progress}%
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            disabled={loading || !areaId || files.length === 0}
            className="pressable inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            <UploadCloud className="h-4 w-4" />
            {loading ? 'Enviando…' : 'Enviar'}
          </button>

          {doneMsg && (
            <div className="inline-flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {doneMsg}
            </div>
          )}
        </div>
      </form>
    </section>
  );
}
