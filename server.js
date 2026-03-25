const express = require("express");
const multer = require("multer");
const puppeteer = require("puppeteer");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const session = require("express-session");

const app = express();
const upload = multer({ dest: "uploads/" });
const DB_FILE = "database.json";

app.use(express.json());
app.use(
  session({
    secret: "prefeitura-ipiau-2024-secure",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 },
  }),
);

const readDB = () => {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8") || "[]");
  } catch (e) {
    return [];
  }
};
const writeDB = (data) =>
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// --- WHATSAPP ---
let isWhatsappReady = false;
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});
client.on("qr", (qr) => qrcode.generate(qr, { small: true }));
client.on("ready", () => {
  isWhatsappReady = true;
  console.log("✅ WhatsApp Conectado!");
});
client.initialize();

app.get("/api/limpar-sessao", (req, res) => {
  req.session.destroy();
  res.status(200).send("Sessão limpa");
});

app.post("/api/login", (req, res) => {
  const { identifier, password } = req.body;
  // LOGIN ADMIN
  if (identifier === "admin2007" && password === "ipiau2007") {
    req.session.role = "admin";
    return res.json({ success: true, role: "admin" });
  }
  // LOGIN CIDADÃO
  const demandas = readDB();
  const protocoloExiste = demandas.find((d) => d.protocolo === identifier);
  if (protocoloExiste) {
    req.session.role = "user";
    req.session.protocolo = identifier;
    return res.json({ success: true, role: "user" });
  }
  res.status(401).json({ success: false });
});

