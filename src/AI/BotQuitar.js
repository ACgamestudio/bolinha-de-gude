// ---------- IA do bot na fase Quitar ----------
// Nada de pathfinding ou minimax aqui — o bot escolhe um ponto ao redor do triângulo,
// mira na bolinha-alvo mais próxima dali e chuta a força proporcional à distância,
// com uma margem de erro aleatória (pra não jogar "perfeito demais" e ficar chato).
const BotQuitar = {
    ERRO_ANGULO_GRAUS: 7,     // desvio aleatório de mira, pra cada lado
    ERRO_FORCA_PERCENT: 8,    // desvio aleatório de força, pra cada lado
    DISTANCIA_FORCA_MAXIMA: 420, // distância (px) que corresponde a ~100% de força

    // decide a jogada completa: onde posicionar a própria bolinha, ângulo e força
    decidirJogada(limitesCampo, centroTriangulo, bolinhasAlvo) {
        const posicao = this.escolherPosicao(limitesCampo, centroTriangulo);
        const alvo = this.escolherAlvo(posicao, bolinhasAlvo);

        const dx = alvo.x - posicao.x;
        const dy = alvo.y - posicao.y;
        const distancia = Math.hypot(dx, dy);

        const anguloIdeal = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
        const angulo = anguloIdeal + Phaser.Math.FloatBetween(-this.ERRO_ANGULO_GRAUS, this.ERRO_ANGULO_GRAUS);

        const forcaBase = Phaser.Math.Clamp((distancia / this.DISTANCIA_FORCA_MAXIMA) * 100, 35, 100);
        const forca = Phaser.Math.Clamp(
            forcaBase + Phaser.Math.FloatBetween(-this.ERRO_FORCA_PERCENT, this.ERRO_FORCA_PERCENT),
            20, 100
        );

        return { x: posicao.x, y: posicao.y, angulo, forca };
    },

    // um ponto aleatório num anel ao redor do centro do triângulo, dentro do campo
    escolherPosicao(limites, centro) {
        const raioMin = 95, raioMax = 210;
        for (let tentativa = 0; tentativa < 12; tentativa++) {
            const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const raio = Phaser.Math.FloatBetween(raioMin, raioMax);
            const x = Phaser.Math.Clamp(centro.x + Math.cos(ang) * raio, limites.x1 + 20, limites.x2 - 20);
            const y = Phaser.Math.Clamp(centro.y + Math.sin(ang) * raio, limites.y1 + 20, limites.y2 - 20);
            return { x, y };
        }
        return { x: limites.x1 + 40, y: centro.y };
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
