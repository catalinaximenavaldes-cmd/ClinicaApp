const NOMBRE_CARPETA_IMAGENES = "ImagenesPacientes";
const NOMBRE_HOJA_IMAGENES = "ImagenesPacientes";

/**
 * ============================
 * POST
 * ============================
 */
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    var accion = (data.accion || "").toString().trim();
    var nombre = (data.nombre || "").toString().trim();

    escribirLog("ACCION DETECTADA: " + accion + " | NOMBRE: " + nombre);

    // 1. CREAR CITA
    if (accion === "crearCita") {
      var hojaAgenda = ss.getSheetByName("Agenda");
      if (!hojaAgenda) throw new Error("No existe la hoja 'Agenda'");

      var horaForzada = "'" + (data.hora || "");
      hojaAgenda.appendRow([
        data.fecha || "",
        horaForzada,
        data.paciente || "",
        data.tratamiento || "",
        "Pendiente"
      ]);

      SpreadsheetApp.flush();
      return ContentService.createTextOutput("Cita agendada");
    }

    // 2. CONFIRMAR ATENCION
    if (accion === "confirmarAsistenciaDesdeAgenda") {
      gestionarStock(data.paciente, data.tratamiento, "restar");
      return ContentService.createTextOutput("Asistencia registrada");
    }

    // 3. ANULAR ATENCION
    if (accion === "anularAtencion") {
      gestionarStock(data.paciente, data.tratamiento, "sumar");
      return ContentService.createTextOutput("Atencion anulada");
    }

    // 4. ACTUALIZAR DIAGNOSTICO
    if (accion === "actualizarDiagnostico") {
      var hojaDiag = ss.getSheetByName("Diagnosticos");
      if (!hojaDiag) throw new Error("No existe la hoja 'Diagnosticos'");

      var datosDiag = hojaDiag.getDataRange().getValues();
      var filaEncontrada = -1;

      for (var i = 1; i < datosDiag.length; i++) {
        if ((datosDiag[i][0] || "").toString().trim() === nombre) {
          filaEncontrada = i + 1;
          break;
        }
      }

      if (filaEncontrada !== -1) {
        hojaDiag.getRange(filaEncontrada, 2).setValue(data.diagnostico || "");
      } else {
        hojaDiag.appendRow([nombre, data.diagnostico || ""]);
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput("Diagnostico actualizado");
    }

    // 5. EDITAR PACIENTE
    if (accion === "editarFichaCompleta") {
      var hoja1 = ss.getSheetByName("Hoja 1");
      if (!hoja1) throw new Error("No existe la hoja 'Hoja 1'");

      var dFicha = hoja1.getDataRange().getValues();
      var rutOriginal = (data.rutOriginal || "").toString().trim();

      for (var j = 1; j < dFicha.length; j++) {
        var rutFila = (dFicha[j][2] || "").toString().trim();

        if (rutFila === rutOriginal) {
          hoja1.getRange(j + 1, 2).setValue(data.nombre || "");
          hoja1.getRange(j + 1, 3).setValue(data.rut || "");

          if (data.fechaNac) {
            hoja1.getRange(j + 1, 4).setValue(data.fechaNac);
          }

          hoja1.getRange(j + 1, 6).setValue(data.direccion || "");
          hoja1.getRange(j + 1, 7).setValue(data.telefono || "");
          hoja1.getRange(j + 1, 8).setValue(data.correo || "");
          hoja1.getRange(j + 1, 10).setValue(data.tratamiento_activo || data.tratamientoActivo || "");
        }
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput("Ficha actualizada");
    }

    // 6. ELIMINAR CITA
    if (accion === "eliminarCita") {
      var hojaAgendaEliminar = ss.getSheetByName("Agenda");
      if (!hojaAgendaEliminar) throw new Error("No existe la hoja 'Agenda'");

      var dAgenda = hojaAgendaEliminar.getDataRange().getValues();
      var pacienteEliminar = (data.paciente || "").toString().trim();
      var tratamientoEliminar = (data.tratamiento || "").toString().trim();

      for (var k = dAgenda.length - 1; k >= 1; k--) {
        var pacienteFila = (dAgenda[k][2] || "").toString().trim();
        var tratamientoFila = (dAgenda[k][3] || "").toString().trim();

        if (pacienteFila === pacienteEliminar && tratamientoFila === tratamientoEliminar) {
          hojaAgendaEliminar.deleteRow(k + 1);
          break;
        }
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput("Cita eliminada");
    }

    // 7. STOCK
    if (accion === "actualizarStock") {
      var hojaStock = ss.getSheetByName("Stock");
      if (!hojaStock) throw new Error("No existe la hoja 'Stock'");

      hojaStock.clearContents();
      hojaStock.getRange(1, 1, data.datos.length, data.datos[0].length).setValues(data.datos);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput("Stock actualizado");
    }

    // 8. ELIMINAR PACIENTE COMPLETO
    if (accion === "eliminarCompleto") {
      eliminarPacienteCompleto(data.nombre, data.rut);
      return ContentService.createTextOutput("Paciente eliminado completamente");
    }

    // 9. ELIMINAR UNA SOLA FILA
    if (accion === "eliminar") {
      eliminarFila(data.nombre, data.rut);
      return ContentService.createTextOutput("Paciente eliminado");
    }

    // 10. ELIMINAR NOTA / EVOLUCION / DOCUMENTO
    if (accion === "eliminarNota") {
      eliminarNotaPaciente(data.nombre, data.fecha, data.tabla || "Evoluciones");
      return ContentService.createTextOutput("Nota eliminada");
    }

    // 11. DAR DE ALTA
    if (accion === "alta") {
      moverEntreHojas(nombre, "Hoja 1", "historicos");
      return ContentService.createTextOutput("Paciente dado de alta");
    }

    // 12. REACTIVAR
    if (accion === "reactivar") {
      moverEntreHojas(nombre, "historicos", "Hoja 1");
      return ContentService.createTextOutput("Paciente reactivado");
    }

    // 13. ELIMINAR HISTORICO COMPLETO
    if (accion === "eliminarHistoricoCompleto") {
      eliminarPacienteHistoricoCompleto(data.nombre);
      return ContentService.createTextOutput("Paciente historico eliminado");
    }

    // 14. GUARDAR EVOLUCION
    if (accion === "guardarEvolucion") {
      var sheetEvolucion = ss.getSheetByName("Hoja 1");
      if (!sheetEvolucion) throw new Error("No existe la hoja 'Hoja 1'");

      var datosPaciente = buscarPacientePorNombre(nombre);

      sheetEvolucion.appendRow([
        new Date(),
        nombre,
        datosPaciente.rut,
        datosPaciente.fechaNacimiento,
        "",
        datosPaciente.direccion,
        datosPaciente.telefono,
        datosPaciente.correo,
        data.evolucion || "",
        datosPaciente.tratamientoActivo
      ]);

      SpreadsheetApp.flush();
      return ContentService.createTextOutput("Evolucion guardada");
    }

    // 15. SUBIR IMAGEN PACIENTE A DRIVE
    if (accion === "subirImagenPaciente") {
      escribirLog("ENTRO A subirImagenPaciente");
      escribirLog(
        "Subiendo imagen de " +
          nombre +
          " | rut: " +
          (data.rut || "") +
          " | archivo: " +
          (data.fileName || "")
      );

      var resultadoImagen = subirImagenPaciente(data);
      return ContentService
        .createTextOutput(JSON.stringify(resultadoImagen))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 16. NUEVO PACIENTE / REGISTRO
    var sheetActiva = ss.getSheetByName("Hoja 1");
    if (!sheetActiva) throw new Error("No existe la hoja 'Hoja 1'");

    sheetActiva.appendRow([
      new Date(),
      nombre,
      data.rut || "",
      data.fecha_nacimiento || "",
      "",
      data.direccion || "",
      data.telefono || "",
      data.correo || "",
      data.evolucion || "",
      data.tratamiento_activo || data.tratamientoActivo || ""
    ]);

    SpreadsheetApp.flush();
    return ContentService.createTextOutput("Paciente guardado");

  } catch (error) {
    Logger.log("ERROR doPost: " + error.toString());
    escribirLog("ERROR doPost: " + error.toString());
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}


/**
 * ============================
 * GET
 * ============================
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (e.parameter.accion === "listarImagenesPaciente") {
      var resultado = listarImagenesPaciente(e.parameter.rut || "", e.parameter.nombre || "");
      return ContentService
        .createTextOutput(JSON.stringify(resultado))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var nombreHoja = e.parameter.hoja || e.parameter.tabla || "Hoja 1";
    var sheet = ss.getSheetByName(nombreHoja);

    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: "Hoja no existe: " + nombreHoja }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getValues();

    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * ============================
 * STOCK + SESIONES + AGENDA
 * ============================
 */
function gestionarStock(paciente, tratamiento, operacion) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaAgenda = ss.getSheetByName("Agenda");
  var hojaTratamientos = ss.getSheetByName("Tratamientos");
  var hojaStock = ss.getSheetByName("Stock");
  var hojaSesiones = ss.getSheetByName("Sesiones");

  if (!hojaAgenda || !hojaTratamientos || !hojaStock || !hojaSesiones) {
    escribirLog("Falta una hoja requerida.");
    throw new Error("Falta una hoja requerida.");
  }

  var agendaData = hojaAgenda.getDataRange().getValues();
  var tData = hojaTratamientos.getDataRange().getValues();
  var sData = hojaStock.getDataRange().getValues();

  var pacienteBuscado = (paciente || "").toString().trim().toLowerCase();
  var tratamientoBuscado = (tratamiento || "").toString().trim().toLowerCase();
  var nuevoEstado = (operacion === "restar") ? "Realizado" : "Pendiente";
  var estadoEsperado = (operacion === "restar") ? "Pendiente" : "Realizado";
  var filaAgenda = -1;

  for (var i = 1; i < agendaData.length; i++) {
    var pacienteFila = (agendaData[i][2] || "").toString().trim().toLowerCase();
    var tratamientoFila = (agendaData[i][3] || "").toString().trim().toLowerCase();
    var estadoFila = (agendaData[i][4] || "").toString().trim();

    if (
      pacienteFila === pacienteBuscado &&
      tratamientoFila === tratamientoBuscado &&
      estadoFila === estadoEsperado
    ) {
      filaAgenda = i + 1;
      break;
    }
  }

  if (filaAgenda === -1) {
    throw new Error("No se encontro la cita en Agenda para " + paciente + " / " + tratamiento);
  }

  hojaAgenda.getRange(filaAgenda, 5).setValue(nuevoEstado);
  SpreadsheetApp.flush();

  if (operacion === "restar") {
    hojaSesiones.appendRow([new Date(), paciente, tratamiento]);
  } else {
    var sesionesData = hojaSesiones.getDataRange().getValues();
    for (var k = sesionesData.length - 1; k >= 1; k--) {
      var pacienteSesion = (sesionesData[k][1] || "").toString().trim().toLowerCase();
      var tratamientoSesion = (sesionesData[k][2] || "").toString().trim().toLowerCase();

      if (pacienteSesion === pacienteBuscado && tratamientoSesion === tratamientoBuscado) {
        hojaSesiones.deleteRow(k + 1);
        break;
      }
    }
  }

  var receta = tData.find(function(f) {
    return (f[0] || "").toString().trim().toLowerCase() === tratamientoBuscado;
  });

  if (receta) {
    for (var col = 1; col < receta.length; col += 2) {
      var insumoNombre = receta[col];
      var cantidadReceta = receta[col + 1];

      if (insumoNombre && cantidadReceta) {
        for (var j = 1; j < sData.length; j++) {
          if ((sData[j][1] || "").toString().trim() === insumoNombre.toString().trim()) {
            var stockActual = parseFloat(sData[j][2]) || 0;
            var factor = (operacion === "restar") ? -1 : 1;
            var nuevoStock = stockActual + (cantidadReceta * factor);
            hojaStock.getRange(j + 1, 3).setValue(nuevoStock);
          }
        }
      }
    }
  }

  SpreadsheetApp.flush();
}


/**
 * ============================
 * BUSCAR DATOS DE PACIENTE
 * ============================
 */
function buscarPacientePorNombre(nombre) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName("Hoja 1");
  var data = hoja.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if ((data[i][1] || "").toString().trim() === (nombre || "").toString().trim()) {
      return {
        rut: data[i][2] || "",
        fechaNacimiento: data[i][3] || "",
        direccion: data[i][5] || "",
        telefono: data[i][6] || "",
        correo: data[i][7] || "",
        tratamientoActivo: data[i][9] || ""
      };
    }
  }

  return {
    rut: "",
    fechaNacimiento: "",
    direccion: "",
    telefono: "",
    correo: "",
    tratamientoActivo: ""
  };
}


