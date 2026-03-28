let cacheDemandas = [];
let demandaAtiva = null;
let chart1 = null;
let chart2 = null;

const CONFIG_ESTILOS = {
    "Iluminação Pública": { icon: "💡", color: "#ecc94b", bg: "#fefcbf" },
    "Limpeza Urbana": { icon: "🧹", color: "#4299e1", bg: "#ebf8ff" },
    "Infraestrutura": { icon: "🚧", color: "#f6ad55", bg: "#fffaf0" },
    "Saúde": { icon: "🏥", color: "#f56565", bg: "#fff5f5" },
    "Patrolamento": { icon: "🚜", color: "#718096", bg: "#f7fafc" },
    "Manejo Verde": { icon: "🌳", color: "#48bb78", bg: "#f0fff4" },
    "Entulho": { icon: "🧱", color: "#a0ae20", bg: "#f5f6e6" },
    "Outros": { icon: "📋", color: "#9f7aea", bg: "#f5f3ff" }
};

async function carregarRelatorios() {
    try {
        const response = await fetch('/api/demandas');
        if (response.status === 403) { window.location.href = 'historico.html'; return; }
        const result = await response.json();
        cacheDemandas = result.data || [];
        const pendentes = cacheDemandas.filter(d => d.status === 'PENDENTE');
        renderizarCategorias(pendentes);
        renderizarGraficos(pendentes);
        popularSelectBairros(pendentes);
    } catch (err) { console.error(err); }
}

