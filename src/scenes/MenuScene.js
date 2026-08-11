// A arte de fundo (menu_bg) já vem com o título "BOLINHA DE GUDE" e os 3 botões
// desenhados nela (JOGAR / OPÇÕES / SAIR), gravados na terra. Em vez de desenhar texto
// por cima (e duplicar), a cena só posiciona zonas clicáveis invisíveis exatamente nas
// caixinhas já existentes na imagem, com um brilho sutil no hover pra dar feedback.
class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    preload() {
        Carregando.acompanhar(this, 'Carregando...');
        this.load.image('fundoMenu', 'assets/images/menu_bg.webp');
    }

    create() {
        criarBotaoTelaCheia(this);

        // fundo cobrindo o canvas inteiro (960x540) mantendo a proporção original da
        // imagem — sobra de altura fica cortada pela própria câmera, sem distorcer nada
        this.add.image(480, 270, 'fundoMenu').setDisplaySize(960, 640);

        // zonas clicáveis sobre as caixinhas já desenhadas na imagem
        this.criarZonaBotao(477, 414, 174, 37, () => this.irParaSelecao());
        this.criarZonaBotao(477, 456, 174, 38, () => this.abrirOpcoes());
        this.criarZonaBotao(477, 498, 174, 37, () => this.tentarSair());

        this.textoToast = this.add.text(480, 360, '', {
            fontSize: '15px',
            fontFamily: 'Fredoka, Arial, sans-serif',
            fontStyle: '600',
            color: '#ffe8b8',
            stroke: '#000000',
            strokeThickness: 4,
            backgroundColor: '#00000066',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setAlpha(0);
    }

    criarZonaBotao(x, y, largura, altura, aoClicar) {
        const destaque = this.add.graphics().setAlpha(0);
        destaque.lineStyle(2, 0xffe066, 0.9);
        destaque.strokeRoundedRect(-largura / 2, -altura / 2, largura, altura, 6);

        const zona = this.add.container(x, y, [destaque]);
        zona.setSize(largura, altura);
        zona.setInteractive({ useHandCursor: true });

        zona.on('pointerover', () => destaque.setAlpha(1));
        zona.on('pointerout', () => destaque.setAlpha(0));
        zona.on('pointerup', () => {
            SomFX.ponto();
            aoClicar();
        });

        return zona;
    }

    irParaSelecao() {
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('SelecaoScene'));
    }

    abrirOpcoes() {
        JogoState.somAtivo = !JogoState.somAtivo;
        this.mostrarToast(JogoState.somAtivo ? '🔊 Som ligado' : '🔇 Som desligado');
    }

    tentarSair() {
        this.mostrarToast('Pode fechar essa aba quando quiser 👋');
        window.close();
    }

    mostrarToast(msg) {
        this.textoToast.setText(msg);
        this.tweens.killTweensOf(this.textoToast);
        this.textoToast.setAlpha(1);
        this.tweens.add({ targets: this.textoToast, alpha: 0, delay: 1400, duration: 400 });
    }
}