app.post("/nova-demanda", upload.single("foto"), async (req, res) => {
  const { solicitante, bairro, tipo, endereco, descricao } = req.body;
  const fotoLocal = req.file;
  const protocolo = `IPI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;

  const demandas = readDB();
  const novaDemanda = {
    id: Date.now(),
    protocolo,
    solicitante,
    bairro,
    tipo,
    endereco,
    descricao,
    data: new Date(),
    status: "PENDENTE",
  };
  demandas.push(novaDemanda);
  writeDB(demandas);

  if (!isWhatsappReady) return res.status(500).send("WhatsApp offline");

  let browser;
  try {
    const numeroDestino = "5573999130553";
    const numberId = await client.getNumberId(numeroDestino);
    const chatId = numberId._serialized;

    // 1. CONVERTER LOGO PARA BASE64 (Indispensável para PDF local)
    const logoPath = path.join(__dirname, "public", "images", "logopmi.png");
    let logoBase64Data = "";
    if (fs.existsSync(logoPath)) {
        const logoBitmap = fs.readFileSync(logoPath);
        logoBase64Data = `data:image/png;base64,${logoBitmap.toString("base64")}`;
    }

    // 2. CONVERTER FOTO DA DEMANDA PARA BASE64
    let fotoBase64 = "";
    if (fotoLocal) {
      const bitmap = fs.readFileSync(fotoLocal.path);
      fotoBase64 = `data:image/jpeg;base64,${bitmap.toString("base64")}`;
    }

    browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();

    const htmlContent = `
            <html>
            <head>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;700&display=swap');
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; color: #333; }
                    .header-bar { background: linear-gradient(90deg, #008D36 0%, #F39200 100%); height: 12px; width: 100%; }
                    .content { padding: 40px; }
                    .header-top { display: flex; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo-img { height: 80px; margin-right: 25px; }
                    .header-text h1 { color: #008D36; margin: 0; font-size: 22px; text-transform: uppercase; }
                    .protocol-banner { background: #fdf2e2; border: 1px solid #F39200; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
                    .protocol-value { font-size: 24px; color: #333; font-weight: bold; letter-spacing: 2px; }
                    .section { margin-bottom: 25px; }
                    .section-title { background: #f4f7f6; padding: 8px 15px; border-left: 5px solid #008D36; font-weight: bold; color: #008D36; font-size: 13px; text-transform: uppercase; margin-bottom: 15px; }
                    .info-grid { display: flex; flex-wrap: wrap; gap: 20px; }
                    .info-item { flex: 1; min-width: 200px; }
                    .label { font-size: 10px; color: #888; text-transform: uppercase; display: block; }
                    .value { font-size: 15px; color: #333; font-weight: 500; }
                    .description-text { background: #fafafa; border: 1px solid #eee; padding: 15px; border-radius: 5px; font-size: 14px; line-height: 1.6; }
                    .photo-section { margin-top: 30px; text-align: center; border: 1px solid #eee; padding: 10px; border-radius: 10px; page-break-inside: avoid; }
                    .photo-img { max-width: 100%; max-height: 450px; border-radius: 5px; }
                    .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header-bar"></div>
                <div class="content">
                    <div class="header-top">
                        <img src="${logoBase64Data}" class="logo-img">
                        <div class="header-text">
                            <h1>Prefeitura Municipal de Ipiaú</h1>
                            <p>Registro Geral de Ocorrências e Demandas</p>
                        </div>
                    </div>
                    <div class="protocol-banner">
                        <span style="font-size:11px; color:#F39200; font-weight:bold;">PROTOCOLO OFICIAL</span><br>
                        <span class="protocol-value">${protocolo}</span>
                    </div>
                    <div class="section">
                        <div class="section-title">Dados do Solicitante</div>
                        <div class="info-grid">
                            <div class="info-item"><span class="label">Nome</span><span class="value">${solicitante}</span></div>
                            <div class="info-item"><span class="label">Data</span><span class="value">${new Date().toLocaleString("pt-BR")}</span></div>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">Localização</div>
                        <div class="info-grid">
                            <div class="info-item"><span class="label">Bairro</span><span class="value">${bairro}</span></div>
                            <div class="info-item"><span class="label">Tipo</span><span class="value">${tipo}</span></div>
                        </div>
                        <div style="margin-top:10px;"><span class="label">Endereço</span><span class="value">${endereco}</span></div>
                    </div>
                    <div class="section">
                        <div class="section-title">Descrição</div>
                        <div class="description-text">${descricao}</div>
                    </div>
                    ${fotoBase64 ? `<div class="photo-section"><img src="${fotoBase64}" class="photo-img" /></div>` : ""}
                    <div class="footer">Emitido via Web App Oficial - Prefeitura de Ipiaú</div>
                </div>
            </body>
            </html>
        `;

    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    const pdfPath = path.join(__dirname, "uploads", `demanda_${novaDemanda.id}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);
    await browser.close();

    const media = MessageMedia.fromFilePath(pdfPath);
    await client.sendMessage(chatId, media, {
      caption: `✅ *NOVA DEMANDA REGISTRADA*\n\n*Protocolo:* ${protocolo}\n*Solicitante:* ${solicitante}\n*Bairro:* ${bairro}`,
    });

    if (fotoLocal) fs.unlinkSync(fotoLocal.path);
    fs.unlinkSync(pdfPath);

    const db = readDB();
    const idx = db.findIndex((d) => d.id === novaDemanda.id);
    if (idx !== -1) {
      db[idx].status = "ENVIADA";
      writeDB(db);
    }

    res.status(200).json({ success: true, protocolo });
  } catch (error) {
    if (browser) await browser.close();
    console.error(error);
    res.status(500).send("Erro interno");
  }
});

app.get("/api/demandas", (req, res) => {
  if (!req.session.role) return res.status(403).json({ error: "Bloqueado" });
  const demandas = readDB();
  if (req.session.role === "admin") res.json({ role: "admin", data: demandas });
  else res.json({ role: "user", data: demandas.filter((d) => d.protocolo === req.session.protocolo) });
});

app.delete("/api/demandas/:id", (req, res) => {
  if (!req.session.role || req.session.role !== "admin") return res.status(403).send("Negado");
  const id = parseInt(req.params.id);
  let demandas = readDB();
  const novaLista = demandas.filter((d) => d.id !== id);
  writeDB(novaLista);
  res.json({ success: true });
});

app.use(express.static("public"));
app.listen(3000, () => console.log("🚀 Servidor rodando em http://localhost:3000"));