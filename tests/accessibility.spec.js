import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Tags de axe-core que cubren WCAG 2.0/2.1/2.2 nivel A y AA. */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function auditar(page) {
  return new AxeBuilder({ page })
    .withTags(WCAG_AA)
    .analyze();
}

function formatear(violaciones) {
  return violaciones
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).join("\n    ")}`,
    )
    .join("\n");
}

test.describe("Accesibilidad WCAG AA", () => {
  test("la pagina inicial no tiene violaciones WCAG A/AA", async ({ page }) => {
    await page.goto("/index.html");
    const resultados = await auditar(page);
    expect(formatear(resultados.violations), `Violaciones detectadas:\n${formatear(resultados.violations)}`).toBe("");
  });

  test("la lista con tareas no tiene violaciones WCAG A/AA", async ({ page }) => {
    await page.goto("/index.html");
    await page.getByLabel("Nueva tarea").fill("Comprar pan");
    await page.getByRole("button", { name: "Agregar tarea" }).click();
    await page.getByLabel("Nueva tarea").fill("Llamar al medico");
    await page.getByRole("button", { name: "Agregar tarea" }).click();

    await expect(page.getByRole("listitem")).toHaveCount(2);

    const resultados = await auditar(page);
    expect(formatear(resultados.violations), `Violaciones detectadas:\n${formatear(resultados.violations)}`).toBe("");
  });

  test("el estado de error es announced y programaticamente invalido", async ({ page }) => {
    await page.goto("/index.html");
    const campo = page.getByLabel("Nueva tarea");
    await page.getByRole("button", { name: "Agregar tarea" }).click();

    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#tarea-error")).toHaveText(/Escribe una tarea/);
  });

  test("cada boton eliminar tiene nombre accesible unico", async ({ page }) => {
    await page.goto("/index.html");
    for (const tarea of ["Comprar pan", "Llamar al medico"]) {
      await page.getByLabel("Nueva tarea").fill(tarea);
      await page.getByRole("button", { name: "Agregar tarea" }).click();
    }

    const botones = page.getByRole("button", { name: /^Eliminar tarea:/ });
    await expect(botones).toHaveCount(2);
    await expect(botones.nth(0)).toHaveAccessibleName("Eliminar tarea: Comprar pan");
    await expect(botones.nth(1)).toHaveAccessibleName("Eliminar tarea: Llamar al medico");
  });

  test("el flujo completo es operable con teclado", async ({ page }) => {
    await page.goto("/index.html");

    // El skip link debe ser lo primero al tabular y debe entrar en main.
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contenido$/);

    // Enfocar el campo, escribir y enviar con Enter (sin usar el raton).
    await page.getByLabel("Nueva tarea").focus();
    await page.keyboard.type("Tarea desde teclado");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Eliminar tarea: Tarea desde teclado" })).toBeVisible();
  });

  test("el idioma y la estructura semantica son correctos", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
  });
});