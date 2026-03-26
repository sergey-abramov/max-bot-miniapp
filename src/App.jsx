import { useEffect, useMemo, useState } from "react";

function prettyJson(value) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch (error) {
    return String(error);
  }
}

function buildPatentUrl(urlLike) {
  const raw = String(urlLike ?? "").trim();
  if (!raw) return null;

  // If backend already returns a full URL - open it as-is.
  if (/^https?:\/\//i.test(raw)) return raw;

  // In current API responses `url` appears to be only DocNumber (e.g. "0002348331").
  // Build a working FIPS/Rospatent viewer link.
  if (/^\d+$/.test(raw)) {
    const docNumber = raw.replace(/^0+/, "") || raw; // avoid DocNumber=0000...
    return `https://www.fips.ru/registers-doc-view/fips_servlet?DB=RUPAT&DocNumber=${encodeURIComponent(
      docNumber
    )}&TypeFile=html`;
  }

  // Unknown format - return original value (may still be resolvable by MAX).
  return raw;
}

const LIBRARY_METHODS = [
  { name: "ready()", description: "Сообщает клиенту MAX, что мини-приложение готово к работе." },
  { name: "close()", description: "Закрывает мини-приложение." },
  { name: "openLink(url)", description: "Открывает ссылку во внешнем браузере." },
  { name: "openMaxLink(url)", description: "Открывает диплинк, связанный с max.ru." },
  { name: "requestContact()", description: "Запрашивает номер телефона пользователя." },
  {
    name: "enableClosingConfirmation()",
    description: "Включает подтверждение перед закрытием мини-приложения.",
  },
  {
    name: "disableClosingConfirmation()",
    description: "Отключает подтверждение перед закрытием мини-приложения.",
  },
  {
    name: "requestScreenMaxBrightness()",
    description: "Запрашивает максимальную яркость экрана на ограниченное время.",
  },
  { name: "restoreScreenBrightness()", description: "Восстанавливает исходную яркость экрана." },
  { name: "downloadFile(url, fileName)", description: "Скачивает файл по URL с заданным именем." },
  { name: "shareContent(payload)", description: "Открывает нативный экран шаринга." },
  { name: "shareMaxContent(payload)", description: "Шарит контент в диалоги и чаты MAX." },
  { name: "enableVerticalSwipes()", description: "Включает вертикальные свайпы в мини-приложении." },
  { name: "disableVerticalSwipes()", description: "Отключает вертикальные свайпы в мини-приложении." },
  {
    name: "openCodeReader(fileSelect?)",
    description: "Открывает сканер QR-кода, при необходимости с выбором файла.",
  },
  { name: "BackButton.show()/hide()", description: "Показывает или скрывает системную кнопку назад." },
  {
    name: "BackButton.onClick()/offClick()",
    description: "Подписка и отписка от нажатия системной кнопки назад.",
  },
  {
    name: "DeviceStorage.setItem/getItem/removeItem/clear",
    description: "Работа с локальным хранилищем устройства.",
  },
  {
    name: "SecureStorage.setItem/getItem/removeItem/clear",
    description: "Работа с защищенным хранилищем устройства.",
  },
  {
    name: "BiometricManager.*",
    description: "Инициализация, запрос доступа, аутентификация и токены биометрии.",
  },
  {
    name: "HapticFeedback.*",
    description: "Тактильная обратная связь: impact, notification и selection.",
  },
  {
    name: "ScreenCapture.enable/disable",
    description: "Управление разрешением захвата экрана.",
  },
];

export default function App() {
  const wa = useMemo(() => window.WebApp, []);
  const [mode, setMode] = useState("pretty");
  const [isMethodsOpen, setIsMethodsOpen] = useState(false);
  const [showPatentSearch, setShowPatentSearch] = useState(false);
  const [patentQuery, setPatentQuery] = useState("");
  const [patentPage, setPatentPage] = useState(1);
  const [patentLoading, setPatentLoading] = useState(false);
  const [patentError, setPatentError] = useState(null);
  const [patentData, setPatentData] = useState(null);

  useEffect(() => {
    if (wa && typeof wa.ready === "function") {
      // Signal MAX client that mini app UI is ready.
      wa.ready();
    }
  }, [wa]);

  const isAvailable = Boolean(wa);
  const initDataUnsafe = isAvailable ? wa.initDataUnsafe ?? {} : {};
  const user = initDataUnsafe.user ?? null;
  const chat = initDataUnsafe.chat ?? null;
  const userName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.username || "Неизвестный пользователь";
  const status = isAvailable
    ? `Платформа: ${wa.platform} · MAX ${wa.version || "?"}`
    : "Объект WebApp недоступен. Откройте страницу из мини-приложения в клиенте MAX.";
  const unsafeData = isAvailable ? prettyJson(initDataUnsafe) : "(нет данных)";
  const rawData = isAvailable ? wa.initData || "(пусто)" : "(нет данных)";

  const infoEntries = [
    { label: "Платформа", value: wa?.platform || "не определена" },
    { label: "Версия MAX", value: wa?.version || "?" },
    { label: "Язык", value: user?.language_code || "не указан" },
    { label: "User ID", value: user?.id ?? "не указан" },
    { label: "Username", value: user?.username ? `@${user.username}` : "не указан" },
    { label: "Chat ID", value: chat?.id ?? "не указан" },
    { label: "Chat Type", value: chat?.type ?? "не указан" },
  ];

  function openPatentsPage() {
    setShowPatentSearch(true);
    setPatentPage(1);
    setPatentError(null);
    // Поиск запустим после ввода запроса пользователем.
  }

  async function searchPatents(nextPage = 1) {
    const query = patentQuery.trim();
    if (!query) {
      setPatentError({ message: "Введите запрос (минимум 2 символа)." });
      return;
    }

    const endpoint =
      import.meta.env.VITE_PATENTS_API_URL ||
      "https://max-bot-back-api.vercel.app/api/patents/search";

    setPatentLoading(true);
    setPatentError(null);
    try {
      const requestId = `req_${Math.random().toString(16).slice(2)}_${Date.now()}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
        body: JSON.stringify({
          query,
          queryMode: "qn",
          page: nextPage,
          pageSize: 20,
          includeFacets: 0,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data?.error?.message ||
          data?.message ||
          `Ошибка поиска: ${res.status}`;
        setPatentError({
          message: msg,
          code: data?.error?.code,
          requestId: data?.error?.requestId,
        });
        setPatentData(null);
        return;
      }

      setPatentData(data);
      setPatentPage(nextPage);
    } catch (e) {
      setPatentError({
        message: e?.message ? String(e.message) : "Network error",
      });
      setPatentData(null);
    } finally {
      setPatentLoading(false);
    }
  }

  return (
    <main className="page">
      <h1>MAX Mini App</h1>
      <p className="status">{status}</p>

      <section className="actions">
        <button
          type="button"
          className={`btn ${mode === "pretty" ? "btn--primary" : "btn--neutral"}`}
          onClick={() => {
            setShowPatentSearch(false);
            setMode("pretty");
          }}
        >
          Профиль
        </button>
        <button
          type="button"
          className={`btn ${mode === "developer" ? "btn--primary" : "btn--neutral"}`}
          onClick={() => {
            setShowPatentSearch(false);
            setMode("developer");
          }}
        >
          Для разработчиков
        </button>
        <button type="button" className="btn btn--neutral" onClick={openPatentsPage}>
          Патенты Роспатента
        </button>
      </section>

      {showPatentSearch ? (
        <section className="card">
          <h2 className="sectionTitle">Поиск патентов (Роспатент)</h2>

          <div className="patentSearchHeader">
            <input
              className="patentInput"
              value={patentQuery}
              placeholder="Введите запрос (например: нейросеть)"
              onChange={(e) => setPatentQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchPatents(1);
              }}
            />
            <button
              type="button"
              className={`btn ${patentLoading ? "btn--neutral" : "btn--primary"}`}
              disabled={patentLoading}
              onClick={() => searchPatents(1)}
            >
              {patentLoading ? "Идет поиск..." : "Искать"}
            </button>
          </div>

          {!patentLoading && !patentError && !patentData ? (
            <p className="muted">Введите запрос и нажмите “Искать”.</p>
          ) : null}

          {patentError ? <p className="patentError">{patentError.message}</p> : null}

          {patentData?.items?.length ? (
            <div className="patentResults">
              {patentData.items.map((item) => (
                <article key={item.id} className="patentResultItem">
                  <h3 className="patentResultTitle">{item.title}</h3>
                  <div className="patentResultMeta">
                    {item.applicant ? <span>{item.applicant}</span> : null}
                    {item.publishedAt ? <span>{item.publishedAt}</span> : null}
                  </div>
                  {item.snippet ? (
                    <p className="patentResultSnippet">{item.snippet}</p>
                  ) : null}
                  {item.url ? (
                    <button
                      type="button"
                      className="btn btn--neutral"
                      onClick={() => {
                        const urlToOpen = buildPatentUrl(item.url);
                        if (!urlToOpen) return;

                        // Prefer MAX API when available, but keep fallback for malformed/unexpected input.
                        try {
                          if (wa && typeof wa.openLink === "function") {
                            wa.openLink(urlToOpen);
                            return;
                          }
                        } catch {
                          // ignore and fallback to window.open
                        }

                        window.open(urlToOpen, "_blank", "noopener,noreferrer");
                      }}
                    >
                      Открыть
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          {patentData ? (
            <div className="patentPagination">
              <button
                type="button"
                className="btn btn--neutral"
                disabled={patentLoading || patentData.pagination.page <= 1}
                onClick={() => searchPatents(patentData.pagination.page - 1)}
              >
                Назад
              </button>

              <span className="patentPaginationInfo">
                Страница {patentData.pagination.page} из{" "}
                {Math.max(
                  1,
                  Math.ceil(patentData.pagination.total / patentData.pagination.pageSize)
                )}
              </span>

              <button
                type="button"
                className="btn btn--primary"
                disabled={patentLoading || !patentData.pagination.hasNext}
                onClick={() => searchPatents(patentData.pagination.page + 1)}
              >
                Далее
              </button>
            </div>
          ) : null}
        </section>
      ) : mode === "pretty" ? (
        <section className="card">
          <div className="profileHeader">
            <img
              className="avatar"
              src={user?.photo_url || "https://placehold.co/120x120?text=User"}
              alt="Фото пользователя"
            />
            <div>
              <h2 className="sectionTitle">{userName}</h2>
              <p className="muted">Данные получены из initDataUnsafe мессенджера.</p>
            </div>
          </div>

          <div className="infoGrid">
            {infoEntries.map((entry) => (
              <article key={entry.label} className="infoItem">
                <p className="infoLabel">{entry.label}</p>
                <p className="infoValue">{String(entry.value)}</p>
              </article>
            ))}
          </div>

          <p className="warn">
            Для безопасности авторизации используйте только <code>initData</code> и проверку
            подписи на сервере.
          </p>
        </section>
      ) : (
        <section className="card">
          <h2 className="sectionTitle">Данные от мессенджера</h2>
          <p className="muted">Отладочный режим: технические данные и библиотечные методы.</p>

          <h3 className="subTitle">initDataUnsafe</h3>
          <pre>{unsafeData}</pre>

          <h3 className="subTitle">initData</h3>
          <pre>{rawData}</pre>

          <button
            type="button"
            className="btn btn--neutral"
            onClick={() => setIsMethodsOpen((prev) => !prev)}
          >
            {isMethodsOpen ? "Скрыть методы библиотеки" : "Методы библиотеки"}
          </button>

          {isMethodsOpen ? (
            <div className="methodsList">
              {LIBRARY_METHODS.map((item) => (
                <article key={item.name} className="methodItem">
                  <p className="methodName">{item.name}</p>
                  <p className="methodDescription">{item.description}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
