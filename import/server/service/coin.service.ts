import { LogUtil, FetchUtil } from "../lib";
import { ResultCode } from "../models";


export class _CoinService {

    public async sendCoin(assetCode: string, toAddress: string, amount: number, userId: string, transferId: string, destTag?: string) {
        if (!assetCode || !toAddress || !Number(amount) || !userId || !transferId) {
            LogUtil.error({ e: "sendCoin(): invalid param." });
            return { code: ResultCode.ERROR };
        }

        let cfg = Meteor.settings.private["COIN_QUEUE"];
        if (!cfg || !cfg.host || !cfg.port || !cfg.privateKey) {
            LogUtil.error({ e: "sendCoin(): cfg is undefined.", assetCode, toAddress, amount, userId, transferId, destTag, cfg });
            return { code: ResultCode.ERROR };
        }

        try {
            let url = cfg.host + ':' + cfg.port + '/send/' + assetCode + '/' + toAddress + '/' + amount + '/' + transferId + '/' + cfg.privateKey;
            let result = await FetchUtil.get(url);

            if (!result) {
                LogUtil.error({ e: "sendCoin(): result is undefined.", assetCode, userId });
                return { code: ResultCode.ERROR };
            }

            let parsedResult = await result.json();
            if (!parsedResult || parsedResult.code != 200) {
                LogUtil.error({ e: "sendCoin(): result is undefined.", assetCode, userId, parsedResult });
                return { code: ResultCode.ERROR };
            }

        } catch (err) {
            LogUtil.error({ e: "sendCoin(): " + err.message , assetCode, userId, cfg });
            return { code: ResultCode.ERROR };
        }

        return { code: ResultCode.SUC };
    }

    public async getNewAddress(assetCode: string, userId: string) {
        if (!assetCode || !userId) {
            LogUtil.error({ e: "getNewAddress(): invalid param.", assetCode, userId });
            return undefined;
        }

        let cfg = Meteor.settings.private["COIN_QUEUE"];
        if (!cfg || !cfg.host || !cfg.port || !cfg.privateKey) {
            LogUtil.error({ e: "getNewAddress(): cfg is undefined.", assetCode, userId, cfg });
            return undefined;
        }

        let address;

        try {
            let url = cfg.host + ':' + cfg.port + '/coinAddr/' + assetCode + '/' + userId + '/' + cfg.privateKey;
            let result = await FetchUtil.get(url);

            if (!result) {
                LogUtil.error({ e: "getNewAddress(): result is undefined.", assetCode, userId });
                return undefined;
            }

            let parsedResult = await result.json();
            if (!parsedResult || parsedResult.code != 200 || !parsedResult.result) {
                LogUtil.error({ e: "getNewAddress(): result is undefined.", assetCode, userId, parsedResult });
                return undefined;
            }

            address = parsedResult.result;
        } catch (err) {
            LogUtil.error({ e: "getNewAddress(): cfg is undefined.", assetCode, userId, cfg });
            return undefined;
        }

        return address;
    }
    
}
export const CoinService = new _CoinService();