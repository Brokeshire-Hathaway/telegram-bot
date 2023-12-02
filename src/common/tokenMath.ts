import { formatUnits, parseUnits } from "viem";

export default class PreciseNumber {
    private constructor(public integer: bigint, public decimals: number) {};

    static fromString(amount: string, decimals = 18): PreciseNumber {
        return amount.includes(".") ? new PreciseNumber(parseUnits(amount, decimals), decimals) : new PreciseNumber(BigInt(amount), decimals);
    };

    static toDecimalString(amount: PreciseNumber): string {
        return formatUnits(amount.integer, amount.decimals);
    };

    static bigMultiply(a: PreciseNumber, b: PreciseNumber, outputPrecision = 18): PreciseNumber {
        const product = a.integer * b.integer;
        const decimalString = formatUnits(product / 10n**BigInt(a.decimals), b.decimals);
        const integer = parseUnits(decimalString, outputPrecision);
        return new PreciseNumber(integer, outputPrecision);
    };
};