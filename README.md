# Bolinha de Gude — Fase 1: Quitar

Jogo de bolinha de gude em campo aberto (sem pista, pode ir pra qualquer parte do
quadrado). Primeira fase implementada: **Quitar** — um triângulo com 5 bolinhas de
tipos variados fica no meio do campo, e quem tirar mais bolinhas de dentro dele ganha.

## Como jogar
1. **Menu** → toque em "JOGAR" (a caixinha já desenhada na terra).
2. **Seleção** → escolha sua bolinha entre os 8 tipos disponíveis.
3. **Quitar**:
   - Na sua vez, arraste sua bolinha até o lugar que quiser no campo (fora do
     triângulo) e toque em "✔ Confirmar posição".
   - Ajuste o **ângulo** (◀ ▶) e a **força** (− +) da tacada.
   - Toque em "🎯 ATIRAR!" pra jogar.
   - O bot joga sozinho na vez dele.
4. Quando as 5 bolinhas do triângulo saírem, quem tirou mais vence.

## Tecnologia
Phaser 3, tudo desenhado por código (nenhuma bolinha é imagem — são texturas geradas
via Graphics), física simples própria (atrito + colisão elástica círculo-círculo), som
100% sintetizado (Web Audio, sem arquivos de áudio). Os dois fundos (menu e campo) são
as imagens fornecidas.

## Ainda não incluído (avisar se quiser que eu adicione)
- Multiplayer online
- Outras fases além do Quitar
- Placar/progressão persistente entre partidas
