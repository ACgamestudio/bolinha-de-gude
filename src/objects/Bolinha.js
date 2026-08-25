// ---------- Tipos de bolinha de gude ----------
// cor: cor base do vidro. corPadrao: cor do "miolo" (a vinheta/veio colorido que dá o
// nome popular ao tipo). padrao: como esse miolo é desenhado (ver criarTexturaBolinha).
// massa/atrito: mesma lógica do jogo de tampinhas — massa alta bate e desloca mais os
// outros, mas também acelera menos com a mesma força; atrito alto para mais rápido.
const TIPOS_DE_BOLINHA = [
    { nome: 'Olho de Gato Azul', cor: 0xdff3ff, corPadrao: 0x2266cc, padrao: 'olho_de_gato', massa: 1.00, atrito: 1.00, pontoForte: 'Equilíbrio total' },
    { nome: 'Furacão Verde',     cor: 0x8ff0b0, corPadrao: 0x0e7a3a, padrao: 'listrada',     massa: 0.85, atrito: 0.85, pontoForte: 'Desliza mais longe' },
    { nome: 'Leiteira',          cor: 0xfaf6ec, corPadrao: 0xd8cdb0, padrao: 'leitosa',      massa: 1.15, atrito: 1.15, pontoForte: 'Resiste ao bater' },
    { nome: 'Ônix',              cor: 0x2b2b2b, corPadrao: 0x111111, padrao: 'lisa',         massa: 1.30, atrito: 1.10, pontoForte: 'Quase imparável' },
    { nome: 'Bolão de Fogo',     cor: 0xfff0e0, corPadrao: 0xd9451c, padrao: 'olho_de_gato', massa: 0.90, atrito: 0.80, pontoForte: 'Arranca rápido' },
    { nome: 'Piscina',           cor: 0xeaf7ff, corPadrao: 0x2e86de, padrao: 'listrada',     massa: 0.95, atrito: 1.05, pontoForte: 'Mira precisa' },
    { nome: 'Ametista',          cor: 0xf3e9fb, corPadrao: 0x8e44ad, padrao: 'lisa',         massa: 1.05, atrito: 0.95, pontoForte: 'Versátil' },
    { nome: 'Ouro Velho',        cor: 0xfff7dd, corPadrao: 0xc9960f, padrao: 'olho_de_gato', massa: 0.75, atrito: 0.90, pontoForte: 'Leve na saída' }
];

const RAIO_BOLINHA = 13; // raio padrão em px de mundo (jogo roda em 960x540)

// gera (uma vez por tipo) a textura de vidro da bolinha — corpo com leve degradê,
// "miolo" colorido de acordo com o padrão, brilho especular e sombra de borda
function criarTexturaBolinha(scene, tipo) {
    const chave = 'bolinha_' + tipo.nome.replace(/\s+/g, '_');
    if (scene.textures.exists(chave)) return chave;

    const tam = 52;
    const c = tam / 2;
    const r = 23;
    const g = scene.add.graphics();

    // corpo base
    g.fillStyle(tipo.cor, 1);
    g.fillCircle(c, c, r);

    // miolo colorido — o que dá a "cara" de cada tipo popular
    if (tipo.padrao === 'olho_de_gato') {
        // vinheta em leque, tipo um pedaço de vidro colorido atravessando o centro
        g.fillStyle(tipo.corPadrao, 0.85);
        g.beginPath();
        g.moveTo(c, c - r * 0.85);
        g.lineTo(c + r * 0.55, c);
        g.lineTo(c, c + r * 0.85);
        g.lineTo(c - r * 0.15, c);
        g.closePath();
        g.fillPath();
        g.fillStyle(tipo.corPadrao, 0.4);
        g.fillCircle(c, c, r * 0.32);
    } else if (tipo.padrao === 'listrada') {
        // dois veios em espiral suave
        g.lineStyle(5, tipo.corPadrao, 0.55);
        g.beginPath();
        g.arc(c, c, r * 0.55, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(20), false);
        g.strokePath();
        g.lineStyle(4, tipo.corPadrao, 0.4);
        g.beginPath();
        g.arc(c, c, r * 0.3, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(210), false);
        g.strokePath();
    } else if (tipo.padrao === 'leitosa') {
        g.fillStyle(tipo.corPadrao, 0.3);
        g.fillCircle(c, c, r * 0.7);
    }
    // 'lisa' não desenha miolo — vidro sólido só com o brilho abaixo

    // sombra sutil de borda (dá volume)
    g.lineStyle(3, 0x000000, 0.18);
    g.strokeCircle(c, c, r - 1.5);

    // brilho especular
    g.fillStyle(0xffffff, 0.55);
    g.fillEllipse(c - r * 0.32, c - r * 0.35, r * 0.55, r * 0.32);
    g.fillStyle(0xffffff, 0.25);
    g.fillEllipse(c + r * 0.28, c + r * 0.4, r * 0.35, r * 0.18);

    g.generateTexture(chave, tam, tam);
    g.destroy();
    return chave;
}

// ---------- Estado físico de uma bolinha em jogo ----------
// Envolve o Phaser.Image com posição/velocidade em ponto flutuante (o sprite só
// reflete essa posição a cada frame) — deixa a física (BolinhaPhysics/CollisionManager)
// desacoplada de detalhes do Phaser.
class Bolinha {
    constructor(scene, x, y, tipo, dono) {
        this.scene = scene;
        this.tipo = tipo;
        this.dono = dono; // 'jogador' | 'bot' | null (bolinhas do triângulo começam sem dono)
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.raio = RAIO_BOLINHA;
        this.removida = false; // true quando já saiu do triângulo (marca ponto e some do alvo)
        this.emJogo = true;    // false quando o round acabou de removê-la da simulação

        const chave = criarTexturaBolinha(scene, tipo);
        this.sprite = scene.add.image(x, y, chave).setDisplaySize(this.raio * 2, this.raio * 2);
    }

    get parada() {
        return Math.abs(this.vx) < 4 && Math.abs(this.vy) < 4;
    }

    atualizarSprite() {
        this.sprite.setPosition(this.x, this.y);
    }

    destruir() {
        this.sprite.destroy();
    }
}
