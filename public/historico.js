/**
 * VARIÁVEIS GLOBAIS
 */
let todasAsDemandas = [];
let roleUsuario = '';

/**
 * INICIALIZAÇÃO COM BLUR DE SEGURANÇA
 */
async function inicializarHistorico() {
    const mainContent = document.querySelector('main');
    const paginaAnterior = document.referrer;

    // APLICA O BLUR IMEDIATAMENTE AO CARREGAR
    mainContent.classList.add('blur-main');

    // Verifica se precisa deslogar (se não vier dos relatórios)
    if (!paginaAnterior.includes('relatorios.html')) {
        try {
            await fetch('/api/limpar-sessao');
        } catch (e) {
            console.error("Erro ao limpar sessão:", e);
        }
    }

    carregarDadosDoServidor();
}

/**
 * CARREGAR DADOS DO SERVIDOR
 */
async function carregarDadosDoServidor() {
    try {
        const response = await fetch('/api/demandas');
        
        if (response.status === 403) {
            // Mantém o blur e pede senha
            abrirPortalAcesso();
            return;
        }

        const result = await response.json();
        todasAsDemandas = result.data || [];
        roleUsuario = result.role || 'user';

        gerenciarMenuRelatorios(roleUsuario);
        atualizarInterface();

        // REMOVE O BLUR APÓS CARREGAR OS DADOS COM SUCESSO
        document.querySelector('main').classList.remove('blur-main');

    } catch (err) {
        console.error("Erro de conexão:", err);
        Swal.fire({
            title: 'Erro de Conexão',
            text: 'Não foi possível conectar ao servidor.',
            icon: 'error',
            confirmButtonColor: '#008D36'
        });
    }
}

/**
 * FILTRAGEM E ATUALIZAÇÃO DA TABELA
 */
function atualizarInterface() {
    const corpo = document.getElementById('tabela-corpo');
    const dashboard = document.querySelector('.dashboard');
    const termoBusca = document.getElementById('search').value.toLowerCase().trim();
    const filtroStatus = document.getElementById('filter-status').value;
    const filtroBairro = document.getElementById('filter-bairro').value;

    if (roleUsuario === 'admin' && dashboard) {
        dashboard.style.display = 'grid';
        document.getElementById('count-total').innerText = todasAsDemandas.length;
        document.getElementById('count-pendentes').innerText = todasAsDemandas.filter(d => d.status === 'PENDENTE').length;
        document.getElementById('count-enviadas').innerText = todasAsDemandas.filter(d => d.status === 'ENVIADA').length;
    } else if (dashboard) {
        dashboard.style.display = 'none';
    }

    const filtradas = todasAsDemandas.filter(d => {
        const sol = (d.solicitante || "").toLowerCase();
        const pro = (d.protocolo || "").toLowerCase();
        const end = (d.endereco || "").toLowerCase();
        const matchesSearch = sol.includes(termoBusca) || pro.includes(termoBusca) || end.includes(termoBusca);
        const matchesStatus = filtroStatus === 'TODOS' || d.status === filtroStatus;
        const matchesBairro = filtroBairro === 'TODOS' || d.bairro === filtroBairro;
        return matchesSearch && matchesStatus && matchesBairro;
    });

    corpo.innerHTML = '';
    if (filtradas.length === 0) {
        corpo.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px;">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    filtradas.slice().reverse().forEach(d => {
        const dataFormatada = d.data ? new Date(d.data).toLocaleDateString('pt-BR') : "-";
        const botaoAcao = roleUsuario === 'admin' 
            ? `<td data-label="Ação">
                <button class="btn-excluir" onclick="deletarProtocolo(${d.id})" title="Excluir Registro">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
               </td>` 
            : '<td data-label="Ação">-</td>';

        corpo.innerHTML += `
            <tr>
                <td data-label="Protocolo"><strong>${d.protocolo || "S/ PROT."}</strong></td>
                <td data-label="Data">${dataFormatada}</td>
                <td data-label="Solicitante"><strong>${d.solicitante || "Não informado"}</strong></td>
                <td data-label="Bairro">${d.bairro || "-"}</td>
                <td data-label="Tipo">${d.tipo || "-"}</td>
                <td data-label="Status"><span class="badge ${d.status === 'PENDENTE' ? 'badge-pendente' : 'badge-enviada'}">${d.status}</span></td>
                ${botaoAcao}
            </tr>`;
    });
}

