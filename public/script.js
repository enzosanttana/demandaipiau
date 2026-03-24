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
    btn.innerText = "Processando...";

    // Alerta de carregamento (Loading)
    Swal.fire({
        title: 'Enviando Demanda',
        text: 'Por favor, aguarde enquanto geramos o PDF e enviamos para o WhatsApp...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

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
            Swal.fire({
                title: 'Sucesso!',
                text: 'Sua demanda foi registrada e enviada com sucesso para a prefeitura.',
                icon: 'success',
                confirmButtonColor: '#008D36', // Verde Ipiaú
                confirmButtonText: 'Ótimo!'
            }).then(() => {
                form.reset();
                preview.innerHTML = '';
                window.location.href = "historico.html"; // Redireciona após o OK
            });
        } else {
            throw new Error('Erro no servidor');
        }
    } catch (err) {
        Swal.fire({
            title: 'Ops!',
            text: 'Ocorreu um erro ao enviar sua demanda. Verifique sua conexão ou se o WhatsApp está conectado.',
            icon: 'error',
            confirmButtonColor: '#F39200', // Laranja Ipiaú
            confirmButtonText: 'Tentar novamente'
        });
    } finally {
        btn.disabled = false;
        btn.innerText = "SALVAR E ENVIAR DEMANDA";
    }
});