/**
 * ============================
 * MOVER ENTRE HOJAS
 * ============================
 */
function moverEntreHojas(nombre, origen, destino) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetO = ss.getSheetByName(origen);
  var sheetD = ss.getSheetByName(destino);

  if (!sheetO || !sheetD) {
    throw new Error("No existe la hoja de origen o destino");
  }

  var data = sheetO.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    if ((data[i][1] || "").toString().trim() === (nombre || "").toString().trim()) {
      sheetD.appendRow(data[i]);
      sheetO.deleteRow(i + 1);
    }
  }

  SpreadsheetApp.flush();
}


/**
 * ============================
 * ELIMINAR UNA FILA
 * ============================
 */
function eliminarFila(nombre, rut) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Hoja 1");
  if (!sheet) throw new Error("No existe la hoja 'Hoja 1'");

  var data = sheet.getDataRange().getValues();
  var nombreBuscado = (nombre || "").toString().trim();
  var rutBuscado = (rut || "").toString().trim();

  for (var i = data.length - 1; i >= 1; i--) {
    var nombreFila = (data[i][1] || "").toString().trim();
    var rutFila = (data[i][2] || "").toString().trim();

    if (nombreFila === nombreBuscado && rutFila === rutBuscado) {
      sheet.deleteRow(i + 1);
      break;
    }
  }

  SpreadsheetApp.flush();
}


