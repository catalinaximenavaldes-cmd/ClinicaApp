const URL =
  typeof CONFIG !== "undefined" && CONFIG.API_URL
    ? CONFIG.API_URL
    : "https://script.google.com/macros/s/AKfycbz_o5PPXlSY8Q7kcIwKjVETz5m-lhU7TxZO84bo9OSE8zf8qsB0Fd6kijopc4gWy94/exec";

let pacientes = {};
let historialPacientes = {};
let diagnosticosMap = {};
let pacienteEditando = "";
let historialCargado = false;
let historialCargaPromise = null;
let tratamientosCache = null;
let sesionesCache = null;

function escapeHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizarFechaInput(valor) {
  if (!valor) return "";
  if (typeof valor === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
    if (/^\d{4}-\d{2}-\d{2}T/.test(valor)) return valor.slice(0, 10);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(valor)) {
      const [dia, mes, anio] = valor.split("/");
      return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    }
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function normalizarFechaRegistro(valor) {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? new Date() : fecha;
}

function formatearFechaHora(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "Sin fecha";
  return fecha.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatearFechaNacimiento(valor) {
  const fechaIso = normalizarFechaInput(valor);
  if (!fechaIso) return "No registrada";
  const [anio, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}/${anio}`;
}

function calcularEdadDesdeFecha(valor) {
  const fechaIso = normalizarFechaInput(valor);
  if (!fechaIso) return "";
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  const mesActual = hoy.getMonth() + 1;
  const diaActual = hoy.getDate();
  if (mesActual < mes || (mesActual === mes && diaActual < dia)) edad--;
  return edad >= 0 ? edad : "";
}

function agregarAlHistorial(nombre, item) {
  if (!nombre) return;
  if (!historialPacientes[nombre]) historialPacientes[nombre] = [];
  historialPacientes[nombre].push(item);
}

function reconstruirHistorialDesdePacientes() {
  historialPacientes = {};

  Object.keys(pacientes).forEach(nombre => {
    const registros = [...(pacientes[nombre] || [])].sort((a, b) => a.fecha - b.fecha);
    registros.forEach((registro, index) => {
      if (!registro.evolucion) return;
      agregarAlHistorial(nombre, {
        fecha: registro.fecha,
        evolucion: registro.evolucion,
        tabla: "Hoja 1",
        tipo: index === 0 ? "Ingreso" : "Evolucion"
      });
    });
  });
}

function getPrimerRegistro(nombre) {
  const lista = pacientes[nombre] || [];
  if (!lista.length) return null;
  return [...lista].sort((a, b) => a.fecha - b.fecha)[0];
}

function getDiagnosticoActual(nombre) {
  return diagnosticosMap[nombre] || "";
}

async function cargarBaseDatos() {
  const lista = document.getElementById("lista");

  try {
    const resPacientes = await fetch(URL);
    const dataPacientes = await resPacientes.json();

    if (!Array.isArray(dataPacientes)) {
      throw new Error("Respuesta invalida del servidor");
    }

    pacientes = {};
    historialPacientes = {};
    diagnosticosMap = {};
    historialCargado = false;
    historialCargaPromise = null;
    tratamientosCache = null;
    sesionesCache = null;

    for (let i = 1; i < dataPacientes.length; i++) {
      const fila = dataPacientes[i] || [];
      const nombre = (fila[1] || "").toString().trim();
      if (!nombre) continue;

      if (!pacientes[nombre]) pacientes[nombre] = [];

      pacientes[nombre].push({
        fecha: normalizarFechaRegistro(fila[0]),
        rut: fila[2] || "",
        fechaNacimiento: fila[3] || "",
        edad: fila[4] || "",
        direccion: fila[5] || "",
        telefono: fila[6] || "",
        correo: fila[7] || "",
        evolucion: fila[8] || "",
        tratamientoActivo: fila[9] || ""
      });
    }

    reconstruirHistorialDesdePacientes();
    mostrarLista();

    const pacienteGuardado = localStorage.getItem("pacienteActual") || "";
    const volverAFichaPaciente = localStorage.getItem("volverAFichaPaciente") === "1";
    if (volverAFichaPaciente && pacienteGuardado && pacientes[pacienteGuardado]) {
      localStorage.removeItem("volverAFichaPaciente");
      verPaciente(pacienteGuardado);
    }
  } catch (error) {
    console.error("Error al conectar:", error);
    if (lista) lista.innerHTML = "Error al conectar.";
  }
}

async function cargarHistorialCompleto() {
  if (historialCargado) return;
  if (historialCargaPromise) {
    await historialCargaPromise;
    return;
  }

  historialCargaPromise = (async () => {
    reconstruirHistorialDesdePacientes();

    const pedidos = [
      fetch(URL + "?tabla=Documentos").then(r => r.json()).catch(() => []),
      fetch(URL + "?tabla=Diagnosticos").then(r => r.json()).catch(() => [])
    ];

    const [dataDocumentos, dataDiagnosticos] = await Promise.all(pedidos);

    if (Array.isArray(dataDocumentos)) {
      for (let i = 1; i < dataDocumentos.length; i++) {
        const fila = dataDocumentos[i] || [];
        agregarAlHistorial(fila[1], {
          fecha: normalizarFechaRegistro(fila[0]),
          evolucion: fila[4] || "",
          tabla: "Documentos",
          tipo: fila[3] || "Documento"
        });
      }
    }

    if (Array.isArray(dataDiagnosticos)) {
      diagnosticosMap = {};
      for (let i = 1; i < dataDiagnosticos.length; i++) {
        const fila = dataDiagnosticos[i] || [];
        const nombre = (fila[0] || "").toString().trim();
        if (!nombre) continue;
        diagnosticosMap[nombre] = fila[1] || "";
      }
    }

    historialCargado = true;
  })();

  try {
    await historialCargaPromise;
  } finally {
    historialCargaPromise = null;
  }
}

function mostrarLista() {
  const lista = document.getElementById("lista");
  document.getElementById("btnVolverLista").style.display = "none";
  document.getElementById("titulo-pagina").innerText = "Pacientes ingresados";

  const nombres = Object.keys(pacientes).sort((a, b) => a.localeCompare(b, "es"));
  if (!nombres.length) {
    lista.innerHTML = "<p>No hay pacientes.</p>";
    return;
  }

  lista.innerHTML = nombres
    .map(nombre => `<div class="card-paciente" onclick="verPaciente('${escapeHtml(nombre)}')">${escapeHtml(nombre)}</div>`)
    .join("");
}

async function verPaciente(nombre) {
  const perfil = getPrimerRegistro(nombre);
  if (!perfil) return;

  localStorage.setItem("pacienteActual", nombre);
  document.getElementById("btnVolverLista").style.display = "block";
  document.getElementById("titulo-pagina").innerText = "Expediente Completo";

  document.getElementById("lista").innerHTML = `
    <div class="perfil-paciente">
      <h3 style="display:flex; justify-content:space-between; align-items:center;">
        <span>Ficha: ${escapeHtml(nombre)}</span>
        <button class="btn-editar-ficha" onclick="abrirModalEdicion('${escapeHtml(nombre)}')" title="Editar ficha" aria-label="Editar ficha">&#9998;</button>
      </h3>
      <div class="datos-personales">
        <p><strong>RUT:</strong> ${escapeHtml(perfil.rut || "No registrado")}</p>
        <p><strong>Fecha de nacimiento:</strong> ${escapeHtml(formatearFechaNacimiento(perfil.fechaNacimiento))}</p>
        <p><strong>Edad:</strong> ${escapeHtml(String(perfil.edad || calcularEdadDesdeFecha(perfil.fechaNacimiento) || "No registrada"))} anos</p>
        <p><strong>Direccion:</strong> ${escapeHtml(perfil.direccion || "No registrada")}</p>
        <p><strong>Telefono:</strong> ${escapeHtml(perfil.telefono || "No registrado")}</p>
        <p><strong>Correo:</strong> ${escapeHtml(perfil.correo || "No registrado")}</p>
        <p><strong>Tratamiento activo:</strong> ${escapeHtml(perfil.tratamientoActivo || "No registrado")}</p>
        <div class="contenedor-diagnostico no-print">
          <h4>Diagnostico Principal</h4>
          <textarea id="txt-diagnostico" placeholder="Cargando..."></textarea>
          <button onclick="guardarDiagnostico('${escapeHtml(nombre)}')" style="background:#2980b9; color:white; padding:10px; border-radius:8px; margin-top:5px; border:none; width:100%; font-weight:bold; cursor:pointer;">Guardar Diagnostico</button>
        </div>
      </div>
      <div class="columna-botones no-print">
        <button class="btn-sesiones" onclick="toggleSesiones('${escapeHtml(nombre)}')">Ver Sesiones Realizadas</button>
        <button onclick="imprimirCarta('${escapeHtml(nombre)}')" style="background:#34495e; color:white;">Imprimir Ficha</button>
        <button class="btn-guardar" onclick="window.location.href='evolucion.html'">Nueva Evolucion</button>
        <button class="btn-documentos" onclick="window.location.href='documentos.html'">Recetas y Examenes</button>
        <button onclick="window.location.href='imagenes-paciente.html'" style="background:#8e44ad; color:white;">Imagenes</button>
        <button onclick="altaPaciente('${escapeHtml(nombre)}')" style="background:#e67e22; color:white;">Dar de Alta</button>
        <button onclick="eliminarPacienteCompleto('${escapeHtml(nombre)}')" style="background:#c0392b; color:white;">Eliminar</button>
      </div>
      <div id="visor-sesiones" class="visor-sesiones no-print"></div>
      <div class="card-agendar no-print">
        <h4>Agendar Proxima Cita</h4>
        <div class="form-agenda">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <input type="date" id="fecha-cita">
            <input type="time" id="hora-cita">
          </div>
          <select id="select-tratamiento-cita"><option value="">-- Seleccionar Tratamiento --</option></select>
          <button class="btn-confirmar-cita" onclick="enviarAAgenda('${escapeHtml(nombre)}')">Guardar en Agenda</button>
        </div>
      </div>
    </div>
    <div id="historial-atenciones">
      <h4 style="color:#2c3e50; margin: 20px 0 10px 10px;" class="no-print">Historial de Atenciones</h4>
      <p style="margin:10px;" class="no-print">Cargando historial...</p>
    </div>
  `;

  abrirModalEdicionEstado(nombre);
  cargarTratamientos();
  cargarDiagnostico(nombre);

  try {
    await cargarHistorialCompleto();
  } catch (error) {
    console.error("Error al cargar historial:", error);
  }

  renderizarHistorial(nombre);
}

function renderizarHistorial(nombre) {
  const contenedor = document.getElementById("historial-atenciones");
  if (!contenedor) return;

  const registrosCronologicos = [...(historialPacientes[nombre] || [])].sort((a, b) => a.fecha - b.fecha);
  const registros = [...registrosCronologicos].reverse();
  let html = '<h4 style="color:#2c3e50; margin: 20px 0 10px 10px;" class="no-print">Historial de Atenciones</h4>';

  if (!registros.length) {
    contenedor.innerHTML = html + '<p style="margin:10px;">No hay evoluciones ni documentos registrados.</p>';
    return;
  }

  html += registros
    .map((registro, index) => {
      const abierta = index === 0;
      const numero = registrosCronologicos.findIndex(item => item === registro) + 1;
      return `
        <div class="contenedor-acordeon">
          <div class="header-nota ${abierta ? "abierto" : ""}" onclick="toggleNota(this)">
            <span>${numero}- ${escapeHtml(registro.tipo || "Registro")} - ${escapeHtml(formatearFechaHora(registro.fecha))}</span>
            <span>&#9662;</span>
          </div>
          <div class="contenido-nota" style="display:${abierta ? "block" : "none"};">
            <p style="white-space:pre-wrap;">${escapeHtml(registro.evolucion || "")}</p>
            <button class="no-print" onclick="eliminarNota('${escapeHtml(nombre)}', '${registro.fecha.toISOString()}', '${escapeHtml(registro.tabla || "Evoluciones")}')" style="background:none; border:none; color:red; cursor:pointer; font-size:12px; padding:0; text-decoration:underline;">Eliminar entrada</button>
          </div>
        </div>
      `;
    })
    .join("");

  contenedor.innerHTML = html;
}

function abrirModalEdicionEstado(nombre) {
  const perfil = getPrimerRegistro(nombre);
  if (!perfil) return;
  pacienteEditando = perfil.rut || "";
}

function abrirModalEdicion(nombre) {
  const perfil = getPrimerRegistro(nombre);
  if (!perfil) return;

  pacienteEditando = perfil.rut || "";
  document.getElementById("modal-nombre").value = nombre;
  document.getElementById("modal-rut").value = perfil.rut || "";
  document.getElementById("modal-fecha-nacimiento").value = normalizarFechaInput(perfil.fechaNacimiento);
  document.getElementById("modal-direccion").value = perfil.direccion || "";
  document.getElementById("modal-telefono").value = perfil.telefono || "";
  document.getElementById("modal-correo").value = perfil.correo || "";
  document.getElementById("modal-tratamiento-activo").value = perfil.tratamientoActivo || "";
  document.getElementById("modal-edicion").style.display = "block";
}

function cerrarModal() {
  document.getElementById("modal-edicion").style.display = "none";
}

async function guardarEdicionPaciente() {
  const datos = {
    accion: "editarFichaCompleta",
    rutOriginal: pacienteEditando,
    nombre: document.getElementById("modal-nombre").value.trim(),
    rut: document.getElementById("modal-rut").value.trim(),
    fechaNac: document.getElementById("modal-fecha-nacimiento").value,
    direccion: document.getElementById("modal-direccion").value.trim(),
    telefono: document.getElementById("modal-telefono").value.trim(),
    correo: document.getElementById("modal-correo").value.trim(),
    tratamiento_activo: document.getElementById("modal-tratamiento-activo").value.trim(),
    tratamientoActivo: document.getElementById("modal-tratamiento-activo").value.trim()
  };

  try {
    await fetch(URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });

    alert("Paciente actualizado");
    cerrarModal();
    location.reload();
  } catch (error) {
    alert("No se pudo actualizar el paciente");
  }
}

async function cargarDiagnostico(nombre) {
  const textarea = document.getElementById("txt-diagnostico");
  if (!textarea) return;

  textarea.value = getDiagnosticoActual(nombre);
  textarea.placeholder = "Escriba el diagnostico principal...";

  if (historialCargado) return;

  try {
    await cargarHistorialCompleto();
    textarea.value = getDiagnosticoActual(nombre);
  } catch (error) {
    console.error("Error al cargar diagnostico:", error);
    textarea.placeholder = "No se pudo cargar el diagnostico";
  }
}

async function guardarDiagnostico(nombre) {
  const textarea = document.getElementById("txt-diagnostico");
  const diagnostico = textarea ? textarea.value.trim() : "";

  try {
    await fetch(URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "actualizarDiagnostico",
        nombre,
        diagnostico
      })
    });

    diagnosticosMap[nombre] = diagnostico;
    alert("Diagnostico actualizado");
  } catch (error) {
    alert("No se pudo guardar el diagnostico");
  }
}

async function cargarTratamientos() {
  const select = document.getElementById("select-tratamiento-cita");
  if (!select) return;

  if (tratamientosCache) {
    renderizarTratamientos(tratamientosCache, select);
    return;
  }

  try {
    const res = await fetch(URL + "?tabla=Tratamientos");
    const data = await res.json();
    tratamientosCache = Array.isArray(data) ? data : [];
    renderizarTratamientos(tratamientosCache, select);
  } catch (error) {
    console.error("Error al cargar tratamientos:", error);
    select.innerHTML = '<option value="">Error al cargar tratamientos</option>';
  }
}

function renderizarTratamientos(data, select) {
  const unicos = [...new Set(data.slice(1).map(fila => (fila[0] || "").toString().trim()).filter(Boolean))];
  select.innerHTML = '<option value="">-- Seleccionar Tratamiento --</option>';
  unicos.forEach(tratamiento => {
    const option = document.createElement("option");
    option.value = tratamiento;
    option.textContent = tratamiento;
    select.appendChild(option);
  });
}

async function enviarAAgenda(nombrePaciente) {
  const fecha = document.getElementById("fecha-cita")?.value;
  const hora = document.getElementById("hora-cita")?.value;
  const tratamiento = document.getElementById("select-tratamiento-cita")?.value;

  if (!fecha || !hora || !tratamiento) {
    alert("Completa fecha, hora y tratamiento para agendar la cita.");
    return;
  }

  try {
    await fetch(URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "crearCita",
        fecha,
        hora,
        paciente: nombrePaciente,
        tratamiento
      })
    });

    alert("Cita agendada correctamente.");
    document.getElementById("fecha-cita").value = "";
    document.getElementById("hora-cita").value = "";
    document.getElementById("select-tratamiento-cita").value = "";
  } catch (error) {
    alert("No se pudo agendar la cita.");
  }
}

async function toggleSesiones(nombre) {
  const visor = document.getElementById("visor-sesiones");
  if (!visor) return;

  if (visor.style.display === "block") {
    visor.style.display = "none";
    return;
  }

  visor.style.display = "block";
  visor.innerHTML = "<p>Cargando sesiones...</p>";

  try {
    if (!sesionesCache) {
      const res = await fetch(URL + "?tabla=Sesiones");
      const data = await res.json();
      sesionesCache = Array.isArray(data) ? data : [];
    }

    const sesiones = sesionesCache
      .slice(1)
      .filter(fila => (fila[1] || "").toString().trim() === nombre)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]));

    if (!sesiones.length) {
      visor.innerHTML = "<p>No hay sesiones registradas.</p>";
      return;
    }

    visor.innerHTML = sesiones
      .map((fila, index) => {
        const fecha = fila[0] ? formatearFechaHora(fila[0]) : "Sin fecha";
        const tratamiento = fila[2] || "Sin tratamiento";
        return `
          <div class="sesion-item">
            <div><strong>Sesion ${index + 1}: ${escapeHtml(tratamiento)}</strong></div>
            <div class="sesion-fecha">${escapeHtml(fecha)}</div>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    visor.innerHTML = "<p>No se pudieron cargar las sesiones.</p>";
  }
}

function toggleNota(elemento) {
  elemento.classList.toggle("abierto");
  const contenido = elemento.nextElementSibling;
  if (contenido) {
    contenido.style.display = contenido.style.display === "block" ? "none" : "block";
  }
}

async function eliminarNota(nombre, fecha, tabla = "Evoluciones") {
  if (!confirm("Deseas eliminar esta entrada del historial?")) {
    return;
  }

  try {
    await fetch(URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "eliminarNota",
        nombre,
        fecha,
        tabla
      })
    });

    alert("Entrada eliminada.");
    location.reload();
  } catch (error) {
    alert("No se pudo eliminar la entrada.");
  }
}

