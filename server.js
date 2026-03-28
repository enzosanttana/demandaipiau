const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const session = require("express-session");

const app = express();
const DB_FILE = "database.json";

// Configuração de Upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = "public/uploads/";
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: "ipiau-secret-key-2026",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

const readDB = () => {
    if (!fs.existsSync(DB_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, "utf-8") || "[]");
    } catch (e) { return []; }
};
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- API ---

app.get("/api/limpar-sessao", (req, res) => {
    req.session.destroy();
    res.status(200).send("Sessão encerrada");
});

app.post("/api/login", (req, res) => {
    const { identifier, password } = req.body;
    if (identifier === "admin2007" && password === "ipiau2007") {
        req.session.role = "admin";
        return res.json({ success: true, role: "admin" });
    }
    const db = readDB();
    if (db.find(d => d.protocolo === identifier)) {
        req.session.role = "user";
        req.session.protocolo = identifier;
        return res.json({ success: true, role: "user" });
    }
    res.status(401).json({ success: false });
});

app.get("/api/demandas", (req, res) => {
    if (!req.session.role) return res.status(403).send("Acesso Negado");
    const db = readDB();
    if (req.session.role === "admin") {
        res.json({ role: "admin", data: db });
    } else {
        res.json({ role: "user", data: db.filter(d => d.protocolo === req.session.protocolo) });
    }
});

// ROTA PARA ALTERAR STATUS PARA ENVIADA
app.patch("/api/demandas/:id/status", (req, res) => {
    if (req.session.role !== "admin") return res.status(403).send("Negado");
    let db = readDB();
    const id = parseInt(req.params.id);
    const index = db.findIndex(d => d.id === id);
    if (index !== -1) {
        db[index].status = "ENVIADA";
        writeDB(db);
        return res.json({ success: true });
    }
    res.status(404).json({ success: false });
});

app.delete("/api/demandas/:id", (req, res) => {
    if (req.session.role !== "admin") return res.status(403).send("Não autorizado");
    let db = readDB();
    const novaLista = db.filter(d => d.id !== parseInt(req.params.id));
    writeDB(novaLista);
    res.json({ success: true });
});

app.post("/nova-demanda", upload.single("foto"), (req, res) => {
    try {
        const { solicitante, bairro, tipo, endereco, descricao } = req.body;
        const protocolo = `IPI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
        const db = readDB();
        db.push({
            id: Date.now(),
            protocolo, solicitante, bairro, tipo, endereco, descricao,
            foto: req.file ? req.file.filename : null,
            data: new Date(),
            status: "PENDENTE"
        });
        writeDB(db);
        res.json({ success: true, protocolo });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.use(express.static("public"));
app.use("/uploads", express.static("public/uploads"));

app.get("/relatorios.html", (req, res) => {
    if (req.session.role === "admin") res.sendFile(path.join(__dirname, "public", "relatorios.html"));
    else res.redirect("/historico.html");
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));