/**
 * ============================
 * ELIMINAR NOTA / EVOLUCION / DOCUMENTO
 * ============================
 */
function eliminarNotaPaciente(nombre, fecha, tabla) {
  var nombreBuscado = (nombre || "").toString().trim();
  var fechaBuscada = fecha ? new Date(fecha).toISOString() : "";
  var sheetName = tabla === "Documentos" ? "Documentos" : "Hoja 1";
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  if (!sheet) throw new Error("No existe la hoja '" + sheetName + "'");

  var data = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    var fechaFila = data[i][0] ? new Date(data[i][0]).toISOString() : "";
    var nombreFila = (data[i][1] || "").toString().trim();

    if (nombreFila === nombreBuscado && fechaFila === fechaBuscada) {
      sheet.deleteRow(i + 1);
      break;
    }
  }

  SpreadsheetApp.flush();
}


/**
 * ============================
 * ELIMINAR PACIENTE HISTORICO COMPLETO
 * ============================
 */
function eliminarPacienteHistoricoCompleto(nombre) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nombreBuscado = (nombre || "").toString().trim();

  var hojas = [
    ss.getSheetByName("historicos"),
    ss.getSheetByName("historicos_evoluciones"),
    ss.getSheetByName("historicos_diagnosticos"),
    ss.getSheetByName("historicos_sesiones"),
    ss.getSheetByName(NOMBRE_HOJA_IMAGENES)
  ];

  for (var h = 0; h < hojas.length; h++) {
    var hoja = hojas[h];
    if (!hoja) continue;

    var data = hoja.getDataRange().getValues();

    for (var i = data.length - 1; i >= 1; i--) {
      var nombreFila = "";

      if (hoja.getName() === "historicos_diagnosticos") {
        nombreFila = (data[i][0] || "").toString().trim();
      } else if (hoja.getName() === "historicos_sesiones") {
        nombreFila = (data[i][1] || "").toString().trim();
      } else if (hoja.getName() === NOMBRE_HOJA_IMAGENES) {
        nombreFila = (data[i][1] || "").toString().trim();
      } else {
        nombreFila = (data[i][1] || "").toString().trim();
      }

      if (nombreFila === nombreBuscado) {
        hoja.deleteRow(i + 1);
      }
    }
  }

  SpreadsheetApp.flush();
}


