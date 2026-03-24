const express = require('express');
const multer = require('multer');
const puppeteer = require('puppeteer');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });
const DB_FILE = 'database.json';

// --- BANCO DE DADOS (JSON) ---
const readDB = () => {
    if (!fs.existsSync(DB_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8') || '[]');
    } catch (e) { return []; }
};
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// --- WHATSAPP ---
let isWhatsappReady = false;
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
    console.log('--- SCANEAR QR CODE ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isWhatsappReady = true;
    console.log('✅ WhatsApp CONECTADO!');
});

client.initialize();

// --- ROTA DE ENVIO ---
app.post('/nova-demanda', upload.single('foto'), async (req, res) => {
    const { solicitante, bairro, tipo, endereco, descricao } = req.body;
    const fotoLocal = req.file;

    const demandas = readDB();
    const novaDemanda = {
        id: Date.now(),
        solicitante, bairro, tipo, endereco, descricao,
        data: new Date(),
        status: 'PENDENTE'
    };
    demandas.push(novaDemanda);
    writeDB(demandas);

    if (!isWhatsappReady) return res.status(500).send("WhatsApp não conectado.");

    let browser;
    let pdfLocalPath = path.join(__dirname, 'uploads', `demanda_${novaDemanda.id}.pdf`);

    try {
        // --- RESOLVER NÚMERO ---
        const numeroDestinoRaw = "5573999130553"; // <--- SEU NÚMERO AQUI
        const numberId = await client.getNumberId(numeroDestinoRaw);
        if (!numberId) throw new Error("Número não reconhecido.");
        const chatId = numberId._serialized;

        // --- CONVERTER FOTO PARA BASE64 PARA O PDF ---
        let fotoBase64 = "";
        if (fotoLocal) {
            const bitmap = fs.readFileSync(fotoLocal.path);
            fotoBase64 = `data:image/jpeg;base64,${new Buffer.from(bitmap).toString('base64')}`;
        }

        // --- GERAR PDF COM FOTO EMBUTIDA ---
        browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        const htmlParaPDF = `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
                    .header { border-bottom: 5px solid #F39200; text-align: center; padding-bottom: 10px; margin-bottom: 20px; }
                    h1 { color: #008D36; margin: 0; font-size: 28px; }
                    h2 { color: #F39200; font-size: 18px; margin-top: 0; }
                    .info-box { background: #f4f4f4; padding: 20px; border-radius: 10px; line-height: 1.6; }
                    .label { font-weight: bold; color: #008D36; }
                    .foto-container { margin-top: 20px; text-align: center; border: 2px solid #ddd; padding: 10px; border-radius: 10px; }
                    .foto-img { max-width: 100%; max-height: 400px; border-radius: 5px; }
                    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Prefeitura de Ipiaú</h1>
                    <h2>Protocolo de Solicitação Digital</h2>
                </div>
                
                <div class="info-box">
                    <p><span class="label">Status:</span> PENDENTE</p>
                    <p><span class="label">Solicitante:</span> ${solicitante}</p>
                    <p><span class="label">Bairro:</span> ${bairro}</p>
                    <p><span class="label">Tipo de Demanda:</span> ${tipo}</p>
                    <p><span class="label">Endereço/Referência:</span> ${endereco}</p>
                    <p><span class="label">Descrição:</span> ${descricao}</p>
                    <p><span class="label">Data do Registro:</span> ${new Date().toLocaleString('pt-BR')}</p>
                </div>

                ${fotoBase64 ? `
                <div class="foto-container">
                    <p style="font-weight:bold; margin-bottom:10px;">Evidência da Demanda (Foto Anexa):</p>
                    <img src="${fotoBase64}" class="foto-img" />
                </div>
                ` : ''}

                <div class="footer">
                    Documento gerado automaticamente pelo Sistema de Demandas de Ipiaú.
                </div>
            </body>
            </html>
        `;

        await page.setContent(htmlParaPDF);
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        fs.writeFileSync(pdfLocalPath, pdfBuffer);
        await browser.close();

        // --- ENVIAR PDF ---
        const pdfMedia = MessageMedia.fromFilePath(pdfLocalPath);
        await client.sendMessage(chatId, pdfMedia, { 
            caption: `✅ *NOVA DEMANDA REGISTRADA*\n\n*Solicitante:* ${solicitante}\n*Bairro:* ${bairro}\n*Tipo:* ${tipo}\n\nO PDF acima contém todos os detalhes e a foto anexa.`,
            sendMediaAsDocument: true 
        });

        // --- LIMPEZA ---
        if (fotoLocal) fs.unlinkSync(fotoLocal.path);
        if (fs.existsSync(pdfLocalPath)) fs.unlinkSync(pdfLocalPath);

        // --- ATUALIZAR STATUS ---
        const dbAtualizado = readDB();
        const index = dbAtualizado.findIndex(d => d.id === novaDemanda.id);
        if (index !== -1) {
            dbAtualizado[index].status = 'ENVIADA';
            writeDB(dbAtualizado);
        }

        res.status(200).send("OK");

    } catch (error) {
        if (browser) await browser.close();
        console.error("ERRO:", error.message);
        res.status(500).send(error.message);
    }
});

app.get('/api/demandas', (req, res) => res.json(readDB()));
app.use(express.static('public'));
app.listen(3000, () => console.log('🚀 Servidor em http://localhost:3000'));