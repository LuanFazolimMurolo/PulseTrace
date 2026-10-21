import type { Observation, Sensor, Session, TimeRange } from "../core/types";
import { fold } from "../import/normalize";

export interface RuleConfig {
  cpuWarning: number;
  cpuCritical: number;
  gpuWarning: number;
  gpuCritical: number;
  sustainedMs: number;
  memoryWarning: number;
}
export const DEFAULT_RULES: RuleConfig = {
  cpuWarning: 90,
  cpuCritical: 100,
  gpuWarning: 85,
  gpuCritical: 95,
  sustainedMs: 30_000,
  memoryWarning: 90,
};
interface Run {
  start: number;
  end: number;
  peak: number;
  count: number;
}
export function runs(
  session: Session,
  sensor: Sensor,
  predicate: (value: number, index: number) => boolean,
  range?: TimeRange,
): Run[] {
  const result: Run[] = [];
  let current: Run | undefined;
  const gapLimit = Math.max(session.cadence * 3, 5000);
  for (let i = 0; i < session.times.length; i++) {
    const t = session.times[i],
      v = sensor.values[i];
    const valid =
      Number.isFinite(v) &&
      (!range || (t >= range[0] && t <= range[1])) &&
      predicate(v, i);
    if (current && (!valid || t - current.end > gapLimit)) {
      result.push(current);
      current = undefined;
    }
    if (!valid) continue;
    if (!current) current = { start: t, end: t, peak: v, count: 1 };
    else {
      if (t > current.end) current.count++;
      current.end = t;
      current.peak = Math.max(current.peak, v);
    }
  }
  if (current) result.push(current);
  return result;
}

