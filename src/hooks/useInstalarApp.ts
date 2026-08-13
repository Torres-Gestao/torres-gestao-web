import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let eventoGuardado: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoGuardado = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("pwa:disponivel"));
  });
}

function ehStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function ehIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadOS = navigator.maxTouchPoints > 1 && /Macintosh/.test(ua);
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}

/**
 * Convite de instalação do PWA.
 * - Android/Chrome: usa o evento beforeinstallprompt.
 * - iOS: o evento não existe; mostramos instrução manual.
 */
export function useInstalarApp(chaveDispensa: string) {
  const [temPrompt, setTemPrompt] = useState(!!eventoGuardado);
  const [instalado, setInstalado] = useState(ehStandalone());
  const [dispensado, setDispensado] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(`pwa-dispensado:${chaveDispensa}`) === "1";
  });

  useEffect(() => {
    const onDisponivel = () => setTemPrompt(true);
    const onInstalado = () => {
      setInstalado(true);
      setTemPrompt(false);
    };
    window.addEventListener("pwa:disponivel", onDisponivel);
    window.addEventListener("appinstalled", onInstalado);
    return () => {
      window.removeEventListener("pwa:disponivel", onDisponivel);
      window.removeEventListener("appinstalled", onInstalado);
    };
  }, []);

  useEffect(() => {
    setDispensado(
      typeof localStorage !== "undefined" &&
        localStorage.getItem(`pwa-dispensado:${chaveDispensa}`) === "1",
    );
  }, [chaveDispensa]);

  const instalar = useCallback(async () => {
    if (!eventoGuardado) return "indisponivel" as const;
    await eventoGuardado.prompt();
    const { outcome } = await eventoGuardado.userChoice;
    eventoGuardado = null;
    setTemPrompt(false);
    return outcome;
  }, []);

  const dispensar = useCallback(() => {
    try {
      localStorage.setItem(`pwa-dispensado:${chaveDispensa}`, "1");
    } catch {
      /* ignore */
    }
    setDispensado(true);
  }, [chaveDispensa]);

  const ios = ehIOS();
  const podeMostrar = !instalado && !dispensado && (temPrompt || ios);

  return { podeMostrar, ios, instalar, dispensar, instalado };
}
