﻿/** Generic LL(*) recursive descent parser. */
module SDP {
    export class Pattern<T> {
        constructor(private _text: string, private _exec: Function) {

        }

        toString() {
            return this._text;
        }

        exec(str: string, pos: number): [T, number];
        exec(str: string): T;

        exec(str, pos?) {
            const r = this._exec.call(null, str, pos || 0);
            //console.log(this + '', str.slice(pos, pos + 10), r);
            if (typeof pos === 'number') return r;
            if (r && r[1] == str.length) return r[0];
            return null;
        }

        map<U>(fn: (value: T) => U): Pattern<U> {
            return $(':' + this, (str, pos) => {
                const r = this.exec(str, pos);
                return r ? [fn(r[0]), r[1]] : null;
            });
        }

        take(i: number) {
            return this.map(r => r[i]);
        }

        /** [["A", 1], ["B", 2]] -> { A: 1, B: 2 } */
        fold<U>(k: number, v: number) {
            return this.map((r: any) => {
                const m: { [key: string]: U } = {};

                for (const p of r)
                    m[p[k]] = p[v];

                return m;
            });
        }

        rep(min = 0) {
            return $(min + '*' + this, (str, pos) => {
                const res: T[] = [];
                let r: [T, number];

                while (r = this.exec(str, pos)) {
                    res.push(r[0]);
                    pos = r[1];
                }

                return res.length >= min ? [res, pos] : null;
            });
        }
    }

    export function $<T>(exec: Pattern<T>): Pattern<T>;
    export function $<T>(text: string, exec: (str: string, pos: number) => [T, number]): Pattern<T>;
    export function $(regexp: RegExp): Pattern<string>;
    export function $(string: string): Pattern<string>;
    export function $(items: any[]): Pattern<any[]>;

    export function $(x, n?): Pattern<any> {
        if (x instanceof Pattern) return x;
        if (typeof n === 'function') return new Pattern(x, n);
        if (x instanceof RegExp) return rgx(x);
        if (typeof x === 'string') return txt(x);
        if (x instanceof Array) return seq(...x);
    }

    function rgx(r: RegExp) {
        return $(r + '', (str, pos) => {
            const m = r.exec(str.slice(pos));
            return m && m.index == 0 ? [m[0], pos + m[0].length] : null;
        });
    }

    function txt(s: string) {
        return $('"' + s + '"', (str, pos) => {
            return str.slice(pos, pos + s.length) == s ? [s, pos + s.length] : null;
        });
    }

    function seq(...ps: any[]) {
        return $('(' + ps.join(' ') + ')', (str, pos) => {
            const res = [];

            for (const p of ps) {
                const r = $(p).exec(str, pos);
                if (!r) return null;
                res.push(r[0]);
                pos = r[1];
            }

            return [res, pos];
        });
    }
}