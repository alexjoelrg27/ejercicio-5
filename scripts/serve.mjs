#!/usr/bin/env node
/**
 * Servidor estatico minimo para las pruebas de Playwright.
 * Uso: node scripts/serve.mjs [puerto]
 */

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import process from "node:process";

const PUERTO = Number(process.argv[2] ?? 4173);
const RAIZ = process.cwd();

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const servidor = createServer(async (peticion, respuesta) => {
  const url = new URL(peticion.url ?? "/", `http://${peticion.headers.host}`);
  let ruta = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (ruta.endsWith("/")) ruta += "index.html";

  const completa = join(RAIZ, ruta);
  if (!completa.startsWith(RAIZ)) {
    respuesta.writeHead(403).end("403");
    return;
  }

  try {
    const info = await stat(completa);
    if (info.isDirectory()) {
      respuesta.writeHead(302, { location: `${ruta}/` }).end();
      return;
    }
    respuesta.writeHead(200, {
      "content-type": TIPOS[extname(completa).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(completa).pipe(respuesta);
  } catch {
    respuesta.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404");
  }
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log(`Servidor de pruebas en http://127.0.0.1:${PUERTO}`);
});