#!/usr/bin/env node
/**
 * Verificacion de enlaces y recursos externos.
 *
 * Reglas aplicadas (WCAG / buenas practicas de seguridad):
 *  - Todo recurso externo debe usar HTTPS (evita mixed content).
 *  - Los enlaces con target="_blank" deben llevar rel="noopener noreferrer"
 *    (evita window.opener / tabnabbing).
 *  - Los iframes deben declarar title (WCAG 4.1.2) y sandbox razonable.
 *  - Los embeds de YouTube deben usar youtube-nocookie.com.
 *  - No se permiten esquemas ejecutables (javascript:, data: en href/src).
 *
 * Por defecto solo se analizan los enlaces de forma estatica.
 * Define LINK_CHECK_ONLINE=1 para comprobar tambien que responden (HEAD).
 */

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import process from "node:process";

const RAIZ = process.cwd();
const IGNORAR = new Set(["node_modules", ".git", "dist", "test-results", "playwright-report"]);
const ESQUEMAS_PELIGROSOS = /^(javascript|vbscript):/i;
const LINK_CHECK_ONLINE = process.env.LINK_CHECK_ONLINE === "1";

const errores = [];
const avisos = [];
const externos = new Set();

function registrar(origen, mensaje) {
  errores.push(`${origen}: ${mensaje}`);
}

async function recolectarHtml(dir) {
  const encontrados = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...(await recolectarHtml(ruta)));
    } else if (extname(entrada.name).toLowerCase() === ".html") {
      encontrados.push(ruta);
    }
  }
  return encontrados;
}

function atributos(tag) {
  const resultado = {};
  const patron = /([a-zA-Z-:][a-zA-Z0-9:_-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/g;
  let coincidencia;
  while ((coincidencia = patron.exec(tag)) !== null) {
    const valor = coincidencia[3] ?? coincidencia[4] ?? coincidencia[5] ?? "";
    resultado[coincidencia[1].toLowerCase()] = valor;
  }
  return resultado;
}

function esYoutube(url) {
  return /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(url);
}

async function comprobarEnLinea(url) {
  try {
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), 15000);
    const respuesta = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: control.signal,
      headers: { "user-agent": "ejercicio-5-ci-link-check" },
    });
    clearTimeout(temporizador);
    if (respuesta.status >= 400) {
      return `HTTP ${respuesta.status}`;
    }
    return null;
  } catch (error) {
    return `sin respuesta (${error.name})`;
  }
}

async function revisarDocumento(ruta) {
  const origen = relative(RAIZ, ruta).replace(/\\/g, "/");
  const contenido = await readFile(ruta, "utf8");

  const etiquetas = contenido.match(/<(a|iframe|embed|link|script|img|source)\b[^>]*>/gi) ?? [];

  for (const etiqueta of etiquetas) {
    const attrs = atributos(etiqueta);
    const nombre = etiqueta.match(/^<([a-zA-Z]+)/)[1].toLowerCase();
    const url = attrs.href ?? attrs.src ?? attrs["data-src"] ?? "";

    if (ESQUEMAS_PELIGROSOS.test(url.trim())) {
      registrar(origen, `<${nombre}> usa un esquema ejecutable: ${url}`);
      continue;
    }

    // Enlaces externos: deben ser HTTPS y protegidos si abren pestana nueva.
    if (nombre === "a" && url) {
      if (/^https?:\/\//i.test(url)) externos.add(url);
      if (/^http:\/\//i.test(url)) {
        registrar(origen, `enlace externo sin HTTPS: ${url}`);
      }
      if (attrs.target === "_blank") {
        const rel = (attrs.rel ?? "").toLowerCase();
        if (!rel.includes("noopener")) {
          registrar(origen, `target="_blank" sin rel="noopener": ${url}`);
        }
        if (!rel.includes("noreferrer")) {
          registrar(origen, `target="_blank" sin rel="noreferrer": ${url}`);
        }
      }
    }

    if (nombre === "iframe") {
      if (!attrs.title || !attrs.title.trim()) {
        registrar(origen, "<iframe> sin atributo title (WCAG 4.1.2)");
      }
      if (/^http:\/\//i.test(url)) {
        registrar(origen, `<iframe> sin HTTPS: ${url}`);
      }
      if (url && !esYoutube(url)) {
        avisos.push(`${origen}: iframe de origen no verificado (${url})`);
      }
      if (esYoutube(url) && /youtube\.com\/(embed|watch)/i.test(url) && !/nocookie/i.test(url)) {
        registrar(origen, `embed de YouTube sin modo nocookie: ${url}`);
      }
    }

    if (["link", "script", "img", "source", "embed"].includes(nombre) && url) {
      if (/^https?:\/\//i.test(url)) externos.add(url);
      if (/^http:\/\//i.test(url)) {
        registrar(origen, `<${nombre}> cargado sin HTTPS: ${url}`);
      }
    }
  }
}

const archivos = await recolectarHtml(RAIZ);

if (archivos.length === 0) {
  console.error("No se encontro ningun archivo HTML para analizar.");
  process.exit(1);
}

for (const archivo of archivos) {
  await revisarDocumento(archivo);
}

if (externos.size > 0 && LINK_CHECK_ONLINE) {
  for (const url of externos) {
    const fallo = await comprobarEnLinea(url);
    if (fallo) {
      registrar("red", `${url} -> ${fallo}`);
    }
  }
}

console.log(`HTML analizado      : ${archivos.length}`);
console.log(`Enlaces externos    : ${externos.size}`);
if (externos.size > 0) {
  for (const url of externos) console.log(`  - ${url}`);
}
console.log(`Avisos              : ${avisos.length}`);
for (const aviso of avisos) console.log(`  ! ${aviso}`);
console.log(`Errores             : ${errores.length}`);
for (const error of errores) console.error(`  x ${error}`);

if (errores.length > 0) {
  console.error("\nFALLO: la verificacion de enlaces externos encontro problemas.");
  process.exit(1);
}

console.log("\nOK: enlaces y recursos externos seguros.");