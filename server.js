const express = require('express');
const multer = require('multer');
const puppeteer = require('puppeteer');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const upload = multer({ dest: 'uploads/' });
const DB_FILE = 'database.json';

app.use(express.json());
app.use(session({
    secret: 'prefeitura-ipiau-2024-secure',
    resave: false,
    saveUninitialized: false, // Alterado para não criar sessões vazias
    cookie: { maxAge: 3600000 } // 1 hora, mas vamos limpar manualmente
}));

const readDB = () => {
    if (!fs.existsSync(DB_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8') || '[]'); } catch (e) { return []; }
};
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// --- WHATSAPP ---
let isWhatsappReady = false;
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});
client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => { isWhatsappReady = true; console.log('✅ WhatsApp Conectado!'); });
client.initialize();

// --- NOVA ROTA: LIMPAR SESSÃO AO ENTRAR ---
app.get('/api/limpar-sessao', (req, res) => {
    req.session.destroy();
    res.status(200).send("Sessão limpa");
});

// --- LOGIN ---
app.post('/api/login', (req, res) => {
    const { identifier, password } = req.body;
    if (identifier === 'admin2007' && password === 'ipiau2007') {
        req.session.role = 'admin';
        return res.json({ success: true, role: 'admin' });
    }
    const demandas = readDB();
    const protocoloExiste = demandas.find(d => d.protocolo === identifier);
    if (protocoloExiste) {
        req.session.role = 'user';
        req.session.protocolo = identifier;
        return res.json({ success: true, role: 'user' });
    }
    res.status(401).json({ success: false });
});

// --- REGISTRO DE DEMANDA ---
app.post('/nova-demanda', upload.single('foto'), async (req, res) => {
    const { solicitante, bairro, tipo, endereco, descricao } = req.body;
    const fotoLocal = req.file;
    const protocolo = `IPI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const demandas = readDB();
    const novaDemanda = { id: Date.now(), protocolo, solicitante, bairro, tipo, endereco, descricao, data: new Date(), status: 'PENDENTE' };
    demandas.push(novaDemanda);
    writeDB(demandas);

    try {
        const numeroDestino = "5573999130553"; 
        const numberId = await client.getNumberId(numeroDestino);
        const chatId = numberId._serialized;

        let browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        // Converter foto para base64 para o PDF
        let fotoBase64 = "";
        if (fotoLocal) {
            const bitmap = fs.readFileSync(fotoLocal.path);
            fotoBase64 = `data:image/jpeg;base64,${bitmap.toString('base64')}`;
        }

        const html = `<html><body style="font-family:Arial;padding:30px;">
            <h1 style="color:#008D36;">Prefeitura de Ipiaú</h1>
            <div style="background:#008D36;color:white;padding:10px;border-radius:5px;font-size:20px;">PROTOCOLO: ${protocolo}</div>
            <p><strong>Solicitante:</strong> ${solicitante}</p>
            <p><strong>Bairro:</strong> ${bairro}</p>
            <p><strong>Tipo:</strong> ${tipo}</p>
            <p><strong>Endereço:</strong> ${endereco}</p>
            <p><strong>Descrição:</strong> ${descricao}</p>
            ${fotoBase64 ? `<div style="text-align:center;"><img src="${fotoBase64}" style="max-width:100%;max-height:400px;border-radius:10px;"></div>` : ''}
        </body></html>`;

        await page.setContent(html);
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        const pdfPath = path.join(__dirname, 'uploads', `demanda_${novaDemanda.id}.pdf`);
        fs.writeFileSync(pdfPath, pdfBuffer);
        await browser.close();

        const media = MessageMedia.fromFilePath(pdfPath);
        await client.sendMessage(chatId, media, { caption: `✅ *NOVA DEMANDA*\nProtocolo: ${protocolo}\nSolicitante: ${solicitante}` });

        if (fotoLocal) fs.unlinkSync(fotoLocal.path);
        fs.unlinkSync(pdfPath);

        const db = readDB();
        const idx = db.findIndex(d => d.id === novaDemanda.id);
        if (idx !== -1) { db[idx].status = 'ENVIADA'; writeDB(db); }

        res.status(200).json({ success: true, protocolo });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro");
    }
});

// --- LISTAGEM ---
app.get('/api/demandas', (req, res) => {
    if (!req.session.role) return res.status(403).json({ error: "Bloqueado" });
    const demandas = readDB();
    if (req.session.role === 'admin') res.json({ role: 'admin', data: demandas });
    else res.json({ role: 'user', data: demandas.filter(d => d.protocolo === req.session.protocolo) });
});

// --- ROTA PARA DELETAR DEMANDA (APENAS ADMIN) ---
app.delete('/api/demandas/:id', (req, res) => {
    // Verifica se é admin
    if (!req.session.role || req.session.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Acesso negado." });
    }

    const id = parseInt(req.params.id);
    let demandas = readDB();
    
    // Filtra para remover a demanda com o ID especificado
    const novaLista = demandas.filter(d => d.id !== id);
    
    if (demandas.length === novaLista.length) {
        return res.status(404).json({ success: false, message: "Demanda não encontrada." });
    }

    writeDB(novaLista);
    res.json({ success: true, message: "Demanda excluída com sucesso." });
});

app.use(express.static('public'));
app.listen(3000, () => console.log('🚀 Rodando em http://localhost:3000'));