/**
 * ============================
 * IMAGENES PACIENTE
 * ============================
 */
function subirImagenPaciente(data) {
  try {
    var nombre = (data.nombre || "").toString().trim();
    var rut = (data.rut || "").toString().trim();
    var descripcion = (data.descripcion || "").toString().trim();
    var mimeType = (data.mimeType || "application/octet-stream").toString();
    var fileBase64 = (data.fileBase64 || "").toString();
    var fileNameOriginal = (data.fileName || "imagen").toString().trim();

    escribirLog("subirImagenPaciente iniciado para rut: " + rut);

    if (!rut) throw new Error("Falta el RUT del paciente");
    if (!fileBase64) throw new Error("No se recibio la imagen");

    var carpeta = obtenerCarpetaImagenes();
    escribirLog("Carpeta encontrada: " + carpeta.getName());

    var fecha = new Date();
    var timestamp = Utilities.formatDate(
      fecha,
      Session.getScriptTimeZone() || "America/Santiago",
      "yyyy-MM-dd_HHmmss"
    );

    var extension = obtenerExtension(fileNameOriginal, mimeType);
    var nombreSeguro = limpiarTextoArchivo(nombre || "paciente");
    var descripcionSegura = limpiarTextoArchivo(descripcion || "imagen");
    var nombreArchivo = rut + "_" + timestamp + "_" + nombreSeguro + "_" + descripcionSegura + extension;

    var bytes = Utilities.base64Decode(fileBase64);
    var blob = Utilities.newBlob(bytes, mimeType, nombreArchivo);
    var file = carpeta.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();
    var url = file.getUrl();

    escribirLog("Archivo creado en Drive: " + fileId);

    registrarImagenPaciente({
      fecha: fecha,
      nombre: nombre,
      rut: rut,
      descripcion: descripcion,
      fileId: fileId,
      url: url
    });

    escribirLog("Fila registrada en ImagenesPacientes para rut: " + rut + " | fileId: " + fileId);

    SpreadsheetApp.flush();

    return {
      ok: true,
      nombre: nombre,
      rut: rut,
      fileId: fileId,
      url: url
    };
  } catch (error) {
    escribirLog("ERROR subirImagenPaciente: " + error.toString());
    throw error;
  }
}

