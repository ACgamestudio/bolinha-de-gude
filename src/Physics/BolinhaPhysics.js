// ---------- Movimento e atrito das bolinhas ----------
// Nada de engine de física completa aqui — é só desaceleração exponencial (atrito) +
// integração simples de posição + rebote nas bordas do campo. Suficiente pra bolinha
// de gude, que não precisa de gravidade/gravidade nem sobreposição complexa.
const BolinhaPhysics = {
    ATRITO_BASE: 340,       // px/s² de desaceleração numa bolinha "atrito 1.0"
    VELOCIDADE_MINIMA: 6,   // abaixo disso, trava em zero (evita ficar "vibrando" pra sempre)
    RESTITUICAO_PAREDE: 0.55, // o quanto da velocidade sobra depois de bater na borda do campo

    // avança o movimento de uma lista de Bolinha em `dt` segundos, dentro do quadrado
    // `limites` = {x1, y1, x2, y2} (bordas internas jogáveis, sem contar o raio)
    atualizar(bolinhas, dt, limites) {
        bolinhas.forEach(b => {
            if (!b.emJogo) return;

            const velocidade = Math.hypot(b.vx, b.vy);
            if (velocidade > 0) {
                const desaceleracao = this.ATRITO_BASE * (b.tipo.atrito || 1) * dt;
                const novaVelocidade = Math.max(0, velocidade - desaceleracao);
                const escala = novaVelocidade / velocidade;
                b.vx *= escala;
                b.vy *= escala;
            }

            b.x += b.vx * dt;
            b.y += b.vy * dt;

            // paredes do campo — rebote com perda de energia
            if (b.x - b.raio < limites.x1) { b.x = limites.x1 + b.raio; b.vx = -b.vx * this.RESTITUICAO_PAREDE; }
            if (b.x + b.raio > limites.x2) { b.x = limites.x2 - b.raio; b.vx = -b.vx * this.RESTITUICAO_PAREDE; }
            if (b.y - b.raio < limites.y1) { b.y = limites.y1 + b.raio; b.vy = -b.vy * this.RESTITUICAO_PAREDE; }
            if (b.y + b.raio > limites.y2) { b.y = limites.y2 - b.raio; b.vy = -b.vy * this.RESTITUICAO_PAREDE; }

            if (Math.hypot(b.vx, b.vy) < this.VELOCIDADE_MINIMA) { b.vx = 0; b.vy = 0; }

            b.atualizarSprite();
        });
    },

    // true quando NENHUMA bolinha em jogo ainda está se movendo — usado pra saber
    // quando a "vez" pode passar pro outro jogador
    todasParadas(bolinhas) {
        return bolinhas.every(b => !b.emJogo || b.parada);
    }
};
