class QuitarScene extends Phaser.Scene {
    constructor() {
        super('QuitarScene');
    }

    preload() {
        Carregando.acompanhar(this, 'Carregando...');
        this.load.image('fundoQuintalJogo', 'assets/images/quintal_bg.webp');
    }

    create() {
        criarBotaoTelaCheia(this);

        this.CAMPO = { x1: 270, y1: 34, x2: 690, y2: 454 };
        this.CENTRO_TRIANGULO = { x: 480, y: 244 };
        this.LADO_TRIANGULO = 112;
        this.RAIO_PROIBIDO_POSICIONAMENTO = 86;
        this.VELOCIDADE_MIN_TIRO = 160;
        this.VELOCIDADE_MAX_TIRO = 760;

        this.pontosJogador = 0;
        this.pontosBot = 0;
        this.jogadorDaVez = 'jogador';
        this.fase = null;
        this.anguloAtual = 225; // mirando de baixo-esquerda pro centro por padrão
        this.forcaAtual = 55;

        this.criarCenario();
        this.criarBolinhasDoTriangulo();
        this.criarBolinhasDosJogadores();
        this.criarHud();
        this.criarUiPosicionamento();
        this.criarUiMira();
        this.criarPainelResultado();

        this.iniciarTurno();
    }

    // ---------- Cenário ----------
    criarCenario() {
        this.add.image(480, 270, 'fundoQuintalJogo')
            .setCrop(181, 0, 1086, 1086)
            .setDisplaySize(960, 960); // recorte quadrado + tamanho quadrado = sem distorção; sobra é cortada pela câmera
        this.add.rectangle(480, 270, 960, 540, 0x000000, 0.45);

        const campo = this.CAMPO;
        const larguraCampo = campo.x2 - campo.x1;
        const alturaCampo = campo.y2 - campo.y1;

        // terra do campo em destaque (mesma foto, só que nítida e recortada quadrada)
        this.add.image((campo.x1 + campo.x2) / 2, (campo.y1 + campo.y2) / 2, 'fundoQuintalJogo')
            .setCrop(181, 0, 1086, 1086)
            .setDisplaySize(larguraCampo, alturaCampo);

        const moldura = this.add.graphics();
        moldura.lineStyle(5, 0xf0d9a8, 0.6);
        moldura.strokeRect(campo.x1, campo.y1, larguraCampo, alturaCampo);
        moldura.lineStyle(2, 0x3e2412, 0.7);
        moldura.strokeRect(campo.x1 - 3, campo.y1 - 3, larguraCampo + 6, alturaCampo + 6);

        // triângulo riscado na terra
        const v = verticesTriangulo(this.CENTRO_TRIANGULO.x, this.CENTRO_TRIANGULO.y, this.LADO_TRIANGULO);
        this.verticesTriangulo = v;
        const risco = this.add.graphics();
        risco.lineStyle(3, 0xfff3d6, 0.85);
        risco.beginPath();
        risco.moveTo(v.topo.x, v.topo.y);
        risco.lineTo(v.baseDir.x, v.baseDir.y);
        risco.lineTo(v.baseEsq.x, v.baseEsq.y);
        risco.closePath();
        risco.strokePath();
    }

    // ---------- Bolinhas-alvo do triângulo ----------
    criarBolinhasDoTriangulo() {
        const tipos = Phaser.Utils.Array.Shuffle(TIPOS_DE_BOLINHA.slice()).slice(0, 5);
        const c = this.CENTRO_TRIANGULO;
        // pequeno cluster de 5 posições ao redor do centro do triângulo, com jitter
        const offsets = [
            { x: 0, y: 0 },
            { x: -16, y: -12 }, { x: 16, y: -12 },
            { x: -16, y: 14 }, { x: 16, y: 14 }
        ];

        this.bolinhasAlvo = tipos.map((tipo, i) => {
            const off = offsets[i];
            const jitterX = Phaser.Math.FloatBetween(-3, 3);
            const jitterY = Phaser.Math.FloatBetween(-3, 3);
            const b = new Bolinha(this, c.x + off.x + jitterX, c.y + off.y + jitterY, tipo, null);
            b.ehAlvo = true;
            return b;
        });
    }

