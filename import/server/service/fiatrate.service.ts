import { CompanyAsset, FiatRate, ResultCode } from "../models";
import { LogUtil } from "../lib";
import { RedisService } from "./redis.service";
import { FiatRateCollection } from "../collections";

export class _FiatrateService {

    public initValue(companyAsset: CompanyAsset, tradeAmount: number, storedOrderKind: string): FiatRate {
        if (!companyAsset || !tradeAmount || !storedOrderKind) {
            LogUtil.error({ e: "fiatrate.initValue():파라미터 에러.", tradeAmount, companyAsset, storedOrderKind });
            return undefined;
        }

        var fiatRate: any = {};
        fiatRate['src'] = companyAsset.src;
        fiatRate['target'] = companyAsset.code;
        fiatRate['kind'] = storedOrderKind;
        fiatRate['ts'] = new Date().getTime();
        fiatRate['openingPrice'] = companyAsset.openingPrice;
        fiatRate['highPrice'] = companyAsset.highPrice;
        fiatRate['lowPrice'] = companyAsset.lowPrice;
        fiatRate['closePrice'] = companyAsset.prevPresentPrice;
        fiatRate['presentPrice'] = companyAsset.presentPrice;
        fiatRate['prevClosingPrice'] = companyAsset.prevClosingPrice;
        fiatRate['amount'] = tradeAmount;
        fiatRate['highPriceUpDt'] = companyAsset.highPriceUpDt;
        fiatRate['lowPriceUpDt'] = companyAsset.lowPriceUpDt;

        return fiatRate;
    }

    public async createFiat(fiatRate: FiatRate) {
        if (!fiatRate) {
            LogUtil.error({ e: 'createFiat(): invalid param.', fiatRate });
            return { code: ResultCode.ERROR };
        }

        let result;
        // redis에 cache 추가.
        try {
            RedisService.setFiatRate(fiatRate);

            result = await FiatRateCollection.insert(fiatRate).first().toPromise();
            if (!result) {
                LogUtil.error({ e: 'fiatRate 생성 실패.', fiatRate });
                return { code: ResultCode.ERROR };
            }
        } catch (err) {
            LogUtil.error({ e: 'createFiat(): ' + err.message });
            return { code: ResultCode.ERROR };
        }
    }


}
export const FiatrateService = new _FiatrateService();