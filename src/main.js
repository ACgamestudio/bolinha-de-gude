// ---------- Estado global (persiste entre cenas) ----------
const JogoState = {
    tipoEscolhido: TIPOS_DE_BOLINHA[0].nome
};

// ---------- Som sintetizado (sem arquivo de áudio nenhum, tudo Web Audio) ----------
const SomFX = {
    ctx: null,

    iniciar() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    criarRuido(duracao) {
        const tamanho = Math.max(1, Math.floor(this.ctx.sampleRate * duracao));
        const buffer = this.ctx.createBuffer(1, tamanho, this.ctx.sampleRate);
        const dados = buffer.getChannelData(0);
        for (let i = 0; i < tamanho; i++) dados[i] = Math.random() * 2 - 1;
        return buffer;
    },

    // "tec" de vidro — duas bolinhas se batendo. Curto, agudo, quase sem ressonância.
    bater(forca = 0.6) {
        this.iniciar();
        const t = this.ctx.currentTime;
        const pitch = Phaser.Math.Clamp(0.85 + forca * 0.4, 0.8, 1.6);

        const estalo = this.ctx.createBufferSource();
        estalo.buffer = this.criarRuido(0.02);
        const filtro = this.ctx.createBiquadFilter();
        filtro.type = 'bandpass';
        filtro.frequency.setValueAtTime(3600 * pitch, t);
        filtro.Q.setValueAtTime(3, t);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35 * Math.min(1, 0.4 + forca), t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        estalo.connect(filtro).connect(gain).connect(this.ctx.destination);
        estalo.start(t);
        estalo.stop(t + 0.06);

        [1, 2.6].forEach((razao, i) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1800 * pitch * razao, t);
            g.gain.setValueAtTime(0.08 / (i + 1), t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
            osc.connect(g).connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.1);
        });
    },

    // som do tiro saindo (o "flick" do dedo soltando a bolinha)
    atirar() {
        this.iniciar();
        const t = this.ctx.currentTime;
        const ruido = this.ctx.createBufferSource();
        ruido.buffer = this.criarRuido(0.05);
        const filtro = this.ctx.createBiquadFilter();
        filtro.type = 'highpass';
        filtro.frequency.setValueAtTime(1800, t);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        ruido.connect(filtro).connect(gain).connect(this.ctx.destination);
        ruido.start(t);
        ruido.stop(t + 0.06);
    },

    // bolinha saiu do triângulo — blip curto e feliz
    ponto() {
        this.iniciar();
        const t = this.ctx.currentTime;
        [880, 1320].forEach((freq, i) => {
            const tt = t + i * 0.06;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, tt);
            gain.gain.setValueAtTime(0.001, tt);
            gain.gain.linearRampToValueAtTime(0.18, tt + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, tt + 0.14);
            osc.connect(gain).connect(this.ctx.destination);
            osc.start(tt);
            osc.stop(tt + 0.15);
        });
    },

    vitoria() {
        this.iniciar();
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            const t = this.ctx.currentTime + i * 0.12;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.001, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.connect(gain).connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.4);
        });
    }
};

// ---------- Música de fundo (menu → seleção, para quando o Quitar começa) ----------
const MusicaFundo = {
    instancia: null,

    tocar(scene) {
        if (!this.instancia) {
            this.instancia = scene.sound.add('musicaFundo', { loop: true, volume: 0.45 });
        }
        if (JogoState.somAtivo === false) return;
        if (!this.instancia.isPlaying) this.instancia.play();
    },

    // fade out suave usando o tween manager da cena que está chamando (não precisa ser
    // a mesma cena que tocou a música — o Phaser tuenda qualquer objeto com props numéricas)
    parar(scene, duracaoMs = 700) {
        if (!this.instancia || !this.instancia.isPlaying) return;
        scene.tweens.add({
            targets: this.instancia,
            volume: 0,
            duration: duracaoMs,
            onComplete: () => { if (this.instancia) this.instancia.stop(); }
        });
    }
};


