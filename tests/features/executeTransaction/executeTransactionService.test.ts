import chai from "chai";
import chaiHttp from "chai-http";
import app from "../../../src/service.js";
import { UUID } from "crypto";

chai.use(chaiHttp);

chai.should();

describe("Execute Transaction Service", function () {
  before(async function () {});

  let transactionUuid: UUID | undefined;

  it("should prepare transaction", async function () {
    const request = {
      sender_address: {
        network: "sepolia",
        identifier: "1023703414",
        platform: "telegram.me",
      },
      recipient_address: {
        network: "sepolia",
        identifier: "0x2E46AFE76cd64c43293c19253bcd1Afe2262dEfF",
        platform: "native",
      },
      amount: "0.0001",
      is_native_token: true,
      receive_token_address: null, //"0xf97f4df75117a78c1a5a0dbb814af92458539fb4"
    };
    const response = await chai
      .request(app)
      .put("/transactions/prepare")
      // NOTE: User wallet address won't always be able to be derived from the user's Telegram ID when off-system signing is implemented
      .send(request);
    transactionUuid = response.body.transactionUuid;
  });

  it("should send transaction", async function () {
    const response = await chai
      .request(app)
      .put("/transactions/send")
      .send({ transactionUuid: transactionUuid });
  });
});
