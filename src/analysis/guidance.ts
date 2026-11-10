import type { Observation, Session, Sensor, TimeRange } from "../core/types";
import { stats } from "./compare";
import { fold } from "../import/normalize";

export interface Guidance {
  area: string;
  meaning: string;
  possibilities: string[];
  nextSteps: string[];
  caution: string;
}

/** Guidance is a hypothesis checklist, NEVER a component-failure diagnosis. */
export function guidanceFor(o: Observation): Guidance {
  switch (o.rule) {
    case "power-change":
      return {
        area: "Energia e mudança de carga",
        meaning: "O consumo informado por este sensor mudou rapidamente. Isso é comum quando o jogo altera a carga.",
        possibilities: ["Transição normal entre menu, jogo e carregamento", "Alteração de clock ou limite operacional"],
        nextSteps: ["Compare o horário com utilização e frequência.", "Se o PC apagou por completo, confira tomada, extensão e alimentação com segurança; o CSV não prova falha da fonte."],
        caution: "Oscilações de watts da GPU não medem a qualidade da energia da tomada.",
      };
    case "thermal-sustained":
    case "thermal-peak":
      return {
        area: o.component === "GPU" ? "Placa de vídeo e refrigeração" : o.component === "CPU" ? "Processador e refrigeração" : "Temperatura e ventilação",
        meaning: "A temperatura deste sensor superou um limite genérico de triagem, que precisa ser comparado ao modelo exato.",
        possibilities: ["Carga elevada", "Fluxo de ar ou sistema de refrigeração insuficiente", "Sensor principal e hotspot têm limites diferentes"],
        nextSteps: ["Confira se o nome do sensor indica hotspot/ponto quente.", "Compare com limite térmico e indicadores explícitos de throttling.", "Verifique ventoinhas e poeira com o PC desligado."],
        caution: "Temperatura elevada isolada não demonstra defeito da peça nem causa do desligamento.",
      };
    case "explicit-limit":
      return {
        area: "Limitação de desempenho",
        meaning: "O próprio hardware indicou uma condição limitante; é necessário identificar qual limite.",
        possibilities: ["Limite térmico", "Limite de potência", "Limite operacional de tensão ou utilização"],
        nextSteps: ["Leia o nome exato do indicador.", "Compare com carga, clocks, potência e temperatura no mesmo horário."],
        caution: "O indicador não comprova que houve falha física.",
      };
    case "memory-pressure":
      return {
        area: "Memória RAM e programas",
        meaning: "A RAM foi muito utilizada por um período contínuo.",
        possibilities: ["Vários aplicativos abertos", "Jogo exigindo mais RAM que a disponível"],
        nextSteps: ["Veja uso e memória comprometida no Gerenciador de Tarefas.", "Observe se o problema desaparece com menos programas abertos."],
        caution: "Uso alto não significa módulo de memória defeituoso.",
      };
    case "clock-drop":
      return {
        area: "CPU/GPU e gerenciamento de desempenho",
        meaning: "Foi observada queda importante de frequência durante uma amostra com carga alta.",
        possibilities: ["Mudança de estado de energia", "Limite térmico ou de potência", "Alteração natural da carga"],
        nextSteps: ["Compare sensores explícitos de limitação e temperatura.", "Verifique se houve repetição ao longo do tempo."],
        caution: "A correlação entre clock e carga não identifica a causa.",
      };
    case "storage-health-flag":
      return {
        area: "HD/SSD e integridade dos dados",
        meaning: "Um indicador de aviso de armazenamento foi registrado.",
        possibilities: ["Alerta SMART do dispositivo", "Necessidade de confirmação pelo fabricante"],
        nextSteps: ["Faça backup de arquivos importantes.", "Confira os dados SMART completos e a ferramenta do fabricante."],
        caution: "Não é possível determinar o defeito exato pelo alerta resumido.",
      };
    case "sample-gap":
    case "last-sample":
      return {
        area: "Registro e eventos do Windows",
        meaning: "Uma lacuna ou o fim do CSV não explica por que a gravação parou.",
        possibilities: ["Registro interrompido", "Sistema suspenso ou reiniciado", "Falha de energia não capturada pelo sensor"],
        nextSteps: ["Confira o horário real da ocorrência.", "Correlacione com os eventos 41 e 6008 do Windows e com logs WHEA quando existirem."],
        caution: "Kernel-Power 41 e o fim do CSV não comprovam defeito da fonte.",
      };
    default:
      return {
        area: o.component === "Sistema" ? "Sistema e integridade do registro" : o.component,
        meaning: o.explanation,
        possibilities: o.causes.length ? o.causes : ["Os dados não permitem identificar uma peça específica."],
        nextSteps: o.checks.length ? o.checks : ["Reúna mais leituras e o horário do sintoma."],
        caution: o.limitation,
      };
  }
}

export interface Highlight {
  label: string;
  value: number;
  unit: string;
  sensor: Sensor;
}
export function reportHighlights(session: Session, range: TimeRange): Highlight[] {
  const find = (predicate: (s: Sensor) => boolean) => session.sensors.find((s) => {
    if (!predicate(s)) return false;
    return stats(session, s, range).max !== null;
  });
  const mainTemp = (s: Sensor) => s.metric === "temperature" && s.unit === "°C" && !/hot.?spot|ponto quente|junction|juncao|limite|limit/.test(fold(s.label));
  const spec: Array<[string, Sensor | undefined]> = [
    ["CPU máxima", find(s => s.component === "CPU" && mainTemp(s) && /package|inteira|cpu/.test(fold(s.label)))],
    ["GPU máxima", find(s => s.component === "GPU" && mainTemp(s))],
    ["Hotspot GPU", find(s => s.component === "GPU" && s.metric === "temperature" && /hot.?spot|ponto quente|junction/.test(fold(s.label)))],
    ["RAM máxima", find(s => s.component === "Memória" && s.unit === "%" && s.metric === "usage")],
  ];
  const used = new Set<string>();
  return spec.flatMap(([label, sensor]) => {
    if (!sensor || used.has(sensor.id)) return [];
    used.add(sensor.id);
    const value = stats(session, sensor, range).max;
    return value === null ? [] : [{ label, value, unit: sensor.unit, sensor }];
  });
}

export function selectReportSensors(session: Session, range: TimeRange, technical: boolean): Sensor[] {
  if (technical) return session.sensors.filter(s => stats(session, s, range).count > 0);
  const chosen = new Map<string, Sensor>();
  for (const h of reportHighlights(session, range)) chosen.set(h.sensor.id, h.sensor);
  const names = [/potencia total da cpu|cpu package power|potencia da gpu|gpu power/, /\+5v|\+12v/, /thermal throttling|estrangulamento termico|limite de desempenho - termico/];
  for (const re of names) {
    for (const s of session.sensors) {
      if (re.test(fold(s.label)) && stats(session, s, range).count > 0) chosen.set(s.id, s);
      if (chosen.size >= 12) break;
    }
  }
  return [...chosen.values()].slice(0, 12);
}
