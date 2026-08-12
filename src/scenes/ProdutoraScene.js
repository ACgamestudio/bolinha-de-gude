// ---------- Cena inicial: botão INICIAR + vídeo da produtora + abertura ----------
// Mesma lógica do jogo de tampinhas: o clique em "INICIAR" é o único gesto real do
// usuário na página, então é nele que pedimos tela cheia, travamos a orientação em
// paisagem e só então tocamos os vídeos — assim eles já entram com som liberado e a
// tela já cheia desde o primeiro frame. Depois do vídeo da produtora, encadeia direto
// pro vídeo de abertura (sem precisar de um segundo clique) e só então segue pro Menu.
class ProdutoraScene extends Phaser.Scene {
    constructor() {
        super('ProdutoraScene');
    }

    preload() {
        Carregando.acompanhar(this, 'Carregando...');
        this.load.image('fundoMenuIniciar', 'assets/images/menu_bg.webp');
        this.load.video('videoProdutora', 'assets/video/produtora.mp4');
        this.load.video('videoAbertura', 'assets/video/abertura.mp4');
        this.load.audio('musicaFundo', 'assets/audio/musica.mp3');
    }

    create() {
        this.transicaoEmAndamento = false;

        this.add.image(480, 270, 'fundoMenuIniciar').setDisplaySize(960, 640);
        this.add.rectangle(480, 270, 960, 540, 0x000000, 0.4);

        this.videoProdutora = this.criarVideo('videoProdutora');
        this.videoAbertura = this.criarVideo('videoAbertura');
        this.videoAbertura.setVisible(false);

        this.videoProdutora.once('complete', () => this.tocarAbertura());
        this.videoAbertura.once('complete', () => this.iniciarJogo());

        this.mostrarBotaoIniciar();
    }

    // cria um vídeo já ajustado ao tamanho da tela (mantendo proporção) e com
    // playsinline pra não deixar o Android abrir o player nativo por conta própria
    criarVideo(chave) {
        const video = this.add.video(480, 270, chave);
        video.on('created', () => {
            const vw = video.video.videoWidth;
            const vh = video.video.videoHeight;
            const escala = Math.min(960 / vw, 540 / vh);
            video.setDisplaySize(vw * escala, vh * escala);
            video.setPosition(480, 270);

            const elVideo = video.video;
            elVideo.setAttribute('playsinline', '');
            elVideo.setAttribute('webkit-playsinline', '');
            elVideo.playsInline = true;
        });
        return video;
    }

