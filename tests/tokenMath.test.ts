import chai from 'chai';
import PreciseNumber from "../src/common/tokenMath.js";

chai.should();

describe("Token Math", () => {
    it("should calculate amount in USD", () => {
        const amountInWei = "500000000000000000";
        const amountDecimals = 18;
        const usdPrice = "2084.2984557966433";
        const amountInUsd = PreciseNumber.bigMultiply(PreciseNumber.fromString(amountInWei, amountDecimals), PreciseNumber.fromString(usdPrice));
        const amountInUsdDecimal = PreciseNumber.toDecimalString(amountInUsd);
        amountInUsdDecimal.should.equal("1042.14922789832165");
    });
});