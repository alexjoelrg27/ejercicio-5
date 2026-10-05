import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Viewports representativos: movil pequeno, movil grande, tablet, escritorio. */
const VIEWPORTS = [
  { nombre: "movil pequeno 320x568", width: 320, height: 568 },
  { nombre: "movil 375x667", width: 375, height: 667 },
  { nombre: "tablet 768x1024", width: 768, height: 1024 },
  { nombre: "portatil 1280x800", width: 1280, height: 800 },
  { nombre: "escritorio 1920x1080", width: 1920, height: 1080 },
];

async function poblar(page, tareas) {
  for (const tarea of tareas) {
    await page.getByLabel("Nueva tarea").fill(tarea);
    await page.getByRole("button", { name: "Agregar tarea" }).click();
  }
}

for (const vp of VIEWPORTS) {
  test.describe(`Responsividad - ${vp.nombre}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("no hay desbordamiento horizontal", async ({ page }) => {
      await page.goto("/index.html");
      await poblar(page, [
        "Comprar pan",
        "Llamar al medico cuando tenga tiempo libre por la manana",
      ]);

      const desbordamiento = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        cliente: document.documentElement.clientWidth,
      }));

      expect(
        desbordamiento.scroll,
        `El contenido se desborda: ${desbordamiento.scroll}px > ${desbordamiento.cliente}px`,
      ).toBeLessThanOrEqual(desbordamiento.cliente + 1);
    });

    test("los controles son visibles y tienen tamano util", async ({ page }) => {
      await page.goto("/index.html");
      await poblar(page, ["Comprar pan"]);

      const campo = page.getByLabel("Nueva tarea");
      const boton = page.getByRole("button", { name: "Agregar tarea" });

      for (const control of [campo, boton]) {
        await expect(control).toBeVisible();
        const caja = await control.boundingBox();
        expect(caja, "el control no tiene caja de layout").not.toBeNull();
        // Objetivo tactil minimo razonable (WCAG 2.5.5 es AAA; aqui es buena practica).
        expect(caja.height, "altura insuficiente para dedo").toBeGreaterThanOrEqual(40);
        expect(caja.width, "ancho insuficiente").toBeGreaterThanOrEqual(40);
      }
    });

    test("el contenido permanece accesible sin violacion WCAG A/AA", async ({ page }) => {
      await page.goto("/index.html");
      await poblar(page, ["Comprar pan", "Revisar el buzon"]);

      const resultados = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
      const ids = resultados.violations.map((v) => `${v.id} (${v.impact})`).join(", ");
      expect(ids, `Violaciones en ${vp.nombre}: ${ids}`).toBe("");
    });
  });
}

test.describe("Adaptacion de contenido", () => {
  test("una tarea larga no rompe el diseno en movil", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/index.html");
    await poblar(page, ["palabra".repeat(40)]);

    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde).toBeLessThanOrEqual(1);

    const elemento = page.locator("#lista li > span").first();
    await expect(elemento).toBeVisible();
    const caja = await elemento.boundingBox();
    expect(caja.width).toBeLessThanOrEqual(320);
  });

  test("el zoom al 200% no genera scroll horizontal (WCAG 1.4.10)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/index.html");
    await poblar(page, ["Comprar pan", "Llamar al medico"]);

    // Zoom del 200% emulado reduciendo el viewport a la mitad.
    await page.setViewportSize({ width: 640, height: 800 });

    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde).toBeLessThanOrEqual(1);
  });

  test("la lista se mantiene tras recargar (persistencia)", async ({ page }) => {
    await page.goto("/index.html");
    await poblar(page, ["Comprar pan", "Llamar al medico"]);
    await page.reload();

    await expect(page.getByRole("listitem")).toHaveCount(2);
    await expect(page.getByText("Comprar pan")).toBeVisible();
    await expect(page.locator("#lista-vacia")).toBeHidden();

    // Limpieza para no arrastrar estado entre pruebas.
    await page.evaluate(() => localStorage.clear());
  });

  test("eliminar una tarea actualiza la lista", async ({ page }) => {
    await page.goto("/index.html");
    await poblar(page, ["Comprar pan", "Llamar al medico"]);

    await page.getByRole("button", { name: "Eliminar tarea: Comprar pan" }).click();

    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByText("Comprar pan")).toHaveCount(0);
    await expect(page.getByText("Llamar al medico")).toBeVisible();

    await page.evaluate(() => localStorage.clear());
  });
});