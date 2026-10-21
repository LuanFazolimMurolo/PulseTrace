import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkAreaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Download } from "lucide-react";
import type { Sensor, Session, TimeRange } from "../core/types";
import { saveFile } from "../platform/files";
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkAreaComponent,
  CanvasRenderer,
]);

export function chartPoints(
  session: Session,
  sensor: Sensor,
): [number, number | null][] {
  const result: [number, number | null][] = [];
  const stride = Math.max(1, Math.ceil(session.times.length / 1200));
  for (let i = 0; i < session.times.length; i += stride) {
    const end = Math.min(i + stride, session.times.length);
    let min = i,
      max = i;
    for (let j = i; j < end; j++) {
      if (
        sensor.values[j] < sensor.values[min] ||
        !Number.isFinite(sensor.values[min])
      )
        min = j;
      if (
        sensor.values[j] > sensor.values[max] ||
        !Number.isFinite(sensor.values[max])
      )
        max = j;
    }
    const points = new Set([i, min, max, end - 1]);
    // Preserve every missing-data boundary even when the visual series is reduced.
    for (let j = i; j < end; j++)
      if (
        !Number.isFinite(sensor.values[j]) ||
        (j &&
          session.times[j] - session.times[j - 1] >
            Math.max(session.cadence * 3, 5000))
      )
        points.add(j);
    [...points]
      .sort((a, b) => a - b)
      .forEach((j) => {
        if (
          j &&
          session.times[j] - session.times[j - 1] >
            Math.max(session.cadence * 3, 5000)
        )
          result.push([session.times[j] - 1, null]);
        result.push([
          session.times[j],
          Number.isFinite(sensor.values[j]) ? sensor.values[j] : null,
        ]);
      });
  }
  return result;
}

interface Props {
  session: Session;
  sensors: Sensor[];
  title: string;
  subtitle?: string;
  range: TimeRange;
  onRange: (range: TimeRange) => void;
  light: boolean;
  onError: (error: string) => void;
}
export function Chart({
  session,
  sensors,
  title,
  subtitle,
  range,
  onRange,
  light,
  onError,
}: Props) {
  const element = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.EChartsType | null>(null);
  const callbacks = useRef({ onRange, onError });
  callbacks.current = { onRange, onError };
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const sensorKey = sensors.map((s) => s.id).join(",");
  useEffect(() => {
    if (!element.current || !sensors.length) return;
    const c = echarts.init(element.current, undefined, { renderer: "canvas" });
    chart.current = c;
    const color = light ? "#607184" : "#8291a3",
      grid = light ? "#e7ecf0" : "#222c36";
    c.setOption({
      animation: false,
      color: ["#2dd4bf", "#a78bfa", "#fbbf66", "#6baaff", "#f47793", "#a3d77a"],
      grid: { left: 48, right: 22, top: 40, bottom: 66 },
      tooltip: {
        trigger: "axis",
        renderMode: "richText",
        backgroundColor: light ? "#fff" : "#19212c",
        borderColor: grid,
        textStyle: { color: light ? "#263340" : "#e5edf5" },
        valueFormatter: (v: number) =>
          v == null ? "Ausente" : `${Number(v).toFixed(1)} ${sensors[0].unit}`,
      },
      legend: {
        top: 0,
        left: 10,
        type: "scroll",
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 4,
        textStyle: { color, fontSize: 11 },
      },
      xAxis: {
        type: "time",
        min: session.times[0],
        max: session.times[session.times.length - 1],
        axisLine: { lineStyle: { color: grid } },
        axisLabel: { color, fontSize: 10, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: sensors[0].unit,
        nameLocation: "middle",
        nameGap: 34,
        nameTextStyle: { color, fontSize: 10 },
        axisLabel: { color, fontSize: 10 },
        splitLine: { lineStyle: { color, opacity: 0.1, type: "dashed" } },
        scale: true,
      },
      dataZoom: [
        {
          type: "inside",
          startValue: rangeRef.current[0],
          endValue: rangeRef.current[1],
          filterMode: "none",
        },
        {
          type: "slider",
          height: 18,
          bottom: 6,
          borderColor: grid,
          fillerColor: "#2dd4bf18",
          textStyle: { color },
          handleStyle: { color: "#2dd4bf" },
          dataBackground: {
            lineStyle: { color: "#2dd4bf" },
            areaStyle: { color: "#2dd4bf22" },
          },
          brushSelect: false,
        },
      ],
      series: sensors.map((s) => ({
        id: s.id,
        name: `${s.label}${session.sensors.filter((x) => x.label === s.label).length > 1 ? ` · ${s.id}` : ""}`,
        type: "line",
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1.7 },
        areaStyle: { opacity: 0.045 },
        data: chartPoints(session, s),
      })),
    });
    c.on("datazoom", () => {
      const option = c.getOption();
      const zoom = (option.dataZoom as { start: number; end: number }[])[0];
      const first = session.times[0],
        span = session.times[session.times.length - 1] - first;
      callbacks.current.onRange([
        Math.round(first + (span * zoom.start) / 100),
        Math.round(first + (span * zoom.end) / 100),
      ]);
    });
    const resize = new ResizeObserver(() => c.resize());
    resize.observe(element.current);
    return () => {
      resize.disconnect();
      c.dispose();
      chart.current = null;
    };
    // Sensors are immutable within a session; keys avoid rebuilding on interval changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, sensorKey, light]);
  useEffect(() => {
    chart.current?.dispatchAction(
      { type: "dataZoom", startValue: range[0], endValue: range[1] },
      { silent: true },
    );
  }, [range]);
  async function download() {
    try {
      const data = chart.current?.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: light ? "#fff" : "#131a23",
      });
      if (!data) return;
      const bytes = Uint8Array.from(atob(data.split(",")[1]), (c) =>
        c.charCodeAt(0),
      );
      await saveFile(
        `PulseTrace-${title.replace(/[^\p{L}\d-]/gu, "-")}.png`,
        new Blob([bytes], { type: "image/png" }),
      );
    } catch (e) {
      callbacks.current.onError(String(e));
    }
  }
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          title={`Exportar ${title} em PNG`}
          aria-label={`Exportar ${title} em PNG`}
          onClick={download}
          disabled={!sensors.length}
        >
          <Download size={16} />
        </button>
      </div>
      {sensors.length ? (
        <div
          ref={element}
          className="chart"
          role="img"
          aria-label={`Gráfico ${title}; use os campos de intervalo para filtrar por teclado.`}
        />
      ) : (
        <div className="empty-chart">
          Este tipo de sensor não está presente no arquivo.
        </div>
      )}
    </section>
  );
}
