import { formatUnits, parseUnits } from "viem";

export default class PreciseNumber {
    private constructor(public integer: bigint, public decimals: number) {};

    toDecimalString(): string {
        return formatUnits(this.integer, this.decimals);
    };

    // Decimal precision of 8 is an amount of USD cents for Bitcoin
    toDecimalDisplay(precision = 8): string {
        const rounded = parseUnits(this.toDecimalString(), precision);
        // formatUnits doesn't keep trailing zeros, so we convert another way
        let bigIntString = rounded.toString();
        if (bigIntString.length < precision) {
            bigIntString = bigIntString.padStart(precision, '0');
        }
        const integerPart = bigIntString.slice(0, -precision) || '0';
        const decimalPart = bigIntString.slice(-precision);
        return `${integerPart}.${decimalPart}`;
    };

    static from(amount: string | bigint, decimals = 18): PreciseNumber {
        if (typeof amount === "bigint") {
            return new PreciseNumber(amount, decimals);
        }

        return amount.includes(".") ? new PreciseNumber(parseUnits(amount, decimals), decimals) : new PreciseNumber(BigInt(amount), decimals);
    };

    static bigAdd(a: PreciseNumber, b: PreciseNumber, outputPrecision = 18): PreciseNumber {
        const addition = a.integer + b.integer;
        const decimalString = formatUnits(addition, b.decimals);
        const integer = parseUnits(decimalString, outputPrecision);
        return new PreciseNumber(integer, outputPrecision);
    };

    static bigMultiply(a: PreciseNumber, b: PreciseNumber, outputPrecision = 18): PreciseNumber {
        const product = a.integer * b.integer;
        console.log(`product`);
        console.log(product);

        const decimalString = formatUnits(product / 10n**BigInt(a.decimals), b.decimals);
        const integer = parseUnits(decimalString, outputPrecision);
        return new PreciseNumber(integer, outputPrecision);
    };

    static toDecimalDisplay(amount: `${number}.${number}`, precision?: number): string
    static toDecimalDisplay(amount: string, precision?: number, decimals?: number): string
    static toDecimalDisplay(amount: string, precision?: number, decimals?: number): string {
        return PreciseNumber.from(amount, decimals).toDecimalDisplay(precision);
    };
};