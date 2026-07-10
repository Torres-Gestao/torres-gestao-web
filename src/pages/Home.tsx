import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Home() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-800 via-purple-700 to-fuchsia-600 px-4 text-white">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30">
          <Store className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-3xl font-bold">Cardápio Digital</h1>
        <p className="mt-2 text-sm opacity-80">
          Digite o nome da loja para acessar o cardápio.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const clean = slug.trim().replace(/^\/+/, "").toLowerCase();
            if (clean) navigate(`/${clean}`);
          }}
          className="mt-8 flex gap-2"
        >
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="ex: pizzaria-do-joao"
            className="bg-white/95 text-black placeholder:text-black/50"
          />
          <Button
            type="submit"
            className="bg-yellow-400 text-black hover:bg-yellow-300"
            aria-label="Ir"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
        </form>
        <p className="mt-8 text-xs opacity-70">
          O cardápio de cada loja fica em <code className="rounded bg-white/10 px-1">/nome-da-loja</code>.
        </p>
      </div>
    </div>
  );
}
