const URL = CONFIG.API_URL;
let pacientes = {};
let historialPacientes = {};
let pacienteEditando = "";

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

function normalizarFechaRegistro(valor) {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? new Date() : fecha;
}

function agregarAlHistorial(nombre, item) {
  if (!nombre) return;
  if (!historialPacientes[nombre]) historialPacientes[nombre] = [];
  historialPacientes[nombre].push(item);
}

async function cargarBaseDatos() {
  try {
    const [resPacientes, resEvoluciones, resDocumentos] = await Promise.all([
      fetch(URL),
      fetch(URL + "?tabla=Evoluciones"),
      fetch(URL + "?tabla=Documentos")
    ]);

    const [dataPacientes, dataEvoluciones, dataDocumentos] = await Promise.all([
      resPacientes.json(),
      resEvoluciones.json(),
      resDocumentos.json()
    ]);

    pacientes = {};
    historialPacientes = {};

    for (let i = 1; i < dataPacientes.length; i++) {
      const fila = dataPacientes[i];
      const nombre = fila[1];
      if (!nombre) continue;
      if (!pacientes[nombre]) pacientes[nombre] = [];
      pacientes[nombre].push({
        fecha: normalizarFechaRegistro(fila[0]),
        rut: fila[2],
        fechaNacimiento: fila[3],
        edad: fila[4],
        direccion: fila[5],
        telefono: fila[6],
        correo: fila[7],
        evolucion: fila[8],
        tratamientoActivo: fila[9]
      });

    }

    for (let i = 1; i < dataEvoluciones.length; i++) {
      const fila = dataEvoluciones[i];
      agregarAlHistorial(fila[1], {
        fecha: normalizarFechaRegistro(fila[0]),
        evolucion: fila[3] || "",
        tabla: "Evoluciones",
        tipo: "Evolucion"
      });
    }

    for (let i = 1; i < dataDocumentos.length; i++) {
      const fila = dataDocumentos[i];
      agregarAlHistorial(fila[1], {
        fecha: normalizarFechaRegistro(fila[0]),
        evolucion: fila[4] || "",
        tabla: "Documentos",
        tipo: fila[3] || "Documento"
      });
    }

    mostrarLista();
  } catch (error) {
    console.error("Error al conectar:", error);
    document.getElementById("lista").innerHTML = "Error al conectar.";
  }
}

cargarBaseDatos();

function mostrarLista() {
  document.getElementById("btnVolverLista").style.display = "none";
  document.getElementById("titulo-pagina").innerText = "Pacientes ingresados";
  let html = "";
  for (const nombre in pacientes) {
    html += `<div class="card-paciente" onclick="verPaciente('${nombre}')">👤 ${nombre}</div>`;
  }
  document.getElementById("lista").innerHTML = html || "<p>No hay pacientes.</p>";
}

