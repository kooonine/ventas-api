import { LogUtil } from "../lib";
import { CompanyAssetCollection } from "../collections";
import { Trade, CompanyAsset, ResultCode } from "../models";

export class _CompanyAssetService {

    public getCompanyAsset(src: string, code: string) {
        if (!src || !code) {
            LogUtil.error({ e: 'getCompanyAsset(): param is undefined.', src, code })
            return undefined;
        }

        let companyAsset;
        try {
            companyAsset = CompanyAssetCollection.findOne({ src: src, code: code, useYn: true });
        } catch (err) {
            LogUtil.error({ e: 'getCompanyAsset(): ' + err.message });
            return undefined;
        }

        return companyAsset;
    }

    public getCompanyAssetWithTarget(assetCode: string){
        if (!assetCode) {
            return undefined;
        }

        let companyAsset = undefined;

        try {
            companyAsset = CompanyAssetCollection.findOne({ 'code': assetCode });
        } catch (err) {
            LogUtil.error({ e: 'getCompanyAssetWithTarget(): ' + err.message });
            return undefined;
        }

        return companyAsset;
    }

    getCompanyAssetCode( target: string) {
        if (!target) {
            return undefined;
        }

        let companyAsset = undefined;

        try {
            companyAsset = CompanyAssetCollection.findOne({ src : {$ne : 'KRW'}, 'code': target });
        } catch (err) {
            LogUtil.error({ e: 'getCompanyAssetCode(): ' + err.message });
            return undefined;
        }

        return companyAsset;
    }
    
    public async setMaxCoinAmount(_id: string, maxCoinAmount: number) {
        if (!_id) {
            LogUtil.error({ e: 'setMaxCoinAmount(): param is undefined. ' });
            return { code: ResultCode.ERROR };
        }

        let result;
        try {
            result = await CompanyAssetCollection.update({ _id: _id }, { $set: { maxCoinAmount: maxCoinAmount } }).first().toPromise();

            if (!result) {
                LogUtil.error({ e: 'setMaxCoinAmount(): param is undefined. ', result });
                return { code: ResultCode.ERROR };
            }
        } catch (err) {
            LogUtil.error({ e: 'setMaxCoinAmount(): ' + err.message });
            return { code: ResultCode.ERROR };
        }

        return { code: ResultCode.ERROR }
    }

    public initCompanyAsset(trade: Trade, companyAsset: CompanyAsset) {
        if (!companyAsset || !trade) {
            LogUtil.error({ id: Meteor.userId(), message: "initCompanyAsset():파라미터 에러.", trade, companyAsset });
            return undefined;
        }
        companyAsset.prevPresentPrice = companyAsset.presentPrice;
        companyAsset.presentPrice = trade.price;

        if(trade.src == 'USDT'){
            if(trade.target == 'BTC' || trade.target == 'ETH'){
                try {
                    this.setStandardclosingPrice(trade);
                } catch (error) {
                    LogUtil.error({ id: Meteor.userId(), message: "usdtsetStandardclosingPrice():파라미터 에러.", trade });
                }
            }
        }
        if(trade.src == 'KRW'){
            if(trade.target == 'VENC' || trade.target == 'USDT' || trade.target == 'BTC'){
                try {
                    this.setStandardclosingPrice(trade);
                } catch (error) {
                    LogUtil.error({ id: Meteor.userId(), message: "krw setStandardclosingPrice():파라미터 에러.", trade });
                }
            }
        }

        if (companyAsset.lowPrice > trade.price) {
            companyAsset.lowPrice = trade.price;
        } else if (companyAsset.highPrice < trade.price) {
            companyAsset.highPrice = trade.price;            
        }
        
        if (companyAsset.lowPriceWithinYear > trade.price) {
            companyAsset.lowPriceWithinYear = trade.price;
            companyAsset.lowPriceUpDt = new Date();
        } else if (companyAsset.highPriceWithinYear < trade.price) {
            companyAsset.highPriceWithinYear = trade.price;
            companyAsset.highPriceUpDt = new Date();
        }

        if (companyAsset.openingPrice == 0) {
            companyAsset.openingPrice = trade.price;
        }

        return companyAsset;
    }

    async setCompanyAsset(companyAsset: CompanyAsset) {
        if (!companyAsset) {
            LogUtil.error({ e: 'updateCompanyAsset():파라미터 에러.', companyAsset });
            return { code: ResultCode.ERROR }
        }

        let result;
        try {
            result = await CompanyAssetCollection.update({ 'src': companyAsset.src, 'code': companyAsset.code }, { $set: companyAsset }).first().toPromise();
            if (!result) {
                LogUtil.error({ e: 'companyAsset 업데이트 실패.', companyAsset });
                return { code: ResultCode.ERROR }
            }
        } catch (err) {
            LogUtil.error({ e: 'updateCompanyAsset(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    }

    public isTradePossible(src: string, target: string) {
        if (!src || !target) {
            LogUtil.error({ e: "isTradePossible(): param is undefined.", src, target });
            return false;
        }

        try {
            let companyAsset = this.getCompanyAsset(src, target);
            if (!companyAsset || !companyAsset.tradeYn || !companyAsset.useYn) {
                return false;
            }

        } catch (err) {
            LogUtil.error({ e: "isTradePossible(): param is undefined.", src, target });
            return false;
        }

        return true;
    }

    public isTransferPossible(target: string) {
        if (!target) {
            LogUtil.error({ e: "isTransferPossible(): param is undefined.", target })
            return false;
        }

        try {
            let companyAsset = CompanyAssetCollection.findOne({ code: target });
            if (!companyAsset || !companyAsset.withdrawYn) {
                return false;
            }

        } catch (err) {
            LogUtil.error({ e: "isTransferPossible(): param is undefined.", target });
            return false;
        }

        return true;

    }

    getAssetName(code: string) {
        let companyAsset = CompanyAssetCollection.findOne({ 'code': code });

        if (!companyAsset) {
            LogUtil.error({ method: 'getAssetName(): ', code });
            return code;
        }

        return companyAsset.name;
    }

    async setStandardclosingPrice(trade : Trade) {
        if (!trade) {
            LogUtil.error({ e: 'setStandardclosingPrice():파라미터 에러.', trade });
            return { code: ResultCode.ERROR }
        }
        let listYn = [];
        listYn = await CompanyAssetCollection.find({src : trade.target});
        if(listYn.length < 1){
            return
        }

        let result;
        try {
            if(trade.src == 'USDT'){
                result = await CompanyAssetCollection.update({  'src': trade.target }, { $set: {'USDTclosingPrice' : trade.price}},{multi : true}).first().toPromise();
            }else if(trade.src == 'KRW'){
                result = await CompanyAssetCollection.update({  'src': trade.target }, { $set: {'KRWclosingPrice' : trade.price}},{multi : true}).first().toPromise();
            }
            
            if (!result) {
                LogUtil.error({ e: 'setStandardclosingPrice 업데이트 실패.', trade });
                return { code: ResultCode.ERROR }
            }
        } catch (err) {
            LogUtil.error({ e: 'setStandardclosingPrice(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    }

}
export const CompanyAssetService = new _CompanyAssetService();