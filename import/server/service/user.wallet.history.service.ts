import { UserWalletHistoryCollection } from "../collections/user.wallet.history.collection";
import { UserWallet, UserWalletHistory, UserWalletHistoryType, ResultCode } from "../models";
import { LogUtil, ServerUtil, DecimalUtil } from "../lib";

export class _UserWalletHistoryService {

    public async createWalletHistory(prevUserWallet: UserWallet, laterUserWallet: UserWallet, userWalletHistoryType: UserWalletHistoryType) {
        let userWalletHistory = this.initWalletHistory(prevUserWallet, laterUserWallet, userWalletHistoryType);
        if (!userWalletHistory) {
            LogUtil.error({ e: 'insertWalletHistory(): userwalletHistory is undefined.' });
            return { code: ResultCode.ERROR };
        }

        let result;
        try {
            result = await UserWalletHistoryCollection.insert(userWalletHistory).first().toPromise();

            if (!result) {
                LogUtil.error({ e: 'insertWalletHistory(): insertion is failed.' });
                return { code: ResultCode.ERROR };
            }
        } catch (err) {
            LogUtil.error({ e: 'insertWalletHistory(): ' + err.message });
            return { code: ResultCode.ERROR };
        }

        LogUtil.info({ i: ' wallet his: ', userWalletHistory }, true);

        return { code: ResultCode.SUC, _id: result };
    }

    private initWalletHistory(prevUserWallet: UserWallet, laterUserWallet: UserWallet, userWalletHistoryType: UserWalletHistoryType) {
        if (!prevUserWallet || !laterUserWallet || !userWalletHistoryType) {
            LogUtil.error({ e: 'initWalletHistory(): userwallet is undefined.' });
            return undefined;
        }

        let walletHistory: UserWalletHistory = {
            walletId: prevUserWallet._id,
            walletCode: prevUserWallet.assetCode,
            prevAvailable: prevUserWallet.strAvailable,
            prevBalance: prevUserWallet.strBalance,
            available: DecimalUtil.sub(laterUserWallet.strAvailable, prevUserWallet.strAvailable, true),
            balance: DecimalUtil.sub(laterUserWallet.strBalance, prevUserWallet.strBalance, true),
            laterAvailable: laterUserWallet.strAvailable,
            laterBalance: laterUserWallet.strBalance,
            type: userWalletHistoryType
        }

        return walletHistory;
    }

}
export const UserWalletHistoryService = new _UserWalletHistoryService();