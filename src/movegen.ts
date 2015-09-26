module tsumego {
    'use strict';

    export interface Generator<Node, Move> {
        (node: Node, color: number): { b: Node; m: Move }[];
    }

    export module generators {
        /** Basic moves generator. Tries to maximize libs. */
        export function Basic(rzone: XY[]): Generator<Board, XY> {
            const random = rand.LCG.NR01(Date.now());

            return (board: Board, color: number) => {
                const leafs = [];

                let forked: Board;

                for (const m of rzone) {
                    const x = XY.x(m);
                    const y = XY.y(m);

                    if (!Pattern.isEye(board, x, y, color)) {
                        const b = forked || board.fork();
                        const r = b.play(x, y, color);

                        if (!r) {
                            forked = b;
                            continue;
                        }

                        forked = null;

                        leafs.push({
                            b: b,
                            m: m,
                            r: r,
                            n1: b.totalLibs(color),
                            n2: b.totalLibs(-color),
                        });
                    }
                }

                leafs.sort((a, b) => {
                    return (b.r - a.r)      // maximize the number of captured stones first
                        || (b.n1 - a.n1)    // then maximize the number of liberties
                        || (a.n2 - b.n2)    // then minimize the number of the opponent's liberties
                        || random() - 0.5;
                });

                return leafs;
            };
        }
    }
}