export function analyze(
  session: Session,
  config: RuleConfig = DEFAULT_RULES,
  range?: TimeRange,
): Observation[] {
  const observations: Observation[] = [];
  const first = range?.[0] ?? session.times[0],
    last = range?.[1] ?? session.times[session.times.length - 1];
  const add = (
    rule: string,
    sensor: Sensor | null,
    run: Run | null,
    detail: Partial<Observation> & Pick<Observation, "title" | "explanation">,
  ) => {
    observations.push({
      id: `${rule}-${sensor?.id ?? "session"}-${run?.start ?? first}`,
      rule,
      component: sensor?.component ?? "Sistema",
      severity: "warning",
      sensorId: sensor?.id,
      sensor: sensor?.original ?? "Registro de sensores",
      value: run?.peak ?? null,
      unit: sensor?.unit ?? "",
      time: run?.start ?? first,
      duration: run ? run.end - run.start : null,
      confidence: "Moderada",
      causes: [],
      checks: [],
      limitation:
        "A observação descreve o registro e não comprova um defeito físico.",
      ...detail,
    });
  };
  // Collapse repeated episodes per rule/sensor: retain the longest, then highest peak.
  const strongest = (list: Run[]) =>
    list.sort(
      (a, b) => b.end - b.start - (a.end - a.start) || b.peak - a.peak,
    )[0];
  for (const sensor of session.sensors) {
    if (!sensor.count) continue;
    if (sensor.metric === "temperature" && sensor.unit === "°C") {
      const hotspot = /hot.?spot|junction|juncao/.test(fold(sensor.label));
      const warning = hotspot
        ? 100
        : sensor.component === "CPU"
          ? config.cpuWarning
          : sensor.component === "GPU"
            ? config.gpuWarning
            : sensor.component === "Armazenamento"
              ? 70
              : null;
      const critical = hotspot
        ? 110
        : sensor.component === "CPU"
          ? config.cpuCritical
          : sensor.component === "GPU"
            ? config.gpuCritical
            : 85;
      if (warning !== null) {
        const hot = runs(session, sensor, (v) => v >= warning, range);
        const sustained = strongest(
          hot.filter((r) => r.end - r.start >= config.sustainedMs),
        );
        if (sustained)
          add("thermal-sustained", sensor, sustained, {
            title: "Temperatura elevada por um período contínuo",
            severity: sustained.peak >= critical ? "critical" : "warning",
            explanation: `Este sensor permaneceu em ${warning} °C ou mais por pelo menos ${Math.round((sustained.end - sustained.start) / 1000)} segundos entre leituras válidas.`,
            causes: [
              "Carga intensa de trabalho",
              "Ventilação ou refrigeração insuficiente para a carga",
            ],
            checks: [
              "Compare a temperatura com o limite publicado pelo fabricante do componente.",
              "Verifique ventilação, poeira e funcionamento das ventoinhas.",
            ],
            limitation:
              "Limiares de triagem genéricos, não limites específicos do seu modelo. Intervalos ausentes interrompem a contagem.",
          });
        const peak = strongest(
          hot.filter(
            (r) => r.peak >= critical && r.end - r.start < config.sustainedMs,
          ),
        );
        if (peak)
          add("thermal-peak", sensor, peak, {
            title: "Pico de temperatura registrado",
            explanation: `Houve uma leitura de pelo menos ${critical} °C. O registro não demonstra temperatura persistentemente elevada neste episódio.`,
            checks: [
              "Confira a especificação térmica do modelo e repita a medição.",
            ],
            limitation:
              "Um pico isolado pode refletir transição de carga ou erro do sensor; não comprova falha.",
          });
      }
    }
    if (sensor.metric === "throttle") {
      const active = strongest(runs(session, sensor, (v) => v === 1, range));
      if (active)
        add("explicit-limit", sensor, active, {
          title: /thermal|term|throttl/.test(fold(sensor.label))
            ? "Indicador explícito de limitação ativo"
            : "Limite de desempenho indicado pelo sensor",
          explanation:
            "O próprio sensor registrou o estado ativo. Confira seu nome: limites térmicos, de potência e de tensão têm significados diferentes.",
          confidence: "Alta",
          causes: [
            "Proteção térmica ou limite operacional indicado pelo sensor",
          ],
          checks: ["Observe temperatura, potência e carga no mesmo período."],
          limitation:
            "O estado explícito confirma a indicação registrada, mas não determina a causa física nem a duração entre amostras ausentes.",
        });
    }
    if (sensor.metric === "health" && sensor.unit === "estado") {
      const active = strongest(runs(session, sensor, (v) => v === 1, range));
      if (active)
        add("storage-health-flag", sensor, active, {
          title: "Indicador de saúde do disco ativo",
          explanation:
            "O sensor de alerta ou falha do dispositivo registrou estado ativo.",
          confidence: "Alta",
          checks: [
            "Preserve seus arquivos importantes e confira os dados SMART na ferramenta do fabricante.",
          ],
          limitation:
            "Confirma o indicador registrado, não a natureza ou extensão de um eventual defeito físico.",
        });
    }
    if (
      sensor.component === "Memória" &&
      sensor.metric === "usage" &&
      sensor.unit === "%"
    ) {
      const high = strongest(
        runs(session, sensor, (v) => v >= config.memoryWarning, range).filter(
          (r) => r.end - r.start >= config.sustainedMs,
        ),
      );
      if (high)
        add("memory-pressure", sensor, high, {
          title: "Uso elevado de memória",
          explanation: `O indicador de memória ficou em ${config.memoryWarning}% ou mais durante um período contínuo.`,
          causes: [
            "Aplicativos consumindo muita memória",
            "Carga de trabalho maior que a memória disponível",
          ],
          checks: [
            "Confira o consumo por aplicativo e a memória comprometida.",
          ],
          limitation:
            "Pressão de memória pode prejudicar o desempenho; não indica defeito nos módulos de RAM.",
        });
    }
    if (
      sensor.metric === "clock" &&
      sensor.device !== "Dispositivo não identificado"
    ) {
      const load = session.sensors.find(
        (s) =>
          s.device === sensor.device &&
          s.component === sensor.component &&
          s.metric === "usage" &&
          s.unit === "%",
      );
      if (load) {
        const drops = runs(
          session,
          sensor,
          (v, i) =>
            i > 0 &&
            Number.isFinite(sensor.values[i - 1]) &&
            sensor.values[i - 1] > 500 &&
            v < sensor.values[i - 1] * 0.5 &&
            load.values[i] >= 70 &&
            load.values[i - 1] >= 70 &&
            session.times[i] > session.times[i - 1] &&
            session.times[i] - session.times[i - 1] <=
              Math.max(session.cadence * 3, 5000),
          range,
        );
        const drop = strongest(drops);
        if (drop)
          add("clock-drop", sensor, drop, {
            title: "Queda de frequência sob carga",
            explanation:
              "A frequência caiu mais de 50% entre leituras consecutivas, com utilização de pelo menos 70% no mesmo dispositivo.",
            confidence: "Baixa",
            causes: [
              "Mudança de estado de energia",
              "Limite operacional",
              "Mudança na carga de trabalho",
            ],
            checks: [
              "Compare com indicadores explícitos de throttling e potência.",
            ],
            limitation:
              "Correlação temporal, não causalidade. Clock efetivo e clock solicitado podem ter comportamentos diferentes.",
          });
      }
    }
    if (sensor.metric === "power" && sensor.unit === "W") {
      const changes = runs(
        session,
        sensor,
        (v, i) =>
          i > 0 &&
          Number.isFinite(sensor.values[i - 1]) &&
          Math.abs(v - sensor.values[i - 1]) >= 50 &&
          Math.abs(v - sensor.values[i - 1]) /
            Math.max(sensor.values[i - 1], 10) >=
            0.5 &&
          session.times[i] > session.times[i - 1] &&
          session.times[i] - session.times[i - 1] <=
            Math.max(session.cadence * 3, 5000),
        range,
      );
      const change = strongest(changes);
      if (change)
        add("power-change", sensor, change, {
          title: "Variação acentuada de potência",
          explanation:
            "A potência mudou pelo menos 50 W e 50% entre duas leituras consecutivas.",
          confidence: "Baixa",
          causes: [
            "Início ou fim de uma carga de trabalho",
            "Mudança de limite de energia",
          ],
          checks: ["Compare com utilização e frequência no mesmo horário."],
          limitation:
            "Transições de potência são comuns. Este dado não permite avaliar a integridade da fonte.",
        });
    }
  }
  const gaps = session.gaps.filter((g) => g.end >= first && g.start <= last);
  if (gaps.length) {
    const gap = [...gaps].sort((a, b) => b.duration - a.duration)[0];
    add(
      "sample-gap",
      null,
      { start: gap.start, end: gap.end, peak: gap.duration / 1000, count: 0 },
      {
        title: `${gaps.length} intervalo(s) sem leituras`,
        unit: "s",
        explanation:
          "O intervalo excede três vezes a cadência mediana e cinco segundos. Não há medições no espaço entre essas amostras.",
        confidence: "Alta",
        causes: [
          "Suspensão do computador",
          "Pausa do registro",
          "Atraso de coleta",
        ],
        checks: [
          "Confira se o computador foi suspenso ou se o registro foi pausado.",
        ],
      },
    );
  }
  const hasFinite = session.sensors.some((s) =>
    s.values.some(
      (v, i) =>
        Number.isFinite(v) &&
        session.times[i] >= first &&
        session.times[i] <= last,
    ),
  );
  let firstTime: number | undefined, lastTime: number | undefined;
  for (const t of session.times)
    if (t >= first && t <= last) {
      firstTime ??= t;
      lastTime = t;
    }
  if (!hasFinite || firstTime === lastTime)
    add("insufficient", null, null, {
      severity: "insufficient",
      title: "Dados insuficientes para avaliar tendências",
      explanation:
        "São necessárias leituras numéricas e pelo menos duas amostras em horários distintos dentro do intervalo selecionado.",
      confidence: "Alta",
    });
  add("last-sample", null, null, {
    severity: "insufficient",
    title: "Fim do registro disponível",
    time: session.times[session.times.length - 1],
    explanation:
      "Esta é a última amostra do arquivo. O CSV, sozinho, não informa por que o registro terminou.",
    confidence: "Alta",
    checks: [
      "Se houve falha, informe o horário em Investigar desligamento e compare com eventos do Windows.",
    ],
    limitation:
      "O fim do CSV não comprova travamento ou desligamento inesperado. Dados após a última gravação podem ter sido perdidos.",
  });
  return observations.sort(
    (a, b) =>
      ({ critical: 0, warning: 1, insufficient: 2, normal: 3 })[a.severity] -
        { critical: 0, warning: 1, insufficient: 2, normal: 3 }[b.severity] ||
      a.time - b.time,
  );
}
