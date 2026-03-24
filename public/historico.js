async function carregarDemandas() {
    try {
        const response = await fetch('/api/demandas');
        const demandas = await response.json();
        renderizarPagina(demandas);
    } catch (err) {
        console.error("Erro ao carregar:", err);
    }
}

function renderizarPagina(lista) {
    const corpo = document.getElementById('tabela-corpo');
    const searchInput = document.getElementById('search');
    const filterStatus = document.getElementById('filter-status');

    const search = searchInput.value.toLowerCase();
    const statusFiltro = filterStatus.value;

    // Atualizar Contadores do Dashboard
    document.getElementById('count-total').innerText = lista.length;
    document.getElementById('count-pendentes').innerText = lista.filter(d => d.status === 'PENDENTE').length;
    document.getElementById('count-enviadas').innerText = lista.filter(d => d.status === 'ENVIADA').length;

    corpo.innerHTML = '';

    // Filtragem (Inverte a lista para mostrar o mais novo primeiro)
    const filtradas = lista.slice().reverse().filter(d => {
        const matchesSearch = d.solicitante.toLowerCase().includes(search) || d.bairro.toLowerCase().includes(search);
        const matchesStatus = statusFiltro === 'TODOS' || d.status === statusFiltro;
        return matchesSearch && matchesStatus;
    });

    if (filtradas.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma demanda encontrada.</td></tr>';
        return;
    }

    filtradas.forEach(d => {
        const dataFormatada = new Date(d.data).toLocaleDateString('pt-BR');
        corpo.innerHTML += `
            <tr>
                <td>${dataFormatada}</td>
                <td>${d.solicitante}</td>
                <td>${d.bairro}</td>
                <td>${d.tipo}</td>
                <td><span class="badge ${d.status === 'PENDENTE' ? 'badge-pendente' : 'badge-enviada'}">${d.status}</span></td>
            </tr>
        `;
    });
}

// Eventos para busca em tempo real
document.getElementById('search').addEventListener('input', carregarDemandas);
document.getElementById('filter-status').addEventListener('change', carregarDemandas);

// Iniciar carregamento
carregarDemandas();