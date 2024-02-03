import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../../../src/features/executeTransaction/executeTransactionService.js';
//const chaiHttp = require('chai-http');

chai.use(chaiHttp);

chai.should();

describe("Execute Transaction Service", function() {
    before(async function () {

    });

    it("should prepare transaction", async function() {
        const response = await chai.request(app)
            .put('/transactions')
            // NOTE: User wallet address won't always be able to be derived from the user's Telegram ID when off-system signing is implemented

            // NOTE: The sender_did and recipient_did are composed of three pieces. The first piece is the network name separated by a colon, the second piece is the user's ID. Followed by a period, the third piece is the platform. For example, "arbitrum:@1023703414.telegram.me", the network is "arbitrum", the user's ID is "1023703414", and the platform is "telegram.me".
            .send({ sender_did: "arbitrum:@1023703414.telegram.me", recipient_did: "arbitrum:@1023703414.telegram.me", amount: "0.5", is_native_token: false, receive_token_address: "0xf97f4df75117a78c1a5a0dbb814af92458539fb4"});
    });
});