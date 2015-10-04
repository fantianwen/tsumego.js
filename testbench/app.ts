/// <reference path="kb.ts" />
/// <reference path="xhr.ts" />
/// <reference path="../src/solver.ts" />
/// <reference path="wgo/wgo.d.ts" />

module testbench {
    import n2s = tsumego.n2s;
    import s2n = tsumego.s2n;
    import Result = tsumego.Result;
    import color = tsumego.color;
    import stone = tsumego.stone;
    import Board = tsumego.Board;
    import profile = tsumego.profile;

    var goban: WGo.BasicPlayer = null;

    /** In SGF a B stone at x = 8, y = 2
        is written as B[ic] on a 9x9 goban
        it corresponds to J7 - the I letter
        is skipped and the y coordinate is
        counted from the bottom starting from 1. */
    const xy2s = (m: stone) => !Number.isFinite(m) ? 'null' :
        String.fromCharCode(0x41 + (stone.x(m) > 7 ? stone.x(m) - 1 : stone.x(m))) +
        (goban.board.size - stone.y(m));

    const c2s = (c: color) => c > 0 ? 'B' : 'W';
    const cm2s = (c: color, m: stone) => c2s(c) + (Number.isFinite(m) ? ' plays at ' + xy2s(m) : ' passes');
    const cw2s = (c: color, m: stone) => c2s(c) + ' wins by ' + (Number.isFinite(m) ? xy2s(m) : 'passing');

    /** { x: 2, y: 3 } -> `cd` */
    const xy2f = (xy: stone) => n2s(stone.x(xy)) + n2s(stone.y(xy));

    /** -1, { x: 2, y: 3 } -> `W[cd]` */
    const xyc2f = (c: color, xy: stone) => (c > 0 ? 'B' : 'W') + '[' + xy2f(xy) + ']';

    /** `cd` -> { x: 2, y: 3 } */
    const f2xy = (s: string) => stone(s2n(s, 0), s2n(s, 1));

    function parseSGF(source: string): [Board, stone[], stone] {
        const brd = new Board(source);
        const sgf = SGF.parse(source);
        const setup = sgf.steps[0];
        const aim = f2xy(setup['MA'][0]);
        const rzn = setup['DD'].map(f2xy);
        return [brd, rzn, aim];
    }

    function s2s(c: color, s: Result<stone>) {
        let isDraw = s.color == 0;
        let isLoss = s.color * c < 0;

        return c2s(c) + ' ' + (isLoss ? 'loses' : (isDraw ? 'draws' : 'wins') + ' with ' + xy2s(s.move));
    }

    /** shared transposition table for black and white */
    export var tt = new tsumego.TT<stone>();

    function solve(board: Board, color: color, nkotreats: number = 0, log = false) {
        profile.reset();

        const rs = tsumego.solve({
            root: board,
            color: color,
            nkt: nkotreats,
            tt: tt,
            expand: tsumego.generators.Basic(rzone),
            status: status
        });

        if (log) {
            profile.log();
            console.log(s2s(color, rs));
        }

        return rs;
    }

    class CancellationToken {
        cancelled = false;
    }

    function sleep(ms: number) {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }

    function dbgsolve(board: Board, color: color, nkotreats = 0) {
        let log = true;

        const player = {
            play: (color: number, move: stone) => {
                if (!log) return;

                const pass = !Number.isFinite(move);

                const node = new WGo.KNode({
                    _edited: true,
                    move: {
                        pass: pass,
                        x: stone.x(move),
                        y: stone.y(move),
                        c: color > 0 ? WGo.B : WGo.W
                    }
                });

                goban.kifuReader.node.appendChild(node);
                goban.next(goban.kifuReader.node.children.length - 1);
            },
            undo: () => {
                if (!log) return;
                goban.previous();
            },
            done: (color: number, move: stone, note: string) => {
                if (!log) return;
                const comment = `${cw2s(color, move) } ${note ? '(' + note + ')' : ''}\n`;
                const node = goban.kifuReader.node;
                node.comment = node.comment || '';
                node.comment += comment;
                goban.update();
            },
            loss: (color: number, move: stone, response: stone) => {
                if (!log) return;
                const comment = `if ${cm2s(color, move) }, then ${cw2s(-color, response) }\n`;
                const node = goban.kifuReader.node;
                node.comment = node.comment || '';
                node.comment += comment;
                goban.update();
            }
        };

        const solver = tsumego._solve({
            root: board,
            color: color,
            nkt: nkotreats,
            tt: tt,
            expand: tsumego.generators.Basic(rzone),
            status: status,
            player: player,
            alive: (b: Board) => tsumego.benson.alive(b, aim)
        });

        window['solver'] = solver;

        let tick = 0;
        let result: Result<stone>;

        const next = () => {
            const {done, value} = solver.next();
            tick++;
            result = value;

            if (log) {
                const bp = ';bp=' + tick;
                const rx = /;bp=\d+/;

                location.href = rx.test(location.hash) ?
                    location.href.replace(rx, bp) :
                    location.href + bp;
            }
        };

        const stepOver = (ct: CancellationToken) => {
            const hash = board.hash;

            do {
                next();
            } while (board.hash != hash && !ct.cancelled);

            next();
        };

        const stepOut = () => {
            /*
            log = false;
            const n = solver.depth;
            while (solver.depth >= n)
                next();
            log = true;
            renderSGF(solver.current.node.toString('SGF'));
            */
        };

        keyboard.hook(keyboard.Key.F10, event => {
            event.preventDefault();
            const ct = new CancellationToken;
            const hook = keyboard.hook(keyboard.Key.Esc, event => {
                event.preventDefault();
                console.log('cancelling...');
                ct.cancelled = true;
            });

            stepOver(ct);
        });

        keyboard.hook(keyboard.Key.F11, event => {
            if (!event.shiftKey) {
                event.preventDefault();
                if (event.ctrlKey)
                    debugger;
                next();
            } else {
                // Shift+F11
                event.preventDefault();
                stepOut();
            }
        });

        console.log('debug mode:', c2s(color), 'to play with', nkotreats, 'external ko treats\n',
            'F11 - step into\n',
            'Ctrl+F11 - step into and debug\n',
            'F10 - step over\n',
            'Shift+F11 - step out\n',
            'G - go to a certain step\n');

        keyboard.hook('G'.charCodeAt(0), event => {
            event.preventDefault();
            const stopat = +prompt('Step #:');
            if (!stopat) return;
            console.log('skipping first', stopat, 'steps...');
            while (tick < stopat)
                next();
            renderSGF(board.toString('SGF'));
        });
    }

