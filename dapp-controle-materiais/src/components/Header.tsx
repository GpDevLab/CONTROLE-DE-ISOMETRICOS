"use client";
import { User } from "lucide-react";

export default function Header() {
  return (
    <header className="py-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="/file.svg" alt="logo" className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-semibold">PGI</h1>
          <p className="text-sm text-neutral-500">Portal de Gestão Integrada</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-neutral-200 flex items-center justify-center">
          <User className="h-5 w-5" />
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">João</p>
          <p className="text-xs text-neutral-500">Estagiário 01</p>
        </div>
        <button className="ml-2 rounded-lg px-3 py-2 text-sm border hover:bg-neutral-100">
          Sair
        </button>
      </div>
    </header>
  );
}