function verPaciente(nombre) {
  localStorage.setItem("pacienteActual", nombre);
  document.getElementById("btnVolverLista").style.display = "block";
  document.getElementById("titulo-pagina").innerText = "Expediente Completo";

  const registros = [...(historialPacientes[nombre] || [])].sort((a, b) => b.fecha - a.fecha);
  const perfil = [...pacientes[nombre]].sort((a, b) => a.fecha - b.fecha)[0];

  const html = `
    <div class="perfil-paciente">
        <h3 style="display:flex; justify-content:space-between; align-items:center;">
            <span>Ficha: ${nombre}</span>
            <button class="btn-editar-ficha" onclick="abrirModalEdicion('${nombre}')" title="Editar ficha" aria-label="Editar ficha">✏️</button>
        </h3>
        <div class="datos-personales">
            <p><strong>🆔 RUT:</strong> ${perfil.rut || 'No registrado'}</p>
            <p><strong>🎂 Fecha de nacimiento:</strong> ${formatearFechaNacimiento(perfil.fechaNacimiento)}</p>
            <p><strong>📅 Edad:</strong> ${perfil.edad || calcularEdadDesdeFecha(perfil.fechaNacimiento) || 'No registrada'} años</p>
            <p><strong>🏠 Dirección:</strong> ${perfil.direccion || 'No registrada'}</p>
            <p><strong>📞 Teléfono:</strong> ${perfil.telefono || 'No registrado'}</p>
            <p><strong>📧 Correo:</strong> ${perfil.correo || 'No registrado'}</p>
            <p><strong>💉 Tratamiento Activo:</strong> ${perfil.tratamientoActivo || 'No registrado'}</p>
            <div class="contenedor-diagnostico no-print">
                <h4>📋 Diagnóstico Principal</h4>
                <textarea id="txt-diagnostico" placeholder="Cargando..."></textarea>
                <button onclick="guardarDiagnostico('${nombre}')" style="background:#2980b9; color:white; padding:10px; border-radius:8px; margin-top:5px; border:none; width:100%; font-weight:bold; cursor:pointer;">Guardar Diagnóstico</button>
            </div>
        </div>
        <div class="columna-botones no-print">
            <button class="btn-sesiones" onclick="toggleSesiones('${nombre}')">📊 Ver Sesiones Realizadas</button>
            <button onclick="imprimirCarta(localStorage.getItem('pacienteActual'))" style="background:#34495e; color:white;">🖨️ Imprimir Ficha</button>
            <button class="btn-guardar" onclick="window.location.href='evolución.html'">➕ Nueva Evolución</button>
            <button class="btn-documentos" onclick="window.location.href='documentos.html'">📄 Recetas y Exámenes</button>
            <button onclick="window.location.href='imagenes-paciente.html'" style="background:#8e44ad; color:white;">Im�genes</button>
            <button onclick="altaPaciente('${nombre}')" style="background:#e67e22; color:white;">🏥 Dar de Alta</button>
            <button onclick="eliminarPacienteCompleto('${nombre}')" style="background:#c0392b; color:white;">🗑️ Eliminar</button>
        </div>
        <div id="visor-sesiones" class="visor-sesiones no-print"></div>
        <div class="card-agendar no-print">
            <h4>📅 Agendar Próxima Cita</h4>
            <div class="form-agenda">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <input type="date" id="fecha-cita">
                    <input type="time" id="hora-cita">
                </div>
                <select id="select-tratamiento-cita"><option value="">-- Seleccionar Tratamiento --</option></select>
                <button class="btn-confirmar-cita" onclick="enviarAAgenda('${nombre}')">Guardar en Agenda</button>
            </div>
        </div>
    </div>
    <h4 style="color:#2c3e50; margin: 20px 0 10px 10px;" class="no-print">Historial de Atenciones</h4>
  `;

  document.getElementById("lista").innerHTML = html;
  cargarTratamientos();
  cargarDiagnostico(nombre);

  if (!registros.length) {
    document.getElementById("lista").insertAdjacentHTML("beforeend", '<p style="margin:10px;">No hay evoluciones ni documentos registrados.</p>');
    return;
  }

  registros.forEach((e, index) => {
    const displayStyle = index === 0 ? "block" : "none";
    const abiertoClase = index === 0 ? "abierto" : "";
    const notaHtml = `
      <div class="contenedor-acordeon">
          <div class="header-nota ${abiertoClase}" onclick="toggleNota(this)">
              <span>${e.tipo || 'Registro'} - ${e.fecha.toLocaleString()}</span>
              <span>▼</span>
          </div>
          <div class="contenido-nota" style="display: ${displayStyle}">
              <p style="white-space: pre-wrap;">${e.evolucion || ''}</p>
              <button class="no-print" onclick="eliminarNota('${nombre}', '${e.fecha.toISOString()}', '${e.tabla || "Evoluciones"}')" style="background:none; border:none; color:red; cursor:pointer; font-size:12px; padding:0; text-decoration:underline;">Eliminar entrada</button>
          </div>
      </div>
    `;
    document.getElementById("lista").insertAdjacentHTML("beforeend", notaHtml);
  });
}

