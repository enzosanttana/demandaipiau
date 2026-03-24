const form = document.getElementById('formDemanda');
const fotoInput = document.getElementById('foto');
const preview = document.getElementById('preview-container');

// Mostrar preview da foto
fotoInput.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}">`;
        };
        reader.readAsDataURL(file);
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('btnSalvar');
    btn.disabled = true;
    btn.innerText = "Processando e Enviando...";

    const formData = new FormData();
    formData.append('solicitante', document.getElementById('solicitante').value);
    formData.append('bairro', document.getElementById('bairro').value);
    formData.append('tipo', document.getElementById('tipo').value);
    formData.append('endereco', document.getElementById('endereco').value);
    formData.append('descricao', document.getElementById('descricao').value);
    formData.append('foto', fotoInput.files[0]);

    try {
        const response = await fetch('/nova-demanda', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            alert("Sucesso! Sua demanda foi registrada e enviada para a prefeitura.");
            form.reset();
            preview.innerHTML = '';
        } else {
            alert("Erro ao enviar. Tente novamente.");
        }
    } catch (err) {
        console.error(err);
        alert("Erro de conexão com o servidor.");
    } finally {
        btn.disabled = false;
        btn.innerText = "SALVAR E ENVIAR DEMANDA";
    }
});