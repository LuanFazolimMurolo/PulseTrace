import { useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  Cpu,
  FileText,
  FolderOpen,
  Gauge,
  HardDrive,
  LayoutDashboard,
  LockKeyhole,
  MemoryStick,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Upload,
  Waypoints,
  X,
} from "lucide-react";
import type {
  Component,
  ImportOptions,
  Marker,
  Session,
  TimeRange,
} from "./core/types";
import { LIMITS } from "./core/types";
import { dateTime } from "./core/format";
import { analyze } from "./analysis/rules";
import { stats } from "./analysis/compare";
import { createDemo } from "./import/demo";
import { useImport } from "./hooks/useImport";
import { chooseNativeFiles, isTauri } from "./platform/files";
import { RangeBar } from "./components/RangeBar";
import { ObservationCard } from "./components/ObservationCard";
import { Dashboard } from "./pages/Dashboard";
import { Sensors } from "./pages/Sensors";
import { Timeline } from "./pages/Timeline";
import { Investigation } from "./pages/Investigation";
import { Compare } from "./pages/Compare";
import { Reports } from "./pages/Reports";

const nav = [
  { name: "Visão geral", icon: LayoutDashboard },
  { name: "CPU", icon: Cpu },
  { name: "GPU", icon: Monitor },
  { name: "Memória", icon: MemoryStick },
  { name: "Armazenamento", icon: HardDrive },
  { name: "Sistema", icon: Gauge },
  { name: "Linha do tempo", icon: Waypoints },
  { name: "Diagnóstico", icon: ShieldCheck },
  { name: "Investigar desligamento", icon: Search },
  { name: "Comparar sessões", icon: ArrowLeftRight },
  { name: "Relatórios", icon: FileText },
];
const subtitles: Record<string, string> = {
  "Visão geral":
    "Entenda o comportamento do seu hardware, leitura por leitura.",
  CPU: "Temperatura, carga e limites do processador.",
  GPU: "Acompanhe os sensores registrados da placa de vídeo.",
  Memória: "Utilização e disponibilidade da memória registrada.",
  Armazenamento: "Atividade e indicadores disponíveis dos seus discos.",
  Sistema: "Sensores gerais e nomes ainda não reconhecidos.",
  "Linha do tempo": "Conecte as leituras aos momentos que importam.",
  Diagnóstico: "Evidências, hipóteses e próximos passos.",
  "Investigar desligamento": "Procure pistas nos minutos anteriores à falha.",
  "Comparar sessões": "Observe o que mudou entre dois registros.",
  Relatórios: "Guarde sua análise e compartilhe as evidências.",
  Ajuda: "Do primeiro registro à interpretação dos resultados.",
};
export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState("");
  const [page, setPage] = useState("Visão geral");
  const [light, setLight] = useState(false);
  const [range, setRange] = useState<TimeRange>([0, 0]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState<ImportOptions>({
    dateOrder: "DMY",
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
  });
  const [markers, setMarkers] = useState<Record<string, Marker[]>>({});
  const [dragging, setDragging] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null);
  const session = sessions.find((s) => s.id === activeId);
  const selectSession = (s: Session) => {
    setActiveId(s.id);
    setRange([s.times[0], s.times[s.times.length - 1]]);
  };
  const importer = useImport((s) => {
    setSessions((previous) => [...previous, s]);
    selectSession(s);
  });
  const observations = useMemo(
    () => (session ? analyze(session, undefined, range) : []),
    [session, range],
  );
  const alerts = observations.filter(
    (o) => o.severity === "critical" || o.severity === "warning",
  );
  function importFiles(files: (File | string)[]) {
    void importer.importFiles(
      files,
      options,
      LIMITS.sessions - sessions.length,
      LIMITS.totalCells -
        sessions.reduce((sum, s) => sum + s.times.length * s.sensors.length, 0),
    );
  }
  async function choose(folder = false) {
    try {
      if (isTauri()) {
        const paths = await chooseNativeFiles(folder);
        if (paths.length) importFiles(paths);
      } else (folder ? folderInput : input).current?.click();
    } catch (e) {
      importer.setError(String(e));
    }
  }
  async function demo() {
    if (sessions.length >= LIMITS.sessions) {
      importer.setError("Remova uma sessão antes de abrir a demonstração.");
      return;
    }
    setDemoBusy(true);
    try {
      const s = await createDemo();
      setSessions((previous) => [...previous, s]);
      selectSession(s);
    } catch (e) {
      importer.setError(String(e));
    } finally {
      setDemoBusy(false);
    }
  }
  function removeSession() {
    const next = sessions.filter((s) => s.id !== activeId);
    setSessions(next);
    setMarkers((previous) => {
      const updated = { ...previous };
      delete updated[activeId];
      return updated;
    });
    if (next.length) selectSession(next[0]);
    else {
      setActiveId("");
      setPage("Visão geral");
    }
  }
  const props = session
    ? { session, range, onRange: setRange, light, onError: importer.setError }
    : null;
  return (
    <div
      className={`app ${light ? "light" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!importer.progress) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!importer.progress) importFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Visão geral");
          }}
        >
          <span className="brand-symbol">
            <Activity size={25} strokeWidth={2.4} />
          </span>
          <span>
            Pulse<span className="brand-light">Trace</span>
            <small>HARDWARE ANALYZER</small>
          </span>
        </a>
        <div className="workspace-label">ESPAÇO DE ANÁLISE</div>
        <nav aria-label="Navegação principal">
          {nav.map(({ name, icon: Icon }, i) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""} ${i === 6 ? "nav-separator" : ""}`}
              onClick={() => setPage(name)}
              disabled={!session && name !== "Visão geral"}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "Diagnóstico" && alerts.length > 0 && (
                <b className="nav-count">{alerts.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-chip">
            <LockKeyhole size={16} />
            <div>
              100% local<small>Seus dados ficam com você</small>
            </div>
          </div>
          <button
            className={`nav-item ${page === "Ajuda" ? "active" : ""}`}
            onClick={() => setPage("Ajuda")}
          >
            <CircleHelp size={18} />
            <span>Guia de uso</span>
          </button>
          <div className="sidebar-footer">
            <span>
              PulseTrace <b>v0.1.0</b>
            </span>
            <button
              className="icon-button"
              onClick={() => setLight(!light)}
              aria-label={light ? "Ativar tema escuro" : "Ativar tema claro"}
            >
              {light ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Análise de hardware <span>/</span> <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="offline-status">
              <span className="live-dot" /> Processamento local
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="Opções de importação"
              title="Opções de importação"
              onClick={() => setOptionsOpen(!optionsOpen)}
            >
              <Settings2 size={18} />
            </button>
            <button
              className="primary small"
              onClick={() => void choose()}
              disabled={!!importer.progress || demoBusy}
            >
              <Plus size={17} /> Importar CSV
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {session ? "SESSÃO DE DIAGNÓSTICO" : "CONHEÇA SEU HARDWARE"}
              </div>
              <h1>
                {session || page === "Ajuda"
                  ? page
                  : "Cada leitura conta uma história."}
              </h1>
              <p>{subtitles[page]}</p>
            </div>
            {session && (
              <button
                className="secondary"
                onClick={() => setPage("Relatórios")}
              >
                <ArrowDownToLine size={16} /> Exportar relatório
              </button>
            )}
          </div>
          {optionsOpen && (
            <section className="panel import-options">
              <h3>Opções de importação</h3>
              <label>
                Ordem das datas
                <select
                  value={options.dateOrder}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      dateOrder: e.target.value as "DMY" | "MDY",
                    })
                  }
                >
                  <option value="DMY">Dia / mês / ano</option>
                  <option value="MDY">Mês / dia / ano</option>
                </select>
              </label>
              <label>
                Fuso do registro (minutos em relação a UTC)
                <input
                  type="number"
                  min={-840}
                  max={840}
                  step={15}
                  value={options.utcOffsetMinutes}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      utcOffsetMinutes: +e.target.value,
                    })
                  }
                />
              </label>
              <small>
                Brasil/São Paulo: −180. Aplica-se somente a novas importações e
                a datas sem fuso explícito. Horário de verão histórico exige o
                deslocamento correto.
              </small>
              <button
                className="secondary"
                disabled={!!importer.progress}
                onClick={() => void choose(true)}
              >
                <FolderOpen size={16} /> Importar pasta
              </button>
            </section>
          )}
          {importer.error && (
            <div role="alert" className="error-banner">
              <span>{importer.error}</span>
              <button
                aria-label="Fechar erro"
                className="icon-button"
                onClick={() => importer.setError("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {importer.progress && (
            <div className="import-progress" role="status">
              <div>
                <strong>Importando {importer.progress.name}</strong>
                <span>{importer.progress.percent}%</span>
              </div>
              <progress max={100} value={importer.progress.percent} />
              <button className="text-button" onClick={importer.cancel}>
                Cancelar importação
              </button>
            </div>
          )}
          {session && (
            <>
              <div className="session-toolbar">
                <div className="session-selector">
                  <span className="session-file-icon">
                    <FileText size={17} />
                  </span>
                  <select
                    aria-label="Sessão ativa"
                    value={activeId}
                    onChange={(e) => {
                      const s = sessions.find((s) => s.id === e.target.value);
                      if (s) selectSession(s);
                    }}
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                  <span className={`badge ${session.demo ? "demo-badge" : ""}`}>
                    {session.demo ? "DADOS SINTÉTICOS" : "CSV IMPORTADO"}
                  </span>
                </div>
                <div className="session-actions">
                  <small>{dateTime(session.times[0]).split(",")[0]}</small>
                  <button
                    className="icon-button"
                    disabled={!!importer.progress}
                    title="Importar pasta de CSVs"
                    aria-label="Importar pasta de CSVs"
                    onClick={() => void choose(true)}
                  >
                    <FolderOpen size={17} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={!!importer.progress}
                    title="Remover sessão da memória"
                    aria-label="Remover sessão da memória"
                    onClick={removeSession}
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>
              <RangeBar session={session} range={range} onChange={setRange} />
            </>
          )}
          {page === "Ajuda" ? (
            <Help />
          ) : !session ? (
            <>
              <section className="welcome-panel">
                <div className="welcome-visual" aria-hidden="true">
                  <div className="visual-grid" />
                  <div className="visual-glow" />
                  <svg viewBox="0 0 680 180">
                    <path
                      className="wave-faint"
                      d="M0 110L85 110 95 95 110 120 125 55 142 140 160 100 235 100 252 75 270 95 320 95 335 30 350 145 370 90 420 90 440 105 465 85 490 90 680 90"
                    />
                    <path
                      className="wave-main"
                      d="M0 115L85 115 110 102 125 120 150 70 170 140 195 95 240 95 260 108 288 85 325 85 345 28 367 150 390 82 422 90 445 85 465 100 490 80 525 90 680 90"
                    />
                  </svg>
                  <span className="visual-caption">
                    <Activity size={15} /> Sinais que ajudam a entender.
                  </span>
                </div>
                <div className="welcome-content">
                  <div className="upload-symbol">
                    <Upload size={27} />
                  </div>
                  <h2>Seu próximo diagnóstico começa aqui.</h2>
                  <p>
                    Abra um registro do HWiNFO64 para explorar temperaturas,
                    <br />
                    desempenho e pistas sobre o que aconteceu.
                  </p>
                  <div className="welcome-buttons">
                    <button
                      className="primary"
                      onClick={() => void choose()}
                      disabled={!!importer.progress}
                    >
                      <Upload size={17} /> Selecionar arquivo CSV
                    </button>
                    <button
                      className="secondary"
                      onClick={() => void choose(true)}
                      disabled={!!importer.progress}
                    >
                      <FolderOpen size={17} /> Abrir pasta
                    </button>
                  </div>
                  <small>
                    ou arraste seus arquivos para esta janela · até 64 MiB por
                    arquivo
                  </small>
                </div>
              </section>
              <div className="welcome-bottom">
                <section className="panel demo-panel">
                  <ChartNoAxesCombined size={25} />
                  <div>
                    <h3>Explore antes de importar</h3>
                    <p>
                      Conheça a interface com uma sessão de dados sintéticos.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => void demo()}
                    disabled={demoBusy || !!importer.progress}
                  >
                    {demoBusy ? "Preparando…" : "Abrir demonstração"}
                    <ArrowRight size={16} />
                  </button>
                </section>
                <section className="panel privacy-panel">
                  <ShieldCheck size={25} />
                  <div>
                    <h3>Privado por princípio</h3>
                    <p>
                      Sem nuvem, conta ou telemetria.
                      <br />
                      Toda a análise acontece no seu computador.
                    </p>
                  </div>
                </section>
              </div>
              <div className="welcome-steps">
                <span>
                  <b>01</b> Registre no HWiNFO64
                </span>
                <ArrowRight size={14} />
                <span>
                  <b>02</b> Abra o CSV aqui
                </span>
                <ArrowRight size={14} />
                <span>
                  <b>03</b> Entenda as evidências
                </span>
              </div>
            </>
          ) : (
            props && (
              <div key={`${session.id}-${page}`} className="page-content">
                {page === "Visão geral" && (
                  <Dashboard
                    {...props}
                    observations={observations}
                    navigate={setPage}
                  />
                )}
                {["CPU", "GPU", "Memória", "Armazenamento", "Sistema"].includes(
                  page,
                ) && <Sensors {...props} component={page as Component} />}
                {page === "Linha do tempo" && (
                  <Timeline
                    {...props}
                    observations={observations}
                    markers={markers[session.id] ?? []}
                    onMarker={(m) =>
                      setMarkers((previous) => ({
                        ...previous,
                        [session.id]: [...(previous[session.id] ?? []), m],
                      }))
                    }
                    onRemove={(id) =>
                      setMarkers((previous) => ({
                        ...previous,
                        [session.id]: previous[session.id].filter(
                          (m) => m.id !== id,
                        ),
                      }))
                    }
                  />
                )}
                {page === "Diagnóstico" && (
                  <>
                    <div className="info-box">
                      <ShieldCheck size={20} />
                      <p>
                        As observações descrevem o que foi registrado. Limiares
                        são genéricos e não substituem os limites do fabricante.
                        Ausência de alertas não comprova estabilidade.
                      </p>
                    </div>
                    {(
                      [
                        "CPU",
                        "GPU",
                        "Memória",
                        "Armazenamento",
                        "Sistema",
                      ] as Component[]
                    ).map((component) => (
                      <section
                        key={component}
                        className="panel diagnosis-group"
                      >
                        <div className="panel-heading">
                          <h3>{component}</h3>
                          <span className="badge">
                            {
                              session.sensors.filter(
                                (s) => s.component === component,
                              ).length
                            }{" "}
                            sensores
                          </span>
                        </div>
                        {observations.filter((o) => o.component === component)
                          .length ? (
                          observations
                            .filter((o) => o.component === component)
                            .map((o) => (
                              <ObservationCard key={o.id} observation={o} />
                            ))
                        ) : (
                          <p className="empty-note">
                            {!observations.some(
                              (o) => o.rule === "insufficient",
                            ) &&
                            session.sensors.some(
                              (s) =>
                                s.component === component &&
                                stats(session, s, range).count > 0,
                            )
                              ? "Normal nas regras avaliadas: nenhum limiar foi atingido. Isso não exclui problemas fora dos sensores disponíveis."
                              : "Dados insuficientes: selecione um intervalo com leituras válidas em horários distintos e sensores deste componente."}
                          </p>
                        )}
                      </section>
                    ))}
                    <section className="panel form-panel">
                      <h3>Qualidade e integridade</h3>
                      <p>
                        {session.quality.encoding} · {session.quality.totalRows}{" "}
                        linhas de dados · {session.quality.invalidTimestamps}{" "}
                        timestamps inválidos ·{" "}
                        {session.quality.repeatedTimestamps} repetidos ·{" "}
                        {session.quality.outOfOrder} fora de ordem ·{" "}
                        {session.quality.incompleteRows} linhas incompletas ·{" "}
                        {session.quality.skippedRows} descartadas ·{" "}
                        {session.quality.invalidValues} valores inválidos ·{" "}
                        {session.quality.missingValues} ausentes.
                      </p>
                      {session.quality.warnings.map((w) => (
                        <p key={w}>{w}</p>
                      ))}
                    </section>
                  </>
                )}
                {page === "Investigar desligamento" && (
                  <Investigation {...props} />
                )}
                {page === "Comparar sessões" && (
                  <Compare sessions={sessions} session={session} />
                )}
                {page === "Relatórios" && <Reports {...props} />}
              </div>
            )
          )}
          <footer className="main-footer">
            <span>
              <LockKeyhole size={12} /> Análise local · sem telemetria
            </span>
            <span>
              Observações orientam a investigação. Não comprovam defeitos.
            </span>
          </footer>
        </main>
      </div>
      <input
        className="sr-only"
        ref={input}
        data-testid="csv-input"
        type="file"
        accept=".csv"
        multiple
        onChange={(e) => {
          importFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <input
        className="sr-only"
        ref={folderInput}
        data-testid="folder-input"
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        onChange={(e) => {
          importFiles(
            Array.from(e.target.files ?? []).filter((f) =>
              /\.csv$/i.test(f.name),
            ),
          );
          e.target.value = "";
        }}
      />
      {dragging && (
        <div className="drop-overlay">
          <Upload size={48} />
          <h2>Solte seus registros aqui</h2>
          <p>Arquivos CSV do HWiNFO64 · processamento local</p>
        </div>
      )}
    </div>
  );
}

function Help() {
  return (
    <section className="panel help-panel">
      <h2>Do registro às evidências</h2>
      <ol>
        <li>
          <strong>Instale o HWiNFO64 pelo site oficial.</strong>
          <p>
            Endereço: https://www.hwinfo.com/download/ . O HWiNFO64 é um
            software de terceiros com licença própria; seus binários não
            acompanham o PulseTrace.
          </p>
        </li>
        <li>
          <strong>Abra em modo Sensors-only.</strong>
          <p>
            Na janela de sensores, configure o intervalo de leitura. Dois
            segundos são um ponto de partida; intervalos menores aumentam o
            tamanho do registro.
          </p>
        </li>
        <li>
          <strong>Inicie o registro CSV.</strong>
          <p>
            Use o botão de iniciar registro na janela de sensores e salve em uma
            pasta fácil de encontrar. Deixe o registro ativo durante o uso
            normal.
          </p>
        </li>
        <li>
          <strong>Depois de uma falha, preserve o arquivo.</strong>
          <p>
            Reinicie o computador e abra o CSV no PulseTrace. O HWiNFO64 não
            precisa estar aberto. Não sobrescreva o registro anterior.
          </p>
        </li>
        <li>
          <strong>Confira datas e sensores.</strong>
          <p>
            Nas opções de importação, ajuste a ordem da data e o fuso do
            computador que gerou o CSV. A interface apresenta horários no fuso
            deste computador.
          </p>
        </li>
        <li>
          <strong>Investigue com contexto.</strong>
          <p>
            Use o zoom dos gráficos, marque acontecimentos e abra Investigar
            desligamento. Um alerta de temperatura não significa um componente
            defeituoso; o fim do CSV não prova um desligamento.
          </p>
        </li>
        <li>
          <strong>Exporte e compartilhe se desejar.</strong>
          <p>
            Os relatórios distinguem medições e hipóteses. Revise os nomes de
            arquivo e de dispositivos antes de compartilhar. Sessões e
            marcadores ficam somente na memória e são removidos ao fechar o
            aplicativo.
          </p>
        </li>
      </ol>
      <div className="info-box">
        Limites desta versão: 64 MiB por arquivo, 4.096 colunas, 1 milhão de
        linhas, 6 milhões de valores por arquivo e 3 sessões abertas. Formatos e
        idiomas desconhecidos podem exigir novos aliases. Confira os problemas
        de integridade em Diagnóstico.
      </div>
    </section>
  );
}