    criarBolinhasDosJogadores() {
        const tipoJogador = TIPOS_DE_BOLINHA.find(t => t.nome === JogoState.tipoEscolhido) || TIPOS_DE_BOLINHA[0];
        const tiposRestantes = TIPOS_DE_BOLINHA.filter(t => t.nome !== tipoJogador.nome);
        const tipoBot = Phaser.Utils.Array.GetRandom(tiposRestantes.length ? tiposRestantes : TIPOS_DE_BOLINHA);

        this.bolinhaJogador = new Bolinha(this, this.CAMPO.x1 + 40, this.CAMPO.y2 - 40, tipoJogador, 'jogador');
        this.bolinhaBot = new Bolinha(this, this.CAMPO.x2 - 40, this.CAMPO.y1 + 40, tipoBot, 'bot');

        this.bolinhaJogador.sprite.setDepth(5);
        this.bolinhaBot.sprite.setDepth(5);
    }

    // ---------- HUD ----------
    criarHud() {
        this.textoStatus = this.add.text(480, 14, '', {
            fontSize: '17px',
            fontFamily: 'Fredoka, Arial, sans-serif',
            fontStyle: '700',
            color: '#ffe066',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        const painel = (x, tipo, cor) => {
            const c = this.add.container(x, 130);
            const fundo = this.add.graphics();
            fundo.fillStyle(0x1a0f06, 0.75);
            fundo.fillRoundedRect(-70, -55, 140, 110, 10);
            fundo.lineStyle(2, cor, 0.9);
            fundo.strokeRoundedRect(-70, -55, 140, 110, 10);
            const chave = criarTexturaBolinha(this, tipo);
            const prev = this.add.image(0, -20, chave).setDisplaySize(44, 44);
            const nome = this.add.text(0, 8, tipo.nome, {
                fontSize: '11px', fontFamily: 'Fredoka, Arial, sans-serif', color: '#ffe8c8', align: 'center', wordWrap: { width: 130 }
            }).setOrigin(0.5);
            const placar = this.add.text(0, 32, '0', {
                fontSize: '24px', fontFamily: 'Fredoka, Arial, sans-serif', fontStyle: '700', color: '#ffffff'
            }).setOrigin(0.5);
            c.add([fundo, prev, nome, placar]);
            return placar;
        };

        this.placarJogadorTxt = painel(135, this.bolinhaJogador.tipo, 0x2ecc71);
        this.placarBotTxt = painel(825, this.bolinhaBot.tipo, 0xe74c3c);

        this.textoRestantes = this.add.text(480, 470, '', {
            fontSize: '13px',
            fontFamily: 'Fredoka, Arial, sans-serif',
            color: '#ffe8c8'
        }).setOrigin(0.5).setDepth(10);
    }

    atualizarPlacar() {
        this.placarJogadorTxt.setText(String(this.pontosJogador));
        this.placarBotTxt.setText(String(this.pontosBot));
        const restantes = this.bolinhasAlvo.filter(b => !b.removida).length;
        this.textoRestantes.setText(restantes + ' bolinha' + (restantes === 1 ? '' : 's') + ' no triângulo');
    }

    // ---------- UI de posicionamento ----------
    criarUiPosicionamento() {
        this.dicaPosicionar = this.add.text(480, 500, 'Arraste sua bolinha até o lugar', {
            fontSize: '14px', fontFamily: 'Fredoka, Arial, sans-serif', fontStyle: '600', color: '#ffffff',
            backgroundColor: '#000000aa', padding: { x: 10, y: 4 }
        }).setOrigin(0.5).setDepth(20);

        this.botaoConfirmarPosicao = criarBotaoEstilizado(this, 480, 522, 200, 34, '✔ Confirmar posição', 0x1f7a3d, 0x0f4a22, '#ffffff', () => {
            this.encerrarPosicionamento();
        });
        this.botaoConfirmarPosicao.setDepth(20);

        this.textoBotJogando = this.add.text(480, 500, '🤖 Bot escolhendo posição...', {
            fontSize: '14px', fontFamily: 'Fredoka, Arial, sans-serif', fontStyle: '600', color: '#ffd76b',
            backgroundColor: '#000000aa', padding: { x: 10, y: 4 }
        }).setOrigin(0.5).setDepth(20);

        this.bolinhaJogador.sprite.setInteractive({ useHandCursor: true });
        this.input.setDraggable(this.bolinhaJogador.sprite);

        this.bolinhaJogador.sprite.on('drag', (pointer, dragX, dragY) => {
            this.bolinhaJogador.sprite.setPosition(dragX, dragY);
        });
        this.bolinhaJogador.sprite.on('dragend', () => {
            const pos = this.ajustarPosicaoValida(this.bolinhaJogador.sprite.x, this.bolinhaJogador.sprite.y, this.bolinhaJogador);
            this.bolinhaJogador.x = pos.x;
            this.bolinhaJogador.y = pos.y;
            this.bolinhaJogador.atualizarSprite();
        });
    }

    // empurra um ponto pra fora da zona proibida do triângulo e afasta de outras bolinhas,
    // sempre mantendo dentro dos limites do campo — usado tanto pro jogador (ao soltar o
    // arrasto) quanto pra posição escolhida pelo bot
    ajustarPosicaoValida(x, y, ignorar) {
        const c = this.CENTRO_TRIANGULO;
        let px = Phaser.Math.Clamp(x, this.CAMPO.x1 + 18, this.CAMPO.x2 - 18);
        let py = Phaser.Math.Clamp(y, this.CAMPO.y1 + 18, this.CAMPO.y2 - 18);

        for (let i = 0; i < 40; i++) {
            const distCentro = Math.hypot(px - c.x, py - c.y);
            if (distCentro < this.RAIO_PROIBIDO_POSICIONAMENTO) {
                const ang = distCentro === 0 ? Math.random() * Math.PI * 2 : Math.atan2(py - c.y, px - c.x);
                px = c.x + Math.cos(ang) * (this.RAIO_PROIBIDO_POSICIONAMENTO + 2);
                py = c.y + Math.sin(ang) * (this.RAIO_PROIBIDO_POSICIONAMENTO + 2);
                px = Phaser.Math.Clamp(px, this.CAMPO.x1 + 18, this.CAMPO.x2 - 18);
                py = Phaser.Math.Clamp(py, this.CAMPO.y1 + 18, this.CAMPO.y2 - 18);
                continue;
            }

            let empurrado = false;
            for (const outra of this.todasBolinhas()) {
                if (outra === ignorar) continue;
                const d = Math.hypot(px - outra.x, py - outra.y);
                const minimo = outra.raio + 14 + 2;
                if (d < minimo) {
                    const ang = d === 0 ? Math.random() * Math.PI * 2 : Math.atan2(py - outra.y, px - outra.x);
                    px = outra.x + Math.cos(ang) * minimo;
                    py = outra.y + Math.sin(ang) * minimo;
                    empurrado = true;
                }
            }
            if (!empurrado) break;
        }

        return { x: px, y: py };
    }

    todasBolinhas() {
        return [...this.bolinhasAlvo, this.bolinhaJogador, this.bolinhaBot];
    }

    // ---------- UI de mira (ângulo + força por botões) ----------
    criarUiMira() {
        this.setaMira = this.add.graphics().setDepth(15);

        const y = 500;
        const passo = (delta) => () => {
            this.anguloAtual = Phaser.Math.Wrap(this.anguloAtual + delta, 0, 360);
            this.desenharSetaMira();
        };

        this.botaoAnguloMenos = this.criarBotaoRedondo(340, y, '◀', passo(-5));
        this.textoAngulo = this.add.text(390, y, '0°', {
            fontSize: '15px', fontFamily: 'Fredoka, Arial, sans-serif', fontStyle: '700', color: '#ffffff'
        }).setOrigin(0.5).setDepth(20);
        this.botaoAnguloMais = this.criarBotaoRedondo(440, y, '▶', passo(5));

        this.labelAngulo = this.add.text(390, y - 22, 'ÂNGULO', {
            fontSize: '11px', fontFamily: 'Fredoka, Arial, sans-serif', color: '#ffe8c8'
        }).setOrigin(0.5).setDepth(20);

        this.barraForcaFundo = this.add.graphics().setDepth(20);
        this.barraForcaPreenchimento = this.add.graphics().setDepth(20);
        this.textoForca = this.add.text(650, y - 22, 'FORÇA', {
            fontSize: '11px', fontFamily: 'Fredoka, Arial, sans-serif', color: '#ffe8c8'
        }).setOrigin(0.5).setDepth(20);

        this.botaoForcaMenos = this.criarBotaoRedondo(578, y, '−', () => this.ajustarForca(-10));
        this.botaoForcaMais = this.criarBotaoRedondo(722, y, '+', () => this.ajustarForca(10));

        this.botaoAtirar = criarBotaoEstilizado(this, 850, y, 150, 40, '🎯 ATIRAR!', 0xc0392b, 0x6e1c11, '#ffffff', () => {
            this.atirar('jogador');
        });
        this.botaoAtirar.setDepth(20);

        this.gruposMiraElementos = [
            this.botaoAnguloMenos, this.botaoAnguloMais, this.textoAngulo,
            this.botaoForcaMenos, this.botaoForcaMais, this.botaoAtirar,
            this.barraForcaFundo, this.barraForcaPreenchimento, this.textoForca,
            this.labelAngulo
        ];

        this.desenharBarraForca();
        this.desenharSetaMira();
    }

    criarBotaoRedondo(x, y, label, aoClicar) {
        const g = this.add.graphics();
        g.fillStyle(0x3e2412, 0.9);
        g.fillCircle(0, 0, 17);
        g.lineStyle(2, 0x1c0f06, 1);
        g.strokeCircle(0, 0, 17);
        const txt = this.add.text(0, 0, label, {
            fontSize: '16px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffe8c8'
        }).setOrigin(0.5);
        const botao = this.add.container(x, y, [g, txt]).setDepth(20);
        botao.setSize(34, 34);
        botao.setInteractive({ useHandCursor: true });
        botao.on('pointerover', () => this.tweens.add({ targets: botao, scale: 1.1, duration: 80 }));
        botao.on('pointerout', () => this.tweens.add({ targets: botao, scale: 1, duration: 80 }));
        botao.on('pointerup', aoClicar);
        return botao;
    }

    ajustarForca(delta) {
        this.forcaAtual = Phaser.Math.Clamp(this.forcaAtual + delta, 10, 100);
        this.desenharBarraForca();
    }

    desenharBarraForca() {
        const x = 600, y = 500, largura = 110, altura = 16;
        this.barraForcaFundo.clear();
        this.barraForcaFundo.fillStyle(0x1a0f06, 0.85);
        this.barraForcaFundo.fillRoundedRect(x, y - altura / 2, largura, altura, 6);
        this.barraForcaFundo.lineStyle(2, 0xf0d9a8, 0.6);
        this.barraForcaFundo.strokeRoundedRect(x, y - altura / 2, largura, altura, 6);

        this.barraForcaPreenchimento.clear();
        const w = (largura - 4) * (this.forcaAtual / 100);
        const cor = this.forcaAtual > 75 ? 0xe74c3c : (this.forcaAtual > 40 ? 0xf1c40f : 0x2ecc71);
        this.barraForcaPreenchimento.fillStyle(cor, 1);
        this.barraForcaPreenchimento.fillRoundedRect(x + 2, y - altura / 2 + 2, Math.max(2, w), altura - 4, 4);
    }

    desenharSetaMira() {
        this.textoAngulo.setText(Math.round(this.anguloAtual) + '°');
        this.setaMira.clear();
        if (this.fase !== 'mirando' || !this.bolinhaJogador) return;
        const rad = Phaser.Math.DegToRad(this.anguloAtual);
        const bx = this.bolinhaJogador.x, by = this.bolinhaJogador.y;
        const comprimento = 34;
        const ex = bx + Math.cos(rad) * comprimento;
        const ey = by + Math.sin(rad) * comprimento;
        this.setaMira.lineStyle(3, 0xffe066, 0.95);
        this.setaMira.lineBetween(bx, by, ex, ey);
        this.setaMira.fillStyle(0xffe066, 0.95);
        this.setaMira.fillCircle(ex, ey, 4);
    }

    mostrarUiMira(mostrar) {
        this.gruposMiraElementos.forEach(el => el.setVisible(mostrar));
        this.setaMira.setVisible(mostrar);
        if (mostrar) this.desenharSetaMira(); else this.setaMira.clear();
    }

    // ---------- Fluxo de turno ----------
    iniciarTurno() {
        this.textoStatus.setText(this.jogadorDaVez === 'jogador' ? 'SUA VEZ' : 'VEZ DO BOT');
        this.fase = 'posicionando';
        this.mostrarUiMira(false);

        if (this.jogadorDaVez === 'jogador') {
            this.dicaPosicionar.setVisible(true);
            this.botaoConfirmarPosicao.setVisible(true);
            this.textoBotJogando.setVisible(false);
            this.bolinhaJogador.sprite.setInteractive({ useHandCursor: true });
        } else {
            this.dicaPosicionar.setVisible(false);
            this.botaoConfirmarPosicao.setVisible(false);
            this.textoBotJogando.setVisible(true);
            this.time.delayedCall(700, () => this.jogadaDoBot());
        }
    }

    encerrarPosicionamento() {
        if (this.fase !== 'posicionando' || this.jogadorDaVez !== 'jogador') return;
        this.bolinhaJogador.sprite.disableInteractive();
        this.dicaPosicionar.setVisible(false);
        this.botaoConfirmarPosicao.setVisible(false);

        this.fase = 'mirando';
        const c = this.CENTRO_TRIANGULO;
        this.anguloAtual = Phaser.Math.RadToDeg(Math.atan2(c.y - this.bolinhaJogador.y, c.x - this.bolinhaJogador.x));
        this.forcaAtual = 55;
        this.desenharBarraForca();
        this.mostrarUiMira(true);
    }

    jogadaDoBot() {
        const alvosRestantes = this.bolinhasAlvo.filter(b => !b.removida);
        if (alvosRestantes.length === 0) return;

        const jogada = BotQuitar.decidirJogada(this.CAMPO, this.CENTRO_TRIANGULO, alvosRestantes);
        const pos = this.ajustarPosicaoValida(jogada.x, jogada.y, this.bolinhaBot);
        this.bolinhaBot.x = pos.x;
        this.bolinhaBot.y = pos.y;
        this.bolinhaBot.atualizarSprite();
        this.textoBotJogando.setText('🤖 Bot mirando...');

        this.time.delayedCall(600, () => {
            this.atirar('bot', jogada.angulo, jogada.forca);
        });
    }

    atirar(quem, anguloForcado, forcaForcada) {
        const bolinha = quem === 'jogador' ? this.bolinhaJogador : this.bolinhaBot;
        const angulo = anguloForcado !== undefined ? anguloForcado : this.anguloAtual;
        const forca = forcaForcada !== undefined ? forcaForcada : this.forcaAtual;

        const rad = Phaser.Math.DegToRad(angulo);
        const velocidade = this.VELOCIDADE_MIN_TIRO + (forca / 100) * (this.VELOCIDADE_MAX_TIRO - this.VELOCIDADE_MIN_TIRO);
        bolinha.vx = Math.cos(rad) * velocidade;
        bolinha.vy = Math.sin(rad) * velocidade;

        if (JogoState.somAtivo !== false) SomFX.atirar();
        this.mostrarUiMira(false);
        this.textoBotJogando.setVisible(false);
        this.fase = 'simulando';
    }

    // ---------- Loop de física ----------
    update(time, delta) {
        if (this.fase !== 'simulando') return;
        const dt = Math.min(delta / 1000, 0.032);

        BolinhaPhysics.atualizar(this.todasBolinhas(), dt, this.CAMPO);
        CollisionManager.resolverTodas(this.todasBolinhas(), (a, b, forcaImpacto) => {
            if (JogoState.somAtivo !== false) SomFX.bater(Phaser.Math.Clamp(forcaImpacto / 500, 0.1, 1));
        });

        let alguemSaiu = false;
        this.bolinhasAlvo.forEach(b => {
            if (b.removida) return;
            const v = this.verticesTriangulo;
            const dentro = pontoDentroTriangulo({ x: b.x, y: b.y }, v.topo, v.baseDir, v.baseEsq);
            if (!dentro) {
                b.removida = true;
                alguemSaiu = true;
                if (this.jogadorDaVez === 'jogador') this.pontosJogador++; else this.pontosBot++;
            }
        });
        if (alguemSaiu) {
            if (JogoState.somAtivo !== false) SomFX.ponto();
            this.atualizarPlacar();
        }

        if (BolinhaPhysics.todasParadas(this.todasBolinhas())) {
            this.finalizarSimulacao();
        }
    }

    finalizarSimulacao() {
        const restantes = this.bolinhasAlvo.filter(b => !b.removida).length;
        if (restantes === 0) {
            this.mostrarResultado();
            return;
        }
        this.jogadorDaVez = this.jogadorDaVez === 'jogador' ? 'bot' : 'jogador';
        this.iniciarTurno();
    }

    // ---------- Resultado final ----------
    criarPainelResultado() {
        this.painelResultado = this.add.container(480, 270).setDepth(50).setVisible(false);
        const fundo = this.add.rectangle(0, 0, 960, 540, 0x000000, 0.7);
        const caixa = this.add.graphics();
        caixa.fillStyle(0x241207, 0.95);
        caixa.fillRoundedRect(-220, -110, 440, 220, 16);
        caixa.lineStyle(3, 0xf0d9a8, 0.7);
        caixa.strokeRoundedRect(-220, -110, 440, 220, 16);

        this.textoResultadoTitulo = this.add.text(0, -60, '', {
            fontSize: '30px', fontFamily: 'Fredoka, Arial, sans-serif', fontStyle: '700', color: '#ffe066',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5);

        this.textoResultadoPlacar = this.add.text(0, -12, '', {
            fontSize: '18px', fontFamily: 'Fredoka, Arial, sans-serif', color: '#ffffff'
        }).setOrigin(0.5);

        const botaoJogarDeNovo = criarBotaoEstilizado(this, -100, 55, 170, 42, '🔁 De novo', 0x1f7a3d, 0x0f4a22, '#ffffff', () => {
            this.scene.restart();
        });
        const botaoMenu = criarBotaoEstilizado(this, 100, 55, 170, 42, '🏠 Menu', 0x3e2412, 0x1c0f06, '#ffe8c8', () => {
            this.scene.start('MenuScene');
        });

        this.painelResultado.add([fundo, caixa, this.textoResultadoTitulo, this.textoResultadoPlacar, botaoJogarDeNovo, botaoMenu]);
    }

    mostrarResultado() {
        this.fase = 'fimDeRound';
        this.mostrarUiMira(false);
        this.textoStatus.setText('FIM DA RODADA');

        let titulo;
        if (this.pontosJogador > this.pontosBot) { titulo = '🏆 VOCÊ VENCEU!'; if (JogoState.somAtivo !== false) SomFX.vitoria(); }
        else if (this.pontosBot > this.pontosJogador) titulo = '😅 O BOT VENCEU';
        else titulo = '🤝 EMPATE';

        this.textoResultadoTitulo.setText(titulo);
        this.textoResultadoPlacar.setText('Você: ' + this.pontosJogador + '    Bot: ' + this.pontosBot);
        this.painelResultado.setVisible(true);
    }
}
