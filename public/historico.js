/**
 * FUNÇÃO DE ENTRADA: 
 * Limpa qualquer sessão anterior e força o pedido de identificação
 */
async function inicializarHistorico() {
    try {
        await fetch('/api/limpar-sessao');
        carregarDemandas();
    } catch (e) {
        console.error("Erro ao limpar sessão:", e);
    }
}

/**
 * Tenta buscar as demandas do servidor
 */
async function carregarDemandas() {
    try {
        const response = await fetch('/api/demandas');
        
        if (response.status === 403) {
            abrirPortalAcesso();
            return;
        }

        const result = await response.json(); 
        renderizarPagina(result);

    } catch (err) {
        console.error("Erro ao carregar:", err);
        Swal.fire({
            title: 'Erro de Conexão',
            text: 'Não foi possível conectar ao servidor da prefeitura.',
            icon: 'error',
            confirmButtonColor: '#F39200'
        });
    }
}

/**
 * Portal de Acesso (Admin vs Cidadão)
 */
function abrirPortalAcesso() {
    Swal.fire({
        title: 'Acesso ao Histórico',
        text: 'Identifique-se para visualizar os registros',
        icon: 'lock',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Administrador',
        denyButtonText: 'Cidadão (Protocolo)',
        cancelButtonText: 'Voltar',
        confirmButtonColor: '#008D36', // Verde
        denyButtonColor: '#F39200',    // Laranja
        allowOutsideClick: false,
        allowEscapeKey: false
    }).then((result) => {
        if (result.isConfirmed) loginAdmin();
        else if (result.isDenied) loginCidadao();
        else window.location.href = 'index.html';
    });
}

async function loginAdmin() {
    const { value: formValues } = await Swal.fire({
        title: 'Acesso Administrativo',
        html:
            '<input id="swal-user" class="swal2-input" placeholder="Usuário">' +
            '<input id="swal-pass" type="password" class="swal2-input" placeholder="Senha">',
        confirmButtonText: 'Entrar',
        confirmButtonColor: '#008D36',
        showCancelButton: true,
        preConfirm: () => [
            document.getElementById('swal-user').value,
            document.getElementById('swal-pass').value
        ]
    });
    if (formValues) fazerLogin(formValues[0], formValues[1]);
    else abrirPortalAcesso();
}

async function loginCidadao() {
    const { value: protocolo } = await Swal.fire({
        title: 'Consulta por Protocolo',
        input: 'text',
        inputPlaceholder: 'IPI-2024-XXXX',
        confirmButtonText: 'Consultar',
        confirmButtonColor: '#F39200',
        showCancelButton: true,
        inputValidator: (value) => !value && 'Você precisa digitar o protocolo!'
    });
    if (protocolo) fazerLogin(protocolo, null);
    else abrirPortalAcesso();
}

async function fazerLogin(identifier, password) {
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (data.success) carregarDemandas();
        else Swal.fire('Erro', 'Dados inválidos.', 'error').then(() => abrirPortalAcesso());
    } catch (err) {
        Swal.fire('Erro', 'Falha no servidor.', 'error');
    }
}

/**
 * RENDERIZAÇÃO DA PÁGINA
 */
function renderizarPagina(result) {
    const lista = result.data;
    const role = result.role;

    const corpo = document.getElementById('tabela-corpo');
    const dashboard = document.querySelector('.dashboard');
    const searchInput = document.getElementById('search');
    const filterStatus = document.getElementById('filter-status');

    // Controle do Dashboard (Só mostra se for Admin)
    if (role === 'user' && dashboard) {
        dashboard.style.display = 'none';
    } else if (dashboard) {
        dashboard.style.display = 'grid';
        document.getElementById('count-total').innerText = lista.length;
        document.getElementById('count-pendentes').innerText = lista.filter(d => d.status === 'PENDENTE').length;
        document.getElementById('count-enviadas').innerText = lista.filter(d => d.status === 'ENVIADA').length;
    }

    const search = searchInput.value.toLowerCase();
    const statusFiltro = filterStatus.value;
    corpo.innerHTML = '';

    const filtradas = lista.slice().reverse().filter(d => {
        const matchesSearch = d.solicitante.toLowerCase().includes(search) || 
                             d.bairro.toLowerCase().includes(search) ||
                             d.protocolo.toLowerCase().includes(search);
        const matchesStatus = statusFiltro === 'TODOS' || d.status === statusFiltro;
        return matchesSearch && matchesStatus;
    });

    if (filtradas.length === 0) {
        corpo.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color: #666;">Nenhuma demanda encontrada.</td></tr>';
        return;
    }

    filtradas.forEach(d => {
        const dataFormatada = new Date(d.data).toLocaleDateString('pt-BR');
        
        // Criamos o botão de excluir com ícone SVG PROFISSIONAL
        const acaoAdmin = role === 'admin' 
            ? `<td data-label="Ações">
                <button class="btn-excluir" onclick="deletarProtocolo(${d.id})" title="Excluir Registro">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
               </td>` 
            : '';

        corpo.innerHTML += `
            <tr>
                <td data-label="Protocolo"><strong>${d.protocolo}</strong></td>
                <td data-label="Data">${dataFormatada}</td>
                <td data-label="Solicitante"><strong>${d.solicitante}</strong></td>
                <td data-label="Bairro">${d.bairro}</td>
                <td data-label="Tipo">${d.tipo}</td>
                <td data-label="Status">
                    <span class="badge ${d.status === 'PENDENTE' ? 'badge-pendente' : 'badge-enviada'}">
                        ${d.status}
                    </span>
                </td>
                ${acaoAdmin}
            </tr>
        `;
    });
}

/**
 * FUNÇÃO DE EXCLUSÃO (APENAS ADMIN)
 */
async function deletarProtocolo(id) {
    const confirmacao = await Swal.fire({
        title: 'Excluir Registro?',
        text: "Esta ação não pode ser desfeita!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#008D36',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacao.isConfirmed) {
        try {
            const res = await fetch(`/api/demandas/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                Swal.fire('Excluído!', 'O registro foi removido com sucesso.', 'success');
                carregarDemandas();
            } else {
                Swal.fire('Erro', 'Não foi possível excluir o registro.', 'error');
            }
        } catch (e) {
            Swal.fire('Erro', 'Falha na conexão com o servidor.', 'error');
        }
    }
}

// Eventos de busca
document.getElementById('search').addEventListener('input', () => carregarDemandas());
document.getElementById('filter-status').addEventListener('change', () => carregarDemandas());

// Iniciar Processo
inicializarHistorico();