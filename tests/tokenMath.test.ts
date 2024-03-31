import chai from "chai";
import PreciseNumber from "../src/common/tokenMath.js";

chai.should();

describe("Token Math", () => {
  it("should calculate amount in USD", () => {
    const amountInWei = "500000000000000000";
    const amountDecimals = 18;
    const usdPrice = "2084.2984557966433";
    const bigAmount = PreciseNumber.from(amountInWei, amountDecimals);
    const bigUsdPrice = PreciseNumber.from(usdPrice);
    const amountInUsd = PreciseNumber.bigMultiply(bigAmount, bigUsdPrice);
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

    PreciseNumber.toDecimalDisplay(largeUsd, 14).should.equal(
      "2084.29845579664330",
    );
    PreciseNumber.toDecimalDisplay(largeUsd, 18).should.equal(
      "2084.298455796643300000",
    );

    const smallUsd = "0.0984557966433";
    PreciseNumber.toDecimalDisplay(smallUsd, 4).should.equal("0.0985");
  });

  it("should calculate transaction receipt", () => {
    const gasUsedApiResponse = 103318;
    const bigGasUsed = PreciseNumber.from(String(gasUsedApiResponse), 0);
    bigGasUsed.toDecimalString().should.equal("103318");

    const gasCostApiResponse = 1500000010;
    const bigGasCost = PreciseNumber.from(String(gasCostApiResponse));
    bigGasCost.toDecimalString().should.equal("0.00000000150000001");

    const amountCached = "0.0001";
    const bigGasFee = PreciseNumber.bigMultiply(bigGasUsed, bigGasCost);
    bigGasFee.toDecimalString().should.equal("0.00015497700103318");

    const totalAmount = PreciseNumber.bigAdd(
      PreciseNumber.from(amountCached),
      bigGasFee,
    );
    totalAmount.toDecimalString().should.equal("0.00025497700103318");
  });
});
