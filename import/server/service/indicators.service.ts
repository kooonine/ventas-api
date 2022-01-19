import { LogUtil } from "../lib";
import { Users, IndicatorsCollection, UserWalletCollection } from "../collections";
import { ReadPref } from "../models";

export class _IndicatorsService {
    async getIndicatorsValue(id: string, coin: string) {
        if (!id) {
            LogUtil.error({ e: 'getIndicatorsValue(): userId is undefined.' });
            return [];
        }
        try {
            let totalMembers = await Users.find();
            let amount = await IndicatorsCollection.find({ userId: id},{ readPreference: ReadPref.SECONDARY_PREFERRED } );
            let retentionMembers = await UserWalletCollection.find({assetCode:coin, balance: {$ne :0 }}, { readPreference: ReadPref.SECONDARY_PREFERRED });
            let result = {
                totalM: totalMembers.length,
                retentionM: retentionMembers.length,
                amountC: amount
            }
            return result;
        }
        catch (err) {
            LogUtil.error({ e: 'getIndicatorsValue(): ' + err.message });
            return [];
        }
    }
}


export const IndicatorsService = new _IndicatorsService();