function listarImagenesPaciente(rut, nombre) {
  var hoja = obtenerHojaImagenesPacientes();
  var data = hoja.getDataRange().getValues();
  var rutBuscado = (rut || "").toString().trim().toLowerCase();
  var nombreBuscado = (nombre || "").toString().trim().toLowerCase();
  var resultado = [];

  for (var i = 1; i < data.length; i++) {
    var fila = data[i];
    var rutFila = (fila[2] || "").toString().trim().toLowerCase();
    var nombreFila = (fila[1] || "").toString().trim().toLowerCase();

    if (
      (rutBuscado && rutFila === rutBuscado) ||
      (nombreBuscado && nombreFila === nombreBuscado)
    ) {
      resultado.push({
        fecha: fila[0] || "",
        nombre: fila[1] || "",
        rut: fila[2] || "",
        descripcion: fila[3] || "",
        fileId: fila[4] || "",
        url: fila[5] || ""
      });
    }
  }

  return resultado;
}

function obtenerCarpetaImagenes() {
  var carpetas = DriveApp.getFoldersByName(NOMBRE_CARPETA_IMAGENES);
  if (!carpetas.hasNext()) {
    throw new Error("No existe una carpeta de Drive llamada '" + NOMBRE_CARPETA_IMAGENES + "'");
  }
  return carpetas.next();
}

function obtenerHojaImagenesPacientes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(NOMBRE_HOJA_IMAGENES);

  if (!hoja) {
    escribirLog("No existia hoja ImagenesPacientes. Creando...");
    hoja = ss.insertSheet(NOMBRE_HOJA_IMAGENES);
    hoja.appendRow(["fecha", "nombre", "rut", "descripcion", "fileId", "url"]);
    SpreadsheetApp.flush();
  }

  return hoja;
}

function registrarImagenPaciente(data) {
  try {
    var hoja = obtenerHojaImagenesPacientes();

    escribirLog(
      "registrarImagenPaciente -> nombre: " +
        (data.nombre || "") +
        " | rut: " +
        (data.rut || "")
    );

    hoja.appendRow([
      data.fecha || new Date(),
      data.nombre || "",
      data.rut || "",
      data.descripcion || "",
      data.fileId || "",
      data.url || ""
    ]);

    SpreadsheetApp.flush();
    escribirLog("appendRow realizado en ImagenesPacientes");
  } catch (error) {
    escribirLog("ERROR registrarImagenPaciente: " + error.toString());
    throw error;
  }
}

