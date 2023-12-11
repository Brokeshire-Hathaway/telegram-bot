import chai from 'chai';
import PreciseNumber from "../src/common/tokenMath.js";
import { formatUnits, parseUnits } from 'viem';

chai.should();

describe("Token Math", () => {
    it("should calculate amount in USD", () => {
        const amountInWei = "500000000000000000";
        const amountDecimals = 18;
        const usdPrice = "2084.2984557966433";
        const amountInUsd = PreciseNumber.bigMultiply(PreciseNumber.from(amountInWei, amountDecimals), PreciseNumber.from(usdPrice));
        const amountInUsdDecimal = amountInUsd.toDecimalString();
        amountInUsdDecimal.should.equal("1042.14922789832165");
    });

    it("should round amount to too specified decimal display precision", () => {
        const largeUsd = "2084.2984557966433";

        PreciseNumber.toDecimalDisplay(largeUsd, 2).should.equal("2084.30");
        PreciseNumber.toDecimalDisplay(largeUsd, 9).should.equal("2084.298455797");
        PreciseNumber.toDecimalDisplay(largeUsd, 5).should.equal("2084.29846");
    });

    it("should have leading and trailing zeros for specified decimal display precision", () => {
        const largeUsd = "2084.2984557966433";

        PreciseNumber.toDecimalDisplay(largeUsd, 14).should.equal("2084.29845579664330");
        PreciseNumber.toDecimalDisplay(largeUsd, 18).should.equal("2084.298455796643300000");

        const smallUsd = "0.0984557966433"
        PreciseNumber.toDecimalDisplay(smallUsd, 4).should.equal("0.0985");
    });
});