/**
 * PORTAL DE ACESSO
 */
function abrirPortalAcesso() {
    Swal.fire({
        title: 'Consulta de Ocorrências',
        text: 'Identifique-se para visualizar o histórico de registros.',
        icon: 'info',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Administrador',
        denyButtonText: 'Cidadão (Protocolo)',
        cancelButtonText: 'Voltar',
        confirmButtonColor: '#008D36', 
        denyButtonColor: '#F39200',    
        cancelButtonColor: '#718096',  
        allowOutsideClick: false,
        customClass: { confirmButton: 'prefeitura-btn', denyButton: 'prefeitura-btn', cancelButton: 'prefeitura-btn' }
    }).then((result) => {
        if (result.isConfirmed) loginAdmin();
        else if (result.isDenied) loginCidadao();
        else window.location.href = 'index.html';
    });
}

async function loginAdmin() {
    const { value: formValues } = await Swal.fire({
        title: '🔒 Acesso Administrativo',
        html: `<div class="login-admin-container">
                <input id="swal-user" type="text" class="login-input" placeholder="Usuário">
                <input id="swal-pass" type="password" class="login-input" placeholder="Senha">
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'ENTRAR',
        confirmButtonColor: '#008D36',
        customClass: { confirmButton: 'prefeitura-btn', cancelButton: 'prefeitura-btn' },
        preConfirm: () => [document.getElementById('swal-user').value, document.getElementById('swal-pass').value]
    });
    if (formValues) realizarLogin(formValues[0], formValues[1]);
    else abrirPortalAcesso();
}

async function loginCidadao() {
    const { value: prot } = await Swal.fire({
        title: 'Consulta por Protocolo',
        input: 'text',
        inputPlaceholder: 'IPI-2026-1234',
        showCancelButton: true,
        confirmButtonText: 'CONSULTAR',
        confirmButtonColor: '#F39200',
        customClass: { confirmButton: 'prefeitura-btn', cancelButton: 'prefeitura-btn' },
        inputValidator: (v) => !v && 'Digite o protocolo!'
    });
    if (prot) realizarLogin(prot, null);
    else abrirPortalAcesso();
}

async function realizarLogin(identifier, password) {
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    if (data.success) {
        carregarDadosDoServidor();
    } else {
        Swal.fire({ title: 'Acesso Negado', text: 'Dados inválidos.', icon: 'error', confirmButtonColor: '#d33' }).then(abrirPortalAcesso);
    }
}

function gerenciarMenuRelatorios(role) {
    const navMenu = document.getElementById('nav-menu');
    if (role === 'admin' && !document.getElementById('btn-relatorios')) {
        const link = document.createElement('a');
        link.href = 'relatorios.html';
        link.id = 'btn-relatorios';
        link.innerText = 'RELATÓRIOS';
        navMenu.appendChild(link);
    }
}

async function deletarProtocolo(id) {
    const confirm = await Swal.fire({ title: 'Excluir?', text: 'Deseja apagar este registro?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' });
    if (confirm.isConfirmed) {
        await fetch(`/api/demandas/${id}`, { method: 'DELETE' });
        carregarDadosDoServidor();
    }
}

// LISTENERS
document.getElementById('search').addEventListener('input', atualizarInterface);
document.getElementById('filter-status').addEventListener('change', atualizarInterface);
document.getElementById('filter-bairro').addEventListener('change', atualizarInterface);

// INÍCIO
inicializarHistorico();