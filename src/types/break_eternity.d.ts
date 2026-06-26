declare module 'break_eternity.js' {
  export default class Decimal {
    constructor(value?: number | string | Decimal);

    // 静态方法
    static pow(base: number | Decimal, exponent: number | Decimal): Decimal;
    static log(value: number | Decimal, base?: number | Decimal): Decimal;
    static ln(value: number | Decimal): Decimal;
    static exp(value: number | Decimal): Decimal;

    // 比较
    eq(other: number | Decimal): boolean;
    neq(other: number | Decimal): boolean;
    gt(other: number | Decimal): boolean;
    gte(other: number | Decimal): boolean;
    lt(other: number | Decimal): boolean;
    lte(other: number | Decimal): boolean;

    // 运算
    add(other: number | Decimal): Decimal;
    sub(other: number | Decimal): Decimal;
    mul(other: number | Decimal): Decimal;
    div(other: number | Decimal): Decimal;
    pow(other: number | Decimal): Decimal;
    log(base?: number | Decimal): Decimal;
    ln(): Decimal;
    exp(): Decimal;
    sqrt(): Decimal;
    abs(): Decimal;
    neg(): Decimal;
    floor(): Decimal;
    ceil(): Decimal;
    round(): Decimal;

    // 转换
    toNumber(): number;
    toString(): string;
    toExponential(places?: number): string;
    toFixed(places?: number): string;

    // 属性
    sign: number;
    layer: number;
    mag: number;
  }
}

declare global {
  interface Window {
    katex: {
      render: (latex: string, element: HTMLElement, options?: {
        throwOnError?: boolean;
        displayMode?: boolean;
        trust?: boolean;
      }) => void;
    };
  }
}

export {};
