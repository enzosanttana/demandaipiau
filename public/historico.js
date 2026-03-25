/**
 * FUNÇÃO DE ENTRADA: 
 * Limpa qualquer sessão anterior e força o pedido de identificação
 */
async function inicializarHistorico() {
    try {
        // 1. Comando invisível ao servidor para esquecer quem estava logado
        await fetch('/api/limpar-sessao');
        
        // 2. Agora tenta carregar (isso vai disparar o erro 403 e abrir o Portal)
        carregarDemandas();
    } catch (e) {
        console.error("Erro ao limpar sessão:", e);
    }
}

/**
 * Função para carregar as demandas (Tenta buscar, se falhar abre o Portal)
 */
async function carregarDemandas() {
    try {
        const response = await fetch('/api/demandas');
        
        // Se o servidor retornar 403 (Não autorizado), abre o portal de login
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
            text: 'Não foi possível conectar ao servidor.',
            icon: 'error',
            confirmButtonColor: '#F39200'
        });
    }
}

/**
 * Abre o alerta inicial perguntando o tipo de acesso
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
        if (result.isConfirmed) {
            loginAdmin();
        } else if (result.isDenied) {
            loginCidadao();
        } else {
            window.location.href = 'index.html';
        }
    });
}

/**
 * Modal de login para Administrador
 */
async function loginAdmin() {
    const { value: formValues } = await Swal.fire({
        title: 'Acesso Administrativo',
        html:
            '<input id="swal-user" class="swal2-input" placeholder="Usuário">' +
            '<input id="swal-pass" type="password" class="swal2-input" placeholder="Senha">',
        focusConfirm: false,
        confirmButtonText: 'Entrar',
        confirmButtonColor: '#008D36',
        showCancelButton: true,
        cancelButtonText: 'Voltar',
        preConfirm: () => {
            return [
                document.getElementById('swal-user').value,
                document.getElementById('swal-pass').value
            ]
        }
    });

    if (formValues) {
        fazerLogin(formValues[0], formValues[1]);
    } else {
        abrirPortalAcesso();
    }
}

/**
 * Modal de busca para Cidadão
 */
async function loginCidadao() {
    const { value: protocolo } = await Swal.fire({
        title: 'Consulta por Protocolo',
        input: 'text',
        inputLabel: 'Digite o número do seu protocolo',
        inputPlaceholder: 'IPI-2024-XXXX',
        confirmButtonText: 'Consultar',
        confirmButtonColor: '#F39200',
        showCancelButton: true,
        cancelButtonText: 'Voltar',
        inputValidator: (value) => {
            if (!value) return 'Você precisa digitar o protocolo!';
        }
    });

    if (protocolo) {
        fazerLogin(protocolo, null);
    } else {
        abrirPortalAcesso();
    }
}

/**
 * Envia as credenciais para o servidor
 */
async function fazerLogin(identifier, password) {
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });

        const data = await res.json();

        if (data.success) {
            // Login deu certo, carrega os dados
            carregarDemandas();
        } else {
            Swal.fire('Acesso Negado', 'Dados inválidos ou protocolo não encontrado.', 'error')
                .then(() => abrirPortalAcesso());
        }
    } catch (err) {
        Swal.fire('Erro', 'Falha na comunicação com o servidor.', 'error');
    }
}

/**
 * Renderiza os dados na tabela e Dashboard
 */
function renderizarPagina(result) {
    const lista = result.data;
    const role = result.role;

    const corpo = document.getElementById('tabela-corpo');
    const dashboard = document.querySelector('.dashboard');
    const searchInput = document.getElementById('search');
    const filterStatus = document.getElementById('filter-status');

    // 1. Controle do Dashboard: Só aparece para Admin
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

    // 2. Filtragem e Ordenação
    const filtradas = lista.slice().reverse().filter(d => {
        const matchesSearch = d.solicitante.toLowerCase().includes(search) || 
                             d.bairro.toLowerCase().includes(search) ||
                             d.protocolo.toLowerCase().includes(search);
        const matchesStatus = statusFiltro === 'TODOS' || d.status === statusFiltro;
        return matchesSearch && matchesStatus;
    });

    if (filtradas.length === 0) {
        corpo.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #666;">Nenhuma demanda encontrada.</td></tr>';
        return;
    }

    // 3. Construção da Tabela com data-label para Mobile
    filtradas.forEach(d => {
        const dataFormatada = new Date(d.data).toLocaleDateString('pt-BR');
        
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
            </tr>
        `;
    });
}

// Eventos de busca (SÓ FUNCIONAM SE ESTIVER LOGADO COMO ADMIN)
document.getElementById('search').addEventListener('input', () => carregarDemandas());
document.getElementById('filter-status').addEventListener('change', () => carregarDemandas());

// INICIALIZAÇÃO OBRIGATÓRIA LIMPANDO SESSÃO
inicializarHistorico();