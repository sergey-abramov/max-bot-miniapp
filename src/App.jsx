import { useEffect, useMemo } from "react";

function prettyJson(value) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch (error) {
    return String(error);
  }
}

export default function App() {
  const wa = useMemo(() => window.WebApp, []);

  useEffect(() => {
    if (wa && typeof wa.ready === "function") {
      // Signal MAX client that mini app UI is ready.
      wa.ready();
    }
  }, [wa]);

  const isAvailable = Boolean(wa);
  const status = isAvailable
    ? `Платформа: ${wa.platform} · MAX ${wa.version || "?"}`
    : "Объект WebApp недоступен. Откройте страницу из мини-приложения в клиенте MAX.";
  const unsafeData = isAvailable ? prettyJson(wa.initDataUnsafe) : "(нет данных)";
  const rawData = isAvailable ? wa.initData || "(пусто)" : "(нет данных)";

  return (
    <main className="page">
      <h1>MAX Mini App</h1>
      <p>{status}</p>
      <p className="warn">
        Демо: <code>initDataUnsafe</code> не использовать для проверки личности. Для API
        используйте только <code>initData</code> и валидируйте его на сервере.
      </p>

      <h2>initDataUnsafe (демо)</h2>
      <pre>{unsafeData}</pre>

      <h2>initData (строка для сервера, не показывайте пользователю в проде)</h2>
      <pre>{rawData}</pre>
    </main>
  );
}