function renderizarGraficos(pendentes) {
    if (chart1) chart1.destroy();
    if (chart2) chart2.destroy();
    const contTipo = {}; pendentes.forEach(d => { contTipo[d.tipo] = (contTipo[d.tipo] || 0) + 1; });
    const labelsTipo = Object.keys(contTipo);
    const coresTipo = labelsTipo.map(l => CONFIG_ESTILOS[l.replace(/[\u{1F300}-\u{1F9FF}]/u, "").trim()]?.color || "#cbd5e0");
    chart1 = new Chart(document.getElementById('chart-problemas'), { type: 'doughnut', data: { labels: labelsTipo.map(l => l.replace(/[\u{1F300}-\u{1F9FF}]/u, "").trim()), datasets: [{ data: Object.values(contTipo), backgroundColor: coresTipo }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } });
    const contBai = {}; pendentes.forEach(d => { contBai[d.bairro] = (contBai[d.bairro] || 0) + 1; });
    const allBai = Object.entries(contBai).sort((a, b) => b[1] - a[1]);
    chart2 = new Chart(document.getElementById('chart-bairros'), { type: 'bar', data: { labels: allBai.map(b => b[0]), datasets: [{ label: 'Pendentes', data: allBai.map(b => b[1]), backgroundColor: '#F39200' }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
}

function renderizarCategorias(pendentes) {
    const painel = document.getElementById('painel-estatisticas');
    const contagem = {}; pendentes.forEach(d => { contagem[d.tipo] = (contagem[d.tipo] || 0) + 1; });
    painel.innerHTML = '';
    Object.keys(contagem).sort((a,b) => contagem[b] - contagem[a]).forEach(tipo => {
        const config = CONFIG_ESTILOS[tipo.replace(/[\u{1F300}-\u{1F9FF}]/u, "").trim()] || CONFIG_ESTILOS["Outros"];
        painel.innerHTML += `<div class="report-card" onclick="abrirModalDetalhes('${tipo.replace(/'/g, "\\'")}')" style="--accent-color: ${config.color}; --bg-icon: ${config.bg}"><div class="icon-circle">${config.icon}</div><h3>${tipo.replace(/[\u{1F300}-\u{1F9FF}]/u, "").trim()}</h3><div class="count">${contagem[tipo]}</div><span class="status-label">Pendentes</span></div>`;
    });
}

function popularSelectBairros(pendentes) {
    const select = document.getElementById('select-bairro-report');
    const bairros = [...new Set(pendentes.map(d => d.bairro))].sort();
    select.innerHTML = '<option value="">🏠 Selecione um bairro...</option>';
    if (bairros.length > 0) {
        select.innerHTML += `<option value="TODOS">🌍 TODOS OS BAIRROS (${pendentes.length})</option>`;
        bairros.forEach(b => { select.innerHTML += `<option value="${b}">${b} (${pendentes.filter(d => d.bairro === b).length})</option>`; });
    }
}

function filtrarPorBairro() {
    const val = document.getElementById('select-bairro-report').value;
    const container = document.getElementById('resultado-bairro');
    if (!val) return;
    const filtradas = val === "TODOS" ? cacheDemandas.filter(d => d.status === 'PENDENTE') : cacheDemandas.filter(d => d.bairro === val && d.status === 'PENDENTE');
    container.innerHTML = '';
    filtradas.slice().reverse().forEach(d => {
        container.innerHTML += `<div class="card-bairro-item" onclick="abrirInfoDemanda('${d.protocolo}')"><div class="prot">${d.protocolo}</div><span class="solic">${d.solicitante}</span><span class="tipo-tag">${d.tipo}</span><div style="font-size:0.8rem; color:#666; margin-top:5px;">${d.bairro} - ${d.endereco}</div></div>`;
    });
}

function abrirModalDetalhes(tipo) {
    const overlay = document.getElementById('modal-overlay');
    const corpo = document.getElementById('modal-corpo');
    const filtradas = cacheDemandas.filter(d => d.tipo === tipo && d.status === 'PENDENTE');
    document.getElementById('modal-titulo').innerText = tipo.replace(/[\u{1F300}-\u{1F9FF}]/u, "").trim();
    corpo.innerHTML = '';
    filtradas.slice().reverse().forEach(d => {
        corpo.innerHTML += `<div class="item-detalhe" style="background:white; padding:15px; margin-bottom:10px; border-radius:10px; border-left:5px solid var(--laranja); cursor:pointer;" onclick="abrirInfoDemanda('${d.protocolo}')"><div style="display:flex; justify-content:space-between; font-weight:bold; color:var(--verde)"><span>${d.protocolo}</span><span>${new Date(d.data).toLocaleDateString()}</span></div><div style="font-size:0.9rem; margin-top:5px;"><strong>${d.solicitante}</strong></div></div>`;
    });
    overlay.style.display = 'flex';
}

/**
 * ABRE A FICHA TÉCNICA E ORGANIZA OS BOTÕES NO FOOTER
 */
function abrirInfoDemanda(protocolo) {
    const d = cacheDemandas.find(x => x.protocolo === protocolo);
    if (!d) return;
    demandaAtiva = d;

    const modal = document.getElementById('modal-info-demanda');
    const corpo = document.getElementById('info-corpo');
    const footer = document.getElementById('info-footer-botoes');

    corpo.innerHTML = `
        <div class="info-grid-dados">
            <div class="dado-item"><label>Protocolo</label><span style="color:var(--laranja)">${d.protocolo}</span></div>
            <div class="dado-item"><label>Data</label><span>${new Date(d.data).toLocaleString('pt-BR')}</span></div>
            <div class="dado-item"><label>Solicitante</label><span>${d.solicitante}</span></div>
            <div class="dado-item"><label>Status Atual</label><span>${d.status}</span></div>
            <div class="dado-item dado-full"><label>Localização</label><span>${d.bairro} - ${d.endereco}</span></div>
            <div class="dado-item dado-full"><label>Descrição</label><div style="background:#fff; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">${d.descricao}</div></div>
            ${d.foto ? `<div class="dado-item dado-full"><label>Foto</label><img src="/uploads/${d.foto}" class="foto-preview-info"></div>` : ''}
        </div>`;

    // Botões no Footer (Para não ficarem em baixo do painel)
    const btnDespacho = d.status === 'PENDENTE' 
        ? `<button onclick="confirmarDespacho(${d.id})" class="btn-despacho">🚀 CONFIRMAR ENVIO</button>` 
        : `<span class="badge-status-info">JÁ ENVIADA</span>`;

    footer.innerHTML = `
        ${btnDespacho}
        <button onclick="gerarPDFDaInfo()" class="btn-gerar-pdf">📄 GERAR PDF</button>
        <button onclick="fecharInfo()" class="btn-cancelar">FECHAR</button>
    `;

    modal.style.display = 'flex';
}

async function confirmarDespacho(id) {
    const confirm = await Swal.fire({ 
        title: 'Confirmar Envio?', 
        text: "A demanda será marcada como ENVIADA.", 
        icon: 'question', 
        showCancelButton: true, 
        confirmButtonText: 'Sim, marcar como enviada', 
        confirmButtonColor: '#008D36' 
    });

    if (confirm.isConfirmed) {
        const res = await fetch(`/api/demandas/${id}/status`, { method: 'PATCH' });
        const data = await res.json();
        if (data.success) {
            await Swal.fire('Sucesso!', 'Status Atualizado.', 'success');
            fecharInfo();
            carregarRelatorios(); // Atualiza tudo
        }
    }
}

function gerarPDFDaInfo() {
    const d = demandaAtiva;
    const docA4 = document.getElementById('documento-a4-oculto');
    docA4.innerHTML = `<div class="a4-header"><img src="images/logopmi.png" class="a4-logo"><div><h1 style="margin:0; font-size:18px;">PREFEITURA DE IPIAÚ</h1><p style="margin:0; font-size:11px;">Relatório Oficial de Ocorrência</p></div></div><div class="a4-protocol-box"><strong>PROTOCOLO: ${d.protocolo}</strong></div><div class="a4-section-title">INFORMAÇÕES GERAIS</div><div style="display:grid; grid-template-columns:1fr 1fr; font-size:12px; gap:10px;"><p><strong>Solicitante:</strong> ${d.solicitante}</p><p><strong>Data:</strong> ${new Date(d.data).toLocaleString()}</p><p><strong>Bairro:</strong> ${d.bairro}</p><p><strong>Tipo:</strong> ${d.tipo}</p></div><p style="font-size:12px;"><strong>Endereço:</strong> ${d.endereco}</p><div class="a4-section-title">DESCRIÇÃO</div><div style="font-size:12px; border:1px solid #eee; padding:10px; min-height:80px;">${d.descricao}</div>${d.foto ? `<div class="a4-section-title">EVIDÊNCIA FOTOGRÁFICA</div><div style="text-align:center;"><img src="/uploads/${d.foto}" style="max-width:100%; max-height:450px; border-radius:8px;"></div>` : ''}`;
    const opt = { margin: 0, filename: `Demanda_${d.protocolo}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(docA4).save();
}

function fecharInfo() { document.getElementById('modal-info-demanda').style.display = 'none'; }
function fecharModal() { document.getElementById('modal-overlay').style.display = 'none'; document.body.style.overflow = 'auto'; }

document.addEventListener('DOMContentLoaded', carregarRelatorios);