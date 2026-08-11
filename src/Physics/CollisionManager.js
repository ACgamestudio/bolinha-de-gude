// ---------- Colisão entre bolinhas ----------
// Círculo-círculo simples: separa a sobreposição (ponderado por massa — a mais pesada
// cede menos espaço) e troca velocidade ao longo da normal do choque (impulso com
// restituição, tipo bolinha de vidro batendo — não perde quase nada de energia).
const CollisionManager = {
    RESTITUICAO: 0.88,

    resolverTodas(bolinhas, aoColidir) {
        for (let i = 0; i < bolinhas.length; i++) {
            const a = bolinhas[i];
            if (!a.emJogo) continue;
            for (let j = i + 1; j < bolinhas.length; j++) {
                const b = bolinhas[j];
                if (!b.emJogo) continue;
                this.resolverPar(a, b, aoColidir);
            }
        }
    },

    resolverPar(a, b, aoColidir) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.raio + b.raio;
        if (dist === 0 || dist >= minDist) return;

        const nx = dx / dist;
        const ny = dy / dist;

        // separa a sobreposição — quem tem mais massa cede menos
        const massaA = a.tipo.massa || 1;
        const massaB = b.tipo.massa || 1;
        const somaMassa = massaA + massaB;
        const sobreposicao = minDist - dist;
        const empurraA = sobreposicao * (massaB / somaMassa);
        const empurraB = sobreposicao * (massaA / somaMassa);
        a.x -= nx * empurraA; a.y -= ny * empurraA;
        b.x += nx * empurraB; b.y += ny * empurraB;

        // velocidade relativa ao longo da normal
        const dvx = b.vx - a.vx;
        const dvy = b.vy - a.vy;
        const velocidadeRelativa = dvx * nx + dvy * ny;
        if (velocidadeRelativa > 0) return; // já se afastando, não precisa trocar impulso

        const impulso = -(1 + this.RESTITUICAO) * velocidadeRelativa / (1 / massaA + 1 / massaB);
        const impulsoX = impulso * nx;
        const impulsoY = impulso * ny;

        a.vx -= impulsoX / massaA;
        a.vy -= impulsoY / massaA;
        b.vx += impulsoX / massaB;
        b.vy += impulsoY / massaB;

        const forcaImpacto = Math.abs(velocidadeRelativa);
        if (aoColidir && forcaImpacto > 25) aoColidir(a, b, forcaImpacto);
    }
};
