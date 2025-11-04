// index.js
import {
  makeWASocket,
  useMultiFileAuthState,
  generateWAMessageFromContent,
  DisconnectReason,
  Browsers,
} from "@whiskeysockets/baileys";
import { createInterface } from "node:readline";
import { keepAlive } from "./keepAlive.js";
import { Boom } from "@hapi/boom";
import pino from "pino";

async function connectToWA() {
  const version = process.versions.node.split(".")[0];

  if (+version < 18) {
    console.log("Necesitas Node.js versión 18 o superior.");
    return;
  }

  // auth files will be stored in ./auth (useMultiFileAuthState creates multiple files)
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const browser = Browsers.appropriate("chrome");

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    // si alguna vez necesitas fijar versión, descomenta y ajusta:
    // version: [2, 3000, 1015901307],
    mobile: false,
    auth: state,
    browser,
  });

  // Mostrar QR en la terminal (si tienes qrcode-terminal instalado) o
  // imprimir el string del QR para que lo conviertas manualmente.
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // intento dinámico de usar qrcode-terminal si está instalado
      try {
        const qrcode = await import("qrcode-terminal");
        qrcode.generate(qr, { small: true });
        console.log("Escanea el QR con tu app de WhatsApp (Dispositivos -> Vincular un dispositivo).");
      } catch (err) {
        console.log("No está instalada la dependencia opcional 'qrcode-terminal'.");
        console.log("Copia este string y pégalo en https://webqr.com/ o usa cualquier generador de QR:");
        console.log(qr);
      }
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("Conexión cerrada. Razón:", lastDisconnect?.error?.toString?.() ?? lastDisconnect);
      if (shouldReconnect) {
        console.log("Reconectando...");
        setTimeout(connectToWA, 2000);
      } else {
        console.log("La sesión fue desconectada y requiere re-login (logged out). Borra ./auth si quieres re-registrar.");
      }
    } else if (connection === "open") {
      console.log("Conectado correctamente. App lista.");
      try { keepAlive(); } catch(e) { /* keepAlive tiene su propia seguridad */ }
    }
  });

  // Este evento escucha mensajes nuevos
  sock.ev.on("messages.upsert", async ({ type, messages }) => {
    try {
      if (type !== "notify") return;
      const msg = messages?.[0];
      if (!msg?.message) return;
      if (msg?.key?.fromMe) return;

      // determinar primer tipo de mensaje
      const msgType = Object.keys(msg.message)[0];

      // patrón original: only interested in viewOnce / special wrappers
      const pattern =
        /^(messageContextInfo|senderKeyDistributionMessage|viewOnceMessage(?:V2(?:Extension)?)?)$/;

      if (!pattern.test(msgType)) return;

      // identificar la key final que contiene viewOnceMessage
      const lastKey = Object.keys(msg.message).at(-1);
      if (!/^viewOnceMessage(?:V2(?:Extension)?)?$/.test(lastKey)) return;

      const fileType = Object.keys(msg.message[lastKey].message)[0];

      // seguridad: verificar estructura
      if (!msg.message[lastKey].message[fileType]) return;

      // quitar el flag viewOnce (== lo hace visible)
      delete msg.message[lastKey].message[fileType].viewOnce;

      // asegurar que socket ya tiene id de usuario
      if (!sock?.user?.id) return;

      // generar el mensaje protobuf para reenviar
      const proto = generateWAMessageFromContent(msg.key.remoteJid, msg.message, {});

      // reenviar al propio usuario (igual que en tu versión original)
      await sock.relayMessage(sock.user.id, proto.message, {
        messageId: proto.key.id,
      });

      console.log("ViewOnce reenvíado desde", msg.key.remoteJid, "a", sock.user.id);
    } catch (err) {
      console.error("Error manejando messages.upsert:", err);
    }
  });

  // guardar credenciales cuando cambien
  sock.ev.on("creds.update", saveCreds);

  // capturar errores globales del socket
  sock.ev.on("connection.error", (err) => {
    console.error("Socket connection error:", err);
  });
}

await connectToWA();

// handlers globales (mejor loguearlos para debugging)
process.on("uncaughtExceptionMonitor", console.error);
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/* Code migrated and improved for modern baileys - by your assistant */
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { pino } from "pino";
import { keepAlive } from "./keepAlive.js";

// --- FUNCIÓN PRINCIPAL ---
async function connectToWA() {
  const version = process.versions.node.split(".")[0];

  // Verifica que la versión de Node sea compatible
  if (+version < 18) {
    console.log("❌ Necesitas Node.js versión 18 o superior para ejecutar este bot.");
    return;
  }

  // Carga o crea la sesión de autenticación
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  // Crea el socket de conexión con Baileys
  const socket = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: true, // 👈 Muestra el QR directamente en la terminal
    auth: state,
    browser: Browsers.appropriate("Chrome"),
  });

  // Guarda los datos de sesión cuando cambien
  socket.ev.on("creds.update", saveCreds);

  // Maneja los eventos de conexión
  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect.error instanceof Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("⚠️ Conexión cerrada. Reconectando...");
      if (shouldReconnect) connectToWA();
    } else if (connection === "open") {
      keepAlive();
      console.log("✅ Bot conectado correctamente a WhatsApp");
    }
  });

  // --- AQUÍ VA TU LÓGICA PRINCIPAL DEL BOT ---
  socket.ev.on("messages.upsert", async ({