async function altaPaciente(nombre) {
  if (!confirm(`Dar de alta a ${nombre} y mover su ficha a historicos?`)) {
    return;
  }

  try {
    await fetch(URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "alta",
        nombre
      })
    });

    alert("Paciente dado de alta.");
    window.location.href = "historicos.html";
  } catch (error) {
    alert("No se pudo dar de alta al paciente.");
  }
}

async function eliminarPacienteCompleto(nombre) {
  const perfil = getPrimerRegistro(nombre);
  if (!perfil) {
    alert("No se encontro el paciente.");
    return;
  }

  if (!confirm(`Deseas eliminar por completo a ${nombre}? Esta accion borrara toda su ficha.`)) {
    return;
  }

  try {
    await fetch(URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "eliminarCompleto",
        nombre,
        rut: perfil.rut || ""
      })
    });

    alert("Paciente eliminado completamente.");
    location.reload();
  } catch (error) {
    alert("No se pudo eliminar el paciente.");
  }
}

function solicitarIndicacionesResumen() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.45)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "16px";
    overlay.style.zIndex = "2000";

    const modal = document.createElement("div");
    modal.style.background = "#fff";
    modal.style.width = "min(640px, 100%)";
    modal.style.borderRadius = "14px";
    modal.style.padding = "18px";
    modal.style.boxShadow = "0 12px 30px rgba(0,0,0,0.2)";

    modal.innerHTML = `
      <h3 style="margin:0 0 10px; color:#2c3e50;">Indicaciones/Resumen</h3>
      <p style="margin:0 0 12px; color:#5b6b7a;">Escribe un resumen breve para incluir en la ficha impresa.</p>
      <textarea id="textarea-resumen-impresion" style="width:100%; min-height:180px; border:1px solid #cfd8e3; border-radius:10px; padding:12px; box-sizing:border-box; resize:vertical;"></textarea>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:12px; flex-wrap:wrap;">
        <button type="button" id="cancelar-resumen-impresion" style="padding:10px 14px; border:none; border-radius:8px; background:#ecf0f1; cursor:pointer;">Cancelar</button>
        <button type="button" id="aceptar-resumen-impresion" style="padding:10px 14px; border:none; border-radius:8px; background:#34495e; color:white; cursor:pointer;">Continuar e Imprimir</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const textarea = modal.querySelector("#textarea-resumen-impresion");
    const cerrar = valor => {
      overlay.remove();
      resolve(valor);
    };

    modal.querySelector("#cancelar-resumen-impresion").onclick = () => cerrar(null);
    modal.querySelector("#aceptar-resumen-impresion").onclick = () => cerrar(textarea.value.trim());
    overlay.onclick = event => {
      if (event.target === overlay) cerrar(null);
    };

    textarea.focus();
  });
}

async function imprimirCarta(nombre) {
  const perfil = getPrimerRegistro(nombre);
  if (!perfil) {
    alert("No se encontro la ficha del paciente.");
    return;
  }

  const diagnostico = document.getElementById("txt-diagnostico")?.value?.trim() || getDiagnosticoActual(nombre) || "No registrado";
  const resumenIndicaciones = await solicitarIndicacionesResumen();
  if (resumenIndicaciones === null) {
    return;
  }
  const fechaEmision = new Date().toLocaleDateString("es-CL");

  const ventana = window.open("", "_blank", "width=900,height=1200");
  if (!ventana) {
    alert("No se pudo abrir la vista de impresion.");
    return;
  }

  ventana.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ficha - ${escapeHtml(nombre)}</title>
      <style>
        body { font-family: Arial, sans-serif; color:#111827; margin:0; padding:32px; background:#ffffff; }
        h1, h2 { margin-bottom: 10px; }
        .seccion { margin-top: 26px; }
        .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .campo { padding:10px 12px; border:1px solid #d7dee7; border-radius:10px; background:#fbfdff; }
        .encabezado { display:flex; align-items:center; gap:16px; margin-bottom:20px; padding-bottom:18px; border-bottom:3px solid #d9e4ec; }
        .encabezado img { width:72px; height:72px; object-fit:contain; }
        .encabezado-texto h1 { margin:0 0 4px; color:#23445a; }
        .encabezado-texto p { margin:0; color:#5b6b7a; }
        .fecha-emision { color:#4b5563; margin:0; }
        .seccion h2 { color:#23445a; border-bottom:1px solid #dbe5ec; padding-bottom:6px; }
        .pie { margin-top:32px; padding-top:18px; border-top:2px solid #d9e4ec; color:#334155; display:grid; grid-template-columns:1.1fr 1fr; gap:24px; }
        .pie h3 { margin:0 0 10px; font-size:20px; color:#23445a; }
        .pie p { margin:0; line-height:1.7; color:#475569; }
        .pie-contacto h4 { margin:0 0 12px; font-size:18px; color:#23445a; }
        .pie-contacto div { margin-bottom:10px; color:#334155; }
      </style>
    </head>
    <body>
      <div class="encabezado">
        <img src="logoclinica.png" alt="Logo CliniBienVital">
        <div class="encabezado-texto">
          <h1>Ficha Clinica</h1>
          <p>CliniBienVital</p>
        </div>
      </div>
      <p class="fecha-emision"><strong>Fecha de emision:</strong> ${escapeHtml(fechaEmision)}</p>
      <div class="seccion">
        <h2>${escapeHtml(nombre)}</h2>
        <div class="grid">
          <div class="campo"><strong>RUT:</strong> ${escapeHtml(perfil.rut || "No registrado")}</div>
          <div class="campo"><strong>Fecha de nacimiento:</strong> ${escapeHtml(formatearFechaNacimiento(perfil.fechaNacimiento))}</div>
          <div class="campo"><strong>Edad:</strong> ${escapeHtml(String(perfil.edad || calcularEdadDesdeFecha(perfil.fechaNacimiento) || "No registrada"))}</div>
          <div class="campo"><strong>Telefono:</strong> ${escapeHtml(perfil.telefono || "No registrado")}</div>
          <div class="campo"><strong>Correo:</strong> ${escapeHtml(perfil.correo || "No registrado")}</div>
          <div class="campo"><strong>Direccion:</strong> ${escapeHtml(perfil.direccion || "No registrada")}</div>
          <div class="campo"><strong>Tratamiento activo:</strong> ${escapeHtml(perfil.tratamientoActivo || "No registrado")}</div>
        </div>
      </div>
      <div class="seccion">
        <h2>Diagnostico principal</h2>
        <p>${escapeHtml(diagnostico)}</p>
      </div>
      <div class="seccion">
        <h2>Indicaciones/Resumen</h2>
        <div class="campo" style="min-height:140px; white-space:pre-wrap;">${escapeHtml(resumenIndicaciones || "").replace(/\n/g, "<br>") || "Sin indicaciones."}</div>
      </div>
      <div class="pie">
        <div>
          <h3>CliniBienVital</h3>
          <p>
            Centro orientado a la atencion integral,
            la rehabilitacion funcional y el bienestar
            de cada paciente.
          </p>
        </div>
        <div class="pie-contacto">
          <h4>Contacto</h4>
          <div>Telefono: +56 9 9837 7622</div>
          <div>Correo: clinibienvital@gmail.com</div>
          <div>Direccion: Av. Echeñique 5037, Ñuñoa, Santiago</div>
          <div>Web: clinibienvital.cl</div>
        </div>
      </div>
    </body>
    </html>
  `);
  ventana.document.close();
  ventana.focus();
  ventana.print();
}

cargarBaseDatos();

