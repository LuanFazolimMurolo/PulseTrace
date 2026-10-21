import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
const csv =
  "Date,Time,CPU Package [°C],GPU Temperature [°C],Physical Memory Load [%]\n20.10.2026,12:00:00,50,60,45\n20.10.2026,12:00:02,101,65,46\n20.10.2026,12:00:04,55,64,47";
const csvFile = (name = "hwinfo-test.csv") => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from(csv),
});

test("demonstração: navegação, gráficos, marcadores, investigação e temas", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).hostname !== "127.0.0.1"
    )
      externalRequests.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Cada leitura conta uma história." }),
  ).toBeVisible();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/boas-vindas.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abrir demonstração" }).click();
  await expect(
    page.getByText("DADOS SINTÉTICOS", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Temperaturas ao longo do tempo" }),
  ).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/dashboard.png",
    fullPage: true,
  });
  const png = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Exportar Temperaturas ao longo do tempo em PNG",
    })
    .click();
  expect((await png).suggestedFilename()).toMatch(/\.png$/);
  for (const name of ["CPU", "GPU", "Memória", "Armazenamento", "Sistema"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Leituras por sensor" }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Linha do tempo", exact: true })
    .click();
  await page
    .getByPlaceholder("Ex.: o jogo parou de responder")
    .fill("Jogo congelou");
  await page.getByRole("button", { name: "Adicionar marcador" }).click();
  await expect(
    page.getByRole("heading", { name: "Jogo congelou" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Última leitura disponível" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Usar seleção como intervalo A" })
    .click();
  await expect(
    page.getByRole("columnheader", { name: "B", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Investigar desligamento", exact: true })
    .click();
  await page.getByRole("button", { name: "Investigar período" }).click();
  await expect(
    page.getByText("Última amostra anterior à falha", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Diagnóstico/ }).click();
  await expect(
    page.getByRole("heading", { name: "Qualidade e integridade" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await expect(page.locator(".app")).toHaveClass(/light/);
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test("importa CSV, filtra intervalo e exporta HTML, PDF e CSV", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("csv-input").setInputFiles(csvFile());
  await expect(page.getByText("CSV IMPORTADO", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Pico de temperatura registrado", { exact: true }),
  ).toBeVisible();
  const start = page.getByLabel("Início do intervalo");
  const end = await page.getByLabel("Fim do intervalo").inputValue();
  await start.fill(end);
  await start.press("Tab");
  await expect(
    page.getByText("Pico de temperatura registrado", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  for (const type of ["HTML", "PDF", "CSV"]) {
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: `Exportar ${type}`, exact: true })
      .click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(
      `PulseTrace-relatorio.${type.toLowerCase()}`,
    );
    expect(await file.failure()).toBeNull();
  }
});

test("compara duas sessões e remove registros da memória", async ({ page }) => {
  await page.goto("/");
  await page
    .getByTestId("csv-input")
    .setInputFiles([csvFile("sessao-a.csv"), csvFile("sessao-b.csv")]);
  await expect(page.getByLabel("Sessão ativa").locator("option")).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: "Comparar sessões" }).click();
  await expect(
    page.getByRole("heading", { name: "Comparação de médias e máximas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remover sessão da memória" }).click();
  await expect(page.getByLabel("Sessão ativa").locator("option")).toHaveCount(
    1,
  );
});

test("erros claros, arrastar e soltar e layout estreito", async ({ page }) => {
  await page.goto("/");
  await page
    .getByTestId("csv-input")
    .setInputFiles({
      name: "vazio.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(""),
    });
  await expect(page.getByRole("alert")).toContainText("vazio");
  const transfer = await page.evaluateHandle((text) => {
    const dt = new DataTransfer();
    dt.items.add(new File([text], "arrastado.csv", { type: "text/csv" }));
    return dt;
  }, csv);
  await page.locator(".app").dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByText("CSV IMPORTADO", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 900, height: 720 });
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("cancela importação em andamento sem adicionar sessão", async ({
  page,
}) => {
  await page.goto("/");
  const rows = ["Timestamp,CPU Package [°C]"];
  for (let i = 0; i < 200_000; i++)
    rows.push(`${new Date(Date.UTC(2026, 0, 1) + i * 2000).toISOString()},60`);
  await page
    .getByTestId("csv-input")
    .setInputFiles({
      name: "grande.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(rows.join("\n")),
    });
  await page.getByRole("button", { name: "Cancelar importação" }).click();
  await expect(page.getByText("CSV IMPORTADO", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("validação opcional do registro externo: worker, dashboard e sensores", async ({
  page,
}) => {
  const path = "tests/private/hwinfo_report_20240508.csv";
  test.skip(
    !existsSync(path),
    "Amostra externa não redistribuída; veja docs/VALIDACAO.md.",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByTestId("csv-input").setInputFiles(path);
  await expect(page.getByText("CSV IMPORTADO", { exact: true })).toBeVisible();
  await expect(page.locator(".session-details")).toContainText("123");
  await expect(page.locator(".session-details")).toContainText("376");
  expect(await page.getByLabel("Fim do intervalo").inputValue()).toMatch(
    /40\.281$/,
  );
  await page
    .getByRole("main").getByRole("button", { name: "Investigar desligamento", exact: true })
    .click();
  await page.getByRole("button", { name: "Investigar período" }).click();
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Leituras na janela" })
      .locator("strong"),
  ).toHaveText("123");
  await page.getByRole("button", { name: "CPU", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "CPU (Tctl/Tdie)", exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Diagnóstico/ }).click();
  await expect(page.getByText(/0 timestamps inválidos/)).toBeVisible();
  expect(errors).toEqual([]);
});
