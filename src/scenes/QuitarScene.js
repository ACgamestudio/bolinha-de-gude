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
        MusicaFundo.parar(this);

        this.CAMPO = { x1: 40, y1: 30, x2: 920, y2: 486 };
        this.LADO_TRIANGULO = 108;
        // 3 triângulos espalhados pelo campo, cada um com suas próprias bolinhas-alvo
        this.CENTROS_TRIANGULOS = [
            { x: 250, y: 190 },
            { x: 710, y: 190 },
            { x: 480, y: 360 }
        ];
        this.RAIO_PROIBIDO_POSICIONAMENTO = 82;
        this.VELOCIDADE_MIN_TIRO = 160;
        this.VELOCIDADE_MAX_TIRO = 1050;
        this.PUXAO_MAXIMO = 200;        // px de arrasto = força máxima do estilingue

        this.pontosJogador = 0;
        this.pontosBot = 0;
        this.jogadorDaVez = 'jogador';
        // quando alguém para dentro do triângulo, fica 1 rodada sem jogar (castigo).
        // esse contador marca quantas vezes cada lado ainda vai pular.
        this.vezesPuladas = { jogador: 0, bot: 0 };
        this.fase = null;
        this.anguloAtual = 225; // mirando de baixo-esquerda pro centro por padrão
        this.forcaAtual = 55;
        this.jogadorJaPosicionou = false;

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
        this.rastroGfx = this.add.graphics().setDepth(4);
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

        // triângulos riscados na terra — um por centro
        this.verticesTriangulos = this.CENTROS_TRIANGULOS.map(c =>
            verticesTriangulo(c.x, c.y, this.LADO_TRIANGULO)
        );
        const risco = this.add.graphics();
        this.verticesTriangulos.forEach(v => {
            risco.lineStyle(3, 0xfff3d6, 0.85);
            risco.beginPath();
            risco.moveTo(v.topo.x, v.topo.y);
            risco.lineTo(v.baseDir.x, v.baseDir.y);
            risco.lineTo(v.baseEsq.x, v.baseEsq.y);
            risco.closePath();
            risco.strokePath();
        });
    }

    // ---------- Bolinhas-alvo do triângulo ----------
    criarBolinhasDoTriangulo() {
        // 3 bolinhas por triângulo, agrupadas em cluster ao redor do centro
        const offsets = [
            { x: 0, y: -12 },
            { x: -15, y: 12 }, { x: 15, y: 12 }
        ];

        this.bolinhasAlvo = [];
        this.CENTROS_TRIANGULOS.forEach((c, idxTri) => {
            const tipos = Phaser.Utils.Array.Shuffle(TIPOS_DE_BOLINHA.slice()).slice(0, offsets.length);
            tipos.forEach((tipo, i) => {
                const off = offsets[i];
                const jitterX = Phaser.Math.FloatBetween(-3, 3);
                const jitterY = Phaser.Math.FloatBetween(-3, 3);
                const b = new Bolinha(this, c.x + off.x + jitterX, c.y + off.y + jitterY, tipo, null);
                b.ehAlvo = true;
                b.triangulo = idxTri; // a qual triângulo essa bolinha pertence
                this.bolinhasAlvo.push(b);
            });
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
            const c = this.add.container(x, 92).setDepth(30);
            const fundo = this.add.graphics();
            fundo.fillStyle(0x1a0f06, 0.75);
            fundo.fillRoundedRect(-60, -46, 120, 92, 10);
            fundo.lineStyle(2, cor, 0.9);
            fundo.strokeRoundedRect(-60, -46, 120, 92, 10);
            const chave = criarTexturaBolinha(this, tipo);
            const prev = this.add.image(0, -18, chave).setDisplaySize(38, 38);
            const nome = this.add.text(0, 6, tipo.nome, {
                fontSize: '10px', fontFamily: 'Fredoka, Arial, sans-serif', color: '#ffe8c8', align: 'center', wordWrap: { width: 112 }
            }).setOrigin(0.5);
            const placar = this.add.text(0, 28, '0', {
                fontSize: '22px', fontFamily: 'Fredoka, Arial, sans-serif', fontStyle: '700', color: '#ffffff'
            }).setOrigin(0.5);
            c.add([fundo, prev, nome, placar]);
            return placar;
        };

        this.placarJogadorTxt = painel(105, this.bolinhaJogador.tipo, 0x2ecc71);
        this.placarBotTxt = painel(855, this.bolinhaBot.tipo, 0xe74c3c);

        this.textoRestantes = this.add.text(480, 44, '', {
            fontSize: '13px',
            fontFamily: 'Fredoka, Arial, sans-serif',
            color: '#ffe8c8',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(10);
    }

    atualizarPlacar() {
        this.placarJogadorTxt.setText(String(this.pontosJogador));
        this.placarBotTxt.setText(String(this.pontosBot));
        const restantes = this.bolinhasAlvo.filter(b => !b.removida).length;
        this.textoRestantes.setText(restantes + ' bolinha' + (restantes === 1 ? '' : 's') + ' nos triângulos');
    }

    // ---------- UI de posicionamento ----------
    criarUiPosicionamento() {
        this.dicaPosicionar = this.add.text(480, 512, 'Arraste sua bolinha até o lugar de saída', {
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
            if (this.fase !== 'posicionando') return;
            this.bolinhaJogador.sprite.setPosition(dragX, dragY);
        });
        this.bolinhaJogador.sprite.on('dragend', () => {
            if (this.fase !== 'posicionando') return;
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
        let px = Phaser.Math.Clamp(x, this.CAMPO.x1 + 18, this.CAMPO.x2 - 18);
        let py = Phaser.Math.Clamp(y, this.CAMPO.y1 + 18, this.CAMPO.y2 - 18);

        for (let i = 0; i < 60; i++) {
            // empurra pra fora da zona proibida de QUALQUER triângulo
            let empurradoTri = false;
            for (const c of this.CENTROS_TRIANGULOS) {
                const distCentro = Math.hypot(px - c.x, py - c.y);
                if (distCentro < this.RAIO_PROIBIDO_POSICIONAMENTO) {
                    const ang = distCentro === 0 ? Math.random() * Math.PI * 2 : Math.atan2(py - c.y, px - c.x);
                    px = c.x + Math.cos(ang) * (this.RAIO_PROIBIDO_POSICIONAMENTO + 2);
                    py = c.y + Math.sin(ang) * (this.RAIO_PROIBIDO_POSICIONAMENTO + 2);
                    px = Phaser.Math.Clamp(px, this.CAMPO.x1 + 18, this.CAMPO.x2 - 18);
                    py = Phaser.Math.Clamp(py, this.CAMPO.y1 + 18, this.CAMPO.y2 - 18);
                    empurradoTri = true;
                }
            }
            if (empurradoTri) continue;

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

    // ---------- Estilingue: arrasta a bolinha pra trás e solta ----------
    criarUiMira() {
        this.guiaEstilingue = this.add.graphics().setDepth(15);
        this.puxando = false;
        this.puxaoDX = 0;
        this.puxaoDY = 0;

        // handlers de arrasto no sprite da própria bolinha do jogador
        const sp = this.bolinhaJogador.sprite;
        sp.on('dragstart', () => {
            if (this.fase !== 'mirando' || this.jogadorDaVez !== 'jogador') return;
            this.puxando = true;
        });
        sp.on('drag', (pointer, dragX, dragY) => {
            if (!this.puxando) return;
            // vetor do centro da bolinha até o dedo (o "puxão"); a bolinha NÃO se move
            let dx = dragX - this.bolinhaJogador.x;
            let dy = dragY - this.bolinhaJogador.y;
            const dist = Math.hypot(dx, dy);
            if (dist > this.PUXAO_MAXIMO) {
                dx = dx / dist * this.PUXAO_MAXIMO;
                dy = dy / dist * this.PUXAO_MAXIMO;
            }
            this.puxaoDX = dx;
            this.puxaoDY = dy;
            // mantém o sprite fixo no lugar da bolinha (só o guia se move)
            sp.setPosition(this.bolinhaJogador.x, this.bolinhaJogador.y);
            this.desenharGuiaEstilingue();
        });
        sp.on('dragend', () => {
            if (!this.puxando) return;
            this.puxando = false;
            const dist = Math.hypot(this.puxaoDX, this.puxaoDY);
            this.guiaEstilingue.clear();
            if (dist < 12) { this.desenharGuiaEstilingue(); return; } // puxão fraco demais: ignora
            // dispara na direção OPOSTA ao puxão (estilingue)
            const forca = Phaser.Math.Clamp(dist / this.PUXAO_MAXIMO, 0, 1) * 100;
            const angulo = Phaser.Math.RadToDeg(Math.atan2(-this.puxaoDY, -this.puxaoDX));
            this.puxaoDX = this.puxaoDY = 0;
            this.atirar('jogador', angulo, forca);
        });
    }

    desenharGuiaEstilingue() {
        const g = this.guiaEstilingue;
        g.clear();
        if (!this.puxando || !this.bolinhaJogador) return;
        const bx = this.bolinhaJogador.x, by = this.bolinhaJogador.y;
        const dist = Math.hypot(this.puxaoDX, this.puxaoDY);
        const t = Phaser.Math.Clamp(dist / this.PUXAO_MAXIMO, 0, 1);
        // linha da faixa elástica (do dedo até a bolinha)
        const cor = t > 0.75 ? 0xe74c3c : (t > 0.4 ? 0xf1c40f : 0x2ecc71);
        g.lineStyle(4, cor, 0.9);
        g.lineBetween(bx, by, bx + this.puxaoDX, by + this.puxaoDY);
        // seta de trajetória (direção oposta), comprimento proporcional à força
        const tx = bx - this.puxaoDX * 1.6, ty = by - this.puxaoDY * 1.6;
        g.lineStyle(4, 0xffe066, 0.95);
        g.lineBetween(bx, by, tx, ty);
        g.fillStyle(0xffe066, 0.95);
        g.fillCircle(tx, ty, 6);
        // pontinhos tracejados na trajetória
        g.fillStyle(0xffffff, 0.6);
        for (let i = 1; i <= 4; i++) {
            g.fillCircle(bx - this.puxaoDX * (0.4 * i), by - this.puxaoDY * (0.4 * i), 2.5);
        }
    }

    mostrarUiMira(mostrar) {
        if (!mostrar) { this.puxando = false; this.guiaEstilingue.clear(); }
        // habilita/desabilita o arrasto de tiro da bolinha do jogador
        if (this.bolinhaJogador) {
            if (mostrar && this.jogadorDaVez === 'jogador') {
                this.bolinhaJogador.sprite.setInteractive({ useHandCursor: true });
                this.input.setDraggable(this.bolinhaJogador.sprite, true);
            }
        }
    }


    // ---------- Fluxo de turno ----------
    iniciarTurno() {
        this.textoStatus.setText(this.jogadorDaVez === 'jogador' ? 'SUA VEZ' : 'VEZ DO BOT');
        this.mostrarUiMira(false);

        if (this.jogadorDaVez === 'jogador') {
            this.textoBotJogando.setVisible(false);
            if (!this.jogadorJaPosicionou) {
                // primeira jogada: escolhe onde colocar a bolinha
                this.fase = 'posicionando';
                this.dicaPosicionar.setVisible(true);
                this.botaoConfirmarPosicao.setVisible(true);
                this.bolinhaJogador.sprite.setInteractive({ useHandCursor: true });
                this.jogadorJaPosicionou = true;
            } else {
                // demais jogadas: já vai direto pro estilingue, de onde a bolinha parou
                this.dicaPosicionar.setVisible(false);
                this.botaoConfirmarPosicao.setVisible(false);
                this.fase = 'mirando';
                this.mostrarUiMira(true);
                this.textoStatus.setText('PUXE E SOLTE PRA ATIRAR');
            }
        } else {
            this.dicaPosicionar.setVisible(false);
            this.botaoConfirmarPosicao.setVisible(false);
            this.textoBotJogando.setVisible(true);
            this.time.delayedCall(700, () => this.jogadaDoBot());
        }
    }

    encerrarPosicionamento() {
        if (this.fase !== 'posicionando' || this.jogadorDaVez !== 'jogador') return;
        this.dicaPosicionar.setVisible(false);
        this.botaoConfirmarPosicao.setVisible(false);

        this.fase = 'mirando';
        this.mostrarUiMira(true);
        this.textoStatus.setText('PUXE E SOLTE PRA ATIRAR');
    }

    jogadaDoBot() {
        const alvosRestantes = this.bolinhasAlvo.filter(b => !b.removida);
        if (alvosRestantes.length === 0) return;

        const jogada = BotQuitar.decidirJogada(this.CAMPO, this.CENTROS_TRIANGULOS, alvosRestantes);
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

    // rastro suave atrás de cada bolinha em movimento — puramente visual
    desenharRastros() {
        const g = this.rastroGfx;
        g.clear();
        this.todasBolinhas().forEach(b => {
            if (b.removida || !b.emJogo) return;
            const vel = Math.hypot(b.vx, b.vy);
            if (vel < 40) return;
            const comprimento = Phaser.Math.Clamp(vel / 22, 6, 42);
            const ux = b.vx / vel, uy = b.vy / vel;
            const cor = (b.dono === 'jogador') ? 0xffe066 : (b.dono === 'bot' ? 0xff8c6b : 0xffffff);
            g.fillStyle(cor, 0.16);
            g.fillCircle(b.x - ux * comprimento * 0.7, b.y - uy * comprimento * 0.7, b.raio * 0.7);
            g.fillStyle(cor, 0.28);
            g.fillCircle(b.x - ux * comprimento * 0.35, b.y - uy * comprimento * 0.35, b.raio * 0.85);
        });
    }

    // ---------- Loop de física ----------
    update(time, delta) {
        if (this.fase !== 'simulando') return;
        const dt = Math.min(delta / 1000, 0.032);

        BolinhaPhysics.atualizar(this.todasBolinhas(), dt, this.CAMPO);
        CollisionManager.resolverTodas(this.todasBolinhas(), (a, b, forcaImpacto) => {
            if (JogoState.somAtivo !== false) SomFX.bater(Phaser.Math.Clamp(forcaImpacto / 500, 0.1, 1));
            // tremidinha de câmera nos impactos fortes — dá peso à batida
            if (forcaImpacto > 260) {
                this.cameras.main.shake(90, Phaser.Math.Clamp(forcaImpacto / 30000, 0.002, 0.01));
            }
        });

        this.desenharRastros();

        let alguemSaiu = false;
        this.bolinhasAlvo.forEach(b => {
            if (b.removida) return;
            const v = this.verticesTriangulos[b.triangulo];
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
        if (this.rastroGfx) this.rastroGfx.clear();

        // regra: se a bolinha de quem jogou parou DENTRO de algum triângulo, ele NÃO morre —
        // fica 1 rodada sem jogar (o adversário joga 2 vezes seguidas antes de voltar a alternar)
        const quemJogou = this.jogadorDaVez;
        const atirador = quemJogou === 'jogador' ? this.bolinhaJogador : this.bolinhaBot;
        const parouNoTriangulo = this.verticesTriangulos.some(v =>
            pontoDentroTriangulo({ x: atirador.x, y: atirador.y }, v.topo, v.baseDir, v.baseEsq)
        );
        if (parouNoTriangulo) {
            if (JogoState.somAtivo !== false) SomFX.bater(1);
            this.vezesPuladas[quemJogou] += 1; // vai perder a próxima vez
            this.textoStatus.setText(quemJogou === 'jogador'
                ? '😬 Parou no triângulo! Você perde a próxima vez'
                : '😅 O bot parou no triângulo! Ele perde a próxima vez');
        }

        const restantes = this.bolinhasAlvo.filter(b => !b.removida).length;
        if (restantes === 0) {
            this.mostrarResultado();
            return;
        }

        // pequena pausa pra ler o aviso de castigo, se houve
        const proximo = () => this.passarVez();
        if (parouNoTriangulo) {
            this.time.delayedCall(1100, proximo);
        } else {
            proximo();
        }
    }

    // decide de quem é a próxima vez respeitando os castigos.
    // se o próximo da vez está de castigo, ele "gasta" um pulo e a vez volta pro outro.
    passarVez() {
        let proximo = this.jogadorDaVez === 'jogador' ? 'bot' : 'jogador';

        // se o próximo tem pulo pendente, consome o pulo e mantém a vez com quem acabou de jogar
        if (this.vezesPuladas[proximo] > 0) {
            this.vezesPuladas[proximo] -= 1;
            proximo = this.jogadorDaVez; // o mesmo lado joga de novo
        }

        this.jogadorDaVez = proximo;
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

    mostrarResultado(vencedorForcado, tituloForcado) {
        this.fase = 'fimDeRound';
        this.mostrarUiMira(false);
        this.textoStatus.setText('FIM DA RODADA');

        let titulo;
        if (tituloForcado) {
            titulo = tituloForcado;
            if (vencedorForcado === 'jogador' && JogoState.somAtivo !== false) SomFX.vitoria();
        } else if (this.pontosJogador > this.pontosBot) {
            titulo = '🏆 VOCÊ VENCEU!'; if (JogoState.somAtivo !== false) SomFX.vitoria();
        } else if (this.pontosBot > this.pontosJogador) {
            titulo = '😅 O BOT VENCEU';
        } else {
            titulo = '🤝 EMPATE';
        }

        this.textoResultadoTitulo.setText(titulo);
        this.textoResultadoPlacar.setText('Você: ' + this.pontosJogador + '    Bot: ' + this.pontosBot);
        this.painelResultado.setVisible(true);
    }
}
