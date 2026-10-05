const CLAVE = "tareas";

const form = document.getElementById("form-agregar");
const input = document.getElementById("tarea");
const boton = document.getElementById("agregar");
const errorSpan = document.getElementById("tarea-error");
const lista = document.getElementById("lista");
const vacia = document.getElementById("lista-vacia");

function cargarTareas() {
  try {
    const guardadas = localStorage.getItem(CLAVE);
    const datos = guardadas ? JSON.parse(guardadas) : [];
    return Array.isArray(datos) ? datos.filter((t) => typeof t === "string") : [];
  } catch (error) {
    return [];
  }
}

let tareas = cargarTareas();

function guardarTareas() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(tareas));
  } catch (error) {
    mostrarError("No se pudo guardar la lista en este navegador.");
  }
}

function mostrarError(mensaje) {
  errorSpan.textContent = mensaje;
  input.setAttribute("aria-invalid", mensaje ? "true" : "false");
}

function renderizar() {
  lista.replaceChildren();

  tareas.forEach(function (texto, indice) {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.textContent = texto;

    const btnEliminar = document.createElement("button");
    btnEliminar.type = "button";
    btnEliminar.textContent = "Eliminar";
    // Nombre accesible unico: permite distinguir cada boton en la lista.
    btnEliminar.setAttribute("aria-label", `Eliminar tarea: ${texto}`);
    btnEliminar.dataset.indice = indice;

    li.append(span, btnEliminar);
    lista.appendChild(li);
  });

  vacia.hidden = tareas.length > 0;
}

form.addEventListener("submit", function (event) {
  event.preventDefault();

  const texto = input.value.trim();

  if (texto === "") {
    mostrarError("Escribe una tarea antes de agregar.");
    input.focus();
    return;
  }

  mostrarError("");
  tareas.push(texto);
  guardarTareas();
  renderizar();
  input.value = "";
  input.focus();
});

input.addEventListener("input", function () {
  if (errorSpan.textContent) {
    mostrarError("");
  }
});

lista.addEventListener("click", function (event) {
  const botonEliminado = event.target.closest("button[data-indice]");
  if (!botonEliminado) {
    return;
  }

  tareas.splice(Number(botonEliminado.dataset.indice), 1);
  guardarTareas();
  renderizar();
});

renderizar();