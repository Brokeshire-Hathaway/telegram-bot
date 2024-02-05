import chai from 'chai';
import { messageEmber } from '../../../src/features/messageEmber/messageEmber.js';

chai.should();

describe("Message Ember", function() {
    before(async function () {

    });

    it("should complete send token transaction", async function() {
        this.timeout(35000);

        const SENDER_UID = "1129320042";
        const THREAD_ID = "-1001481423";
        const FIREPOT_ADDRESS = "0x2E46AFE76cd64c43293c19253bcd1Afe2262dEfF";

        const onActivity = (message: string) => {
            console.log(`Activity update: ${message}`);
        }

        let reply = await messageEmber(SENDER_UID, THREAD_ID, `send 0.0001 eth to ${FIREPOT_ADDRESS}`, onActivity);
        reply = await messageEmber(SENDER_UID, THREAD_ID, "yes", onActivity);
    });
});