import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">Página não encontrada.</p>
      <Link to="/" className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        Ir para o início
      </Link>
    </div>
  );
}
