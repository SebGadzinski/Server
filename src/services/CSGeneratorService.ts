/**
 * @file Zoom Meeting functionality.
 * @author Sebastian Gadzinski
 */

import config, { csgeneratorMongo } from '../config';
import { IUser } from '../models/User';
import { IWork } from '../models/Work';

class CSGeneratorService {
    public static getInstance(): CSGeneratorService {
        if (!CSGeneratorService.instance) {
            CSGeneratorService.instance = new CSGeneratorService();
        }
        return CSGeneratorService.instance;
    }

    private static instance: CSGeneratorService;

    public async addTokens(work: IWork, user: IUser): Promise<void> {
        if (work.categorySlug === 'software' && work.serviceSlug === 'client-server-generator') {
            let csgenUser: any = await csgeneratorMongo.db.collection('users').findOne({ email: user.email });
            if (csgenUser) {
                await csgeneratorMongo.db.collection('users').updateOne(
                    { email: user.email },
                    {
                        $set: {
                            tokens: (csgenUser?.tokens ?? 0) + work.tokens,
                            updatedAt: new Date(), updatedBy: 'Gadzy Work',
                        }
                    }
                );
            } else {
                csgenUser = await csgeneratorMongo.db.collection('users').insertOne({
                    email: user.email,
                    emailConfirmed: user.emailConfirmed,
                    fullName: user.fullName,
                    password: user.password,
                    mfa: user.mfa,
                    roles: ['user'],
                    refreshToken: 'remake',
                    salt: user.salt,
                    createdBy: 'Gadzy Work',
                    updatedBy: 'Gadzy Work',
                    claims: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    generatingProject: false,
                    tokens: work.tokens ?? 0
                });
            }
        }
    }

}

export default CSGeneratorService.getInstance();