    function status(b: Board) {
        return b.get(stone.x(aim), stone.y(aim)) < 0 ? -1 : +1;
    }

    var board: Board, rzone: stone[], aim;

    const source = location.search.slice(1);
    let sgfdata = '';

    (source.slice(0, 1) == '(' ? Promise.resolve(source) : send('GET', '/problems/' + source + '.sgf')).then(res => {
        [board, rzone, aim] = parseSGF(res);
        console.log(res);
        sgfdata = res;
        console.log(board + '');
        document.title = source;
        setTimeout(() => renderSGF(res));

        try {
            const [, bw, nkt] = /^#(B|W)([+-]\d+)/.exec(location.hash);
            dbgsolve(board, bw == 'W' ? -1 : +1, +nkt);
        } catch (_) {
            console.log(_);
        }
    }).catch(err => {
        console.error(err);
    });

    function renderSGF(sgf: string) {
        goban = new WGo.BasicPlayer(document.body, {
            // a dummy C{...] tag is needed to
            // enable the comment box in wgo
            sgf: sgf.replace(/\)\s*$/, 'C[ ])')
        });

        goban.setCoordinates(true);
        goban.kifuReader.allowIllegalMoves(true);
    }

    function makeMove(x: number, y: number, c: number) {
        const node = new WGo.KNode({
            _edited: true,
            move: {
                x: x,
                y: y,
                c: c > 0 ? WGo.B : WGo.W
            }
        });

        goban.kifuReader.node.appendChild(node);
        goban.next(goban.kifuReader.node.children.length - 1);
    }

    function parse(si: string, size: number): stone {
        const x = si.charCodeAt(0) - 65;
        const y = size - +/\d+/.exec(si)[0];

        return stone(x, y);
    }

    window['$'] = data => {
        const cmd = data.toString().trim().split(' ');
        const col = cmd[0].toLowerCase();

        switch (col) {
            case 'x':
            case 'o':
                const xy = cmd[1] && cmd[1].toUpperCase();
                const c = cmd[0].toUpperCase() == 'O' ? -1 : +1;

                if (/^[a-z]\d+$/i.test(xy)) {
                    const p = parse(xy, board.size);

                    if (!board.play(stone(stone.x(p), stone.y(p), c))) {
                        console.log(col, 'cannot play at', xy);
                    } else {
                        console.log(board + '');
                        makeMove(stone.x(p), stone.y(p), c);
                    }
                } else {
                    const {move} = solve(board, c, !xy ? 0 : +xy, true);

                    if (!Number.isFinite(move)) {
                        console.log(col, 'passes');
                    } else {
                        board.play(move);
                        console.log(board + '');
                        makeMove(stone.x(move), stone.y(move), c);
                    }
                }
                break;

            case 'undo':
                let n = +(cmd[1] || 1);

                while (n-- > 0) {
                    const move = board.undo();

                    if (move) {
                        console.log('undo ' + stone.toString(move));
                    } else {
                        console.log('nothing to undo');
                        break;
                    }
                }

                console.log(board + '');
                break;

            case 'path':
                let move: stone, moves: stone[] = [];

                while (move = board.undo())
                    moves.unshift(move);

                for (move of moves) {
                    console.log(board + '');
                    board.play(move);
                }

                console.log(board + '');
                break;

            default:
                console.log('unknown command');
        }
    };
}
