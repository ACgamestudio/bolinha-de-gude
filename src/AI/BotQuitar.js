// ---------- IA do bot na fase Quitar ----------
// Nada de pathfinding ou minimax aqui — o bot escolhe um ponto ao redor do triângulo,
// mira na bolinha-alvo mais próxima dali e chuta a força proporcional à distância,
// com uma margem de erro aleatória (pra não jogar "perfeito demais" e ficar chato).
const BotQuitar = {
    DISTANCIA_FORCA_MAXIMA: 420, // distância (px) que corresponde a ~100% de força

    // parâmetros de cada nível — quanto maior o erro, mais "burro" (e justo) o bot fica.
    // no difícil o bot também tenta posições melhores (mais perto de um alvo) antes de mirar.
    NIVEIS: {
        facil:   { erroAngulo: 16, erroForca: 18, tentativasPosicao: 1 },
        medio:   { erroAngulo: 7,  erroForca: 8,  tentativasPosicao: 4 },
        dificil: { erroAngulo: 2,  erroForca: 3,  tentativasPosicao: 14 }
    },

    nivelAtual() {
        return this.NIVEIS[JogoState.dificuldade] || this.NIVEIS.medio;
    },

    // decide a jogada completa: onde posicionar a própria bolinha, ângulo e força.
    // centrosTriangulos é um array; o bot escolhe uma posição perto de alguma bolinha-alvo.
    decidirJogada(limitesCampo, centrosTriangulos, bolinhasAlvo) {
        const nivel = this.nivelAtual();
        const posicao = this.escolherPosicao(limitesCampo, centrosTriangulos, bolinhasAlvo, nivel);
        const alvo = this.escolherAlvo(posicao, bolinhasAlvo);

        const dx = alvo.x - posicao.x;
        const dy = alvo.y - posicao.y;
        const distancia = Math.hypot(dx, dy);

        const anguloIdeal = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
        const angulo = anguloIdeal + Phaser.Math.FloatBetween(-nivel.erroAngulo, nivel.erroAngulo);

        const forcaBase = Phaser.Math.Clamp((distancia / this.DISTANCIA_FORCA_MAXIMA) * 100, 35, 100);
        const forca = Phaser.Math.Clamp(
            forcaBase + Phaser.Math.FloatBetween(-nivel.erroForca, nivel.erroForca),
            20, 100
        );

        return { x: posicao.x, y: posicao.y, angulo, forca };
    },

    // gera algumas posições num anel ao redor do triângulo e escolhe a melhor: a que fica
    // mais perto de alguma bolinha-alvo (tiro mais curto = mais preciso). no fácil sorteia
    // só 1 e usa direto; no difícil compara várias.
    escolherPosicao(limites, centros, bolinhasAlvo, nivel) {
        const raioMin = 90, raioMax = 190;
        let melhorPos = null;
        let melhorDist = Infinity;
        const lista = Array.isArray(centros) ? centros : [centros];

        for (let i = 0; i < nivel.tentativasPosicao; i++) {
            const centro = Phaser.Utils.Array.GetRandom(lista);
            const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const raio = Phaser.Math.FloatBetween(raioMin, raioMax);
            const x = Phaser.Math.Clamp(centro.x + Math.cos(ang) * raio, limites.x1 + 20, limites.x2 - 20);
            const y = Phaser.Math.Clamp(centro.y + Math.sin(ang) * raio, limites.y1 + 20, limites.y2 - 20);

            let distMaisProxima = Infinity;
            bolinhasAlvo.forEach(b => {
                const d = Math.hypot(b.x - x, b.y - y);
                if (d < distMaisProxima) distMaisProxima = d;
            });

            if (distMaisProxima < melhorDist) {
                melhorDist = distMaisProxima;
                melhorPos = { x, y };
            }
        }

        return melhorPos || { x: limites.x1 + 40, y: centro.y };
    },

    // prioriza a bolinha-alvo mais próxima da posição escolhida
    escolherAlvo(posicao, bolinhasAlvo) {
        let melhor = bolinhasAlvo[0];
        let menorDist = Infinity;
        bolinhasAlvo.forEach(b => {
            const d = Math.hypot(b.x - posicao.x, b.y - posicao.y);
            if (d < menorDist) { menorDist = d; melhor = b; }
        });
        return melhor;
    }
};