function limpiarTextoArchivo(texto) {
  return (texto || "")
    .toString()
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "archivo";
}

function obtenerExtension(fileName, mimeType) {
  var nombre = (fileName || "").toLowerCase();

  if (nombre.match(/\.[a-z0-9]+$/)) {
    return nombre.slice(nombre.lastIndexOf("."));
  }

  var mapa = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "application/pdf": ".pdf"
  };

  return mapa[mimeType] || ".bin";
}


/**
 * ============================
 * PRUEBA DE DRIVE
 * ============================
 */
function pruebaCrearArchivoDrive() {
  var carpetas = DriveApp.getFoldersByName(NOMBRE_CARPETA_IMAGENES);
  if (!carpetas.hasNext()) {
    throw new Error("No existe la carpeta " + NOMBRE_CARPETA_IMAGENES);
  }

  var carpeta = carpetas.next();
  var blob = Utilities.newBlob("prueba", "text/plain", "prueba_drive.txt");
  var archivo = carpeta.createFile(blob);
  Logger.log(archivo.getId());
  escribirLog("pruebaCrearArchivoDrive OK: " + archivo.getId());
}


/** LOGS */
function escribirLog(texto) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName("Logs");

  if (!hoja) {
    hoja = ss.insertSheet("Logs");
    hoja.appendRow(["Fecha", "Mensaje"]);
  }

  hoja.appendRow([new Date(), texto]);
}


/**
 * ============================
 * ELIMINAR PACIENTE COMPLETO
 * ============================
 */
function eliminarPacienteCompleto(nombre, rut) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nombreBuscado = (nombre || "").toString().trim();
  var rutBuscado = (rut || "").toString().trim();

  var hojaPacientes = ss.getSheetByName("Hoja 1");
  if (hojaPacientes) {
    var dataPacientes = hojaPacientes.getDataRange().getValues();
    for (var i = dataPacientes.length - 1; i >= 1; i--) {
      var nombreFila = (dataPacientes[i][1] || "").toString().trim();
      var rutFila = (dataPacientes[i][2] || "").toString().trim();

      if (nombreFila === nombreBuscado && rutFila === rutBuscado) {
        hojaPacientes.deleteRow(i + 1);
      }
    }
  }

  var hojaDiag = ss.getSheetByName("Diagnosticos");
  if (hojaDiag) {
    var dataDiag = hojaDiag.getDataRange().getValues();
    for (var j = dataDiag.length - 1; j >= 1; j--) {
      var nombreDiag = (dataDiag[j][0] || "").toString().trim();
      if (nombreDiag === nombreBuscado) {
        hojaDiag.deleteRow(j + 1);
      }
    }
  }

  var hojaAgenda = ss.getSheetByName("Agenda");
  if (hojaAgenda) {
    var dataAgenda = hojaAgenda.getDataRange().getValues();
    for (var k = dataAgenda.length - 1; k >= 1; k--) {
      var nombreAgenda = (dataAgenda[k][2] || "").toString().trim();
      if (nombreAgenda === nombreBuscado) {
        hojaAgenda.deleteRow(k + 1);
      }
    }
  }

  var hojaSesiones = ss.getSheetByName("Sesiones");
  if (hojaSesiones) {
    var dataSesiones = hojaSesiones.getDataRange().getValues();
    for (var m = dataSesiones.length - 1; m >= 1; m--) {
      var nombreSesion = (dataSesiones[m][1] || "").toString().trim();
      if (nombreSesion === nombreBuscado) {
        hojaSesiones.deleteRow(m + 1);
      }
    }
  }

  var hojaImagenes = ss.getSheetByName(NOMBRE_HOJA_IMAGENES);
  if (hojaImagenes) {
    var dataImagenes = hojaImagenes.getDataRange().getValues();
    for (var n = dataImagenes.length - 1; n >= 1; n--) {
      var nombreImagen = (dataImagenes[n][1] || "").toString().trim();
      var rutImagen = (dataImagenes[n][2] || "").toString().trim();
      if (nombreImagen === nombreBuscado || (rutBuscado && rutImagen === rutBuscado)) {
        hojaImagenes.deleteRow(n + 1);
      }
    }
  }

  SpreadsheetApp.flush();
}
