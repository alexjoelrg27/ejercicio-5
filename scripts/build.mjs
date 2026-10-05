#!/usr/bin/env node
/**
 * Prepara el directorio `dist/` con los archivos publicables.
 * Se ejecuta antes de subir el artefacto a GitHub Pages para no
 * publicar node_modules ni archivos de desarrollo.
 */

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const RAIZ = process.cwd();
const DESTINO = join(RAIZ, "dist");

const ARCHIVOS = ["index.html", "styles.css", "script.js"];

await rm(DESTINO, { recursive: true, force: true });
await mkdir(DESTINO, { recursive: true });

for (const archivo of ARCHIVOS) {
  await cp(join(RAIZ, archivo), join(DESTINO, archivo));
}

// GitHub Pages no procesa archivos que empiezan por _ (subrayado).
// .nojekyll desactiva Jekyll y sirve el contenido tal cual.
await writeFile(join(DESTINO, ".nojekyll"), "");

console.log(`dist/ preparado con: ${ARCHIVOS.join(", ")}`);