    // ---------- tela cheia + paisagem (mesma lógica robusta do jogo de tampinhas) ----------
    pedirTelaCheia() {
        if (this.scale.isFullscreen) {
            this.travarPaisagem();
            return;
        }

        let jaTravou = false;
        const aoEntrarFullscreen = () => {
            if (jaTravou) return;
            jaTravou = true;
            this.travarPaisagem();
        };

        this.scale.once('enterfullscreen', aoEntrarFullscreen);
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) aoEntrarFullscreen();
        }, { once: true });
        this.time.delayedCall(600, aoEntrarFullscreen);

        if (this.scale.fullscreen.available) {
            try {
                this.scale.startFullscreen();
                return;
            } catch (e) {
                console.warn('[Bolinha de Gude] Erro ao pedir tela cheia via Phaser:', e);
            }
        }

        const el = document.documentElement;
        const pedir = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (pedir) {
            try { pedir.call(el); } catch (e) { console.warn('[Bolinha de Gude] Erro ao pedir tela cheia nativa:', e); }
        }
    }

    travarPaisagem() {
        try {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => {});
            }
        } catch (e) { /* sem suporte — a rotação via CSS já cobre isso */ }
    }

    // botão "INICIAR" = uma bolinha de gude girando, com o texto fixo por cima
    mostrarBotaoIniciar() {
        const tipo = TIPOS_DE_BOLINHA.find(t => t.nome === 'Furacão Verde') || TIPOS_DE_BOLINHA[0];
        const chave = criarTexturaBolinha(this, tipo);

        const bolinha = this.add.image(0, 0, chave).setScale(3.4);

        const rotulo = this.add.text(0, 0, 'INICIAR', {
            fontSize: '19px',
            fontFamily: 'Fredoka, Arial, sans-serif',
            fontStyle: '700',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5);

        const botao = this.add.container(480, 270, [bolinha, rotulo]).setAlpha(0);
        botao.setSize(190, 190);
        botao.setInteractive({ useHandCursor: true });

        let tweenGiro = this.tweens.add({ targets: bolinha, angle: 360, duration: 3200, repeat: -1 });

        botao.on('pointerover', () => {
            if (this.transicaoEmAndamento) return;
            if (tweenGiro) tweenGiro.stop();
            tweenGiro = this.tweens.add({ targets: bolinha, angle: bolinha.angle + 360, duration: 800, repeat: -1 });
            this.tweens.add({ targets: botao, scale: 1.06, duration: 150 });
        });

        botao.on('pointerout', () => {
            if (this.transicaoEmAndamento) return;
            if (tweenGiro) tweenGiro.stop();
            tweenGiro = this.tweens.add({ targets: bolinha, angle: bolinha.angle + 360, duration: 3200, repeat: -1 });
            this.tweens.add({ targets: botao, scale: 1, duration: 150 });
        });

        botao.on('pointerdown', () => {
            if (this.transicaoEmAndamento) return;
            this.tweens.add({ targets: botao, scale: 0.94, duration: 80 });
        });

        // dispara no soltar (pointerup), não no toque — mais confiável pro Chrome Android
        // liberar tela cheia de verdade nesse gesto
        botao.on('pointerup', () => {
            if (this.transicaoEmAndamento) return;
            this.transicaoEmAndamento = true;
            if (tweenGiro) tweenGiro.stop();
            botao.disableInteractive();
            this.comecar(botao, bolinha);
        });

        this.botaoIniciar = botao;
        this.tweens.add({ targets: botao, alpha: 1, duration: 400 });
    }

    comecar(botao, bolinha) {
        this.pedirTelaCheia();
        SomFX.iniciar();
        SomFX.atirar();

        // destrava o gerenciador de som do próprio Phaser nesse mesmo clique — é um
        // contexto de áudio separado do SomFX (que é Web Audio puro), e a música de
        // fundo depende dele especificamente
        if (this.sound && this.sound.context && this.sound.context.state === 'suspended') {
            this.sound.context.resume();
        }
        if (this.sound && this.sound.unlock) this.sound.unlock();

        this.tweens.add({ targets: bolinha, angle: bolinha.angle + 720, duration: 320, ease: 'cubic.out' });
        this.tweens.add({
            targets: botao,
            alpha: 0,
            scale: 0.9,
            duration: 300,
            delay: 100,
            onComplete: () => botao.destroy()
        });

        this.videoProdutora.setMute(false);
        this.videoProdutora.play(false);

        // segurança: se o vídeo não avisar que terminou, segue o jogo do mesmo jeito
        this.time.delayedCall(20000, () => this.tocarAbertura());
    }

    tocarAbertura() {
        if (this.trocandoParaAbertura) return;
        this.trocandoParaAbertura = true;

        this.videoProdutora.setVisible(false);
        this.videoAbertura.setVisible(true);
        this.videoAbertura.setMute(false);
        this.videoAbertura.setVolume(0.55);
        this.videoAbertura.play(false);

        MusicaFundo.tocar(this);

        this.time.delayedCall(20000, () => this.iniciarJogo());
    }

    iniciarJogo() {
        if (this.transicaoParaJogoFeita) return;
        this.transicaoParaJogoFeita = true;

        this.time.delayedCall(150, () => this.cameras.main.fadeOut(300, 0, 0, 0));
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    }
}
