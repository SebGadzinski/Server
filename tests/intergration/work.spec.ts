/**
 * @file Tests on Work related routes
 * @author Sebastian Gadzinski
 */

import { expect } from 'chai';
import IntergrationTest from '../bases/IntergrationTest';
const { simpleSignIn } = require('../data/users').default;

class WorkTest extends IntergrationTest {
    constructor() {
        super('/data/work Tests', '/api/data/work');
        this.run();
    }

    run() {
        describe(this.testName, () => {
            before(this.startMongo);

            let testUser = simpleSignIn;
            const newPassword = 'newPassword2!';

            it('user purchases class', async () => {
                // Sample code
                // expect(response.data.data).to.have.property('email', testUser.email);
                it('user purchases SINGLE_SESSION', async () => {

                });

                it('user purchases PERPETUAL', async () => {

                });
                it('user purchases TIME_FRAME', async () => {

                });
            });

            it('user purchases work via meeting', async () => {

            });

            it('user purchases work via on spot creation', async () => {

            });


            after(this.killMongo);
        });
    }
}

export default new WorkTest();
