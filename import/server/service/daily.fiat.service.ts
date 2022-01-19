import { FiatRate, DailyFiatRate, Profile, ResultCode, ReadPref } from "../models";
import { ServerUtil, LogUtil, DecimalUtil } from "../lib";
import { DailyFiatRateCollection } from "../collections";
import { IfObservable } from "rxjs/observable/IfObservable";

export class _DailyFiatService {
    async getDailyFiatListWithinYear(src, target, limit) {
        LogUtil.info({ console : 'getDailyFiatListWithinYear'}, true);
        
        if (!src || !target) {
            LogUtil.error({ messgae : 'getDailyFiatListWithinYear() : invalid param. src / target : ' + src + ' / ' + target});
            return [];
        }

        let todayNineDate = new Date().setHours(9, 0, 0);
        let beforeYearDate = new Date(todayNineDate - 31536000000);

        let dailyFiatList = [];
        try {
            dailyFiatList = await DailyFiatRateCollection.find({ src: src, target: target, inDt: { $gte: beforeYearDate } }, { sort: { inDt: -1 }, limit : limit, readPreference: ReadPref.SECONDARY_PREFERRED });
        } catch (err) {
            LogUtil.error({ e: 'getDailyFiatListWithinYear(): ' + err.message });
            return [];
        }

        return dailyFiatList;
    }

    public initValue(fiatrate: FiatRate) {
        if (!fiatrate) {
            LogUtil.error({ e: 'dailyFiatrate.initValue(): fiatrate is undefined.', fiatrate });
            return undefined;
        }

        let dailyFiatRate: DailyFiatRate = {
            src: fiatrate.src,
            target: fiatrate.target,
            highPrice: fiatrate.highPrice,
            lowPrice: fiatrate.lowPrice,
            presentPrice: fiatrate.presentPrice,
            prevClosingPrice: fiatrate.prevClosingPrice,
            openingPrice: fiatrate.openingPrice,
            dailySellAmount: fiatrate.kind == 'buy' ? 0 : fiatrate.amount,
            dailyBuyAmount: fiatrate.kind == 'sell' ? 0 : fiatrate.amount,
            dailyTradingValue: DecimalUtil.floorDecimalPoint(fiatrate.amount * fiatrate.presentPrice, 8),
            highPriceUpDt: fiatrate.highPriceUpDt,
            lowPriceUpDt: fiatrate.lowPriceUpDt
        }

        return dailyFiatRate;
    }
    public async updateDailyFiat(dailyFiat: DailyFiatRate) {
        if (!dailyFiat) {
            LogUtil.error({ e: 'dailyFiatrate.updateDailyFiat(): dailyFiat is undefined.', dailyFiat });
            return { code: ResultCode.ERROR };
        }

        let result;
        let storedDailyFiat;
        let todayNineDate = new Date();
        todayNineDate.setHours(9, 0, 0, 0);
        let yesterdayNineDate = new Date(todayNineDate.getTime() - 86400000);        

        try {
            if (new Date() < todayNineDate) {
                storedDailyFiat = DailyFiatRateCollection.findOne({ src: dailyFiat.src, target: dailyFiat.target, inDt: { $gte: yesterdayNineDate } });                
            } else {
                storedDailyFiat = DailyFiatRateCollection.findOne({ src: dailyFiat.src, target: dailyFiat.target, inDt: { $gte: todayNineDate } });                
            }       

            if (!storedDailyFiat) {
                dailyFiat.inDt = todayNineDate;
                result = await DailyFiatRateCollection.rawCollection().insert(dailyFiat);
                if (!result) {
                    LogUtil.error({ e: 'dailyFiatrate.updateDailyFiat(): dailyFiatrate insert 실패.', dailyFiat });
                }
            } else {
                dailyFiat.dailyBuyAmount = DecimalUtil.floorDecimalPoint(dailyFiat.dailyBuyAmount + storedDailyFiat.dailyBuyAmount, 8);
                dailyFiat.dailySellAmount = DecimalUtil.floorDecimalPoint(dailyFiat.dailySellAmount + storedDailyFiat.dailySellAmount, 8);
                dailyFiat.dailyTradingValue = DecimalUtil.floorDecimalPoint(dailyFiat.dailyTradingValue + storedDailyFiat.dailyTradingValue, 8);
                result = await DailyFiatRateCollection.update({ _id: storedDailyFiat._id }, { $set: dailyFiat }).first().toPromise()
                if (!result) {
                    LogUtil.error({ e: 'dailyFiatrate.updateDailyFiat(): dailyFiatrate update 실패.', dailyFiat });
                }
            }
        } catch (err) {
            LogUtil.error({ e: 'updateDailyFiat(): ' + err.message });
            return { code: ResultCode.ERROR };
        }
    }
}
export const DailyFiatService = new _DailyFiatService();