function abrirModalEdicion(nombre) {
  const perfil = [...pacientes[nombre]].sort((a, b) => a.fecha - b.fecha)[0];
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
    nombre: document.getElementById("modal-nombre").value,
    rut: document.getElementById("modal-rut").value,
    fechaNac: document.getElementById("modal-fecha-nacimiento").value,
    direccion: document.getElementById("modal-direccion").value,
    telefono: document.getElementById("modal-telefono").value,
    correo: document.getElementById("modal-correo").value,
    tratamiento_activo: document.getElementById("modal-tratamiento-activo").value,
    tratamientoActivo: document.getElementById("modal-tratamiento-activo").value
  };

  await fetch(URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(datos)
  });

  alert("✅ Paciente actualizado");
  location.reload();
}

async function cargarDiagnostico(nombre) {
  const textarea = document.getElementById("txt-diagnostico");
  if (!textarea) return;

  textarea.value = "";
  textarea.placeholder = "Cargando diagnóstico...";

  try {
    const res = await fetch(URL + "?tabla=Diagnosticos");
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    const registro = data.find((fila, index) => index > 0 && fila[0] === nombre);
    textarea.value = registro ? (registro[1] || "") : "";
    textarea.placeholder = "Escriba el diagnóstico principal...";
  } catch (error) {
    console.error("Error al cargar diagnóstico:", error);
    textarea.placeholder = "No se pudo cargar el diagnóstico";
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

    alert("✅ Diagnóstico actualizado");
  } catch (error) {
    alert("❌ No se pudo guardar el diagnóstico");
  }
}
function escaparHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function imprimirCartaLegacy(nombre) {
  const registrosPaciente = pacientes[nombre];
  if (!registrosPaciente || !registrosPaciente.length) {
    alert("No se encontrÃ³ la ficha del paciente.");
    return;
  }

  const perfil = [...registrosPaciente].sort((a, b) => a.fecha - b.fecha)[0];
  const evoluciones = [...registrosPaciente].sort((a, b) => b.fecha - a.fecha);
  const diagnostico = document.getElementById("txt-diagnostico")?.value?.trim() || "No registrado";
  const fechaEmision = new Date().toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const contenidoEvoluciones = evoluciones.map((registro, index) => `
    <section class="evolucion">
      <div class="evolucion-header">
        <span>EvoluciÃ³n ${index + 1}</span>
        <span>${escaparHtml(registro.fecha ? registro.fecha.toLocaleString("es-CL") : "Sin fecha")}</span>
      </div>
      <div class="evolucion-body">${escaparHtml(registro.evolucion || "Sin registro").replace(/\n/g, "<br>")}</div>
    </section>
  `).join("");

  const ventana = window.open("", "_blank", "width=900,height=1200");
  if (!ventana) {
    alert("No se pudo abrir la vista de impresiÃ³n. Revisa si el navegador bloqueÃ³ la ventana.");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ficha - ${escaparHtml(nombre)}</title>
      <style>
        body {
          font-family: Georgia, "Times New Roman", serif;
          color: #111;
          margin: 0;
          padding: 36px;
          background: #fff;
        }
        .encabezado {
          display: flex;
          align-items: center;
          gap: 18px;
          border-bottom: 2px solid #111;
          padding-bottom: 18px;
          margin-bottom: 28px;
        }
        .encabezado img {
          width: 78px;
          height: 78px;
          object-fit: contain;
        }
        .clinica {
          font-size: 30px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .subtitulo {
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .titulo {
          margin: 0 0 20px 0;
          font-size: 24px;
          font-weight: 700;
        }
        .meta {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin: 0 0 22px 0;
          font-size: 13px;
        }
        .seccion {
          margin-bottom: 24px;
        }
        .seccion h2 {
          font-size: 15px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          border-bottom: 1px solid #444;
          padding-bottom: 6px;
          margin: 0 0 12px 0;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 24px;
        }
        .campo {
          font-size: 14px;
          line-height: 1.5;
        }
        .campo strong {
          display: inline-block;
          min-width: 150px;
        }
        .diagnostico {
          border: 1px solid #444;
          padding: 12px;
          min-height: 60px;
          white-space: pre-wrap;
          line-height: 1.6;
          font-size: 14px;
        }
        .evolucion {
          border: 1px solid #444;
          margin-bottom: 14px;
          page-break-inside: avoid;
        }
        .evolucion-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 12px;
          border-bottom: 1px solid #444;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .evolucion-body {
          padding: 12px;
          line-height: 1.7;
          font-size: 14px;
          white-space: normal;
        }
        .firma {
          margin-top: 42px;
          padding-top: 18px;
          text-align: center;
        }
        .firma-linea {
          width: 260px;
          border-top: 1px solid #111;
          margin: 0 auto 10px auto;
        }
        .firma-texto {
          font-size: 13px;
          line-height: 1.5;
        }
        @media print {
          body {
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <header class="encabezado">
        <img src="logoclinica.png" alt="Logo CliniBienVital">
        <div>
          <div class="clinica">Clinibienvital</div>
          <div class="subtitulo">Ficha clÃ­nica del paciente</div>
        </div>
      </header>

      <h1 class="titulo">${escaparHtml(nombre)}</h1>
      <div class="meta">
        <div><strong>Fecha de emisiÃƒÂ³n:</strong> ${escaparHtml(fechaEmision)}</div>
        <div><strong>Documento:</strong> Ficha clÃƒÂ­nica</div>
      </div>

      <section class="seccion">
        <h2>Antecedentes del paciente</h2>
        <div class="grid">
          <div class="campo"><strong>RUT:</strong> ${escaparHtml(perfil.rut || "No registrado")}</div>
          <div class="campo"><strong>Fecha de nacimiento:</strong> ${escaparHtml(formatearFechaNacimiento(perfil.fechaNacimiento))}</div>
          <div class="campo"><strong>Edad:</strong> ${escaparHtml(String(perfil.edad || calcularEdadDesdeFecha(perfil.fechaNacimiento) || "No registrada"))}</div>
          <div class="campo"><strong>TelÃ©fono:</strong> ${escaparHtml(perfil.telefono || "No registrado")}</div>
          <div class="campo"><strong>Correo:</strong> ${escaparHtml(perfil.correo || "No registrado")}</div>
          <div class="campo"><strong>DirecciÃ³n:</strong> ${escaparHtml(perfil.direccion || "No registrada")}</div>
          <div class="campo"><strong>Tratamiento activo:</strong> ${escaparHtml(perfil.tratamientoActivo || "No registrado")}</div>
        </div>
      </section>

      <section class="seccion">
        <h2>DiagnÃ³stico principal</h2>
        <div class="diagnostico">${escaparHtml(diagnostico)}</div>
      </section>

      <section class="seccion">
        <h2>Historial de atenciones</h2>
        ${contenidoEvoluciones}
      </section>
      <footer class="firma">
        <div class="firma-linea"></div>
        <div class="firma-texto">Firma y timbre profesional</div>
        <div class="firma-texto">Clinibienvital</div>
      </footer>
    </body>
    </html>
  `;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  ventana.print();
}
function imprimirCarta(nombre) {
  const registrosPaciente = pacientes[nombre];
  if (!registrosPaciente || !registrosPaciente.length) {
    alert("No se encontro la ficha del paciente.");
    return;
  }

  const perfil = [...registrosPaciente].sort((a, b) => a.fecha - b.fecha)[0];
  const evoluciones = [...(historialPacientes[nombre] || [])].sort((a, b) => b.fecha - a.fecha);
  const diagnostico = document.getElementById("txt-diagnostico")?.value?.trim() || "No registrado";
  const fechaEmision = new Date().toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const logoUrl = new window.URL("logoclinica.png", window.location.href).href;

  const contenidoEvoluciones = evoluciones.length ? evoluciones.map((registro, index) => `
    <section class="evolucion">
      <div class="evolucion-header">
        <span>${escaparHtml(registro.tipo || ("Evolucion " + (index + 1)))}</span>
        <span>${escaparHtml(registro.fecha ? registro.fecha.toLocaleString("es-CL") : "Sin fecha")}</span>
      </div>
      <div class="evolucion-body">${escaparHtml(registro.evolucion || "Sin registro").replace(/\n/g, "<br>")}</div>
    </section>
  `).join("") : '<p>No hay evoluciones ni documentos registrados.</p>';

  const ventana = window.open("about:blank", "_blank", "width=900,height=1200");
  if (!ventana) {
    alert("No se pudo abrir la vista de impresion. Revisa si el navegador bloqueo la ventana.");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ficha - ${escaparHtml(nombre)}</title>
      <style>
        body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 0; padding: 36px; background: #fff; }
        .encabezado { display: flex; align-items: center; gap: 18px; border-bottom: 2px solid #111; padding-bottom: 18px; margin-bottom: 28px; }
        .encabezado img { width: 78px; height: 78px; object-fit: contain; flex: 0 0 auto; }
        .clinica { font-size: 30px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .subtitulo { font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 4px; }
        .titulo { margin: 0 0 20px 0; font-size: 24px; font-weight: 700; }
        .meta { display: flex; justify-content: space-between; gap: 20px; margin: 0 0 22px 0; font-size: 13px; }
        .seccion { margin-bottom: 24px; }
        .seccion h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.12em; border-bottom: 1px solid #444; padding-bottom: 6px; margin: 0 0 12px 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
        .campo { font-size: 14px; line-height: 1.5; }
        .campo strong { display: inline-block; min-width: 150px; }
        .diagnostico { border: 1px solid #444; padding: 12px; min-height: 60px; white-space: pre-wrap; line-height: 1.6; font-size: 14px; }
        .evolucion { border: 1px solid #444; margin-bottom: 14px; page-break-inside: avoid; }
        .evolucion-header { display: flex; justify-content: space-between; gap: 16px; padding: 10px 12px; border-bottom: 1px solid #444; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
        .evolucion-body { padding: 12px; line-height: 1.7; font-size: 14px; white-space: normal; }
        .firma { margin-top: 42px; padding-top: 18px; text-align: center; }
        .firma-linea { width: 260px; border-top: 1px solid #111; margin: 0 auto 10px auto; }
        .firma-texto { font-size: 13px; line-height: 1.5; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <header class="encabezado">
        <img src="${escaparHtml(logoUrl)}" alt="Logo CliniBienVital">
        <div>
          <div class="clinica">Clinibienvital</div>
          <div class="subtitulo">Ficha Clinica del Paciente</div>
        </div>
      </header>
      <h1 class="titulo">${escaparHtml(nombre)}</h1>
      <div class="meta">
        <div><strong>Fecha de emision:</strong> ${escaparHtml(fechaEmision)}</div>
        <div><strong>Documento:</strong> Ficha clinica</div>
      </div>
      <section class="seccion">
        <h2>Antecedentes del paciente</h2>
        <div class="grid">
          <div class="campo"><strong>RUT:</strong> ${escaparHtml(perfil.rut || "No registrado")}</div>
          <div class="campo"><strong>Fecha de nacimiento:</strong> ${escaparHtml(formatearFechaNacimiento(perfil.fechaNacimiento))}</div>
          <div class="campo"><strong>Edad:</strong> ${escaparHtml(String(perfil.edad || calcularEdadDesdeFecha(perfil.fechaNacimiento) || "No registrada"))}</div>
          <div class="campo"><strong>Telefono:</strong> ${escaparHtml(perfil.telefono || "No registrado")}</div>
          <div class="campo"><strong>Correo:</strong> ${escaparHtml(perfil.correo || "No registrado")}</div>
          <div class="campo"><strong>Direccion:</strong> ${escaparHtml(perfil.direccion || "No registrada")}</div>
          <div class="campo"><strong>Tratamiento activo:</strong> ${escaparHtml(perfil.tratamientoActivo || "No registrado")}</div>
        </div>
      </section>
      <section class="seccion">
        <h2>Diagnostico principal</h2>
        <div class="diagnostico">${escaparHtml(diagnostico)}</div>
      </section>
      <section class="seccion">
        <h2>Historial de atenciones</h2>
        ${contenidoEvoluciones}
      </section>
      <footer class="firma">
        <div class="firma-linea"></div>
        <div class="firma-texto">Firma y timbre profesional</div>
        <div class="firma-texto">Clinibienvital</div>
      </footer>
    </body>
    </html>
  `;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();

  const imprimirVentana = () => {
    try {
      ventana.focus();
      ventana.print();
    } catch (error) {
      alert("No se pudo abrir la impresion.");
    }
  };

  if (ventana.document.readyState === "complete") {
    setTimeout(imprimirVentana, 150);
  } else {
    ventana.onload = () => setTimeout(imprimirVentana, 150);
  }
}

async function toggleSesiones(nombre) {
  const visor = document.getElementById("visor-sesiones");
  if (!visor) return;

  const visible = visor.style.display === "block";
  if (visible) {
    visor.style.display = "none";
    visor.innerHTML = "";
    return;
  }

  visor.style.display = "block";
  visor.innerHTML = "<p>Cargando sesiones...</p>";

  try {
    const res = await fetch(URL + "?tabla=Sesiones");
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    const sesiones = data
      .slice(1)
      .filter(fila => fila[1] === nombre)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]));

    if (!sesiones.length) {
      visor.innerHTML = "<p>No hay sesiones realizadas registradas.</p>";
      return;
    }

    visor.innerHTML = sesiones.map(fila => {
      const fecha = fila[0] ? new Date(fila[0]).toLocaleString("es-CL") : "Sin fecha";
      const tratamiento = fila[2] || "Sin tratamiento";
      return `
        <div class="sesion-item">
          <div><strong>💉 ${tratamiento}</strong></div>
          <div class="sesion-fecha">📅 ${fecha}</div>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Error al cargar sesiones:", error);
    visor.innerHTML = "<p>No se pudieron cargar las sesiones.</p>";
  }
}
async function cargarTratamientos() {
  const select = document.getElementById("select-tratamiento-cita");
  if (!select) return;

  select.innerHTML = '<option value="">Cargando tratamientos...</option>';

  try {
    const res = await fetch(URL + "?tabla=Tratamientos");
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    const tratamientos = data
      .slice(1)
      .map(fila => (fila[0] || "").toString().trim())
      .filter(Boolean);

    const unicos = [...new Set(tratamientos)];

    if (!unicos.length) {
      select.innerHTML = '<option value="">No hay tratamientos disponibles</option>';
      return;
    }

    select.innerHTML = '<option value="">-- Seleccionar Tratamiento --</option>';
    unicos.forEach(tratamiento => {
      const option = document.createElement("option");
      option.value = tratamiento;
      option.textContent = tratamiento;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar tratamientos:", error);
    select.innerHTML = '<option value="">Error al cargar tratamientos</option>';
  }
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

    alert("✅ Cita agendada correctamente.");
    document.getElementById("fecha-cita").value = "";
    document.getElementById("hora-cita").value = "";
    document.getElementById("select-tratamiento-cita").value = "";
  } catch (error) {
    alert("❌ No se pudo agendar la cita.");
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
  if (!confirm("¿Deseas eliminar esta evolución del historial?")) {
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

    alert("✅ Evolución eliminada.");
    location.reload();
  } catch (error) {
    alert("❌ No se pudo eliminar la evolución.");
  }
}

async function altaPaciente(nombre) {
  if (!confirm(`¿Dar de alta a ${nombre} y mover su ficha a históricos?`)) {
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

    alert("✅ Paciente dado de alta.");
    window.location.href = "historicos.html";
  } catch (error) {
    alert("❌ No se pudo dar de alta al paciente.");
  }
}
async function eliminarPacienteCompleto(nombre) {
  const registros = pacientes[nombre] || [];
  if (!registros.length) {
    alert("No se encontró el paciente.");
    return;
  }

  const rut = registros[0].rut || "";
  const totalRegistros = registros.filter(reg => (reg.rut || "") === rut).length || registros.length;

  if (!confirm(`¿Deseas eliminar por completo a ${nombre}? Esta acción borrará toda su ficha.`)) {
    return;
  }

  try {
    for (let i = 0; i < totalRegistros; i++) {
      await fetch(URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "eliminar",
          nombre,
          rut
        })
      });
    }

    alert("✅ Paciente eliminado completamente.");
    location.reload();
  } catch (error) {
    alert("❌ No se pudo eliminar el paciente completo.");
  }
}






