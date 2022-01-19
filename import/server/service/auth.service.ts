import { Users, CertsColls, HistoryCollection } from "../collections";
import { LogUtil, ServerUtil } from "../lib";
import { ReadPref } from "../models";

export class _authService {
    getUserByEmail(email: string) {
        let user;
        
        try {
            user = Users.findOne({ 'emails.address': email });

            if (!user) {
                return undefined;
            }
        } catch (err) {
            LogUtil.error({ e: 'getUserByEmail(): ' + err.message });
            return;
        }

        return user;
    }

    async createEnc(type: string = 'new', email: string = '', sucUrl, failUrl) {
        let cert: any = {};
        cert.certType = 'nice';
        if (type == 'reg' && email) {
            cert.userId = email;
        } else {
            cert.userId = Meteor.userId();
        }
        cert.certYn = false;

        let id;
        try {
            id = await CertsColls.collection.insert(cert);
        } catch (err) {
            LogUtil.error({ e : 'createEnc() exception.. ' + err.message });
            return undefined;
        }

        const enc = await ServerUtil.getNiceId(id, type, sucUrl, failUrl);

        CertsColls.collection.update(id, {
            $set: {
                cert: enc
            }
        });
        cert.enc = enc;
        cert._id = id;
        return cert;
    }

    async getMyLoginHistory() {
        let userId = Meteor.userId();
        
        if (!userId) {
            LogUtil.error({ e: 'getMyLoginHistory(): userId is undefined. ' })
            return [];
        }

        let myLoginHistoryList = [];

        try {
            myLoginHistoryList = await HistoryCollection.find({ owner: userId, category: 'login' }, { sort: { inDt: -1 }, readPreference: ReadPref.SECONDARY_PREFERRED });            
        } catch (err) {
            LogUtil.error({ e: 'getMyLoginHistory(): ' + err.message });
            return [];
        }

        return myLoginHistoryList;
    }
}
export const AuthService = new _authService();