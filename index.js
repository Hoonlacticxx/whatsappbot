// index.js
import {
  makeWASocket,
  useMultiFileAuthState,
  generateWAMessageFromContent,
  DisconnectReason,
  Browsers,
} from "@whiskeysockets/baileys";
import { keepAlive } from "./keepAlive.js";
import { Boom } from "@hapi/boom";
import pino from "pino";

async function connectToWA() {
  const version = process.versions.node.split(".")[0];

  if (+version < 18) {
    console.log("❌ Necesitas Node.js versión 18 o superior.");
    return;
  }

  // Cargar o crear sesión
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const browser = Browsers.appropriate("Chrome");

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    auth: state,
    browser,
  });

  // Mostrar QR
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrcode = await import("qrcode-terminal");
        qrcode.generate(qr, { small: true });
        console.log("📱 Escanea el QR con tu app de WhatsApp (Dispositivos -> Vincular un dispositivo).");
      } catch (err) {
        console.log("⚠️ No está instalada 'qrcode-terminal'. Copia es