function sinalPonto(p1, p2, p3) {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

function pontoDentroTriangulo(pt, v1, v2, v3) {
    const d1 = sinalPonto(pt, v1, v2);
    const d2 = sinalPonto(pt, v2, v3);
    const d3 = sinalPonto(pt, v3, v1);
    const temNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const temPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(temNeg && temPos);
}

// devolve os 3 vértices de um triângulo equilátero "de ponta pra cima" centrado em (cx,cy)
function verticesTriangulo(cx, cy, lado) {
    const altura = lado * Math.sqrt(3) / 2;
    return {
        topo: { x: cx, y: cy - altura * 2 / 3 },
        baseEsq: { x: cx - lado / 2, y: cy + altura / 3 },
        baseDir: { x: cx + lado / 2, y: cy + altura / 3 }
    };
}

// ---------- Botão pequeno de tela cheia (mesmo padrão do jogo de tampinhas) ----------
function criarBotaoTelaCheia(scene) {
    if (!scene.scale.fullscreen.available) return null;

    const botao = scene.add.text(34, 506, '⛶', {
        fontSize: '22px',
        fontFamily: 'Arial',
        color: '#ffffff',
        backgroundColor: '#00000066',
        padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });

    const atualizarIcone = () => botao.setText(scene.scale.isFullscreen ? '⤢' : '⛶');

    botao.on('pointerover', () => botao.setStyle({ backgroundColor: '#000000aa' }));
    botao.on('pointerout', () => botao.setStyle({ backgroundColor: '#00000066' }));
    botao.on('pointerup', () => {
        if (scene.scale.isFullscreen) {
            scene.scale.stopFullscreen();
        } else {
            scene.scale.startFullscreen();
            try {
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(() => {});
                }
            } catch (e) { /* navegador sem suporte — segue com a rotação via CSS */ }
        }
    });

    scene.scale.on('enterfullscreen', atualizarIcone);
    scene.scale.on('leavefullscreen', atualizarIcone);

    return botao;
}

// botão retangular padrão usado nos menus — fundo semitransparente, texto centralizado
function criarBotaoEstilizado(scene, x, y, largura, altura, texto, corFundo, corBorda, corTexto, aoClicar) {
    const g = scene.add.graphics();
    g.fillStyle(corFundo, 0.85);
    g.fillRoundedRect(-largura / 2, -altura / 2, largura, altura, 10);
    g.lineStyle(3, corBorda, 1);
    g.strokeRoundedRect(-largura / 2, -altura / 2, largura, altura, 10);

    const rotulo = scene.add.text(0, 0, texto, {
        fontSize: '19px',
        fontFamily: 'Fredoka, Arial, sans-serif',
        fontStyle: '600',
        color: corTexto
    }).setOrigin(0.5);

    const botao = scene.add.container(x, y, [g, rotulo]);
    botao.setSize(largura, altura);
    botao.setInteractive({ useHandCursor: true });

    botao.on('pointerover', () => scene.tweens.add({ targets: botao, scale: 1.04, duration: 100 }));
    botao.on('pointerout', () => scene.tweens.add({ targets: botao, scale: 1, duration: 100 }));
    botao.on('pointerup', aoClicar);

    return botao;
}

const config = {
    type: Phaser.AUTO,
    width: 960,
    height: 540,
    parent: 'game',
    backgroundColor: '#2a1608',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        fullscreenTarget: document.documentElement
    },
    scene: [ProdutoraScene, MenuScene, SelecaoScene, QuitarScene]
};

function iniciarJogo() {
    window.game = new Phaser.Game(config);
}

if (document.fonts && document.fonts.load) {
    Promise.race([
        Promise.all([
            document.fonts.load('600 40px Fredoka'),
            document.fonts.load('700 48px Fredoka')
        ]),
        new Promise(resolve => setTimeout(resolve, 500))
    ]).then(iniciarJogo);
} else {
    iniciarJogo();
}
