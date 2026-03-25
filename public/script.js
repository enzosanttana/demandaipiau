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

    Swal.fire({
        title: 'Enviando Demanda',
        text: 'Por favor, aguarde enquanto geramos o seu protocolo...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    const formData = new FormData();
    formData.append('solicitante', document.getElementById('solicitante').value);
    formData.append('bairro', document.getElementById('bairro').value);
    formData.append('tipo', document.getElementById('tipo').value);
    formData.append('endereco', document.getElementById('endereco').value);
    formData.append('descricao', document.getElementById('descricao').value);
    formData.append('foto', fotoInput.files[0]);

    try {
        const response = await fetch('/nova-demanda', { method: 'POST', body: formData });
        const result = await response.json();

        if (response.ok && result.success) {
            Swal.fire({
                title: 'Demanda Registrada!',
                html: `
                    <p>Sua solicitação foi enviada com sucesso para a prefeitura.</p>
                    <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin-top: 15px; border: 2px dashed #008D36;">
                        <span style="font-size: 0.9rem; color: #666; display: block; margin-bottom: 5px;">SEU PROTOCOLO PARA CONSULTA:</span>
                        <strong style="font-size: 1.6rem; color: #F39200; letter-spacing: 2px;">${result.protocolo}</strong>
                    </div>
                    <p style="margin-top: 15px; font-size: 0.85rem; color: #888;">Anote este número. Você precisará dele no menu <b>Histórico</b>.</p>
                `,
                icon: 'success',
                confirmButtonColor: '#008D36',
                confirmButtonText: 'ENTENDI E ANOTEI'
            }).then(() => {
                form.reset();
                preview.innerHTML = '';
            });
        } else { throw new Error('Erro no servidor'); }
    } catch (err) {
        Swal.fire({
            title: 'Ops!',
            text: 'Ocorreu um erro ao enviar sua demanda.',
            icon: 'error',
            confirmButtonColor: '#F39200'
        });
    } finally {
        btn.disabled = false;
        btn.innerText = "SALVAR E ENVIAR DEMANDA";
    }
});