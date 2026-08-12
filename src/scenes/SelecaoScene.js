class SelecaoScene extends Phaser.Scene {
    constructor() {
        super('SelecaoScene');
    }

    preload() {
        Carregando.acompanhar(this, 'Carregando...');
        this.load.image('fundoQuintalSelecao', 'assets/images/quintal_bg.webp');
    }

    create() {
        criarBotaoTelaCheia(this);
        MusicaFundo.tocar(this);

        // mesmo fundo de terra do jogo, recortado quadrado e escurecido — dá contexto
        // sem competir com a grade de bolinhas
        this.add.image(480, 270, 'fundoQuintalSelecao')
            .setCrop(181, 0, 1086, 1086)
            .setDisplaySize(960, 540);
        this.add.rectangle(480, 270, 960, 540, 0x1a0f06, 0.55);

        this.add.text(480, 42, 'ESCOLHA SUA BOLINHA', {
            fontSize: '26px',
            fontFamily: 'Fredoka, Arial, sans-serif',
            fontStyle: '700',
            color: '#ffe066',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5);

        this.textoNome = this.add.text(480, 300, '', {
            fontSize: '20px',
            fontFamily: 'Fredoka, Arial, sans-serif',
            fontStyle: '700',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.textoPontoForte = this.add.text(480, 328, '', {
            fontSize: '15px',
            fontFamily: 'Fredoka, Arial, sans-serif',
            fontStyle: 'italic',
            color: '#ffe8b8'
        }).setOrigin(0.5);

        this.anelSelecao = this.add.graphics();

        this.itens = [];
        const colunas = 4;
        const espacoX = 168;
        const espacoY = 92;
        const inicioX = 480 - espacoX * (colunas - 1) / 2;
        const inicioY = 130;

        TIPOS_DE_BOLINHA.forEach((tipo, i) => {
            const col = i % colunas;
            const lin = Math.floor(i / colunas);
            const x = inicioX + col * espacoX;
            const y = inicioY + lin * espacoY;
            this.criarItem(tipo, x, y);
        });

        this.selecionar(TIPOS_DE_BOLINHA.find(t => t.nome === JogoState.tipoEscolhido) || TIPOS_DE_BOLINHA[0]);

        criarBotaoEstilizado(this, 140, 500, 180, 46, '◀ Voltar', 0x3e2412, 0x1c0f06, '#ffe8c8', () => {
            this.cameras.main.fadeOut(250, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
        });

        criarBotaoEstilizado(this, 820, 500, 180, 46, 'JOGAR ▶', 0x1f7a3d, 0x0f4a22, '#ffffff', () => {
            SomFX.ponto();
            this.cameras.main.fadeOut(250, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('QuitarScene'));
        });
    }

    criarItem(tipo, x, y) {
        const chave = criarTexturaBolinha(this, tipo);
        const sprite = this.add.image(x, y, chave).setDisplaySize(52, 52);

        const zona = this.add.zone(x, y, 64, 64).setInteractive({ useHandCursor: true });
        zona.on('pointerup', () => {
            SomFX.ponto();
            this.selecionar(tipo);
        });
        zona.on('pointerover', () => this.tweens.add({ targets: sprite, scale: 1.15, duration: 100 }));
        zona.on('pointerout', () => this.tweens.add({ targets: sprite, scale: 1, duration: 100 }));

        this.itens.push({ tipo, x, y, sprite });
    }

    selecionar(tipo) {
        JogoState.tipoEscolhido = tipo.nome;
        this.textoNome.setText(tipo.nome);
        this.textoPontoForte.setText('★ ' + tipo.pontoForte);

        const item = this.itens.find(it => it.tipo.nome === tipo.nome);
        this.anelSelecao.clear();
        if (item) {
            this.anelSelecao.lineStyle(3, 0xffe066, 1);
            this.anelSelecao.strokeCircle(item.x, item.y, 34);
        }
    }
}
