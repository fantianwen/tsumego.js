/// <reference path="qargs.ts" />

module testbench {
    function hookToolToKey(tool: string, key: string) {
        document.addEventListener('keydown', event => {
            if (event.key.toUpperCase() == key.toUpperCase())
                vm.tool = tool;
        });

        document.addEventListener('keyup', event => {
            if (event.key.toUpperCase() == key.toUpperCase())
                vm.tool = '';
        });
    }

    hookToolToKey('MA', 'T'); // T = target
    hookToolToKey('AB', 'B'); // B = black
    hookToolToKey('AW', 'W'); // W = white

    // "editor" is the initial state; from there it can go to
    // eitehr of the three states and cannot go back
    type Mode = 'editor' | 'proof-tree' | 'solver' | 'debugger';

    export const vm = new class VM {
        constructor() {
            $(window).on('load', () => {
                $('#sgf').focusout(() => {
                    this.sgfchanged.fire();
                });
            });
        }

        set mode(value: Mode) {
            document.body.className = value;

            if (value == 'debugger') {
                $('#footer').css('background-color', '#a7691c');
                $('#dbg-panel').show();
                $('#solver-panel').hide();
                $('#tool').hide();
            }

            if (value == 'solver') {
                $('#footer').css('background-color', 'green');
            }

            if (value == 'proof-tree') {
                $('#footer').css('background-color', 'blue');
                $('#solver-panel').hide();
                $('#tool').hide();
                $('#km').hide();
            }
        }

        get mode(): Mode {
            return document.body.className as Mode;
        }

        /** The currently selected editor tool: MA, AB, AW, etc. */
        get tool(): string {
            const button = document.querySelector('#tool button.active');
            return button && button.getAttribute('data-value');
        }

        set tool(value: string) {
            for (const button of $('#tool button').toArray()) {
                if (button.getAttribute('data-value') == value)
                    button.classList.add('active');
                else
                    button.classList.remove('active');
            }
        }

        /** ko master: +1, -1 or 0 */
        get km(): number {
            const b = document.querySelector('#km button.active');
            return b ? +b.getAttribute('data-value') : undefined;
        }

        set km(value: number) {
            for (const button of $('#km button').toArray()) {
                if (+button.getAttribute('data-value') == value)
                    button.classList.add('active');
                else
                    button.classList.remove('active');
            }
        }

        /** Hides/shows the km selector. */
        set kmVisible(viisble: boolean) {
            $('#km').css('display', viisble ? '' : 'none');
        }

        /** e.g. "B3 bc" */
        set coords(text: string) {
            $('#coords').text(text);
        }

        set note(text: string) {
            $('#comment').text(text);
        }

        get sgf(): string {
            return $('#sgf').text();
        }

        set sgf(text: string) {
            $('#sgf').text(text);
        }

        sgfchanged = new Event<() => void>();

        set svg(text: string) {
            // better to reformat the entire xml, but this works too
            text = text.replace(/(<\/\w+>)(<\w+)/gm, '$1\n  $2');

            $('#svg').text(text);
        }

        set canUndo(value: boolean) {
            if (value)
                $('#undo').removeClass('disabled');
            else
                $('#undo').addClass('disabled');
        }

        dbg = new class DbgVM {
            set inactive(value: boolean) {
                $('#dbg-panel button').toggleClass('disabled', value);
            }

            /** aka F5 */
            get run() {
                return $('#dbg-run');
            }

            get bp() {
                return $('#dbg-bp');
            }

            /** aka F11 */
            get stepInto() {
                return $('#dbg-into');
            }

            /** aka F10 */
            get stepOver() {
                return $('#dbg-next');
            }

            /** aka Shift+F11 */
            get stepOut() {
                return $('#dbg-undo');
            }

            get stop() {
                return $('#dbg-stop');
            }
        };
    };
}
